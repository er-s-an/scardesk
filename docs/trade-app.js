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
  let ticks = [];
  let previewLiq = null;

  const I18N = {
    zh: {
      banner: "Devnet · 真实签名 · 非主网",
      bannerBody: "本页在浏览器内构建并发送交易，直连 OnFinality Devnet RPC。无本机 desk、无隧道。一键领水：钱包签名铸造 1000 demo dUSD（60 秒冷却）。",
      connect: "连接钱包",
      mark: "标记价",
      account: "资金",
      ticket: "下单",
      positions: "持仓",
      deposit: "入金",
      withdraw: "出金",
      open: "开仓",
      close: "平仓",
      faucet: "领水 1000 dUSD",
      feeSol: "领 Fee SOL",
      browserKey: "浏览器密钥",
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
      nextConnect: "下一步：连接钱包。没有扩展就用浏览器密钥。",
      mobileHint: "手机：点 Phantom / Solflare 会尝试打开钱包 App。也可以在钱包自带浏览器里打开本页。",
      nextSol: "下一步：领取 Devnet Fee SOL（至少 0.02），然后回来刷新。",
      nextSetup: "下一步：正在把这个钱包登记到 desk。",
      nextFaucet: "下一步：领 1000 dUSD。签名后它在钱包里，还要入金。",
      nextDeposit: "下一步：把钱包里的 dUSD 入金到 desk，然后才能开仓。",
      nextOpen: "下一步：确认名义价值和清算价，然后开仓。",
      idle: "未连接 · Devnet",
      needSol: "Devnet SOL 不足（需 ≥0.02）。请先打开 faucet.solana.com 领 Fee SOL，再连接。",
      wrongNet: "钱包似乎在主网/非 Devnet。请在 Phantom/Solflare 切换到 Devnet 后再试。",
      rpcBusy: "RPC 忙（429），等几秒再试。未新签。",
      openFaucet: "打开 SOL 水龙头",
      mobileWallet: "手机请用钱包内置浏览器打开本页，或安装 Phantom / Solflare。",
      browserKeyHint: "无扩展时可用「浏览器密钥」（本机生成，仅 Devnet 演示）。",
      loading: "读取 desk…",
      notOnChain: "此页只结算 SOL/USD。",
      chart: "走势",
      chartEmpty: "正在读取标记价…",
      chartNote: "红线是这次打开页面后采到的 SOL 标记，不是历史 K 线。灰虚线是按当前保证金和杠杆算出的清算价。",
      chartWait: "标记刚到。多停一会，红线会沿这次会话往右长。",
      riskSum: "合成永续 · 亏损进 LP 并铸造 SCAR · 盈利按 FIFO 排队 · 非主网",
      riskBody: "孤立保证金，一次开满、一次平完，不能加仓。1001 倍时价格只要动几个基点，整笔保证金就会被清算。这是 Devnet 演示，钱包签的是真交易，不是主网资金。",
      stepConnect: "连接",
      stepSol: "Fee SOL",
      stepFaucet: "领水",
      stepDeposit: "入金",
      stepOpen: "开仓",
      connectHint: "没有钱包扩展时用浏览器密钥。密钥只留在这台浏览器，只签 Devnet。",
      notional: "名义价值",
      liq: "清算价",
      dist: "距离清算",
      amount: "金额",
      tx: "成交",
      footer: "Scardesk · Devnet 演示 · 真实签名 · 非主网资金 · 与 papertrade.xyz 无关",
      thSide: "方向",
      thLev: "杠杆",
      thMargin: "保证金",
      thEntry: "开仓价",
      thUpnl: "浮盈",
      thLiq: "清算价",
      noPos: "还没有仓。入金之后再开第一笔。",
      goLong: "开多",
      goShort: "开空",
      goSol: "领取 Fee SOL",
      goFaucet: "领水 1000 dUSD",
      goDeposit: "入金到 desk",
      goSetup: "登记到 desk",
      reasonConnect: "先连接。浏览器密钥不需要安装扩展。",
      reasonSol: "开仓要付 Devnet 手续费。领到 SOL 后点刷新。",
      reasonFaucet: "Desk 和钱包都还没有 dUSD。",
      reasonDeposit: "dUSD 还在钱包里。入金后才会变成可开仓余额。",
      reasonOpen: "开仓价用当前标记。平仓在持仓表里。",
      reasonSetup: "这个钱包还没在 desk 上建账户。",
      levWarn: "100 倍以上：价格稍微反向，整笔保证金就没了。",
      levExtreme: "1001 倍：大约几个基点就会清算。这是产品上限，不是默认。",
      ticketChain: "SOL/USD · 链上",
      eyebrow: "SOL/USD · Devnet",
      pythNote: "链上 Pyth",
      flatNote: "红 = 涨",
      chartSample: "本次会话采样",
    },
    en: {
      banner: "Devnet · real signatures · not mainnet",
      bannerBody: "This page builds and sends transactions in the browser against OnFinality Devnet RPC. No local desk, no tunnel. One-click faucet: wallet signs a 1000 demo dUSD mint (60s cooldown).",
      connect: "Connect wallet",
      mark: "Mark",
      account: "Funds",
      ticket: "Ticket",
      positions: "Positions",
      deposit: "Deposit",
      withdraw: "Withdraw",
      open: "Open",
      close: "Close",
      faucet: "Faucet 1000 dUSD",
      feeSol: "Fee SOL",
      browserKey: "Browser key",
      long: "Long",
      short: "Short",
      balance: "Balance",
      walletHold: "Wallet dUSD",
      queued: "Queued",
      opens: "Pos.",
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
      nextConnect: "Next: connect a wallet. No extension? Use the browser key.",
      mobileHint: "Phone: Phantom / Solflare tries to open the wallet app. You can also open this page in the wallet's browser.",
      nextSol: "Next: get Devnet fee SOL (at least 0.02), then come back and refresh.",
      nextSetup: "Next: registering this wallet on the desk.",
      nextFaucet: "Next: faucet 1000 dUSD. After you sign, it sits in the wallet — then deposit.",
      nextDeposit: "Next: deposit wallet dUSD onto the desk. Only then can you open.",
      nextOpen: "Next: check notional and liquidation, then open.",
      idle: "Not connected · Devnet",
      needSol: "Not enough Devnet SOL (≥0.02 needed). Open faucet.solana.com for fee SOL, then reconnect.",
      wrongNet: "Wallet looks like mainnet / not Devnet. Switch Phantom/Solflare to Devnet and retry.",
      rpcBusy: "RPC busy (429). Wait a few seconds, then retry. Nothing new was signed.",
      openFaucet: "Open SOL faucet",
      mobileWallet: "On mobile, open this page inside your wallet browser, or install Phantom / Solflare.",
      browserKeyHint: "No extension? Use Browser key (local Devnet demo key).",
      loading: "Reading desk…",
      notOnChain: "This page settles SOL/USD only.",
      chart: "Chart",
      chartEmpty: "Reading the mark…",
      chartNote: "The red line is the SOL mark sampled since you opened this page, not history. The gray dash is liquidation at the margin and leverage you typed.",
      chartWait: "Mark just arrived. Stay on the page and the line grows with this session.",
      riskSum: "Synthetic perps · losses fund the LP and mint SCAR · wins wait in FIFO · not mainnet",
      riskBody: "Isolated margin. One fill, full close, no top-up. At 1001× a few basis points liquidate the whole margin. Devnet demo: the wallet signs real transactions. Not mainnet funds.",
      stepConnect: "Connect",
      stepSol: "Fee SOL",
      stepFaucet: "Faucet",
      stepDeposit: "Deposit",
      stepOpen: "Open",
      connectHint: "No wallet extension? Use the browser key. It stays in this browser and only signs Devnet.",
      notional: "Notional",
      liq: "Liquidation",
      dist: "To liquidation",
      amount: "Amount",
      tx: "Fills",
      footer: "Scardesk · Devnet demo · real signatures · not mainnet funds · not papertrade.xyz",
      thSide: "Side",
      thLev: "Lev",
      thMargin: "Margin",
      thEntry: "Entry",
      thUpnl: "uPnL",
      thLiq: "Liq",
      noPos: "No position yet. Deposit, then open the first one.",
      goLong: "Open long",
      goShort: "Open short",
      goSol: "Get fee SOL",
      goFaucet: "Faucet 1000 dUSD",
      goDeposit: "Deposit to desk",
      goSetup: "Register on desk",
      reasonConnect: "Connect first. The browser key needs no extension.",
      reasonSol: "Opening needs Devnet SOL for fees. Refresh after the faucet.",
      reasonFaucet: "No dUSD on the desk or in the wallet yet.",
      reasonDeposit: "dUSD is still in the wallet. Deposit it before opening.",
      reasonOpen: "Opens at the current mark. Close from the positions table.",
      reasonSetup: "This wallet has no desk account yet.",
      levWarn: "Above 100× a small move against you takes the whole margin.",
      levExtreme: "1001× liquidates in a few basis points. That is the ceiling, not the default.",
      ticketChain: "SOL/USD · on-chain",
      eyebrow: "SOL/USD · Devnet",
      pythNote: "On-chain Pyth",
      flatNote: "Red = up",
      chartSample: "This session",
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
    if (/Opening Phantom app/i.test(blob)) return lang === "zh"
      ? "正在打开 Phantom… 若无反应，请在钱包内置浏览器打开本页，或用浏览器密钥。"
      : "Opening Phantom… If nothing opens, use the in-wallet browser, or Browser key.";
    if (/Opening Solflare app/i.test(blob)) return lang === "zh"
      ? "正在打开 Solflare… 若无反应，请在钱包内置浏览器打开本页，或用浏览器密钥。"
      : "Opening Solflare… If nothing opens, use the in-wallet browser, or Browser key.";
    if (/Phantom is not installed/i.test(blob)) return lang === "zh"
      ? "未安装 Phantom。手机请用钱包内置浏览器打开，或桌面装扩展 / 用浏览器密钥。"
      : "Phantom not installed. On phone open in wallet browser; on desktop install extension or use Browser key.";
    if (/Solflare is not installed/i.test(blob)) return lang === "zh"
      ? "未安装 Solflare。手机请用钱包内置浏览器打开，或桌面装扩展 / 用浏览器密钥。"
      : "Solflare not installed. On phone open in wallet browser; on desktop install extension or use Browser key.";
    if (/too many requests|-32029|429/i.test(blob)) return t("rpcBusy");
    if (/mainnet|wrong.?cluster|network mismatch|custom program error: 0x1|Attempt to load|invalid account data/i.test(blob) && /mainnet|cluster|network/i.test(blob)) {
      return t("wrongNet");
    }
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
    // Prefer getSignatureStatuses (HTTP) — avoid signatureSubscribe websockets that spike OnFinality 429.
    const started = Date.now();
    let wait = 1400;
    let confirmed = false;
    while (Date.now() - started < 45000) {
      try {
        const st = await S().withBackoff(() =>
          connection.getSignatureStatuses([sig], { searchTransactionHistory: true })
        , 5);
        const val = st && st.value && st.value[0];
        if (val) {
          if (val.err) {
            const err = new Error("Transaction failed on chain.");
            err.signature = sig;
            throw err;
          }
          const cs = val.confirmationStatus;
          if (cs === "confirmed" || cs === "finalized") {
            confirmed = true;
            break;
          }
        }
      } catch (err) {
        if (err.message === "Transaction failed on chain.") throw err;
        if (!S().isRateLimit(err)) throw err;
        wait = Math.min(wait * 2, 8000);
      }
      await new Promise((r) => setTimeout(r, wait));
    }
    if (!confirmed) {
      const err = new Error(lang === "zh"
        ? "已发送但未确认。打开 explorer 查看，再点刷新。"
        : "Sent but not confirmed yet. Check explorer, then refresh.");
      err.signature = sig;
      throw err;
    }
    // Optional meta/logs — soft-fail on 429
    try {
      const tx = await S().withBackoff(() =>
        connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })
      , 4);
      return tx || { meta: { err: null, logMessages: [] } };
    } catch (err) {
      if (S().isRateLimit(err)) return { meta: { err: null, logMessages: [] } };
      throw err;
    }
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
    if (price && price.text) noteTick(Number(price.text));
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
    const hero = Number(snap.price.text);
    px.textContent = Number.isFinite(hero)
      ? hero.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : snap.price.text;
    px.title = snap.price.text;
    const provisional = snap.price.source === "fixture";
    src.textContent = provisional
      ? (lang === "zh" ? "fixture · 暂定" : "fixture · provisional")
      : (snap.price.source === "pyth" ? t("pythNote") : snap.price.source);
    src.className = "pill " + snap.price.source;
    if (lastPx !== null && raw !== lastPx) {
      lastDir = raw > lastPx ? 1 : -1;
      const diff = raw - lastPx;
      delta.textContent = (diff > 0n ? "+" : "") + S().math.fmtPrice(diff);
    } else if (lastPx === null) {
      delta.textContent = t("flatNote");
    }
    lastPx = raw;
    const dir = lastDir === 1 ? "up" : lastDir === -1 ? "dn" : "";
    px.className = dir ? "q-px " + dir : "q-px";
    if (dir) delta.className = "delta " + dir;
    if (note) {
      note.textContent = snap.price.source === "pyth"
        ? (lang === "zh" ? "Devnet 上的 Pyth 账户写入 desk，不是 Hermes 直连。" : "Desk oracle from a sponsored Pyth account. Not a Hermes stream.")
        : (lang === "zh" ? "fixture 暂定标记。" : "Fixture mark.");
    }
  }

  function renderAccount() {
    const a = snap && snap.actor;
    if (!a) {
      $("bal").textContent = "—";
      $("queued").textContent = "—";
      $("opens").textContent = "—";
      $("wallet-dusd").textContent = "—";
      $("who").textContent = lang === "zh" ? "连接后显示地址。" : "Address shows after you connect.";
      return;
    }
    $("bal").textContent = a.missing ? "—" : a.balance + " dUSD";
    $("queued").textContent = a.missing ? "—" : a.queued + " dUSD";
    $("opens").textContent = a.missing ? "—" : String(a.openCount);
    $("wallet-dusd").textContent = a.walletDusd + " dUSD";
    $("who").textContent = (a.missing
      ? (lang === "zh" ? "这个钱包还没在 desk 上。" : "Not on the desk yet.")
      : short(a.pubkey)) + " · " + a.sol + " SOL";
    const pill = $("sol-pill");
    if (pill) pill.textContent = a.sol + " SOL";
  }

  function sideWord(sideName) {
    return sideName === "long" ? t("long") : t("short");
  }

  function renderPositions() {
    const body = $("pos-body");
    const rows = (snap && snap.positions) || [];
    const open = rows.filter((p) => p.open);
    if (!open.length) {
      body.innerHTML = `<tr class="empty"><td colspan="7" class="fine">${t("noPos")}</td></tr>`;
      return;
    }
    body.innerHTML = open.map((p) => {
      const up = Number(p.upnl);
      const upCls = Number.isFinite(up) && up < 0 ? "dn" : "up";
      const sideCls = p.side === "long" ? "up" : "dn";
      return `
      <tr>
        <td class="${sideCls}" data-label="${t("thSide")}">${sideWord(p.side)}</td>
        <td data-label="${t("thLev")}">${p.leverage}×</td>
        <td data-label="${t("thMargin")}">${p.margin}</td>
        <td data-label="${t("thEntry")}">${p.entry}</td>
        <td class="${upCls}" data-label="${t("thUpnl")}">${p.upnl}</td>
        <td data-label="${t("thLiq")}">${p.liq}</td>
        <td><button type="button" data-close="${p.id}" class="ghost">${t("close")}</button></td>
      </tr>`;
    }).join("");
    body.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closePos([btn.getAttribute("data-close")]));
    });
  }

  function solOf(actor) {
    if (!actor || actor.sol == null || actor.sol === "—") return NaN;
    const n = Number(actor.sol);
    return Number.isFinite(n) ? n : NaN;
  }

  function marginNeed() {
    const n = Number(($("margin") && $("margin").value) || 0);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function currentPhase() {
    if (!walletAdapter || !walletAdapter.publicKey) return "connect";
    const a = snap && snap.actor;
    const sol = solOf(a);
    if (Number.isFinite(sol) && sol < 0.02) return "need-sol";
    if (!a || a.missing) return "setup";
    const bal = Number(a.balance || 0);
    const hold = Number(a.walletDusd || 0);
    const need = marginNeed();
    if (bal + 1e-9 < need && hold <= 0) return "faucet";
    if (bal + 1e-9 < need && hold > 0) return "deposit";
    return "open";
  }

  function updateNext() {
    const el = $("next-step");
    if (!el) return;
    const key = {
      connect: "nextConnect",
      "need-sol": "nextSol",
      setup: "nextSetup",
      faucet: "nextFaucet",
      deposit: "nextDeposit",
      open: "nextOpen",
    }[currentPhase()];
    el.textContent = t(key || "nextConnect");
  }

  function renderSteps() {
    const ph = currentPhase();
    const order = ["connect", "need-sol", "faucet", "deposit", "open"];
    const idx = order.indexOf(ph === "setup" ? "need-sol" : ph);
    document.querySelectorAll("#steps li").forEach((li) => {
      const step = li.getAttribute("data-step");
      const i = order.indexOf(step);
      li.classList.toggle("now", step === ph || (ph === "setup" && step === "need-sol"));
      li.classList.toggle("done", idx > -1 && i > -1 && i < idx);
    });
  }

  function renderPreview() {
    const notionalEl = $("prev-notional");
    const liqEl = $("prev-liq");
    const distEl = $("prev-dist");
    const warn = $("lev-warn");
    previewLiq = null;
    if (!notionalEl || !liqEl || !distEl) return;
    const math = S().math;
    const lev = Number($("lev").value);
    const marginText = ($("margin").value || "").trim();
    const mark = snap && snap.price ? BigInt(snap.price.raw) : null;
    const liqBps = (snap && snap.desk && snap.desk.liqFractionBps) || 5000;
    const maxLev = (snap && snap.desk && snap.desk.maxLeverage) || 1001;
    document.querySelectorAll(".lev-chips button").forEach((btn) => {
      btn.classList.toggle("on", Number(btn.getAttribute("data-lev")) === lev);
    });
    if (warn) {
      const hot = Number.isFinite(lev) && lev >= 100;
      warn.hidden = !hot;
      warn.textContent = lev >= 1000 ? t("levExtreme") : t("levWarn");
    }
    if (!mark || !/^\d+(\.\d+)?$/.test(marginText) || !Number.isFinite(lev) || lev < 1 || lev > maxLev) {
      notionalEl.textContent = "—";
      liqEl.textContent = "—";
      distEl.textContent = "—";
      drawChart();
      return;
    }
    try {
      const micro = math.toMicro(marginText);
      const notional = micro * BigInt(Math.trunc(lev));
      const liq = math.calcLiq(side, mark, Math.trunc(lev), liqBps);
      previewLiq = Number(math.fmtPrice(liq));
      notionalEl.textContent = math.fmtMicro(notional) + " dUSD";
      liqEl.textContent = math.fmtPrice(liq);
      const entryN = Number(math.fmtPrice(mark));
      const pct = entryN > 0 ? Math.abs(entryN - previewLiq) / entryN * 100 : 0;
      const n = pct < 1 ? pct.toFixed(3) : pct.toFixed(2);
      distEl.textContent = lang === "zh"
        ? (side === "long" ? `下跌 ${n}% 则整笔保证金清算` : `上涨 ${n}% 则整笔保证金清算`)
        : (side === "long" ? `${n}% drop liquidates the margin` : `${n}% rise liquidates the margin`);
    } catch {
      notionalEl.textContent = "—";
      liqEl.textContent = "—";
      distEl.textContent = "—";
    }
    drawChart();
  }

  function renderGo() {
    const btn = $("btn-open");
    const reason = $("go-reason");
    const row = $("connect-row");
    if (!btn) return;
    const ph = currentPhase();
    if (row) row.hidden = ph !== "connect";
    btn.hidden = ph === "connect";
    btn.dataset.phase = ph;
    btn.dataset.side = side;
    const copy = {
      "need-sol": ["goSol", "reasonSol"],
      setup: ["goSetup", "reasonSetup"],
      faucet: ["goFaucet", "reasonFaucet"],
      deposit: ["goDeposit", "reasonDeposit"],
      open: [side === "long" ? "goLong" : "goShort", "reasonOpen"],
    }[ph] || ["goLong", "reasonConnect"];
    btn.textContent = t(copy[0]);
    if (reason) reason.textContent = t(ph === "connect" ? "reasonConnect" : copy[1]);
    const fundRow = $("fund-row");
    if (fundRow) {
      const queued = snap && snap.actor ? Number(snap.actor.queued || 0) : 0;
      fundRow.hidden = !(queued > 0);
    }
    const eyebrow = $("market-eyebrow");
    if (eyebrow) eyebrow.textContent = t("eyebrow");
    const ticketMarket = $("ticket-market");
    if (ticketMarket) ticketMarket.textContent = t("ticketChain");
  }

  function noteTick(price) {
    if (!Number.isFinite(price) || price <= 0) return;
    const now = Date.now();
    const last = ticks[ticks.length - 1];
    if (last && now - last.t < 15000 && last.c === price) return;
    ticks.push({ t: now, c: price });
    if (ticks.length > 240) ticks.shift();
  }

  function drawChart() {
    const canvas = $("mark-chart");
    const empty = $("chart-empty");
    const meta = $("chart-meta");
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 10 || h < 10) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const series = ticks;
    if (empty) {
      empty.hidden = series.length > 0;
      if (!series.length) empty.textContent = snap && snap.price ? t("chartWait") : t("chartEmpty");
    }
    if (meta) {
      meta.textContent = series.length
        ? t("chartSample") + " · " + series.length
        : "";
    }
    if (!series.length) return;
    const pad = { l: 12, r: 78, t: 18, b: 16 };
    const plotW = Math.max(10, w - pad.l - pad.r);
    const plotH = Math.max(10, h - pad.t - pad.b);
    const vals = series.map((p) => p.c);
    if (previewLiq != null && Number.isFinite(previewLiq)) vals.push(previewLiq);
    let lo = Math.min.apply(null, vals);
    let hi = Math.max.apply(null, vals);
    if (!(hi > lo)) {
      lo *= 0.998;
      hi *= 1.002;
    }
    const span = hi - lo || 1;
    lo -= span * 0.12;
    hi += span * 0.12;
    const yOf = (v) => pad.t + ((hi - v) / (hi - lo)) * plotH;
    const xOf = (i) => (series.length < 2 ? pad.l : pad.l + (i / (series.length - 1)) * plotW);
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(58,41,39,0.95)";
    ctx.fillStyle = "#A89A92";
    for (let i = 0; i < 4; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(2), pad.l + plotW + 8, y + 4);
    }
    if (series.length >= 2) {
      ctx.beginPath();
      series.forEach((p, i) => {
        const x = xOf(i);
        const y = yOf(p.c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#FF2418";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const lastX = xOf(series.length - 1);
      ctx.lineTo(lastX, pad.t + plotH);
      ctx.lineTo(xOf(0), pad.t + plotH);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,36,24,0.12)";
      ctx.fill();
    } else {
      const y = yOf(series[0].c);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#FF2418";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (previewLiq != null && Number.isFinite(previewLiq)) {
      const y = yOf(previewLiq);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "#8A847F";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#C8C2BC";
      ctx.fillText((lang === "zh" ? "清算 " : "Liq ") + previewLiq.toFixed(2), pad.l + 8, Math.max(14, y - 6));
    }
  }

  function renderDeskMeta() {
    const d = snap && snap.desk;
    $("desk-meta").textContent = d
      ? (lang === "zh"
        ? `最高 ${d.maxLeverage}× · LP ${d.lp}`
        : `Max ${d.maxLeverage}× · LP ${d.lp}`)
      : "—";
    $("prog-link").href = S().explorerAddr(DEP.programId);
    $("prog-link").textContent = short(DEP.programId);
  }

  function render() {
    renderQuote();
    renderAccount();
    renderPositions();
    renderDeskMeta();
    renderPreview();
    renderGo();
    renderSteps();
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
    if ($("btn-open")) $("btn-open").disabled = !!busy;
    if ($("market-note")) $("market-note").textContent = "";
    const pill = $("sol-pill");
    if (pill && !(snap && snap.actor)) pill.textContent = "— SOL";
  }

  const MIN_SOL_LAMPORTS = 20_000_000; // ~0.02 SOL for rent + fees

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  async function ensureDevnet(adapter) {
    const provider = adapter.provider;
    if (!provider || !provider.request) return { ok: true, switched: false };
    // Best-effort switch; many wallets ignore or fail silently.
    try {
      await provider.request({ method: "wallet_switchNetwork", params: { network: "devnet" } });
    } catch { /* optional */ }
    try {
      // Phantom sometimes exposes getAccount / connection network hints
      if (provider.isPhantom && provider._connection && provider._connection.rpcEndpoint) {
        const ep = String(provider._connection.rpcEndpoint);
        if (/mainnet/i.test(ep) && !/devnet/i.test(ep)) {
          return { ok: false, reason: "mainnet" };
        }
      }
    } catch { /* ignore */ }
    return { ok: true, switched: true };
  }

  async function connect(kind) {
    if (busy) return;
    const factory = S().wallet[kind];
    if (!factory) return toast("Wallet adapter missing", "bad");
    if ((kind === "phantom" || kind === "solflare") && isMobile()) {
      // Deep-link / guidance: in-app browser is the reliable path on phones.
      const hasExt = kind === "phantom"
        ? !!(window.phantom && window.phantom.solana) || !!(window.solana && window.solana.isPhantom)
        : !!(window.solflare && window.solflare.isSolflare);
      if (!hasExt) {
        toast(t("mobileWallet") + " " + t("browserKeyHint"), "wait", 9000);
      }
    }
    setBusy(true);
    try {
      const adapter = factory();
      setLink("connecting", "Connecting " + adapter.name + "…");
      toast("Connecting " + adapter.name + "…", "wait");
      await adapter.connect();
      const net = await ensureDevnet(adapter);
      if (!net.ok) {
        toast(t("wrongNet"), "bad", 10000);
        setLink("error", t("wrongNet"));
        try { await adapter.disconnect(); } catch { /* */ }
        return;
      }
      walletAdapter = adapter;
      ensureClient();
      // Gate: need Devnet SOL before initUser (rent). Clear ZH/EN toast + open faucet.
      let lamports = 0;
      try {
        lamports = await S().withBackoff(() => connection.getBalance(adapter.publicKey), 5);
      } catch (err) {
        if (S().isRateLimit(err)) {
          toast(t("rpcBusy"), "bad", 8000);
          setLink("error", t("rpcBusy"));
          return;
        }
        throw err;
      }
      if (lamports < MIN_SOL_LAMPORTS) {
        const sol = (lamports / 1e9).toFixed(4);
        toast(t("needSol") + " (" + sol + " SOL)", "bad", 12000);
        setLink("error", t("needSol"));
        try { window.open("https://faucet.solana.com", "_blank", "noopener"); } catch { /* */ }
        // Keep wallet connected so user can retry after faucet, but do not initUser.
        await loadState();
        return;
      }
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
      const msg = explain(err);
      toast(msg, "bad", 9000);
      setLink("error", msg);
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

  async function go() {
    const ph = currentPhase();
    if (ph === "connect") {
      toast(t("reasonConnect"), "wait");
      return;
    }
    if (ph === "need-sol") {
      window.open("https://faucet.solana.com", "_blank", "noopener");
      toast(t("feeSolHint"), "wait", 8000);
      return;
    }
    if (ph === "setup") {
      await runOp("init-user");
      await loadState();
      if (snap && snap.actor && !snap.actor.hasWallet) await runOp("init-wallet");
      return;
    }
    if (ph === "faucet") {
      await runOp("faucet", { detail: "demo faucet 1000 dUSD" });
      return;
    }
    if (ph === "deposit") {
      const amount = ($("cash-amt").value || "").trim();
      const hold = snap && snap.actor ? Number(snap.actor.walletDusd || 0) : 0;
      if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
        toast(lang === "zh" ? "入金金额须为数字，如 100。" : "Deposit amount must be a number, like 100.", "bad");
        return;
      }
      if (hold > 0 && Number(amount) > hold + 1e-9) {
        toast(lang === "zh"
          ? "钱包里只有 " + snap.actor.walletDusd + " dUSD。把金额调小。"
          : "Wallet only holds " + snap.actor.walletDusd + " dUSD. Lower the amount.", "bad");
        return;
      }
      await runOp("deposit", { amount, detail: amount + " dUSD" });
      return;
    }
    const margin = ($("margin").value || "").trim();
    const leverage = Number($("lev").value);
    const fundFrom = ($("fund") && $("fund").value) || "balance";
    const maxLev = (snap && snap.desk && snap.desk.maxLeverage) || 1001;
    if (!/^\d+(\.\d+)?$/.test(margin) || Number(margin) <= 0) {
      toast(lang === "zh" ? "保证金须大于 0。" : "Margin must be greater than 0.", "bad");
      return;
    }
    if (!Number.isFinite(leverage) || leverage < 1 || leverage > maxLev) {
      toast((lang === "zh" ? "杠杆须为 1–" : "Leverage must be 1–") + maxLev, "bad");
      return;
    }
    const bal = snap && snap.actor ? Number(snap.actor.balance || 0) : 0;
    if (fundFrom === "balance" && Number(margin) > bal + 1e-9) {
      toast(lang === "zh" ? "Desk 余额不够这笔保证金。先入金，或把保证金调小。" : "Desk balance is below this margin. Deposit, or lower it.", "bad");
      return;
    }
    await runOp("open", {
      side,
      margin,
      leverage,
      fundFrom,
      detail: side + " " + margin + " @" + leverage + "x",
    });
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
      renderPreview();
      renderGo();
    });
    $("side-short").addEventListener("click", () => {
      side = "short";
      $("side-short").classList.add("on");
      $("side-long").classList.remove("on");
      renderPreview();
      renderGo();
    });
    document.querySelectorAll("[data-connect]").forEach((btn) => {
      btn.addEventListener("click", () => connect(btn.getAttribute("data-connect")));
    });
    document.querySelectorAll(".lev-chips button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("lev").value = btn.getAttribute("data-lev");
        renderPreview();
        renderGo();
      });
    });
    ["margin", "lev", "cash-amt"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        renderPreview();
        renderGo();
        updateNext();
        renderSteps();
      });
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") go();
      });
    });
    window.addEventListener("resize", () => drawChart());
    $("btn-open").addEventListener("click", () => go());
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
      requestAnimationFrame(() => drawChart());
    }
    setInterval(async () => {
      if (busy) return;
      try { await loadState(); } catch { /* soft */ }
    }, 20000);
  }

  boot();
})();
