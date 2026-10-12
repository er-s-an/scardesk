/** Scardesk desk. Talks only to /api/state and /api/act. */

const $ = (id) => document.getElementById(id);

let actor = sessionStorage.getItem("scardesk-actor") || "alice";
let snap = null;
let lastPx = null;
let lastDir = 0;
let side = "long";
let pollTimer = null;
let viewGen = 0;
let walletAdapter = null;
let tradeAsSession = sessionStorage.getItem("scardesk-as-session") === "1";
let linkPhase = "idle";
let linkHint = "";
const SESSION_STORE = "scardesk-session";
let market = sessionStorage.getItem("scardesk-market") || "SOL/USD";
let chart = null;
let chartTf = sessionStorage.getItem("scardesk-tf") || "Tick";
(function bootMarketFromUrl() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("market")) market = q.get("market");
    if (q.get("tf")) chartTf = q.get("tf");
  } catch { /* ignore */ }
})();

function marketOnChain(data) {
  if (data && typeof data.marketOnChain === "boolean") return data.marketOnChain;
  return market === "SOL/USD";
}

function ensureChart() {
  const canvas = $("mark-chart");
  if (!canvas || !window.ScardeskChart) return null;
  if (!chart) chart = new window.ScardeskChart(canvas);
  chart.setMarket(market);
  chart.setTimeframe(chartTf);
  const ema = $("ema-toggle");
  chart.setShowEma(!!(ema && ema.checked));
  return chart;
}

async function loadHistory() {
  const c = ensureChart();
  if (!c) return;
  try {
    const res = await fetch("/api/history?market=" + encodeURIComponent(market));
    if (!res.ok) return;
    const body = await res.json();
    c.setBars(body.bars || []);
    const entries = ((snap && snap.positions) || [])
      .filter((p) => p.status === "open" && (!p.market || p.market === market))
      .map((p) => ({ side: p.side, price: Number(String(p.entry).replace(/,/g, "")) }))
      .filter((e) => Number.isFinite(e.price));
    c.setEntries(entries);
    c.draw();
  } catch { /* chart is best-effort */ }
}

async function setMarket(next) {
  market = next || "SOL/USD";
  sessionStorage.setItem("scardesk-market", market);
  for (const btn of document.querySelectorAll("#markets button")) {
    const on = btn.dataset.market === market;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  }
  const eye = $("market-eyebrow");
  if (eye) eye.textContent = market + " desk";
  const tm = $("ticket-market");
  if (tm) tm.textContent = market + " · isolated";
  document.title = "Scardesk — " + market;
  try {
    await fetch("/api/market", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ market }),
    });
  } catch { /* desk may be mid-restart */ }
  lastPx = null;
  lastDir = 0;
  await refresh();
  await loadHistory();
}

async function deskBook(op, body) {
  setBusy(true);
  try {
    const res = await fetch("/api/desk-book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, market, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      toast(explain(new Error(data.error || ("desk-book " + res.status))), "bad");
      return null;
    }
    if (op === "open") toast("Desk-book open on " + market + " (not on-chain PDA).", "ok");
    if (op === "close") {
      const scar = data.position && data.position.scarMinted && data.position.scarMinted !== "0";
      toast(scar ? "Desk-book closed. Soft SCAR credit (not minted on-chain)." : "Desk-book closed.", "ok");
    }
    await refresh();
    await loadHistory();
    return data;
  } catch (err) {
    toast(explain(err), "bad");
    return null;
  } finally {
    setBusy(false);
  }
}


const SCAR_ERRORS = {
  0: "The desk rejected that instruction. Retry once.",
  1: "That account is already on the desk.",
  2: "This key is not allowed to do that.",
  3: "Session key rejected. It can trade. It cannot withdraw, stake, or claim.",
  4: "No usable price. Push the oracle, or set the fixture.",
  6: "Not enough dUSD on the desk. Faucet, deposit, or lower the amount.",
  7: "Not enough queued dUSD. Fund from balance, or wait in the queue.",
  8: "Leverage is above the desk maximum. Lower it and retry.",
  9: "Margin must be greater than zero.",
  10: "That position is not open.",
  11: "That position belongs to another account.",
  12: "The LP cannot pay this win, so the close has to write a queue node. Retry.",
  13: "The queue node does not match this account.",
  14: "The settlement math overflowed. Lower the size.",
  15: "An account on this transaction is wrong. Reconnect and retry.",
  16: "The LP cannot cover this payout.",
  17: "Nothing to claim yet. Stake before a payable win, then claim.",
  18: "Too many positions in one batch.",
  19: "That position is in the wrong status for this action.",
  21: "Not enough free SCAR. Stake only what a loss has minted.",
  22: "Fund from balance or from a queued claim.",
  24: "Amount must be greater than zero.",
  25: "The vault and the desk do not match. Deposit only what the dUSD wallet holds. Faucet first if it is empty.",
  26: "This position is not past its liquidation price.",
  27: "The oracle exponent is not the one this desk accepts.",
  28: "Faucet cooldown (60s). Wait, then retry.",
};

