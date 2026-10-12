/** Scardesk Pages trade — prepare+send in browser against Devnet RPC. No Node /api. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const S = () => window.Scardesk;
  if (!S()) {
    document.body.innerHTML = "<p style='padding:2rem;font-family:monospace'>Client bundle failed to load. Reload.</p>";
    return;
  }

  const DEP = S().DEPLOYMENT;
  const LANG_KEY = "scardesk.lang";
  let lang = localStorage.getItem(LANG_KEY) || "zh";
  let walletAdapter = null;
  let connection = null;
  let client = null;
  let snap = null;
  let lastPx = null;
  let lastDir = 0;
  let side = "long";
  let market = "SOL/USD";
  let busy = false;
  let log = [];

  const I18N = {
    zh: {
      banner: "Devnet · 真实签名 · 非主网",
      bannerBody: "本页在浏览器内构建并发送交易，直连 OnFinality Devnet RPC。无本机 desk、无隧道。一键领水：钱包签名铸造 1000 demo dUSD（60 秒冷却）。",
      connect: "连接钱包",
      mark: "标记价",
      account: "账户",
      ticket: "下单",
      positions: "持仓",
      deposit: "入金",
      withdraw: "出金",
      open: "开仓",
      close: "平仓",
      faucet: "领水 1000 dUSD",
      feeSol: "领 Fee SOL",
      long: "做多",
      short: "做空",
      balance: "余额",
      walletHold: "钱包 dUSD",
      queued: "排队中",
      opens: "持仓数",
      margin: "保证金 dUSD",
      leverage: "杠杆",
      fundFrom: "资金来源",
      fromBal: "余额",
      fromQ: "排队债权",
      refresh: "刷新",
      disconnect: "断开",
      preview: "只读预览",
      faucetGap: "领水为链上无权限 demo faucet：连接钱包后点「领水 1000 dUSD」，签名即铸造。60 秒冷却。Fee SOL 请用 faucet.solana.com。",
      feeSolHint: "Devnet SOL 请用 https://faucet.solana.com （本 RPC 拒绝 requestAirdrop）。",
      nextConnect: "下一步：连接 Phantom / Solflare / 浏览器密钥",
      nextFaucet: "下一步：点「领水 1000 dUSD」，签名后入金",
      nextDeposit: "下一步：入金 dUSD 到 desk",
      nextOpen: "下一步：开仓 SOL/USD",
      idle: "未连接 · Devnet",
      loading: "读取 desk…",
      notOnChain: "BTC/ETH 标记可读；开仓仅 SOL/USD 上链。",
    },
    en: {
      banner: "Devnet · real signatures · not mainnet",
      bannerBody: "This page builds and sends transactions in the browser against OnFinality Devnet RPC. No local desk, no tunnel. One-click faucet: wallet signs a 1000 demo dUSD mint (60s cooldown).",
      connect: "Connect wallet",
      mark: "Mark",
      account: "Account",
      ticket: "Ticket",
      positions: "Positions",
      deposit: "Deposit",
      withdraw: "Withdraw",
      open: "Open",
      close: "Close",
      faucet: "Faucet 1000 dUSD",
      feeSol: "Fee SOL",
      long: "Long",
      short: "Short",
      balance: "Balance",
      walletHold: "Wallet dUSD",
      queued: "Queued",
      opens: "Open",
      margin: "Margin dUSD",
      leverage: "Leverage",
      fundFrom: "Fund from",
      fromBal: "balance",
      fromQ: "queued",
      refresh: "Refresh",
      disconnect: "Disconnect",
      preview: "Read-only preview",
      faucetGap: "On-chain permissionless demo faucet: connect, click Faucet 1000 dUSD, sign. 60s cooldown. Fee SOL from faucet.solana.com.",
      feeSolHint: "Get Devnet SOL from https://faucet.solana.com (this RPC refuses requestAirdrop).",
      nextConnect: "Next: connect Phantom / Solflare / Browser key",
      nextFaucet: "Next: click Faucet 1000 dUSD, sign, then deposit",
      nextDeposit: "Next: deposit dUSD onto the desk",
      nextOpen: "Next: open a SOL/USD position",
      idle: "Not connected · Devnet",
      loading: "Reading desk…",
      notOnChain: "BTC/ETH marks are readable; only SOL/USD opens settle on-chain.",
    },
  };

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || (I18N.en[key] || key);
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && I18N[lang][key]) el.textContent = I18N[lang][key];
    });
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    $("lang-zh").classList.toggle("on", lang === "zh");
    $("lang-en").classList.toggle("on", lang === "en");
    $("lang-zh").setAttribute("aria-pressed", lang === "zh" ? "true" : "false");
    $("lang-en").setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    updateNext();
  }

  function short(pk) {
    if (!pk) return "—";
    const s = String(pk);
    return s.slice(0, 4) + "…" + s.slice(-4);
  }

  function toast(text, tone, ms) {
    const el = $("toast");
    el.hidden = false;
    el.dataset.tone = tone || "bad";
    el.textContent = text;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms || 5600);
  }

  function setBusy(on) {
    busy = on;
    document.body.dataset.busy = on ? "1" : "";
  }

  function setLink(phase, text) {
    const el = $("link-state");
    el.dataset.phase = phase;
    el.textContent = text;
  }

  function pushLog(entry) {
    log.unshift({ t: new Date().toISOString(), ...entry });
    if (log.length > 40) log.pop();
    renderLog();
  }

  function renderLog() {
    const el = $("tx-log");
    if (!el) return;
    if (!log.length) {
      el.innerHTML = "<li class='fine'>—</li>";
      return;
    }
    el.innerHTML = log.map((e) => {
      const link = e.sig
        ? `<a href="${S().explorerTx(e.sig)}" rel="noopener" target="_blank">${short(e.sig)}</a>`
        : "";
      return `<li><span class="mono">${e.op || ""}</span> ${e.detail || ""} ${link}</li>`;
    }).join("");
  }

  function explain(err, logs) {
    const msg = (err && err.message) || String(err || "failed");
    const blob = [msg].concat(logs || []).join("\n");
    if (/Phantom is not installed/i.test(blob)) return t("en") && lang === "zh"
      ? "未安装 Phantom。请用 Solflare 或浏览器密钥。"
      : "Phantom is not installed. Use Solflare, or Browser key.";
    if (/Solflare is not installed/i.test(blob)) return lang === "zh"
      ? "未安装 Solflare。请用 Phantom 或浏览器密钥。"
      : "Solflare is not installed. Use Phantom, or Browser key.";
    if (/too many requests|-32029|429/i.test(blob)) return lang === "zh"
      ? "RPC 繁忙 (429)。稍等再试，未新签。"
      : "RPC busy (429). Wait, then retry. Nothing new was signed.";
    if (/user rejected|rejected the request|user declined|cancelled|canceled/i.test(blob)) {
      return lang === "zh" ? "钱包拒绝签名。未发送。" : "Wallet rejected the signature. Nothing was sent.";
    }
    if (/blockhash not found|block height exceeded|blockhash expired/i.test(blob)) {
      return lang === "zh" ? "区块哈希过期。请重试。" : "Blockhash expired. Retry.";
    }
    const coded = /custom program error: 0x([0-9a-f]+)/i.exec(blob);
    const SCAR = {
      3: lang === "zh" ? "会话密钥被拒。可交易，不可出金/质押/领取。" : "Session key rejected.",
      4: lang === "zh" ? "无可用价格。" : "No usable price.",
      6: lang === "zh" ? "desk 上 dUSD 不足。先领水并入金。" : "Not enough dUSD on desk. Faucet, then deposit.",
      8: lang === "zh" ? "杠杆超过 desk 上限。" : "Leverage above desk maximum.",
      25: lang === "zh" ? "钱包 dUSD 不足。先领水。" : "Wallet dUSD empty. Faucet first.",
      28: lang === "zh" ? "领水冷却中（60 秒内不可再领）。稍后再试。" : "Faucet cooldown (60s). Wait, then retry.",
    };
    if (coded) {
      const n = parseInt(coded[1], 16);
      if (SCAR[n]) return SCAR[n];
    }
    if (/insufficient funds|insufficient lamports/i.test(blob)) {
      return lang === "zh" ? "SOL 不足支付手续费。请用 faucet.solana.com 领取 Devnet SOL。" : "Not enough SOL for fees. Use faucet.solana.com.";
    }
    const one = msg.replace(/\s+/g, " ").trim();
    return one.length > 200 ? one.slice(0, 200) + "…" : one;
  }

  function ensureClient() {
    if (!connection) connection = S().createConnection(DEP.rpc);
    if (!client) client = S().createClient(connection);
    return client;
  }

  async function pollConfirmed(sig) {
    const started = Date.now();
    let wait = 1200;
    while (Date.now() - started < 45000) {
      try {
        const tx = await S().withBackoff(() =>
          connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })
        );
        if (tx) {
          if (tx.meta && tx.meta.err) {
            const err = new Error("Transaction failed on chain.");
            err.logs = tx.meta.logMessages || [];
            err.signature = sig;
            throw err;
          }
          return tx;
        }
      } catch (err) {
        if (!S().isRateLimit(err) && !(err.logs && err.message === "Transaction failed on chain.")) throw err;
        if (err.logs && err.message === "Transaction failed on chain.") throw err;
        wait = Math.min(wait * 2, 8000);
      }
      await new Promise((r) => setTimeout(r, wait));
    }
    const err = new Error("Sent but not confirmed yet. Check explorer, then refresh.");
    err.signature = sig;
    throw err;
  }

  async function prepareAndSend(buildFn, meta) {
    ensureClient();
    const owner = walletAdapter.publicKey;
    let built = null;
    for (let i = 0; i < 6; i++) {
      try {
        built = await client.prepareAs(owner, buildFn);
        if (built && built.prepared) break;
      } catch (err) {
        if (!S().isRateLimit(err) || i === 5) throw err;
        await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, i)));
      }
    }
    if (!built || !built.prepared) throw new Error("prepare returned nothing");
    const tx = S().Transaction.from(S().bytesFromBase64(built.prepared));
    const signed = await walletAdapter.signTransaction(tx);
    const raw = signed.serialize();
    const sig = await S().withBackoff(() =>
      connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" })
    , 6);
    const landed = await pollConfirmed(sig);
    const logs = (landed && landed.meta && landed.meta.logMessages) || [];
    const events = S().eventsFromLogs(logs);
    pushLog({ op: meta.op, detail: meta.detail || "", sig });
    return { ok: true, sig, logs, events };
  }

  async function loadState() {
    ensureClient();
    setLink("setup", t("loading"));
    const owners = [];
    if (walletAdapter && walletAdapter.publicKey) owners.push(walletAdapter.publicKey);
    const raw = await client.snapshot(owners.length ? owners : []);
    const math = S().math;
    const layout = S().layout;
    let price = null;
    let priceSource = "";
    try {
      const resolved = math.resolvePrice(raw.desk, raw.oracle, raw.now);
      price = { text: math.fmtPrice(resolved.price), raw: resolved.price.toString(), source: resolved.source };
      priceSource = resolved.source;
    } catch {
      price = null;
    }
    const focusKey = walletAdapter && walletAdapter.publicKey ? walletAdapter.publicKey.toBase58() : null;
    const user = focusKey ? raw.users[focusKey] : null;
    let walletDusd = "0";
    let hasWallet = false;
    let sol = "—";
    if (focusKey) {
      const wInfo = await client.raw(client.walletPda(walletAdapter.publicKey));
      hasWallet = !!wInfo;
      if (wInfo && wInfo.data && wInfo.data.length >= 72) {
        try { walletDusd = math.fmtMicro(layout.tokenAmount(S().Buffer.from(wInfo.data))); } catch { walletDusd = "0"; }
      }
      try {
        const lamports = await S().withBackoff(() => connection.getBalance(walletAdapter.publicKey));
        sol = (lamports / 1e9).toFixed(3);
      } catch { sol = "—"; }
    }
    const positions = (raw.positions || [])
      .filter((p) => !focusKey || p.owner === focusKey)
      .map((p) => {
        const mark = price ? BigInt(price.raw) : 0n;
        const upnl = p.status === 0 && price ? math.calcPnl(p.side, p.entryPrice, mark, p.notional) : p.pnl;
        return {
          id: p.id.toString(),
          side: p.side === 0 ? "long" : "short",
          status: p.status === 0 ? "open" : p.status === 2 ? "liquidated" : "closed",
          leverage: p.leverage,
          margin: math.fmtMicro(p.margin),
          notional: math.fmtMicro(p.notional),
          entry: math.fmtPrice(p.entryPrice),
          liq: math.fmtPrice(p.liqPrice),
          upnl: upnl == null ? "0" : math.fmtMicro(upnl),
          mine: focusKey && p.owner === focusKey,
          open: p.status === 0,
        };
      });
    snap = {
      network: "devnet",
      rpc: DEP.rpc,
      price,
      priceSource,
      desk: raw.desk
        ? {
            maxLeverage: raw.desk.maxLeverage,
            liqFractionBps: raw.desk.liqFractionBps,
            lp: math.fmtMicro(raw.desk.lpCash),
            freeLp: math.fmtMicro(math.lpFreeOf(raw.desk)),
            fixture: math.fmtPrice(raw.desk.fixturePrice),
          }
        : null,
      actor: focusKey
        ? {
            pubkey: focusKey,
            missing: !user,
            balance: user ? math.fmtMicro(user.balance) : "0",
            queued: user ? math.fmtMicro(user.queued) : "0",
            openCount: user ? user.openCount : 0,
            walletDusd,
            hasWallet,
            sol,
            scar: user ? math.fmtMicro(user.scar) : "0",
          }
        : null,
      positions,
      addresses: raw.addresses,
    };
    render();
    return snap;
  }

  function renderQuote() {
    const px = $("px");
    const src = $("src");
    const delta = $("delta");
    const note = $("px-note");
    if (!snap || !snap.price) {
      px.textContent = "—";
      px.className = "q-px";
      src.textContent = "no price";
      src.className = "pill";
      delta.textContent = "—";
      note.textContent = lang === "zh" ? "无可用标记价。" : "No usable mark.";
      return;
    }
    const raw = BigInt(snap.price.raw);
    px.textContent = snap.price.text;
    const provisional = snap.price.source === "fixture";
    src.textContent = provisional
      ? (lang === "zh" ? "fixture · 暂定" : "fixture · provisional")
      : (snap.price.source === "pyth" ? (lang === "zh" ? "pyth · 链上" : "pyth · on-chain") : snap.price.source);
    src.className = "pill " + snap.price.source;
    if (lastPx !== null && raw !== lastPx) {
      lastDir = raw > lastPx ? 1 : -1;
      const diff = raw - lastPx;
      delta.textContent = (diff > 0n ? "+" : "") + S().math.fmtPrice(diff);
    } else if (lastPx === null) {
      delta.textContent = lang === "zh" ? "红=涨" : "red = up";
    }
    lastPx = raw;
    const dir = lastDir === 1 ? "up" : lastDir === -1 ? "dn" : "";
    px.className = dir ? "q-px " + dir : "q-px";
    if (dir) delta.className = "delta " + dir;
    note.textContent = snap.price.source === "pyth"
      ? (lang === "zh"
        ? "来自 Devnet 赞助 Pyth 账户写入的 desk oracle。非 Hermes 直连。"
        : "From desk oracle (sponsored Pyth account on Devnet). Not a live Hermes stream.")
      : (lang === "zh" ? "fixture 暂定标记。诚实标注。" : "Fixture mark — labeled honestly.");
  }

  function renderAccount() {
    const a = snap && snap.actor;
    if (!a) {
      $("bal").textContent = "—";
      $("queued").textContent = "—";
      $("opens").textContent = "—";
      $("wallet-dusd").textContent = "—";
      $("who").textContent = t("nextConnect");
      return;
    }
    $("bal").textContent = a.missing ? "—" : a.balance + " dUSD";
    $("queued").textContent = a.missing ? "—" : a.queued + " dUSD";
    $("opens").textContent = a.missing ? "—" : String(a.openCount);
    $("wallet-dusd").textContent = a.walletDusd + " dUSD";
    $("who").textContent = (a.missing
      ? (lang === "zh" ? "账户尚未在 desk 上。连接后会自动初始化。" : "Not on desk yet. Connect will init.")
      : "Owner " + short(a.pubkey)) + " · " + a.sol + " SOL";
  }

  function renderPositions() {
    const body = $("pos-body");
    const rows = (snap && snap.positions) || [];
    const open = rows.filter((p) => p.open);
    if (!open.length) {
      body.innerHTML = `<tr><td colspan="8" class="fine">${lang === "zh" ? "无持仓" : "No open positions"}</td></tr>`;
      return;
    }
    body.innerHTML = open.map((p) => `
      <tr>
        <td>${p.id}</td>
        <td class="${p.side === "long" ? "up" : "dn"}">${p.side}</td>
        <td>${p.leverage}×</td>
        <td>${p.margin}</td>
        <td>${p.notional}</td>
        <td>${p.entry}</td>
        <td class="${Number(p.upnl) >= 0 ? "up" : "dn"}">${p.upnl}</td>
        <td><button type="button" data-close="${p.id}" class="ghost">${t("close")}</button></td>
      </tr>`).join("");
    body.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closePos([btn.getAttribute("data-close")]));
    });
  }

  function updateNext() {
    const el = $("next-step");
    if (!el) return;
    if (!walletAdapter || !walletAdapter.publicKey) {
      el.textContent = t("nextConnect");
      return;
    }
    const a = snap && snap.actor;
    if (!a || a.missing) {
      el.textContent = t("nextConnect");
      return;
    }
    const bal = Number(a.balance || 0);
    const hold = Number(a.walletDusd || 0);
    if (bal <= 0 && hold <= 0) el.textContent = t("nextFaucet");
    else if (bal <= 0 && hold > 0) el.textContent = t("nextDeposit");
    else el.textContent = t("nextOpen");
  }

  function renderDeskMeta() {
    const d = snap && snap.desk;
    $("desk-meta").textContent = d
      ? `maxLeverage ${d.maxLeverage} · LP ${d.lp} · free ${d.freeLp} · fixture ${d.fixture}`
      : "—";
    $("prog-link").href = S().explorerAddr(DEP.programId);
    $("prog-link").textContent = short(DEP.programId);
  }

  function render() {
    renderQuote();
    renderAccount();
    renderPositions();
    renderDeskMeta();
    updateNext();
    const on = !!(walletAdapter && walletAdapter.publicKey);
    $("btn-disconnect").hidden = !on;
    ["btn-phantom", "btn-solflare", "btn-burner"].forEach((id) => {
      const b = $(id);
      if (b) b.disabled = on;
    });
    if (on) {
      setLink("connected", "devnet · " + walletAdapter.name + " " + short(walletAdapter.publicKey.toBase58()) + " · OnFinality");
    } else {
      setLink("idle", t("idle"));
    }
    const solOnly = market === "SOL/USD";
    $("btn-open").disabled = !on || !solOnly || busy;
    $("market-note").textContent = solOnly ? "" : t("notOnChain");
  }

  async function connect(kind) {
    if (busy) return;
    const factory = S().wallet[kind];
    if (!factory) return toast("Wallet adapter missing", "bad");
    setBusy(true);
    try {
      const adapter = factory();
      setLink("connecting", "Connecting " + adapter.name + "…");
      toast("Connecting " + adapter.name + "…", "wait");
      await adapter.connect();
      // Phantom/Solflare: force Devnet if they expose it
      try {
        if (adapter.provider && adapter.provider.request) {
          await adapter.provider.request({ method: "wallet_switchNetwork", params: { network: "devnet" } }).catch(() => {});
        }
      } catch { /* optional */ }
      walletAdapter = adapter;
      await loadState();
      const a = snap.actor;
      if (a && a.missing) {
        toast(lang === "zh" ? "创建 desk 用户…" : "Creating desk user…", "wait");
        await runOp("init-user");
        await loadState();
      }
      if (snap.actor && !snap.actor.hasWallet) {
        toast(lang === "zh" ? "创建 dUSD 钱包…" : "Creating dUSD wallet…", "wait");
        await runOp("init-wallet");
        await loadState();
      }
      toast(adapter.name + (lang === "zh" ? " 已连接。领水后入金。" : " connected. Faucet, then deposit."), "ok");
    } catch (err) {
      toast(explain(err), "bad");
      setLink("error", explain(err));
    } finally {
      setBusy(false);
      render();
    }
  }

  async function disconnect() {
    try { await walletAdapter?.disconnect(); } catch { /* */ }
    walletAdapter = null;
    snap = null;
    toast(lang === "zh" ? "已断开。" : "Disconnected.", "ok");
    render();
    setLink("idle", t("idle"));
  }

  async function runOp(op, extra) {
    if (!walletAdapter || !walletAdapter.publicKey) {
      toast(lang === "zh" ? "请先连接钱包。" : "Connect a wallet first.", "bad");
      return null;
    }
    if (market !== "SOL/USD" && (op === "open" || op === "close")) {
      toast(t("notOnChain"), "bad");
      return null;
    }
    const owner = walletAdapter.publicKey;
    const handle = { publicKey: owner };
    setBusy(true);
    try {
      const result = await prepareAndSend(async () => {
        if (op === "init-user") return client.initUser(handle);
        if (op === "init-wallet") return client.initWallet(handle);
        if (op === "faucet") return client.demoFaucet(handle);
        if (op === "deposit") return client.deposit(handle, extra.amount);
        if (op === "withdraw") return client.withdraw(handle, owner, extra.amount);
        if (op === "open") {
          return client.open({
            signer: handle,
            owner,
            side: extra.side,
            margin: extra.margin,
            leverage: Number(extra.leverage),
            fundFrom: extra.fundFrom || "balance",
          });
        }
        if (op === "close") return client.close({ signer: handle, owner, positionIds: extra.positionIds });
        throw new Error("unknown op " + op);
      }, { op, detail: extra && extra.detail ? extra.detail : "" });
      toast((lang === "zh" ? "已上链 " : "Landed ") + result.sig.slice(0, 12), "ok");
      await loadState();
      return result;
    } catch (err) {
      toast(explain(err, err.logs), "bad");
      if (err.signature) pushLog({ op, detail: "err", sig: err.signature });
      return { ok: false, error: explain(err, err.logs) };
    } finally {
      setBusy(false);
      render();
    }
  }

  async function closePos(ids) {
    await runOp("close", { positionIds: ids, detail: "close " + ids.join(",") });
  }

  function wire() {
    $("lang-zh").addEventListener("click", () => { lang = "zh"; localStorage.setItem(LANG_KEY, lang); applyI18n(); render(); });
    $("lang-en").addEventListener("click", () => { lang = "en"; localStorage.setItem(LANG_KEY, lang); applyI18n(); render(); });
    $("btn-phantom").addEventListener("click", () => connect("phantom"));
    $("btn-solflare").addEventListener("click", () => connect("solflare"));
    $("btn-burner").addEventListener("click", () => connect("burner"));
    $("btn-disconnect").addEventListener("click", () => disconnect());
    $("btn-refresh").addEventListener("click", async () => {
      setBusy(true);
      try { await loadState(); toast(lang === "zh" ? "已刷新" : "Refreshed", "ok", 2000); }
      catch (e) { toast(explain(e), "bad"); }
      finally { setBusy(false); render(); }
    });
    $("btn-faucet").addEventListener("click", async () => {
      await runOp("faucet", { detail: "demo faucet 1000 dUSD" });
    });
    $("btn-sol").addEventListener("click", () => {
      window.open("https://faucet.solana.com", "_blank", "noopener");
      toast(t("feeSolHint"), "wait", 8000);
    });
    $("btn-deposit").addEventListener("click", async () => {
      const amount = ($("cash-amt").value || "").trim();
      if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
        toast(lang === "zh" ? "金额须为数字，如 100。" : "Amount must be a number, like 100.", "bad");
        return;
      }
      await runOp("deposit", { amount, detail: amount + " dUSD" });
    });
    $("btn-withdraw").addEventListener("click", async () => {
      const amount = ($("cash-amt").value || "").trim();
      if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
        toast(lang === "zh" ? "金额须为数字。" : "Amount must be a number.", "bad");
        return;
      }
      await runOp("withdraw", { amount, detail: "withdraw " + amount });
    });
    $("side-long").addEventListener("click", () => {
      side = "long";
      $("side-long").classList.add("on");
      $("side-short").classList.remove("on");
    });
    $("side-short").addEventListener("click", () => {
      side = "short";
      $("side-short").classList.add("on");
      $("side-long").classList.remove("on");
    });
    $("btn-open").addEventListener("click", async () => {
      const margin = ($("margin").value || "").trim();
      const leverage = Number($("lev").value);
      const fundFrom = $("fund").value || "balance";
      const maxLev = (snap && snap.desk && snap.desk.maxLeverage) || 1001;
      if (!/^\d+(\.\d+)?$/.test(margin) || Number(margin) <= 0) {
        toast(lang === "zh" ? "保证金须大于 0。" : "Margin must be > 0.", "bad");
        return;
      }
      if (!Number.isFinite(leverage) || leverage < 1 || leverage > maxLev) {
        toast((lang === "zh" ? "杠杆须为 1–" : "Leverage must be 1–") + maxLev, "bad");
        return;
      }
      await runOp("open", {
        side,
        margin,
        leverage,
        fundFrom,
        detail: side + " " + margin + " @" + leverage + "x",
      });
    });
    document.querySelectorAll("[data-market]").forEach((btn) => {
      btn.addEventListener("click", () => {
        market = btn.getAttribute("data-market");
        document.querySelectorAll("[data-market]").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("on", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        $("market-eyebrow").textContent = market + (lang === "zh" ? " 交易台" : " desk");
        $("ticket-market").textContent = market + " · isolated";
        render();
      });
    });
  }

  // boot: read desk mark even without wallet
  async function boot() {
    applyI18n();
    wire();
    setBusy(true);
    try {
      await loadState();
    } catch (err) {
      toast(explain(err), "bad");
      setLink("error", explain(err));
    } finally {
      setBusy(false);
      render();
    }
    setInterval(async () => {
      if (busy) return;
      try { await loadState(); } catch { /* soft */ }
    }, 20000);
  }

  boot();
})();
