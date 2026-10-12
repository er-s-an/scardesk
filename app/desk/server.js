#!/usr/bin/env node
/** Scardesk desk. Reads the program and submits the same instructions the agent uses. */

const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  APP_ROOT,
  CONFIG_PATH,
  DeskClient,
  loadKey,
  eventsFromLogs,
  hasSessionReject,
  isRateLimit,
  withBackoff,
  Connection,
  PublicKey,
} = require("../client/src/chain");
const math = require("../client/src/math");
const layout = require("../client/src/layout");
const { createAgent, TOOLS } = require("../client/src/agent");
const { fetchSolUsd } = require("../client/src/price");
const { createRuntime } = require("../client/src/markets-runtime");
const marketsRt = createRuntime();

const PORT = Number(process.env.PORT || 8787);
const PUBLIC = path.join(__dirname, "public");

function loadDotEnv() {
  const file = path.join(APP_ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

function readDeployment() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function readNetworks() {
  try {
    return JSON.parse(fs.readFileSync(path.join(APP_ROOT, "config", "networks.json"), "utf8"));
  } catch {
    return {};
  }
}

function resolveNet() {
  const nets = readNetworks();
  const named = process.env.SCARDESK_NETWORK || "";
  let deployment = readDeployment();
  let deploymentFile = "deployment.json";
  let missingDeployment = false;
  if (named) {
    deploymentFile = "deployment." + named + ".json";
    const specific = path.join(APP_ROOT, "config", deploymentFile);
    if (fs.existsSync(specific)) {
      deployment = JSON.parse(fs.readFileSync(specific, "utf8"));
    } else {
      missingDeployment = true;
      deploymentFile = "deployment.json";
    }
  }
  if (named && nets[named] && nets[named].refused && process.env.SCARDESK_ALLOW_MAINNET !== "1") {
    console.error("Refusing " + named + ". This desk settles demo stable, not mainnet funds.");
    process.exit(1);
  }
  const network = named || deployment.network || "localnet";
  const fromFile = named && nets[named] ? nets[named].rpc : "";
  const rpc = process.env.SCARDESK_RPC || fromFile || deployment.rpc || (nets.localnet && nets.localnet.rpc) || "http://127.0.0.1:8899";
  return { rpc, network, asked: named, missingDeployment, deploymentFile };
}

const resolved = resolveNet();
const RPC = resolved.rpc;
let networkName = resolved.network;
let priceFeed = { ok: false, note: "not fetched yet" };

const keys = {
  admin: loadKey("admin.json"),
  alice: loadKey("alice.json"),
  bob: loadKey("bob.json"),
  session: loadKey("alice-session.json"),
};
const program = loadKey("program.json");
const connection = new Connection(RPC, {
  commitment: "confirmed",
  // The client retries 429 itself. web3's built-in burst shares OnFinality's budget.
  disableRetryOnRateLimit: true,
});

async function pollConfirmed(sig) {
  const started = Date.now();
  let wait = 1200;
  while (Date.now() - started < 40000) {
    try {
      const tx = await connection.getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx) return tx;
    } catch (err) {
      if (!isRateLimit(err)) throw err;
      wait = Math.min(wait * 2, 8000);
    }
    await new Promise((r) => setTimeout(r, wait));
  }
  const err = new Error("The transaction was sent. The RPC has not confirmed it yet. Wait, then retry.");
  err.signature = sig;
  throw err;
}
const client = new DeskClient(connection, program.publicKey);

const log = [];
function pushLog(entry) {
  log.unshift({ t: new Date().toISOString(), ...entry });
  if (log.length > 80) log.pop();
}

function loadProofs() {
  const read = (rel) => {
    const file = path.join(APP_ROOT, rel);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };
  const local = read("demo/last-run.json");
  const pub = read("demo/public-proof.json");
  if (!local && !pub) return null;
  const signatures = { ...(local && local.signatures), ...(pub && pub.signatures) };
  if (local && local.scarMintSig && !signatures.scarMint) signatures.scarMint = local.scarMintSig;
  return {
    ...(local || {}),
    ...(pub && pub.ok ? pub : {}),
    signatures,
    explorer: (pub && pub.explorer) || {},
    local: local ? { network: "localnet", signatures: local.signatures } : null,
    public: pub,
  };
}

function actorOf(name) {
  if (!keys[name]) throw new Error("unknown actor");
  return keys[name];
}

function ownerFor(name) {
  if (name === "session") return keys.alice;
  if (name === "admin") return keys.admin;
  return keys[name];
}

function json(res, code, body) {
  const text = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(text);
}

function pendingOf(user, desk) {
  if (!user || !desk) return 0n;
  const scale = 1_000_000_000_000n;
  const accrued = (user.staked * desk.accReward) / scale;
  const delta = accrued > user.rewardDebt ? accrued - user.rewardDebt : 0n;
  return user.claimable + delta;
}

async function view(focus, opts = {}) {
  const owners = [keys.alice.publicKey, keys.bob.publicKey];
  let focusOwner;
  if (focus === "wallet") {
    if (!opts.owner) throw new Error("connected wallet has no public key yet");
    focusOwner = new PublicKey(opts.owner);
    owners.push(focusOwner);
  } else {
    focusOwner = ownerFor(focus).publicKey;
  }
  const snap = await client.snapshot(owners);
  const names = {
    [keys.alice.publicKey.toBase58()]: "Alice",
    [keys.bob.publicKey.toBase58()]: "Bob",
  };
  if (focus === "wallet") names[focusOwner.toBase58()] = "You";
  const asSession = focus === "wallet" ? opts.as === "session" : focus === "session";
  const user = snap.users[focusOwner.toBase58()] || null;
  const desk = snap.desk;
  const positions = snap.positions.map((p) => {
    const mark = snap.price ? snap.price.price : 0n;
    const upnl = p.status === 0 ? math.calcPnl(p.side, p.entryPrice, mark, p.notional) : p.pnl;
    const liqNow = p.status === 0 && snap.price ? math.isLiquidatable(p.side, mark, p.liqPrice) : false;
    return {
      id: p.id.toString(),
      owner: p.owner,
      who: names[p.owner] || p.owner.slice(0, 4),
      side: p.side === 0 ? "long" : "short",
      status: p.status === 0 ? "open" : p.status === 2 ? "liquidated" : "closed",
      fundFrom: p.fundFrom === 1 ? "queued" : "balance",
      leverage: p.leverage,
      margin: math.fmtMicro(p.margin),
      notional: math.fmtMicro(p.notional),
      mark: snap.price ? math.fmtPrice(snap.price.price) : "",
      entry: math.fmtPrice(p.entryPrice),
      exit: p.status === 0 ? "" : math.fmtPrice(p.exitPrice),
      liq: math.fmtPrice(p.liqPrice),
      upnl: upnl === null ? "0" : math.fmtMicro(upnl),
      upnlRaw: upnl === null ? "0" : upnl.toString(),
      scar: math.fmtMicro(p.scarMinted),
      scarRaw: p.scarMinted.toString(),
      queuedCredit: math.fmtMicro(p.queuedCredit),
      paid: math.fmtMicro(p.paidOut),
      liqNow,
      mine: p.owner === focusOwner.toBase58(),
    };
  });
  let ahead = 0n;
  let distance = 0;
  let seenMine = false;
  const queue = snap.queue.map((n) => {
    const mine = user && n.owner === focusOwner.toBase58() && n.status === 0;
    if (n.status === 0 && !seenMine) {
      if (mine) seenMine = true;
      else {
        distance += 1;
        ahead += n.remaining;
      }
    }
    return {
      index: n.index.toString(),
      who: names[n.owner] || n.owner.slice(0, 4),
      owner: n.owner,
      status: n.status === 0 ? "active" : "paid",
      kind: n.kind === 1 ? "margin" : "profit",
      total: math.fmtMicro(n.total),
      remaining: math.fmtMicro(n.remaining),
      positionId: n.positionId.toString(),
      mine: !!(user && n.owner === focusOwner.toBase58()),
    };
  });
  if (!seenMine) {
    distance = null;
    ahead = 0n;
  }
  const freeScar = user ? user.scar - user.staked : 0n;
  let marginInUse = 0n;
  let openUpnl = 0n;
  const focusKey = focusOwner.toBase58();
  for (const p of snap.positions) {
    if (p.owner !== focusKey || p.status !== 0) continue;
    marginInUse += p.margin;
    const mark = snap.price ? snap.price.price : p.entryPrice;
    const upnl = math.calcPnl(p.side, p.entryPrice, mark, p.notional);
    if (upnl !== null) openUpnl += upnl;
  }
  const walletAccount = await client.raw(client.walletPda(focusOwner));
  let walletDusd = "0";
  try {
    if (walletAccount && walletAccount.data && walletAccount.data.length >= 72) {
      walletDusd = math.fmtMicro(layout.tokenAmount(Buffer.from(walletAccount.data)));
    }
  } catch {
    walletDusd = "0";
  }
  let sol = "0";
  try {
    const lamports = await withBackoff(() => connection.getBalance(focusOwner));
    sol = (lamports / 1e9).toFixed(3);
  } catch {
    sol = "—";
  }
  const signerPk = focus === "wallet"
    ? (asSession && user && user.hasSession ? user.session : focusKey)
    : actorOf(focus).publicKey.toBase58();
  const activeMarket = marketsRt.getActive();
  const marketMeta = marketsRt.getMarket(activeMarket);
  const namesForBook = names;
  // On-chain positions are SOL/USD on the single desk PDA.
  const chainPositions = positions.map((p) => ({ ...p, market: "SOL/USD", onChain: true, deskBook: false }));
  const bookRows = marketsRt.bookPositions(focusKey, namesForBook, marketMeta.onChain ? null : activeMarket);
  const viewPositions = marketMeta.onChain
    ? chainPositions
    : bookRows;
  const overlayPrice = marketsRt.priceView(activeMarket, snap.price);
  const overlayFeed = marketsRt.feedView(activeMarket);

  return {
    network: networkName,
    rpc: RPC,
    focus,
    asSession,
    market: activeMarket,
    markets: marketsRt.marketsPayload(),
    marketNote: marketMeta.note || "",
    marketOnChain: !!marketMeta.onChain,
    priceFeed: {
      ok: !!overlayFeed.ok,
      market: activeMarket,
      source: overlayFeed.source || "",
      cluster: overlayFeed.cluster || "",
      note: overlayFeed.note || "",
      publishTime: overlayFeed.publishTime || "",
      provisional: !!overlayFeed.provisional,
      clamped: !!overlayFeed.clamped,
      pushError: overlayFeed.pushError || "",
      account: overlayFeed.account || "",
    },
    link: {
      network: networkName,
      rpc: RPC,
      asked: resolved.asked,
      missingDeployment: resolved.missingDeployment,
      deploymentFile: resolved.deploymentFile,
    },
    price: overlayPrice.raw && overlayPrice.raw !== "0"
      ? { text: overlayPrice.text, source: overlayPrice.source, raw: overlayPrice.raw, market: activeMarket, onChain: !!overlayPrice.onChain, provisional: !!overlayPrice.provisional }
      : null,
    now: snap.now.toString(),
    addresses: snap.addresses,
    desk: desk
      ? {
          maxLeverage: desk.maxLeverage,
          haircutBps: desk.haircutBps,
          liqFractionBps: desk.liqFractionBps,
          emission: desk.emission.toString(),
          minMargin: math.fmtMicro(desk.minMargin),
          lp: math.fmtMicro(desk.lpCash),
          reserved: math.fmtMicro(desk.reservedFees),
          freeLp: math.fmtMicro(math.lpFreeOf(desk)),
          queueLen: desk.queueLen.toString(),
          queueHead: desk.queueHead.toString(),
          totalScar: math.fmtMicro(desk.totalScar),
          totalStaked: math.fmtMicro(desk.totalStaked),
          oracleMaxAge: desk.oracleMaxAge.toString(),
          fixture: math.fmtPrice(desk.fixturePrice),
        }
      : null,
    scarSupply: math.fmtMicro(snap.scarSupply),
    vault: math.fmtMicro(snap.vaultAmount),
    actor: user
      ? {
          name: focus,
          pubkey: focusKey,
          signer: signerPk,
          balance: math.fmtMicro(user.balance),
          queued: math.fmtMicro(user.queued),
          marginInUse: math.fmtMicro(marginInUse),
          openUpnl: math.fmtMicro(openUpnl),
          scar: math.fmtMicro(user.scar),
          staked: math.fmtMicro(user.staked),
          freeScar: math.fmtMicro(freeScar),
          claimable: math.fmtMicro(pendingOf(user, desk)),
          hasSession: user.hasSession,
          session: user.session,
          openCount: user.openCount,
          hasWallet: !!walletAccount,
          walletDusd,
          sol,
          asSession,
        }
      : {
          name: focus,
          pubkey: focusKey,
          signer: signerPk,
          missing: true,
          hasWallet: !!walletAccount,
          walletDusd,
          sol,
          marginInUse: "0",
          openUpnl: "0",
          asSession,
        },
    positions: viewPositions,
    queue,
    queueDistance: distance,
    queueAhead: math.fmtMicro(ahead),
    log,
    proofs: loadProofs(),
    tools: TOOLS,
  };
}

async function run(focus, op, body) {
  if (op === "oracle" || op === "fixture" || op === "stale-oracle") {
    let result;
    if (op === "oracle") {
      const price = math.toMicro(body.price) * 100n;
      result = await client.pushOracle(keys.admin, price, 0n);
      pushLog({ actor: "operator", tool: "oracle.push", detail: "Pyth path " + body.price, sig: result.sig });
    } else if (op === "fixture") {
      const price = math.toMicro(body.price) * 100n;
      result = await client.setFixture(keys.admin, price);
      pushLog({ actor: "operator", tool: "fixture.set", detail: body.price, sig: result.sig });
    } else {
      result = await client.pushOracle(keys.admin, math.toMicro(body.price || "1") * 100n, 1n);
      pushLog({ actor: "operator", tool: "oracle.stale", detail: "publish_time=1 so fixture is used", sig: result.sig });
    }
    return result;
  }
  if (op === "liquidate") {
    let posOwner = ownerFor(focus === "wallet" || focus === "admin" ? "alice" : focus).publicKey;
    if (body.owner) {
      posOwner = body.owner === "bob" || body.owner === "alice"
        ? keys[body.owner].publicKey
        : new PublicKey(body.owner);
    }
    const result = await client.close({
      signer: keys.admin,
      owner: posOwner,
      positionIds: body.positionIds,
      asLiquidation: true,
      keeper: keys.admin,
    });
    const events = eventsFromLogs(result.logs);
    pushLog({
      actor: "operator",
      tool: "liquidate",
      detail: "positions " + (body.positionIds || []).join(","),
      sig: result.sig,
      events,
    });
    return { ...result, events };
  }
  const signer = actorOf(focus);
  const ownerKp = ownerFor(focus);
  const ownerKey = ownerKp.publicKey;
  if (op === "faucet") {
    // Prefer permissionless demo faucet (owner signs). Falls back to admin mint if needed.
    let result;
    try {
      result = await client.demoFaucet(ownerKp);
      pushLog({ actor: focus, tool: "faucet", detail: "demo faucet 1000 dUSD (permissionless)", sig: result.sig });
    } catch (err) {
      result = await client.faucet(keys.admin, ownerKey, body.amount || "1000");
      pushLog({ actor: "admin", tool: "faucet", detail: "admin mint fallback", sig: result.sig });
    }
    return result;
  }
  if (op === "deposit") {
    const result = await client.deposit(ownerKp, body.amount);
    pushLog({ actor: focus, tool: "deposit", detail: body.amount + " dUSD", sig: result.sig });
    return result;
  }
  if (op === "withdraw") {
    const result = await client.withdraw(signer, ownerKey, body.amount);
    pushLog({ actor: focus, tool: "withdraw", detail: body.amount + " dUSD", sig: result.sig });
    return result;
  }
  if (op === "open") {
    const result = await client.open({
      signer,
      owner: ownerKey,
      side: body.side,
      margin: body.margin,
      leverage: Number(body.leverage),
      fundFrom: body.fundFrom || "balance",
    });
    pushLog({
      actor: focus,
      tool: "positions.open",
      detail: `${body.side} ${body.margin} dUSD @ ${body.leverage}× from ${body.fundFrom || "balance"}`,
      sig: result.sig,
      events: eventsFromLogs(result.logs),
    });
    return result;
  }
  if (op === "close") {
    const result = await client.close({
      signer,
      owner: ownerKey,
      positionIds: body.positionIds,
    });
    const events = eventsFromLogs(result.logs);
    pushLog({
      actor: focus,
      tool: "positions.close",
      detail: "positions " + body.positionIds.join(","),
      sig: result.sig,
      events,
    });
    return { ...result, events };
  }
  if (op === "stake" || op === "unstake") {
    const result = await client.stake(signer, ownerKey, body.amount, op === "unstake");
    pushLog({ actor: focus, tool: op === "stake" ? "paper.stake" : "paper.unstake", detail: body.amount + " SCAR", sig: result.sig });
    return result;
  }
  if (op === "claim") {
    const result = await client.claim(signer, ownerKey);
    pushLog({ actor: focus, tool: "paper.claim", detail: "claim reserved fees", sig: result.sig, events: eventsFromLogs(result.logs) });
    return result;
  }
  if (op === "arm-session") {
    const result = await client.setSession(keys.alice, keys.session.publicKey);
    pushLog({ actor: "alice", tool: "session.arm", detail: keys.session.publicKey.toBase58(), sig: result.sig });
    return result;
  }
  if (op === "clear-session") {
    const result = await client.clearSession(keys.alice);
    pushLog({ actor: "alice", tool: "session.clear", detail: "", sig: result.sig });
    return result;
  }
  if (op === "agent") {
    const tool = body.tool;
    if (!TOOLS.includes(tool)) {
      const err = new Error("Unknown tool. The agent cannot edit balances or mint freely.");
      err.status = 400;
      throw err;
    }
    const agent = createAgent({
      client,
      signer: keys.session,
      owner: keys.alice.publicKey,
      asset: "SOL",
    });
    let result;
    if (tool === "positions.open") result = await agent.positions.open(body.args || {});
    else if (tool === "positions.close") result = await agent.positions.close(body.args || {});
    else if (tool === "positions.closed") result = await agent.positions.closed(body.args || {});
    else if (tool === "account.retrieve") result = await agent.account.retrieve();
    else if (tool === "paper.stake") result = await agent.paper.stake(body.args || {});
    else if (tool === "paper.unstake") result = await agent.paper.unstake(body.args || {});
    else if (tool === "paper.claim") result = await agent.paper.claim();
    pushLog({
      actor: "session",
      tool,
      detail: JSON.stringify(body.args || {}),
      sig: result.sig || "",
      events: result.events || [],
      read: tool.endsWith("retrieve") || tool.endsWith("closed") ? result : undefined,
    });
    return result;
  }
  throw new Error("unknown op " + op);
}

async function prepareAgent(owner, ownerHandle, sessionPk, body) {
  const tool = body.tool;
  if (!TOOLS.includes(tool)) {
    const err = new Error("Unknown tool. The agent cannot edit balances or mint freely.");
    err.status = 400;
    throw err;
  }
  const signer = sessionPk ? { publicKey: sessionPk } : ownerHandle;
  const agent = createAgent({ client, signer, owner });
  if (tool === "positions.closed") {
    const result = await agent.positions.closed(body.args || {});
    pushLog({ actor: "wallet", tool, detail: JSON.stringify(body.args || {}), read: result });
    return { read: true, result, sig: null, logs: [] };
  }
  if (tool === "account.retrieve") {
    const result = await agent.account.retrieve();
    pushLog({ actor: "wallet", tool, detail: "balance " + result.balance, read: result });
    return { read: true, result, sig: null, logs: [] };
  }
  if (!sessionPk) {
    const err = new Error("Arm a session key before the agent signs.");
    err.status = 400;
    throw err;
  }
  const args = body.args || {};
  const built = await client.prepareAs(owner, async () => {
    if (tool === "positions.open") {
      return client.open({
        signer,
        owner,
        side: args.side,
        margin: args.margin,
        leverage: Number(args.leverage),
        fundFrom: args.fundFrom || "balance",
      });
    }
    if (tool === "positions.close") {
      const ids = args.positionIds || args.position_ids;
      return client.close({ signer, owner, positionIds: ids });
    }
    if (tool === "paper.stake") return client.stake(signer, owner, args.amount, false);
    if (tool === "paper.unstake") return client.stake(signer, owner, args.amount, true);
    if (tool === "paper.claim") return client.claim(signer, owner);
    throw new Error("unknown tool " + tool);
  });
  return {
    prepared: built.prepared,
    needsSession: true,
    needsOwner: true,
    tool,
    logs: [],
  };
}

async function broadcast(raw, skipPreflight) {
  try {
    const sig = await withBackoff(() => connection.sendRawTransaction(raw, {
      skipPreflight: !!skipPreflight,
      preflightCommitment: "confirmed",
    }));
    const tx = await pollConfirmed(sig);
    const logs = tx?.meta?.logMessages || [];
    const failed = !!tx.meta?.err;
    return { sig, logs, failed, err: tx.meta?.err || null };
  } catch (err) {
    const logs = err.logs || [];
    const wrapped = new Error(err.message || "send failed");
    wrapped.logs = logs;
    wrapped.signature = err.signature || null;
    throw wrapped;
  }
}

async function prepareWallet(body) {
  const owner = new PublicKey(body.owner);
  const ownerHandle = { publicKey: owner };
  const asSession = body.signer === "session";
  const sessionPk = body.session ? new PublicKey(body.session) : null;
  if (asSession && !sessionPk) throw new Error("arm a session key before signing as the session");
  const signer = asSession ? { publicKey: sessionPk } : ownerHandle;
  const op = body.op;

  if (op === "faucet") {
    if (!(await client.raw(client.walletPda(owner)))) {
      const err = new Error("Initialize the dUSD wallet before the faucet.");
      err.status = 400;
      throw err;
    }
    // Wallet signs permissionless demo faucet (same path as Pages trade.html).
    const prepared = await client.prepareAs(owner, () => client.demoFaucet(ownerHandle));
    return { prepared: prepared.prepared, adminSigned: false, events: [] };
  }
  if (op === "airdrop") {
    try {
      const lamports = networkName === "localnet" || RPC.includes("127.0.0.1") ? 1_000_000_000 : 1_000_000_000;
      const sig = await connection.requestAirdrop(owner, lamports);
      await pollConfirmed(sig);
      pushLog({ actor: "wallet", tool: "airdrop", detail: "1 SOL on " + networkName, sig });
      return { adminSigned: true, sig, logs: [] };
    } catch (err) {
      const adminBal = await connection.getBalance(keys.admin.publicKey);
      if (adminBal < 80_000_000) {
        const wrapped = new Error("The public faucet refused this request. The operator has no SOL to sponsor a fee.");
        wrapped.status = 400;
        throw wrapped;
      }
      const { SystemProgram, Transaction } = require("@solana/web3.js");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keys.admin.publicKey,
          toPubkey: owner,
          lamports: 50_000_000,
        })
      );
      const sig = await connection.sendTransaction(tx, [keys.admin]);
      await pollConfirmed(sig);
      pushLog({ actor: "operator", tool: "sponsor", detail: "0.05 SOL fee to " + owner.toBase58().slice(0, 4), sig });
      return { adminSigned: true, sig, logs: [], sponsored: true };
    }
  }
  if (op === "sync-price") {
    const quote = await syncPrice();
    return { adminSigned: true, sig: null, logs: [], quote };
  }
  if (op === "agent") {
    return prepareAgent(owner, ownerHandle, sessionPk, body);
  }

  const built = await client.prepareAs(owner, async () => {
    if (op === "init-user") return client.initUser(ownerHandle);
    if (op === "init-wallet") return client.initWallet(ownerHandle);
    if (op === "deposit") return client.deposit(ownerHandle, body.amount);
    if (op === "withdraw") return client.withdraw(signer, owner, body.amount);
    if (op === "arm-session") {
      if (!sessionPk) throw new Error("session public key required");
      const bal = await connection.getBalance(owner);
      if (bal < 60_000_000) {
        const err = new Error("Get fee SOL before arming a session. The session key pays position rent and still cannot withdraw.");
        err.status = 400;
        throw err;
      }
      const { SystemProgram } = require("@solana/web3.js");
      client.prefixIxs = [
        SystemProgram.transfer({
          fromPubkey: owner,
          toPubkey: sessionPk,
          lamports: 50_000_000,
        }),
      ];
      try {
        return await client.setSession(ownerHandle, sessionPk);
      } finally {
        client.prefixIxs = null;
      }
    }
    if (op === "clear-session") return client.clearSession(ownerHandle);
    if (op === "open") {
      return client.open({
        signer,
        owner,
        side: body.side,
        margin: body.margin,
        leverage: Number(body.leverage),
        fundFrom: body.fundFrom || "balance",
      });
    }
    if (op === "close") return client.close({ signer, owner, positionIds: body.positionIds });
    if (op === "stake" || op === "unstake") return client.stake(signer, owner, body.amount, op === "unstake");
    if (op === "claim") return client.claim(signer, owner);
    throw new Error("unknown op " + op);
  });
  return {
    prepared: built.prepared,
    needsSession: asSession,
    needsOwner: true,
    logs: [],
  };
}