function explain(err, logs) {
  const msg = (err && err.message) || String(err || "request failed");
  const blob = [msg].concat(logs || []).join("\n");
  if (/Phantom is not installed/i.test(blob)) return "Phantom is not installed in this browser. Use Solflare, or Browser key.";
  if (/Solflare is not installed/i.test(blob)) return "Solflare is not installed in this browser. Use Phantom, or Browser key.";
  if (/too many requests|-32029|429 Too Many Requests|\bRPC 429\b|RPC is busy \(429\)/i.test(blob)) {
    return "The RPC is busy (429). Wait a few seconds. Nothing new was signed.";
  }
  if (/user rejected|rejected the request|approval denied|user declined|transaction cancelled|transaction canceled/i.test(blob)) {
    return "The wallet rejected the signature. Nothing was sent.";
  }
  if (/blockhash not found|block height exceeded|blockhash expired/i.test(blob)) return "The blockhash expired. Retry the action.";
  if (/failed to fetch|networkerror|econnrefused|network request failed|socket hang up/i.test(blob)) {
    return "The desk did not answer. It will retry. Check that npm run desk is running.";
  }
  if (/arm a session/i.test(blob)) return "Arm a session key in this browser first. Then trade as session.";
  if (/Initialize the dUSD wallet/i.test(blob)) return "The dUSD wallet is not on the desk yet. Reconnect and let the setup finish.";
  if (/Get fee SOL before arming/i.test(blob)) return "Press Fee SOL before Arm session. The session key pays position rent and still cannot withdraw.";
  if (/public faucet refused/i.test(blob)) return "The public faucet refused. Press Fee SOL so the operator can sponsor a fee.";
  if (/Wallet bundle is missing/i.test(blob)) return "The wallet bundle did not load. Reload the page.";
  if (/Args must be JSON/i.test(blob)) return "Args must be JSON.";
  const coded = /custom program error: 0x([0-9a-f]+)/i.exec(blob);
  if (coded) {
    const n = parseInt(coded[1], 16);
    if (SCAR_ERRORS[n]) return SCAR_ERRORS[n];
  }
  if (/insufficient funds|insufficient lamports|debit an account/i.test(blob)) {
    return "Not enough SOL for the fee or for rent. Press Fee SOL, then retry.";
  }
  const one = msg.replace(/\s+/g, " ").trim();
  return one.length > 180 ? one.slice(0, 180) + "…" : one;
}

function setLink(phase, text) {
  linkPhase = phase;
  const el = $("link-state");
  if (!el) return;
  el.dataset.phase = phase;
  el.textContent = text;
}

function short(pk) {
  if (!pk) return "—";
  return pk.slice(0, 4) + "…" + pk.slice(-4);
}

function num(text) {
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function micro(human) {
  const text = String(human).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const neg = text.startsWith("-");
  const [whole, frac = ""] = (neg ? text.slice(1) : text).split(".");
  const frac6 = (frac + "000000").slice(0, 6);
  const v = BigInt(whole) * 1000000n + BigInt(frac6);
  return neg ? -v : v;
}

function fmtPriceRaw(raw) {
  const n = BigInt(raw);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const whole = a / 100000000n;
  let frac = (a % 100000000n).toString().padStart(8, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + (frac ? whole.toString() + "." + frac : whole.toString());
}

function liqPreview(entryRaw, leverage, liqBps, which) {
  const entry = BigInt(entryRaw);
  const lev = BigInt(leverage);
  const bps = BigInt(liqBps);
  if (lev <= 0n || entry <= 0n) return null;
  const move = (entry * bps) / (lev * 10000n);
  const px = which === "long" ? entry - move : entry + move;
  return px > 0n ? px : 0n;
}

function toast(text, tone, ms) {
  const el = $("toast");
  el.hidden = false;
  el.dataset.tone = tone || "bad";
  el.textContent = text;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms || 5200);
}

function flashPanel(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  clearTimeout(flashPanel._t && flashPanel._t[id]);
  flashPanel._t = flashPanel._t || {};
  flashPanel._t[id] = setTimeout(() => el.classList.remove("flash"), 1800);
}

function stamp() {
  const el = $("stamp");
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(stamp._t);
  stamp._t = setTimeout(() => { el.hidden = true; }, 1700);
}

function setBusy(on) {
  document.body.dataset.busy = on ? "1" : "0";
  if (on) {
    for (const b of document.querySelectorAll("button")) b.disabled = true;
    return;
  }
  for (const b of document.querySelectorAll("button")) b.disabled = false;
  if (snap) {
    renderAccount(snap);
    renderTicket(snap);
  }
  if (document.body.dataset.connect === "1") {
    for (const b of document.querySelectorAll("button")) b.disabled = true;
  }
}

function sessionKp() {
  const W = window.ScardeskWallet;
  if (!W) return null;
  const saved = sessionStorage.getItem(SESSION_STORE);
  if (!saved) return null;
  return W.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved)));
}

