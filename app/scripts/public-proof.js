#!/usr/bin/env node
/**
 * Deploy Scardesk to a public Solana cluster and land two explorer
 * transactions: a FIFO queue write and a SCAR mint. Also lands a session
 * withdraw that the program rejects.
 *
 * Prefers devnet. This host cannot complete TLS to api.devnet.solana.com
 * (sandbox DNS answers 198.18.0.1; the public A record still ends in TLS EOF),
 * so that URL is not a candidate. OnFinality is the devnet RPC. Testnet is
 * the fallback. The script refuses mainnet.
 *
 * An upgradeable deploy of the 215584-byte program needs about 3.2 SOL:
 * program data and the deploy buffer are each ~1.50166872 SOL. A smaller
 * drip must not start a deploy.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  APP_ROOT,
  CONFIG_PATH,
  DeskClient,
  loadKey,
  loadParams,
  eventsFromLogs,
  hasSessionReject,
  Connection,
  PublicKey,
} = require("../client/src/chain");
const math = require("../client/src/math");
const { fetchSolUsd } = require("../client/src/price");

const CANDIDATES = [
  "https://solana-devnet.api.onfinality.io/public",
  "https://api.testnet.solana.com",
];
const DEPLOY_LAMPORTS = 3_200_000_000;
const GENESIS = {
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: "devnet",
  "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY": "testnet",
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
};

function px(usd) {
  return math.toMicro(usd) * 100n;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rpcOk(url) {
  const connection = new Connection(url, "confirmed");
  const hash = await Promise.race([
    connection.getGenesisHash(),
    sleep(20000).then(() => {
      throw new Error("timeout");
    }),
  ]);
  const network = GENESIS[hash] || "unknown";
  if (network === "mainnet-beta") throw new Error("refusing mainnet " + url);
  return { connection, hash, network, url };
}

async function pickRpc() {
  if (process.env.SCARDESK_RPC) {
    const hit = await rpcOk(process.env.SCARDESK_RPC);
    console.log("rpc", hit.url, hit.network, hit.hash);
    return hit;
  }
  let last = "no rpc";
  for (const url of CANDIDATES) {
    try {
      const hit = await rpcOk(url);
      console.log("rpc", hit.url, hit.network, hit.hash);
      return hit;
    } catch (err) {
      last = url + ": " + err.message;
      console.error("rpc skip", last);
    }
  }
  throw new Error("no public cluster answered: " + last);
}

async function fund(connection, pubkey, sol, attempts) {
  const log = attempts || [];
  let last = "";
  for (let i = 0; i < 3; i++) {
    const bal = await connection.getBalance(pubkey);
    if (bal >= sol * 1e9 * 0.9) return bal;
    const lamports = Math.round(sol * 1e9);
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, "confirmed");
      log.push({ pubkey: pubkey.toBase58(), method: "requestAirdrop", lamports, ok: true, sig });
      console.log("airdrop", pubkey.toBase58().slice(0, 8), sig);
    } catch (err) {
      last = err.message || String(err);
      log.push({ pubkey: pubkey.toBase58(), method: "requestAirdrop", lamports, ok: false, error: last.slice(0, 180) });
      console.error("airdrop fail", pubkey.toBase58().slice(0, 8), last.slice(0, 180));
      await sleep(4000);
    }
  }
  const bal = await connection.getBalance(pubkey);
  if (bal < 0.05 * 1e9) {
    const error = new Error("airdrop failed for " + pubkey.toBase58() + ": " + last);
    error.balance = bal;
    error.attempts = log;
    throw error;
  }
  return bal;
}

function deploy(rpc) {
  const so = path.join(APP_ROOT, "programs/scardesk/target/deploy/scardesk.so");
  if (!fs.existsSync(so)) throw new Error("missing " + so);
  const solana = process.env.SOLANA_BIN || "solana";
  execFileSync(
    solana,
    [
      "program", "deploy", so,
      "--url", rpc,
      "--keypair", path.join(APP_ROOT, "keys/admin.json"),
      "--program-id", path.join(APP_ROOT, "keys/program.json"),
      "--commitment", "confirmed",
    ],
    { stdio: "inherit" }
  );
}

async function step(label, fn) {
  process.stdout.write(label + " … ");
  const result = await fn();
  console.log(result && result.sig ? result.sig : "ok");
  return result;
}

async function main() {
  const picked = await pickRpc();
  const { connection, network, url } = picked;
  const program = loadKey("program.json");
  const admin = loadKey("admin.json");
  const alice = loadKey("alice.json");
  const bob = loadKey("bob.json");
  const session = loadKey("alice-session.json");
  const params = loadParams();
  const client = new DeskClient(connection, program.publicKey);
  const quote = await fetchSolUsd();
  fs.mkdirSync(path.join(APP_ROOT, "fixtures"), { recursive: true });
  fs.writeFileSync(
    path.join(APP_ROOT, "fixtures/hermes-last.json"),
    JSON.stringify({ ...quote, at: new Date().toISOString() }, null, 2)
  );
  console.log("price", quote.ok ? quote.source + " " + quote.price : quote.error);

  console.log("funding admin (deploy rent)");
  const fundingAttempts = [];
  let faucetError = "";
  try {
    await fund(connection, admin.publicKey, 2, fundingAttempts);
  } catch (err) {
    faucetError = err.message;
    console.error(err.message);
  }
  const adminBal = await connection.getBalance(admin.publicKey);
  console.log("admin lamports", adminBal);
  if (adminBal < DEPLOY_LAMPORTS) {
    const proof = {
      ok: false,
      network,
      rpc: url,
      genesis: picked.hash,
      programId: program.publicKey.toBase58(),
      admin: admin.publicKey.toBase58(),
      adminLamports: adminBal,
      deployLamports: DEPLOY_LAMPORTS,
      fundingAttempts,
      price: quote,
      error: "Not enough SOL to deploy. Upgradeable rent for this program is about 3.2 SOL. " + (faucetError || "Public faucet refused this host.") + " No program was sent.",
    };
    fs.mkdirSync(path.join(APP_ROOT, "demo"), { recursive: true });
    fs.writeFileSync(path.join(APP_ROOT, "demo/public-proof.json"), JSON.stringify(proof, null, 2));
    console.error(proof.error);
    process.exitCode = 2;
    return;
  }

  const existing = await connection.getAccountInfo(program.publicKey);
  if (!existing) {
    console.log("deploying program");
    deploy(url);
  } else {
    console.log("program already on", network, existing.data.length, "bytes");
  }

  let desk = await client.readDesk();
  if (!desk) {
    await step("initialize", () => client.initialize(admin, params));
    desk = await client.readDesk();
  }
  if (!desk) throw new Error("desk missing after init");

  for (const kp of [alice, bob, session]) {
    const bal = await connection.getBalance(kp.publicKey);
    if (bal < 20_000_000) {
      try {
        await fund(connection, kp.publicKey, 1);
      } catch (err) {
        console.error("fee fund", kp.publicKey.toBase58().slice(0, 6), err.message);
        if ((await connection.getBalance(admin.publicKey)) > 100_000_000) {
          const { SystemProgram, Transaction } = require("@solana/web3.js");
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: admin.publicKey,
              toPubkey: kp.publicKey,
              lamports: 50_000_000,
            })
          );
          await client.send(admin, tx.instructions, []);
          console.log("transferred fee SOL to", kp.publicKey.toBase58().slice(0, 6));
        }
      }
    }
    if (!(await client.readUser(kp.publicKey)) && kp !== session) {
      await step("init user " + kp.publicKey.toBase58().slice(0, 4), () => client.initUser(kp));
    }
    if (kp !== session && !(await client.raw(client.walletPda(kp.publicKey)))) {
      await step("init wallet " + kp.publicKey.toBase58().slice(0, 4), () => client.initWallet(kp));
    }
  }

  const before = await client.readUser(alice.publicKey);
  if (before.balance < math.toMicro("200")) {
    await step("faucet alice", () => client.faucet(admin, alice.publicKey, "1000"));
    await step("deposit alice", () => client.deposit(alice, "400"));
  }
  const bobUser = await client.readUser(bob.publicKey);
  if (bobUser.balance < math.toMicro("300")) {
    await step("faucet bob", () => client.faucet(admin, bob.publicKey, "1000"));
    await step("deposit bob", () => client.deposit(bob, "400"));
  }

  const proof = {
    ok: false,
    network,
    rpc: url,
    genesis: picked.hash,
    programId: program.publicKey.toBase58(),
    explorerProgram: explorerAccount(program.publicKey.toBase58(), network),
    addresses: {
      program: program.publicKey.toBase58(),
      desk: client.desk.toBase58(),
      dusdMint: client.dusdMint.toBase58(),
      scarMint: client.scarMint.toBase58(),
      vault: client.vault.toBase58(),
      treasury: client.treasury.toBase58(),
      oracle: client.oracle.toBase58(),
      admin: admin.publicKey.toBase58(),
    },
    price: quote,
    signatures: {},
    events: [],
  };

  function absorb(result) {
    if (!result) return [];
    const events = eventsFromLogs(result.logs);
    proof.events.push(...events);
    return events;
  }

  await step("mark 100", () => client.pushOracle(admin, px("100"), 0n, 50_000n));
  const aliceOpen = await step("alice long 100 @ 10×", () =>
    client.open({ signer: alice, owner: alice, side: "long", margin: "100", leverage: 10, fundFrom: "balance" })
  );
  absorb(aliceOpen);
  await step("mark 110", () => client.pushOracle(admin, px("110")));
  const win = await step("alice close → queue", () =>
    client.close({ signer: alice, owner: alice.publicKey, positionIds: [before.nextId] })
  );
  const winEvents = absorb(win);
  proof.signatures.queueWrite = win.sig;
  proof.explorer = proof.explorer || {};
  proof.explorer.queueWrite = explorerTx(win.sig, network);
  if (!winEvents.some((e) => e.name === "queue_write")) {
    throw new Error("queue_write missing. LP may already be large enough to pay the win.");
  }

  const bobBefore = await client.readUser(bob.publicKey);
  await step("bob long 200 @ 10×", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "200", leverage: 10, fundFrom: "balance" })
  );
  await step("mark 105.6", () => client.pushOracle(admin, px("105.6")));
  const loss = await step("bob loss mints SCAR", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [bobBefore.nextId] })
  );
  const lossEvents = absorb(loss);
  proof.signatures.scarMint = loss.sig;
  proof.explorer.scarMint = explorerTx(loss.sig, network);
  if (!lossEvents.some((e) => e.name === "scar_minted")) throw new Error("scar_minted missing");

  const aliceNow = await client.readUser(alice.publicKey);
  if (!aliceNow.hasSession) {
    await step("arm session", () => client.setSession(alice, session.publicKey));
  }
  await step("mark 105.6 flat", () => client.pushOracle(admin, px("105.6")));
  const sessOpen = await step("session open", () =>
    client.open({
      signer: session,
      owner: alice.publicKey,
      side: "long",
      margin: "10",
      leverage: 2,
      fundFrom: "balance",
    })
  );
  absorb(sessOpen);
  const afterOpen = await client.readUser(alice.publicKey);
  const sessClose = await step("session close", () =>
    client.close({
      signer: session,
      owner: alice.publicKey,
      positionIds: [afterOpen.nextId - 1n],
    })
  );
  absorb(sessClose);
  proof.signatures.sessionRoundTrip = sessClose.sig;

  client.skipPreflight = true;
  try {
    await client.withdraw(session, alice.publicKey, "1");
    throw new Error("session withdraw was accepted");
  } catch (err) {
    if (!hasSessionReject(err)) throw err;
    proof.signatures.sessionReject = err.signature || null;
    proof.explorer.sessionReject = err.signature ? explorerTx(err.signature, network) : null;
    console.log("session withdraw rejected", err.signature || "(no signature)");
  } finally {
    client.skipPreflight = false;
  }

  if (quote.ok) {
    try {
      const pushed = await client.pushOracle(admin, quote.price, quote.publishTime, quote.conf || 0);
      proof.signatures.pythPush = pushed.sig;
      proof.explorer.pythPush = explorerTx(pushed.sig, network);
      console.log("restored pyth mark", pushed.sig);
    } catch (err) {
      proof.pythPushError = err.message;
      console.error("pyth push", err.message);
    }
  }

  proof.ok = true;
  proof.scarMintAccount = client.scarMint.toBase58();
  proof.explorer.scarMintAccount = explorerAccount(client.scarMint.toBase58(), network);
  proof.explorer.queueHead = explorerAccount(client.queuePda(0n).toBase58(), network);

  const deployDoc = {
    rpc: url,
    programId: program.publicKey.toBase58(),
    desk: client.desk.toBase58(),
    dusdMint: client.dusdMint.toBase58(),
    scarMint: client.scarMint.toBase58(),
    vault: client.vault.toBase58(),
    treasury: client.treasury.toBase58(),
    oracle: client.oracle.toBase58(),
    admin: admin.publicKey.toBase58(),
    alice: alice.publicKey.toBase58(),
    bob: bob.publicKey.toBase58(),
    session: session.publicKey.toBase58(),
    network,
    genesis: picked.hash,
  };
  const namedPath = path.join(APP_ROOT, "config", "deployment." + network + ".json");
  fs.writeFileSync(namedPath, JSON.stringify(deployDoc, null, 2));
  if (process.env.SCARDESK_ACTIVATE === "1") {
    const localCopy = path.join(APP_ROOT, "config/deployment.local.json");
    if (fs.existsSync(CONFIG_PATH)) {
      const current = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      if (current.network === "localnet" || !fs.existsSync(localCopy)) {
        fs.copyFileSync(CONFIG_PATH, localCopy);
      }
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(deployDoc, null, 2));
    console.log("activated", CONFIG_PATH);
  } else {
    console.log("wrote", namedPath, "(deployment.json left on the local ledger; SCARDESK_ACTIVATE=1 to switch the default)");
  }
  fs.writeFileSync(path.join(APP_ROOT, "demo/public-proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ ok: true, network, queue: proof.explorer.queueWrite, scar: proof.explorer.scarMint }, null, 2));
}

function explorerTx(sig, network) {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=" + network;
  return "https://explorer.solana.com/tx/" + sig + cluster;
}

function explorerAccount(key, network) {
  const cluster = network === "mainnet-beta" ? "" : "?cluster=" + network;
  return "https://explorer.solana.com/address/" + key + cluster;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