const CLOCK = new PublicKey("SysvarC1ock11111111111111111111111111111111");

async function clusterUnix() {
  const info = await connection.getAccountInfo(CLOCK);
  if (!info || !info.data || info.data.length < 40) return null;
  return Buffer.from(info.data).readBigInt64LE(32);
}

function publishFits(publish, now, maxAge) {
  if (publish <= 0n || now == null) return false;
  if (publish > now + 5n) return false;
  const age = now - publish;
  if (age < 0n) return false;
  const limit = maxAge > 0n && maxAge < 120n ? maxAge : 120n;
  return age <= limit;
}

function rememberQuote(quote) {
  priceFeed = quote;
  try {
    fs.writeFileSync(
      path.join(APP_ROOT, "fixtures/hermes-last.json"),
      JSON.stringify({ ...quote, at: new Date().toISOString() }, null, 2)
    );
  } catch { /* fixture dir may be read-only in a static export */ }
}

let priceBusy = false;

async function pushSolOracle(quote) {
  const desk = await client.readDesk();
  if (!desk) return null;
  let publish = 0n;
  try { publish = BigInt(quote.publishTime || "0"); } catch { publish = 0n; }
  let now = null;
  try { now = await clusterUnix(); } catch { now = null; }
  const maxAge = desk.oracleMaxAge != null ? BigInt(desk.oracleMaxAge) : 120n;
  let clamped = false;
  let note = "";
  if (!publishFits(publish, now, maxAge)) {
    clamped = true;
    note = " The Pyth publish time is outside this cluster clock, so the desk stored the price and let the program stamp the cluster clock.";
    publish = 0n;
  }
  const pushed = await client.pushOracle(keys.admin, quote.price, publish, quote.conf || 0);
  pushLog({
    actor: "operator",
    tool: "oracle.pyth",
    detail: "SOL/USD " + quote.source + (quote.cluster ? " " + quote.cluster : "") + (clamped ? " clock-stamped" : " publish " + quote.publishTime),
    sig: pushed.sig,
  });
  return { sig: pushed.sig, publish: publish.toString(), clamped, note };
}