function ensureSessionKp() {
  const existing = sessionKp();
  if (existing) return existing;
  const kp = window.ScardeskWallet.Keypair.generate();
  sessionStorage.setItem(SESSION_STORE, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function showWalletChrome() {
  const on = !!(walletAdapter && walletAdapter.publicKey);
  for (const id of ["btn-phantom", "btn-solflare", "btn-burner"]) $(id).hidden = on;
  $("btn-disconnect").hidden = !on;
  const mine = $("btn-actor-wallet");
  if (mine) mine.hidden = !on;
  const line = $("wallet-line");
  if (line) {
    if (on) {
      const full = walletAdapter.publicKey.toBase58();
      line.textContent = walletAdapter.name + " " + short(full) + " signs here. Mine returns to this wallet. Alice and Bob stay on the demo ledger.";
      line.title = full;
    } else {
      line.textContent = "Connect Phantom, Solflare, or a browser key. The browser key uses the same sign path. It is not the extension.";
      line.title = "";
    }
  }
  if (linkPhase === "connecting" || linkPhase === "setup") return;
  const net = snap && snap.network ? snap.network : "desk";
  const rpc = snap && snap.rpc ? snap.rpc.replace(/^https?:\/\//, "") : "";
  const viewing = actor === "wallet"
    ? (tradeAsSession ? "session key" : "your wallet")
    : actor === "session" ? "Alice session" : actor;
  if (linkHint) {
    setLink("error", linkHint);
    return;
  }
  if (on) {
    setLink("connected", net + " · " + viewing + " · " + walletAdapter.name + " " + short(walletAdapter.publicKey.toBase58()) + (rpc ? " · " + rpc : ""));
  } else {
    setLink("idle", net + " · wallet not connected" + (rpc ? " · " + rpc : ""));
  }
}

function toastFrom(body, events) {
  const minted = (events || []).some((e) => e.name === "scar_minted");
  const queued = (events || []).some((e) => e.name === "queue_write");
  if (minted) stamp();
  if (minted) flashPanel("scar");
  if (queued) flashPanel("queue");
  if (body && body.sessionReject) {
    linkHint = "";
    toast("Session key rejected. It can trade. It cannot withdraw, stake, or claim.", "bad", 8000);
  } else if (body && body.ok === false) {
    toast(explain(body.error || "rejected", body.logs), "bad");
  } else if (minted && queued) toast("SCAR minted. The unpaid part of this close is in the FIFO queue.", "ok", 7000);
  else if (minted) toast("SCAR minted. The loss is now a program credit. It does not transfer.", "ok", 7000);
  else if (queued) toast("Queue write. The unpaid win is waiting at the FIFO head.", "ok", 7000);
  else if (body && body.sponsored) toast("Operator sponsored fee SOL. The public faucet refused.", "ok");
  else if (body && body.sig) toast("Landed " + body.sig.slice(0, 12), "ok");
  else if (body && body.read && body.result) toast("Agent read. No balance was edited.", "ok");
}

function ownerQuery() {
  const q = new URLSearchParams();
  q.set("actor", actor);
  q.set("market", market);
  if (actor === "wallet" && walletAdapter && walletAdapter.publicKey) {
    q.set("owner", walletAdapter.publicKey.toBase58());
    if (tradeAsSession) q.set("as", "session");
  }
  return q;
}

async function signPrepared(b64, needsSession) {
  const W = window.ScardeskWallet;
  const tx = W.Transaction.from(W.bytesFromBase64(b64));
  if (needsSession) {
    const kp = sessionKp();
    if (!kp) throw new Error("Arm a session key in this browser first.");
    tx.partialSign(kp);
  }
  const signed = await walletAdapter.signTransaction(tx);
  return W.toBase64(signed.serialize());
}

async function walletOp(op, extra, opts) {
  extra = extra || {};
  opts = opts || {};
  if (!walletAdapter || !walletAdapter.publicKey) {
    toast("Connect a wallet first.", "bad");
    return null;
  }
  const ownerOnly = ["init-user", "init-wallet", "faucet", "airdrop", "deposit", "arm-session", "clear-session"].includes(op);
  const asSession = tradeAsSession && !ownerOnly;
  const readTool = extra.tool === "account.retrieve" || extra.tool === "positions.closed";
  if ((asSession || (op === "agent" && !readTool)) && !sessionKp() && op !== "arm-session") {
    toast("Arm a session key in this browser first. Then trade as session.", "bad");
    return null;
  }
  const nested = document.body.dataset.connect === "1";
  if (!nested) setBusy(true);
  try {
    const owner = walletAdapter.publicKey.toBase58();
    let session = sessionKp();
    if (op === "arm-session") session = ensureSessionKp();
    const payload = {
      op,
      owner,
      signer: asSession || (op === "agent" && !readTool) ? "session" : "owner",
      session: session ? session.publicKey.toBase58() : undefined,
      ...extra,
    };
    const res = await fetch("/api/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const prepared = await res.json();
    if (prepared.state) {
      viewGen += 1;
      render(prepared.state);
    }
    if (!prepared.ok) {
      const text = explain(prepared.error || "prepare failed", prepared.logs);
      if (!opts.quiet) toast(text, "bad");
      return prepared;
    }
    if (prepared.adminSigned || prepared.read || !prepared.prepared) {
      if (!opts.quiet) {
        linkHint = "";
        toastFrom(prepared, prepared.events || []);
      }
      return prepared;
    }
    const tx = await signPrepared(prepared.prepared, !!prepared.needsSession);
    const restricted = payload.signer === "session" && (
      ["withdraw", "stake", "unstake", "claim"].includes(op) ||
      String(extra.tool || "").startsWith("paper.")
    );
    const sentRes = await fetch("/api/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tx,
        skipPreflight: restricted,
        owner,
        signer: payload.signer,
        op,
        tool: extra.tool || op,
        detail: extra.detail || "",
      }),
    });
    const sent = await sentRes.json();
    if (sent.state) {
      viewGen += 1;
      render(sent.state);
    }
    if (!opts.quiet) {
      if (sent.ok !== false) linkHint = "";
      toastFrom(sent, sent.events || []);
    }
    return sent;
  } catch (err) {
    const text = explain(err);
    if (!opts.quiet) toast(text, "bad");
    return { ok: false, error: text };
  } finally {
    if (!nested) {
      setBusy(false);
      showWalletChrome();
    }
  }
}

function walletLabel(kind) {
  if (kind === "burner") return "Browser key";
  if (kind === "phantom") return "Phantom";
  if (kind === "solflare") return "Solflare";
  return kind;
}

async function connectWallet(kind) {
  const W = window.ScardeskWallet;
  const label = walletLabel(kind);
  if (!W || !W[kind]) {
    linkHint = "The wallet bundle did not load. Reload the page.";
    linkPhase = "error";
    showWalletChrome();
    toast(linkHint, "bad");
    return;
  }
  const adapter = W[kind]();
  linkHint = "";
  linkPhase = "connecting";
  setLink("connecting", "Connecting " + label + "…");
  toast("Connecting " + label + "…", "wait");
  document.body.dataset.connect = "1";
  setBusy(true);
  try {
    await adapter.connect();
    walletAdapter = adapter;
    actor = "wallet";
    sessionStorage.setItem("scardesk-actor", "wallet");
    sessionStorage.setItem("scardesk-wallet-kind", kind);
    linkPhase = "setup";
    setLink("setup", label + " signed in. Reading the desk…");
    await refresh();
    const solText = snap && snap.actor ? snap.actor.sol : "";
    const sol = Number(solText);
    // A dash means the balance read failed. Do not airdrop on that.
    if (solText && solText !== "—" && !(sol >= 0.02)) {
      setLink("setup", "Requesting fee SOL…");
      toast("Requesting fee SOL…", "wait");
      const funded = await walletOp("airdrop", {}, { quiet: true });
      if (!funded || funded.ok === false) {
        linkHint = "Connected. Fee SOL did not land. Press Fee SOL, then Faucet.";
        toast(explain((funded && funded.error) || linkHint, funded && funded.logs), "bad");
        return;
      }
      await refresh();
    }
    if (snap && snap.actor && snap.actor.missing) {
      setLink("setup", "Creating the desk user…");
      toast("Creating the desk user…", "wait");
      const made = await walletOp("init-user", {}, { quiet: true });
      if (!made || made.ok === false) {
        linkHint = "Connected. The desk user was not created. " + explain((made && made.error) || "retry", made && made.logs);
        toast(linkHint, "bad");
        return;
      }
    }
    await refresh();
    if (snap && snap.actor && !snap.actor.hasWallet) {
      setLink("setup", "Creating the dUSD wallet…");
      toast("Creating the dUSD wallet…", "wait");
      const wallet = await walletOp("init-wallet", {}, { quiet: true });
      if (!wallet || wallet.ok === false) {
        linkHint = "Connected. The dUSD wallet was not created. " + explain((wallet && wallet.error) || "retry", wallet && wallet.logs);
        toast(linkHint, "bad");
        return;
      }
    }
    linkHint = "";
    linkPhase = "connected";
    toast(label + " connected. Faucet 1000 dUSD, then deposit.", "ok");
  } catch (err) {
    const text = explain(err);
    linkHint = walletAdapter && walletAdapter.publicKey ? "Connected, setup stopped. " + text : text;
    toast(linkHint, "bad");
  } finally {
    delete document.body.dataset.connect;
    if (linkPhase === "connecting" || linkPhase === "setup") linkPhase = linkHint ? "error" : "connected";
    setBusy(false);
    showWalletChrome();
  }
}

async function disconnectWallet() {
  try { await walletAdapter?.disconnect(); } catch { /* already gone */ }
  walletAdapter = null;
  actor = "alice";
  tradeAsSession = false;
  linkHint = "";
  linkPhase = "idle";
  sessionStorage.setItem("scardesk-actor", "alice");
  sessionStorage.removeItem("scardesk-wallet-kind");
  sessionStorage.removeItem("scardesk-as-session");
  const role = $("role");
  if (role) role.textContent = "owner";
  showWalletChrome();
  toast("Disconnected. The blotter is back on Alice. The browser key stays in this browser.", "ok");
  await refresh();
}

async function act(op, extra) {
  if (actor === "wallet" && op !== "liquidate" && op !== "oracle" && op !== "fixture" && op !== "stale-oracle") {
    return walletOp(op, extra || {});
  }
  setBusy(true);
  try {
    const res = await fetch("/api/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor,
        op,
        owner: actor === "wallet" && walletAdapter && walletAdapter.publicKey
          ? walletAdapter.publicKey.toBase58()
          : undefined,
        signer: actor === "wallet" && tradeAsSession ? "session" : undefined,
        ...extra,
      }),
    });
    const body = await res.json();
    if (body.state) {
      viewGen += 1;
      render(body.state);
    }
    toastFrom(body, body.events || []);
    return body;
  } catch (err) {
    toast(explain(err), "bad");
    return null;
  } finally {
    setBusy(false);
  }
}

function renderQuote(data) {
  const px = $("px");
  const src = $("src");
  const delta = $("delta");
  const feed = data.priceFeed || {};
  if (!data.price) {
    px.textContent = "—";
    px.className = "q-px";
    src.textContent = "no price";
    src.className = "pill";
    delta.textContent = "—";
    const note = $("px-note");
    if (note) note.textContent = feed.note || "No price on this desk.";
    return;
  }
  const raw = BigInt(data.price.raw);
  px.textContent = data.price.text;
  const provisional = data.price.source === "fixture" || feed.provisional;
  src.textContent = provisional ? data.price.source + " · provisional" : data.price.source;
  src.className = "pill " + data.price.source;
  if (lastPx !== null && raw !== lastPx) {
    lastDir = raw > lastPx ? 1 : -1;
    const diff = raw - lastPx;
    const sign = diff > 0n ? "+" : "";
    delta.textContent = sign + fmtPriceRaw(diff.toString());
  } else if (lastPx === null) {
    delta.textContent = "flat tick";
    delta.className = "delta";
  }
  lastPx = raw;
  const dir = lastDir === 1 ? "up" : lastDir === -1 ? "dn" : "";
  px.className = dir ? "q-px " + dir : "q-px";
  if (dir) delta.className = "delta " + dir;
  $("mark-note").textContent = data.price.source + " " + data.price.text;
  const note = $("px-note");
  if (note) {
    if (feed.ok) {
      const mkt = (data.price && data.price.market) || data.market || market;
      note.textContent = "Sponsored Pyth " + mkt + (feed.cluster ? " on " + feed.cluster : "") + ". Hermes still needs PYTH_API_KEY." + (feed.clamped ? " This cluster clock stamped the publish time." : "") + (feed.pushError ? " The on-chain push did not land." : "") + (data.marketOnChain === false ? " Desk-book market — opens are not the Devnet desk PDA." : "");
    } else {
      const mkt = (data.price && data.price.market) || data.market || market;
      note.textContent = "Fixture for " + mkt + " is provisional. Hermes returns 401 without PYTH_API_KEY, and no fresh sponsored Pyth account was read.";
    }
  }
}