async function syncPrice() {
  if (priceBusy) return priceFeed;
  priceBusy = true;
  try {
    // Refresh all three marks. Only SOL pushes on-chain oracle (single desk PDA).
    const all = await marketsRt.syncAll({
      pushOracle: async (quote) => {
        try {
          return await pushSolOracle(quote);
        } catch (err) {
          // Surface into quote via markets-runtime catch path
          throw err;
        }
      },
    });
    const sol = all["SOL/USD"] || marketsRt.feeds["SOL/USD"];
    priceFeed = sol;
    rememberQuote(sol);
    return sol;
  } finally {
    priceBusy = false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const viewCache = new Map();
const viewInflight = new Map();

function viewTtl() {
  return networkName === "localnet" ? 400 : 8000;
}

function viewKey(focus, opts) {
  return [focus, opts.owner || "", opts.as || "", marketsRt.getActive()].join("|");
}

async function viewCached(focus, opts) {
  const key = viewKey(focus, opts);
  const hit = viewCache.get(key);
  if (hit && Date.now() - hit.at < viewTtl()) return hit.body;
  if (viewInflight.has(key)) return viewInflight.get(key);
  const job = view(focus, opts).then((body) => {
    viewCache.set(key, { at: Date.now(), body });
    viewInflight.delete(key);
    return body;
  }).catch((err) => {
    viewInflight.delete(key);
    throw err;
  });
  viewInflight.set(key, job);
  return job;
}

function rpcBusy(err) {
  return isRateLimit(err);
}

function rpcErrorBody(err) {
  if (rpcBusy(err)) {
    return {
      status: 429,
      error: "RPC 429. The public endpoint is busy. Wait a few seconds. Nothing was signed.",
    };
  }
  return { status: (err && err.status) || 500, error: (err && err.message) || "request failed" };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/state") {
      const focus = url.searchParams.get("actor") || "alice";
      const marketQ = url.searchParams.get("market");
      if (marketQ) marketsRt.setActive(marketQ);
      try {
        return json(res, 200, await viewCached(focus, {
          owner: url.searchParams.get("owner"),
          as: url.searchParams.get("as"),
        }));
      } catch (err) {
        const mapped = rpcErrorBody(err);
        return json(res, mapped.status, { ok: false, error: mapped.error });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/prepare") {
      const body = await readBody(req);
      viewCache.clear();
      try {
        const prepared = await prepareWallet(body);
        const state = await view("wallet", { owner: body.owner, as: body.signer });
        return json(res, 200, { ok: true, ...prepared, state });
      } catch (err) {
        return json(res, err.status || 500, { ok: false, error: err.message, logs: err.logs || [] });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/send") {
      const body = await readBody(req);
      viewCache.clear();
      try {
        const raw = Buffer.from(body.tx || "", "base64");
        const sent = await broadcast(raw, !!body.skipPreflight);
        const events = eventsFromLogs(sent.logs);
        const rejected = hasSessionReject({ logs: sent.logs, message: "" });
        const failed = sent.failed && !rejected;
        pushLog({
          actor: "wallet",
          tool: body.tool || body.op || "send",
          detail: body.detail || (rejected ? "rejected — session key cannot do this" : ""),
          sig: sent.sig,
          events,
          error: rejected || (failed ? true : undefined),
        });
        const state = body.owner
          ? await view("wallet", { owner: body.owner, as: body.signer })
          : null;
        return json(res, 200, {
          ok: !failed && !rejected,
          sessionReject: rejected,
          sig: sent.sig,
          events,
          logs: sent.logs,
          state,
          error: rejected
            ? "Session key cannot withdraw, stake, or claim."
            : failed
              ? "Transaction failed on chain."
              : undefined,
        });
      } catch (err) {
        const logs = err.logs || [];
        const rejected = hasSessionReject(err);
        pushLog({
          actor: "wallet",
          tool: body.tool || body.op || "send",
          detail: rejected ? "rejected — session key cannot do this" : err.message,
          sig: err.signature || "",
          events: eventsFromLogs(logs),
          error: true,
        });
        let state = null;
        try {
          if (body.owner) state = await view("wallet", { owner: body.owner, as: body.signer });
        } catch { /* desk may be down */ }
        return json(res, rejected ? 403 : 500, {
          ok: false,
          sessionReject: rejected,
          error: rejected ? "Session key cannot withdraw, stake, or claim." : err.message,
          logs,
          events: eventsFromLogs(logs),
          sig: err.signature || null,
          state,
        });
      }
    }
    if (req.method === "GET" && url.pathname === "/api/markets") {
      return json(res, 200, {
        ok: true,
        active: marketsRt.getActive(),
        markets: marketsRt.marketsPayload(),
      });
    }
    if (req.method === "POST" && url.pathname === "/api/market") {
      const body = await readBody(req);
      const id = marketsRt.setActive(body.market || body.id || "SOL/USD");
      viewCache.clear();
      return json(res, 200, {
        ok: true,
        active: id,
        markets: marketsRt.marketsPayload(),
        price: marketsRt.priceView(id, null),
        priceFeed: marketsRt.feedView(id),
        history: marketsRt.historyView(id),
        marketOnChain: !!marketsRt.getMarket(id).onChain,
        marketNote: marketsRt.getMarket(id).note || "",
      });
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      const id = url.searchParams.get("market") || marketsRt.getActive();
      return json(res, 200, { ok: true, ...marketsRt.historyView(id) });
    }
    if (req.method === "POST" && url.pathname === "/api/desk-book") {
      const body = await readBody(req);
      viewCache.clear();
      try {
        if (body.op === "open") {
          const row = marketsRt.openBook({
            market: body.market || marketsRt.getActive(),
            owner: body.owner || "",
            who: body.who || "You",
            side: body.side || "long",
            marginMicro: body.margin,
            leverage: body.leverage,
            fundFrom: body.fundFrom || "balance",
            liqFractionBps: body.liqFractionBps || (await client.readDesk().then((d) => d && d.liqFractionBps).catch(() => 5000)) || 5000,
          });
          pushLog({
            actor: "desk-book",
            tool: "positions.open",
            detail: row.market + " " + row.side + " " + row.leverage + "x desk-book",
          });
          return json(res, 200, { ok: true, position: row, deskBook: true });
        }
        if (body.op === "close") {
          const row = marketsRt.closeBook(body.id, body.owner || "");
          pushLog({
            actor: "desk-book",
            tool: "positions.close",
            detail: row.market + " " + row.id + " pnl " + row.pnl + (row.scarMinted && row.scarMinted !== "0" ? " scar-credit " + row.scarMinted : ""),
          });
          return json(res, 200, { ok: true, position: row, deskBook: true });
        }
        return json(res, 400, { ok: false, error: "desk-book op must be open or close" });
      } catch (err) {
        return json(res, err.status || 500, { ok: false, error: err.message });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/act") {
      const body = await readBody(req);
      const focus = body.actor || "alice";
      viewCache.clear();
      try {
        const result = await run(focus, body.op, body);
        const state = await view(focus, { owner: body.owner, as: body.signer });
        return json(res, 200, { ok: true, sig: result.sig || null, events: result.events || eventsFromLogs(result.logs || []), state });
      } catch (err) {
        const rejected = hasSessionReject(err);
        pushLog({
          actor: focus,
          tool: body.op === "agent" && body.tool ? body.tool : body.op,
          detail: rejected ? "rejected — session key cannot do this" : err.message,
          error: true,
          events: eventsFromLogs(err.logs || []),
        });
        let state = null;
        try { state = await view(focus, { owner: body.owner, as: body.signer }); } catch { /* desk may be down */ }
        return json(res, rejected ? 403 : err.status || 500, {
          ok: false,
          error: rejected ? "Session key cannot withdraw, stake, or claim." : err.message,
          sessionReject: rejected,
          logs: err.logs || [],
          state,
        });
      }
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end("no");
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end("not found");
    }
    const ext = path.extname(file);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    const mapped = rpcErrorBody(err);
    json(res, mapped.status, { ok: false, error: mapped.error });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Scardesk desk http://127.0.0.1:" + PORT +
    " rpc " + RPC +
    " (" + networkName + ")" +
    " config " + resolved.deploymentFile +
    (resolved.missingDeployment ? " MISSING" : "")
  );
  // Public Devnet RPCs 429 when an oracle push shares the budget with a trade.
  // The first push waits, then repeats every three minutes.
  setTimeout(() => {
    syncPrice().catch((err) => console.error("price sync", err.message));
  }, 45_000);
  setInterval(() => {
    syncPrice().catch((err) => console.error("price sync", err.message));
  }, 180_000);
});