function renderAccount(data) {
  const a = data.actor || {};
  $("bal").textContent = a.missing ? "—" : a.balance + " dUSD";
  const walletHold = $("wallet-hold");
  if (walletHold) {
    walletHold.textContent = a.missing
      ? "This account is not on the desk yet. Reconnect so setup can finish."
      : "Wallet holds " + (a.walletDusd || "0") + " dUSD. Deposit moves it onto the desk. The balance above is what an open can use.";
  }
  $("queued").textContent = a.missing ? "—" : a.queued + " dUSD";
  $("opens").textContent = a.missing ? "—" : String(a.openCount);
  if (data.queueDistance === null || data.queueDistance === undefined) {
    $("qdist").textContent = "not in line";
  } else {
    $("qdist").textContent = data.queueDistance + " ahead · " + data.queueAhead + " dUSD";
  }
  const wallet = actor === "wallet";
  const session = actor === "session" || (wallet && tradeAsSession);
  $("role").textContent = session ? "session" : wallet ? "wallet" : "owner";
  const sol = a.sol ? " · " + a.sol + " SOL" : "";
  $("who").textContent = a.missing
    ? "This account is not on the desk yet." + sol
    : "Owner " + short(a.pubkey) + " · signer " + short(a.signer) + sol + (a.hasSession ? " · session armed " + short(a.session) : " · no session");
  $("session-note").textContent = session
    ? "This signer can open and close. Withdraw, stake, and claim hit the owner's account and the program rejects them."
    : wallet
      ? "The connected wallet signs. Faucet is an operator mint of demo stable into that wallet. Trade as session uses a separate key."
      : "Owner can withdraw, stake, claim, and arm a session key.";
  $("btn-deposit").disabled = session;
  $("btn-faucet").disabled = session;
  $("btn-arm").disabled = !(actor === "alice" || wallet);
  $("btn-clear").disabled = !(actor === "alice" || wallet);
  $("btn-sol").disabled = !wallet;
  $("btn-as").disabled = !wallet;
  $("btn-as").classList.toggle("on", wallet && tradeAsSession);
}

function deskMaxLev(data) {
  const n = data && data.desk && Number(data.desk.maxLeverage);
  return Number.isFinite(n) && n >= 1 ? n : 1001;
}

function ticketReasons(data) {
  const reasons = [];
  const marginText = ($("margin").value || "").trim();
  const margin = micro(marginText || "0");
  const levRaw = num($("lev").value);
  const maxLev = deskMaxLev(data);
  if (!data.price) reasons.push("No mark yet. Wait for the price, or set the fixture in the operator rail.");
  if (margin === null) reasons.push("Margin must be a number, like 100 or 12.5.");
  else if (margin <= 0n) reasons.push("Margin must be greater than zero.");
  if (!Number.isFinite(levRaw) || levRaw < 1 || levRaw > maxLev) {
    reasons.push("Leverage must be from 1 to " + maxLev + ".");
  }
  const a = data.actor || {};
  const fund = $("fund").value;
  if (!a.missing && margin !== null && margin > 0n) {
    const potText = fund === "queued" ? (a.queued || "0") : (a.balance || "0");
    const pot = micro(potText);
    if (pot !== null && margin > pot) {
      reasons.push(fund === "queued"
        ? "Queued claim is " + a.queued + " dUSD. Lower the margin, or fund from balance."
        : "Desk balance is " + a.balance + " dUSD. Faucet, then deposit, or lower the margin.");
    }
  }
  if (a.missing) reasons.push("This account is not on the desk yet. Connect, then wait for setup to finish.");
  if (!data.desk) reasons.push("The desk account is not on this cluster.");
  return reasons;
}

function renderNext(data) {
  const el = $("next-step");
  if (!el) return;
  const on = !!(walletAdapter && walletAdapter.publicKey);
  const a = data.actor || {};
  if (on && actor !== "wallet") {
    el.textContent = "Viewing the demo ledger. Mine returns to your wallet. A session key can trade. Withdraw, stake, and claim are rejected.";
    return;
  }
  if (!on && actor === "session") {
    el.textContent = "This session key can open and close. Withdraw, stake, and claim are sent, then rejected.";
    return;
  }
  if (!on) {
    el.textContent = "Next: connect Phantom, Solflare, or a browser key. Then faucet, deposit, and open.";
    return;
  }
  if (a.missing) {
    el.textContent = "Next: finish setup. The desk creates your user and the dUSD wallet. Then faucet and deposit.";
    return;
  }
  if (tradeAsSession) {
    el.textContent = "Session key can open and close. Withdraw, stake, and claim are sent, then rejected. It cannot take dUSD out.";
    return;
  }
  const bal = micro(a.balance || "0");
  const held = micro(a.walletDusd || "0");
  if (bal === null || bal <= 0n) {
    if (held !== null && held > 0n) {
      el.textContent = "Next: Deposit wallet dUSD onto the desk. An open larger than the desk balance is stopped here.";
      return;
    }
    el.textContent = "Next: Faucet 1000 dUSD, then Deposit. An open larger than the desk balance is stopped here.";
    return;
  }
  if (!a.openCount) {
    el.textContent = marketOnChain(snap)
      ? "Next: open a position on " + market + ". A loss mints SCAR. A win the LP cannot pay enters the FIFO queue."
      : "Next: open a desk-book position on " + market + ". Mark/chart are live; settlement is provisional until a market PDA exists.";
    return;
  }
  el.textContent = "Next: close the open position. Settlement uses the same path as the agent.";
}

function renderTicket(data) {
  const note = $("ticket-note");
  const desk = data.desk;
  const marginText = ($("margin").value || "").trim();
  const margin = micro(marginText || "0");
  const levRaw = num($("lev").value);
  const maxLev = deskMaxLev(data);
  const lev = Math.max(1, Math.min(maxLev, levRaw || 1));
  const levInput = $("lev");
  const levRange = $("lev-range");
  if (levInput) levInput.max = String(maxLev);
  if (levRange) levRange.max = String(maxLev);
  const reasons = ticketReasons(data);
  const blocked = margin === null || !data.price || !desk || reasons.some((r) => r.startsWith("Margin must") || r.startsWith("Leverage") || r.startsWith("The desk account"));
  if (blocked) {
    $("prev-notional").textContent = "—";
    $("prev-liq").textContent = "—";
  } else {
    const notional = margin * BigInt(lev);
    const whole = notional / 1000000n;
    const frac = (notional % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
    $("prev-notional").textContent = (frac ? whole.toString() + "." + frac : whole.toString()) + " dUSD";
    const liq = liqPreview(data.price.raw, lev, desk.liqFractionBps, side);
    $("prev-liq").textContent = liq === null ? "—" : fmtPriceRaw(liq.toString());
  }
  if (note) {
    note.hidden = reasons.length === 0;
    note.textContent = reasons[0] || "";
  }
  const open = $("btn-open");
  if (open) {
    open.classList.toggle("is-blocked", reasons.length > 0);
    open.title = reasons[0] || "Open an isolated position";
  }
}

function cellHtml(label, inner, cls) {
  return "<td data-label=\"" + label + "\"" + (cls ? " class=\"" + cls + "\"" : "") + ">" + inner + "</td>";
}

function renderPositions(data) {
  const body = $("pbody");
  const rows = data.positions || [];
  const mkt = data.market || market;
  if (!rows.length) {
    const empty = marketOnChain(data)
      ? "No positions yet on " + mkt + ". An open ticket lands here."
      : "No desk-book positions on " + mkt + ". Opens here are provisional (not the Devnet desk PDA).";
    body.innerHTML = '<tr class="empty"><td colspan="13">' + empty + '</td></tr>';
    return;
  }
  body.innerHTML = rows.map((p) => {
    const raw = BigInt(p.upnlRaw || "0");
    const cls = raw > 0n ? "up" : raw < 0n ? "dn" : "";
    const tone = raw > 0n ? "win" : raw < 0n ? "loss" : "";
    const actions = [];
    if (p.mine && p.status === "open") {
      if (p.deskBook) {
        actions.push('<button type="button" data-desk-close="' + p.id + '">Close</button>');
      } else {
        actions.push('<button type="button" data-close="' + p.id + '">Close</button>');
      }
    }
    if (p.status === "open" && p.liqNow && !p.deskBook) {
      actions.push('<button type="button" data-liq="' + p.id + '" data-owner="' + p.owner + '">Liquidate</button>');
    }
    const status = p.deskBook ? p.status + " · desk" : p.status;
    return "<tr class=\"" + [p.mine ? "mine" : "", tone].filter(Boolean).join(" ") + "\">" +
      cellHtml("Id", p.id) +
      cellHtml("Mkt", p.market || mkt) +
      cellHtml("Who", p.who) +
      cellHtml("Side", p.side, "side-" + p.side) +
      cellHtml("Lev", p.leverage + "×") +
      cellHtml("Margin", p.margin) +
      cellHtml("Entry", p.entry + (p.exit ? " → " + p.exit : "")) +
      cellHtml("uPnL", (raw > 0n ? "+" : "") + p.upnl, cls) +
      cellHtml("Liq", p.liq) +
      cellHtml("Fund", p.fundFrom) +
      cellHtml("SCAR", p.scar === "0" ? "—" : p.scar) +
      cellHtml("Status", status) +
      cellHtml("", actions.join(" ") || "—") +
      "</tr>";
  }).join("");
}

function renderQueue(data) {
  const desk = data.desk;
  $("qlen").textContent = desk ? desk.queueLen + " live" : "—";
  $("lp").textContent = desk ? desk.lp : "—";
  $("lpfree").textContent = desk ? desk.freeLp : "—";
  $("reserved").textContent = desk ? desk.reserved : "—";
  $("vault").textContent = data.vault || "—";
  const head = desk ? desk.queueHead : null;
  const nodes = data.queue || [];
  if (!nodes.length) {
    $("qbody").innerHTML = '<tr class="empty"><td colspan="5">Queue empty. A win against an empty LP writes the first claim.</td></tr>';
  } else {
    $("qbody").innerHTML = nodes.map((n) => {
      const isHead = n.status === "active" && n.index === head;
      return "<tr class=\"" + (isHead ? "head " : "") + (n.status === "paid" ? "paid " : "") + (n.mine ? "mine" : "") + "\">" +
        cellHtml("#", n.index + (isHead ? " head" : "")) +
        cellHtml("Who", n.who) +
        cellHtml("Kind", n.kind) +
        cellHtml("Left", n.remaining) +
        cellHtml("", n.status + " · pos " + n.positionId) +
        "</tr>";
    }).join("");
  }
  if (data.queueDistance === null || data.queueDistance === undefined) {
    $("qahead").textContent = "You have no active claim. FIFO pays the head, then the next, before LP cash grows.";
  } else {
    $("qahead").textContent = "Your first live claim has " + data.queueDistance + " node(s) and " + data.queueAhead + " dUSD ahead of it.";
  }
}

function renderScar(data) {
  const a = data.actor || {};
  $("scar-free").textContent = a.missing ? "—" : a.freeScar;
  $("scar-staked").textContent = a.missing ? "—" : a.staked;
  $("scar-pending").textContent = a.missing ? "—" : a.claimable + " dUSD";
  $("scar-bal").textContent = a.missing ? "—" : a.scar;
  $("supply").textContent = "supply " + (data.scarSupply || "0");
}

function renderLog(data) {
  const items = data.log || [];
  if (!items.length) {
    $("log").innerHTML = "<li><span class=\"tool\">quiet</span><span>No desk actions in this process yet. The verify script writes chain logs of its own.</span></li>";
  } else {
    $("log").innerHTML = items.map((row) => {
      const ev = (row.events || []).map((e) => e.name).join(" ");
      const when = (row.t || "").slice(11, 19);
      return "<li class=\"" + (row.error ? "bad" : "") + "\">" +
        "<time>" + when + "</time>" +
        "<span class=\"tool\">" + (row.tool || "") + "</span>" +
        "<span>" + (row.actor || "") + " " + (row.detail || "") +
        (row.sig ? " · " + row.sig.slice(0, 12) : "") +
        (ev ? " · " + ev : "") + "</span></li>";
    }).join("");
  }
  const tools = data.tools || [];
  $("tools").innerHTML = tools.map((name) => {
    const off = name.startsWith("paper.");
    return "<button type=\"button\" class=\"" + (off ? "off" : "") + "\" data-tool=\"" + name + "\">" + name + "</button>";
  }).join("");
  const sel = $("agent-tool");
  if (sel.options.length !== tools.length) {
    sel.innerHTML = tools.map((name) => "<option>" + name + "</option>").join("");
  }
  const proofs = data.proofs || {};
  const sigs = proofs.signatures || {};
  const scarSig = proofs.scarMintSig || sigs.scarMint || "";
  const queueSig = sigs.queueWrite || proofs.queueWrite || "";
  const box = $("proofs");
  if (scarSig || queueSig) {
    box.hidden = false;
    const line = (label, sig) => sig ? "<div>" + label + " <code>" + sig + "</code></div>" : "";
    const ex = proofs.explorer || {};
    const link = (label, href) => href ? "<div><a href=\"" + href + "\">" + label + "</a></div>" : "";
    box.innerHTML = "<div>Last verify</div>" +
      line("SCAR mint", scarSig) +
      line("Queue write", queueSig) +
      link("SCAR on explorer", ex.scarMint) +
      link("Queue on explorer", ex.queueWrite);
  }
}

function renderAddrs(data) {
  const a = data.addresses;
  if (!a) {
    $("addrs").textContent = data.rpc || "";
    return;
  }
  $("addrs").textContent = "program " + a.program + " · desk " + a.desk + " · SCAR mint " + a.scarMint + " · dUSD " + a.dusdMint + " · " + (data.network || "") + " " + (data.rpc || "");
}

function render(data) {
  snap = data;
  const banner = $("banner");
  if (!data.desk) {
    banner.hidden = false;
    banner.textContent = data.network && data.network !== "localnet"
      ? "No desk account on " + data.network + ". The program is not on this cluster, so positions cannot load."
      : "Desk account is empty. Start the local validator without --reset, then run npm run verify if this ledger is new.";
  } else if (data.link && data.link.missingDeployment) {
    banner.hidden = false;
    banner.textContent = "SCARDESK_NETWORK=" + data.link.asked + " but config/deployment." + data.link.asked + ".json is missing. The desk is still aimed at " + (data.rpc || "the fallback RPC") + ".";
  } else {
    banner.hidden = true;
  }
  renderQuote(data);
  renderAccount(data);
  renderNext(data);
  renderTicket(data);
  renderPositions(data);
  renderQueue(data);
  renderScar(data);
  renderLog(data);
  renderAddrs(data);
  const net = $("net-line");
  if (net) {
    const file = data.link && data.link.deploymentFile ? " · " + data.link.deploymentFile : "";
    net.textContent = "Demo stable on " + (data.network || "unknown") + file + ". Not mainnet funds. " + (data.rpc || "");
  }
  for (const btn of document.querySelectorAll("#actors button")) {
    btn.classList.toggle("on", btn.dataset.actor === actor);
  }
  if (document.body.dataset.busy === "1" || document.body.dataset.connect === "1") {
    for (const b of document.querySelectorAll("button")) b.disabled = true;
  }
  showWalletChrome();
}

function armPoll(ms) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refresh, ms);
}

async function refresh() {
  const gen = ++viewGen;
  try {
    const res = await fetch("/api/state?" + ownerQuery().toString());
    if (gen !== viewGen) return;
    if (!res.ok) {
      let detail = "state " + res.status;
      try {
        const body = await res.json();
        if (body && body.error) detail = body.error;
      } catch { /* status line is enough */ }
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (gen !== viewGen) return;
    render(data);
    const pace = data.network && data.network !== "localnet" ? 10000 : 4000;
    if (!refresh._slow && !document.hidden) armPoll(pace);
    refresh._pace = pace;
    refresh._slow = false;
  } catch (err) {
    if (gen !== viewGen) return;
    const text = explain(err);
    const banner = $("banner");
    banner.hidden = false;
    banner.textContent = text;
    const rate = /too many requests|rpc 429|rpc is busy|-32029/i.test(text);
    if (linkPhase !== "connecting" && linkPhase !== "setup") {
      setLink("error", rate ? "RPC busy (429). The desk will retry." : "Desk unreachable. The page will retry.");
    }
    if (document.body.dataset.busy !== "1" && (!refresh._told || Date.now() - refresh._told > 20000)) {
      refresh._told = Date.now();
      toast(text, "bad");
    }
    if (rate && !refresh._slow) {
      refresh._slow = true;
      armPoll(20000);
    }
  }
}

function bind() {
  $("actors").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn || btn.hidden) return;
    actor = btn.dataset.actor;
    if (actor === "wallet" && !(walletAdapter && walletAdapter.publicKey)) {
      toast("Connect a wallet first.", "bad");
      actor = sessionStorage.getItem("scardesk-actor") || "alice";
      return;
    }
    if (actor !== "wallet") tradeAsSession = false;
    sessionStorage.setItem("scardesk-actor", actor);
    refresh();
  });
  $("btn-phantom").addEventListener("click", () => connectWallet("phantom"));
  $("btn-solflare").addEventListener("click", () => connectWallet("solflare"));
  $("btn-burner").addEventListener("click", () => connectWallet("burner"));
  $("btn-disconnect").addEventListener("click", () => disconnectWallet());
  $("btn-sol").addEventListener("click", () => walletOp("airdrop", {}));
  $("btn-as").addEventListener("click", () => {
    if (actor !== "wallet") return;
    tradeAsSession = !tradeAsSession;
    sessionStorage.setItem("scardesk-as-session", tradeAsSession ? "1" : "0");
    refresh();
  });
  $("side-long").addEventListener("click", () => setSide("long"));
  $("side-short").addEventListener("click", () => setSide("short"));
  $("lev").addEventListener("input", () => {
    $("lev-range").value = $("lev").value;
    if (snap) renderTicket(snap);
  });
  $("lev-range").addEventListener("input", () => {
    $("lev").value = $("lev-range").value;
    if (snap) renderTicket(snap);
  });
  $("margin").addEventListener("input", () => { if (snap) renderTicket(snap); });
  $("fund").addEventListener("change", () => { if (snap) renderTicket(snap); });
  $("cash-amt").addEventListener("input", () => paintCash());

  function cashProblem() {
    const v = micro(($("cash-amt").value || "").trim());
    if (v === null) return "Amount must be a number, like 100 or 12.5.";
    if (v <= 0n) return "Amount must be greater than zero.";
    return "";
  }
  function paintCash() {
    const note = $("cash-note");
    if (!note) return;
    const problem = cashProblem();
    note.hidden = !problem;
    note.textContent = problem;
  }
  function cashOrStop() {
    const problem = cashProblem();
    paintCash();
    if (problem) {
      toast(problem, "bad");
      return null;
    }
    return $("cash-amt").value.trim();
  }

  $("btn-deposit").addEventListener("click", () => {
    const amount = cashOrStop();
    if (amount === null) return;
    act("deposit", { amount });
  });
  $("btn-withdraw").addEventListener("click", () => {
    const amount = cashOrStop();
    if (amount === null) return;
    act("withdraw", { amount });
  });
  $("btn-faucet").addEventListener("click", () => act("faucet", { amount: "1000" }));
  $("btn-arm").addEventListener("click", () => act("arm-session", {}));
  $("btn-clear").addEventListener("click", () => act("clear-session", {}));
  $("btn-open").addEventListener("click", () => {
    if (snap) {
      const reasons = ticketReasons(snap);
      if (reasons.length) {
        toast(reasons[0], "bad");
        return;
      }
    }
    if (!marketOnChain(snap)) {
      const margin = micro(($("margin").value || "").trim());
      if (margin === null) {
        toast("Margin must be a number.", "bad");
        return;
      }
      const owner = (snap.actor && snap.actor.pubkey) || "";
      const who = (snap.actor && snap.actor.name === "wallet") ? "You" : ((snap.actor && snap.actor.name) || "desk");
      deskBook("open", {
        owner,
        who,
        side,
        margin: margin.toString(),
        leverage: Number($("lev").value),
        fundFrom: $("fund").value,
        liqFractionBps: snap.desk ? snap.desk.liqFractionBps : 5000,
      });
      return;
    }
    act("open", {
      side,
      margin: $("margin").value,
      leverage: Number($("lev").value),
      fundFrom: $("fund").value,
    });
  });
  $("btn-stake").addEventListener("click", () => act("stake", { amount: $("scar-amt").value }));
  $("btn-unstake").addEventListener("click", () => act("unstake", { amount: $("scar-amt").value }));
  $("btn-claim").addEventListener("click", () => act("claim", {}));
  $("btn-oracle").addEventListener("click", () => act("oracle", { price: $("op-px").value }));
  $("btn-fixture").addEventListener("click", () => act("fixture", { price: $("op-px").value }));
  $("btn-stale").addEventListener("click", () => act("stale-oracle", { price: $("op-px").value }));
  $("btn-agent").addEventListener("click", () => {
    let args = {};
    const raw = $("agent-args").value.trim();
    if (raw) {
      try { args = JSON.parse(raw); }
      catch { toast("Args must be JSON.", "bad"); return; }
    }
    act("agent", { tool: $("agent-tool").value, args });
  });
  $("tools").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    $("agent-tool").value = btn.dataset.tool;
  });
  $("pbody").addEventListener("click", (ev) => {
    const deskClose = ev.target.closest("[data-desk-close]");
    const close = ev.target.closest("[data-close]");
    const liq = ev.target.closest("[data-liq]");
    if (deskClose) {
      const owner = (snap && snap.actor && snap.actor.pubkey) || "";
      deskBook("close", { id: deskClose.dataset.deskClose, owner });
      return;
    }
    if (close) act("close", { positionIds: [close.dataset.close] });
    if (liq) act("liquidate", { positionIds: [liq.dataset.liq], owner: liq.dataset.owner });
  });

  const marketsNav = $("markets");
  if (marketsNav) {
    marketsNav.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-market]");
      if (!btn) return;
      setMarket(btn.dataset.market);
    });
  }
  const tfs = $("timeframes");
  if (tfs) {
    tfs.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-tf]");
      if (!btn) return;
      chartTf = btn.dataset.tf;
      sessionStorage.setItem("scardesk-tf", chartTf);
      for (const b of tfs.querySelectorAll("button")) {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      }
      const meta = $("chart-meta");
      if (meta) meta.textContent = chartTf;
      const c = ensureChart();
      if (c) {
        c.setTimeframe(chartTf);
        c.draw();
      }
    });
  }
  const ema = $("ema-toggle");
  if (ema) {
    ema.addEventListener("change", () => {
      const c = ensureChart();
      if (c) {
        c.setShowEma(ema.checked);
        c.draw();
      }
    });
  }
}

function setSide(next) {
  side = next;
  $("side-long").classList.toggle("on", next === "long");
  $("side-short").classList.toggle("on", next === "short");
  if (snap) renderTicket(snap);
}

bind();
showWalletChrome();
// Restore market + timeframe chrome before first paint.
for (const btn of document.querySelectorAll("#markets button")) {
  const on = btn.dataset.market === market;
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-selected", on ? "true" : "false");
}
for (const btn of document.querySelectorAll("#timeframes button")) {
  const on = btn.dataset.tf === chartTf;
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-selected", on ? "true" : "false");
}
const meta0 = $("chart-meta");
if (meta0) meta0.textContent = chartTf;
const eye0 = $("market-eyebrow");
if (eye0) eye0.textContent = market + " desk";
const tm0 = $("ticket-market");
if (tm0) tm0.textContent = market + " · isolated" + (market === "SOL/USD" ? "" : " · desk-book");
document.title = "Scardesk — " + market;
ensureChart();
// Notify server of URL-selected market so /api/state matches chrome.
const bootMarket = fetch("/api/market", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ market }),
}).catch(() => null);
// History is local ring buffer — paint chart even if /api/state 429s.
bootMarket.finally(() => loadHistory());
const savedKind = sessionStorage.getItem("scardesk-wallet-kind");
if (actor === "wallet" && savedKind && window.ScardeskWallet) {
  connectWallet(savedKind);
} else {
  if (actor === "wallet") actor = "alice";
  refresh();
}
armPoll(4000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(pollTimer);
    pollTimer = null;
  } else if (!pollTimer) {
    refresh();
    armPoll(refresh._slow ? 20000 : (refresh._pace || 4000));
  }
});
