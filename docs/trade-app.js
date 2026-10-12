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
  let side = "long";
  let market = "SOL/USD";
  let busy = false;
  let log = [];
  let ticksByMarket = { "SOL/USD": [], "BTC/USD": [], "ETH/USD": [] };
  let lastPxBy = {};
  let lastDirBy = {};
  let previewLiq = null;
  let quotes = {};
  let openLocked = false;
  const ATTEMPT_KEY = "scardesk.attempts.v1";
  const SESSION_KEY = "scardesk.session.v1";
  const FEEDS = {
    "BTC/USD": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    "ETH/USD": "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  };
  const PYTH_PUSH = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";

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
      balance: "可提现余额",
      walletHold: "钱包 dUSD",
      queued: "待兑付利润",
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
      chartNoteRef: "这条线是本次打开页面后采到的参考价，不是历史 K 线。这个市场不能开仓，链上结算仍是 SOL/USD。",
      cashOnly: "资金来源：现金保证金。债权开仓未开放。",
      hintWallet: "在钱包里，还没存进交易账户",
      hintCash: "已入金、未锁定。出金只取这一项",
      hintLocked: "锁在未平仓里，不能提出",
      hintUpnl: "按标记价估算，不是现金",
      hintQueued: "债权。没有到账期限，不能当余额",
      hintScar: "SCAR 不折成美元。奖励领取后才进可提现余额",
      locked: "持仓保证金",
      upnl: "未实现盈亏",
      scarLine: "SCAR / 奖励",
      history: "已结束",
      histNote: "平仓与清算分开",
      thStatus: "结果",
      thPnl: "标记盈亏",
      thRealized: "实际结果",
      closed: "已平仓",
      liquidated: "已清算",
      realizedAll: "没收全部保证金",
      noHist: "还没有已结束的仓。",
      scarTest: "机制测试",
      scarBody: "亏损会铸造 SCAR。对向仓刷奖励的路径还没关掉，所以这里不标价、不显示年化，也不把 SCAR 说成可兑付收益。",
      scarFree: "可用",
      scarStaked: "已质押",
      scarClaim: "可领取 dUSD",
      stake: "质押",
      unstake: "解除",
      claim: "领取奖励",
      session: "会话",
      sessionOff: "不自动交易",
      sessionBody: "可以登记一个会话公钥：它能开仓和平仓，不能出金、质押或领取。链上还没有保证金预算、市场、杠杆和期限的硬限制，所以本页不会替你自动下单。",
      sessionArm: "登记会话",
      sessionClear: "撤销会话",
      sessionNone: "未登记。撤销只影响之后的会话交易，已有仓仍用主钱包平。",
      sessionOn: "已登记",
      notTradable: "此市场不能开仓",
      priceBlocked: "停止新开仓",
      priceBlockedBody: "标记价不是新鲜的链上报价。平仓仍可用，新开仓先停。",
      loadingQuote: "正在加载报价",
      quoteMissing: "报价不可用，不能沿用上一个市场的价格",
      refOnly: "参考报价 · 链上结算仅 SOL",
      deskMark: "链上标记",
      samplePill: "采样",
      unknownTx: "结果待确认。已保留签名，不会自动再发一笔。",
      statusWait: "等待签名",
      statusSubmitted: "已提交",
      statusUnknown: "结果待确认",
      statusConfirmed: "已结算",
      statusFailed: "链上失败",
      statusCancelled: "已取消签名",
      withdrawCap: "出金不能超过可提现余额。",
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
      balance: "Withdrawable cash",
      walletHold: "Wallet dUSD",
      queued: "Queued claim",
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
      chartNoteRef: "This line is the reference price sampled since you opened the page. It is not history. This market cannot open. On-chain settlement stays SOL/USD.",
      cashOnly: "Fund from: cash margin. Queued-claim opens stay off.",
      hintWallet: "In the wallet. Not deposited yet",
      hintCash: "Deposited and free. Withdraw uses only this",
      hintLocked: "Locked in an open position",
      hintUpnl: "Mark estimate. Not cash",
      hintQueued: "A claim. No payout date. Not a balance",
      hintScar: "SCAR is not dollars. Rewards join cash only after claim",
      locked: "Margin locked",
      upnl: "Unrealized PnL",
      scarLine: "SCAR / rewards",
      history: "Closed",
      histNote: "Closes and liquidations stay distinct",
      thStatus: "Result",
      thPnl: "Mark PnL",
      thRealized: "Cash result",
      closed: "Closed",
      liquidated: "Liquidated",
      realizedAll: "Entire margin seized",
      noHist: "No closed or liquidated positions yet.",
      scarTest: "Mechanism test",
      scarBody: "Losses mint SCAR. The wash-trade path is still open, so this page shows no price, no APY, and no promise that SCAR pays cash.",
      scarFree: "Free",
      scarStaked: "Staked",
      scarClaim: "Claimable dUSD",
      stake: "Stake",
      unstake: "Unstake",
      claim: "Claim rewards",
      session: "Session",
      sessionOff: "No auto trading",
      sessionBody: "You can register a session key. It can open and close. It cannot withdraw, stake, or claim. The program has no margin budget, market, leverage, or expiry yet, so this page will not trade for you.",
      sessionArm: "Register session",
      sessionClear: "Revoke session",
      sessionNone: "None registered. Revoke stops later session trades. Open positions still close from the owner wallet.",
      sessionOn: "Registered",
      notTradable: "This market cannot open",
      priceBlocked: "New opens paused",
      priceBlockedBody: "The mark is not a fresh on-chain quote. Closes stay available. New opens wait.",
      loadingQuote: "Loading quote",
      quoteMissing: "Quote unavailable. The previous market's price is not reused",
      refOnly: "Reference quote · on-chain settlement is SOL only",
      deskMark: "On-chain mark",
      samplePill: "Sample",
      unknownTx: "Result not confirmed. The signature is kept. Nothing is sent again automatically.",
      statusWait: "Awaiting signature",
      statusSubmitted: "Submitted",
      statusUnknown: "Result pending",
      statusConfirmed: "Settled",
      statusFailed: "Chain failed",
      statusCancelled: "Signature cancelled",
      withdrawCap: "Withdraw cannot exceed withdrawable cash.",
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
    const attempts = attemptRows().slice().reverse();
    const seen = {};
    attempts.forEach((row) => { if (row.signature) seen[row.signature] = true; });
    const extras = log.filter((entry) => !entry.sig || !seen[entry.sig]);
    const lines = attempts.map((row) => {
      const link = row.signature
        ? `<a href="${S().explorerTx(row.signature)}" rel="noopener" target="_blank">${short(row.signature)}</a>`
        : "";
      return `<li><span class="mono">${attemptLabel(row.status)}</span> ${row.op || ""} ${row.detail || ""} ${link}</li>`;
    }).concat(extras.map((entry) => {
      const link = entry.sig
        ? `<a href="${S().explorerTx(entry.sig)}" rel="noopener" target="_blank">${short(entry.sig)}</a>`
        : "";
      return `<li><span class="mono">${entry.op || ""}</span> ${entry.detail || ""} ${link}</li>`;
    }));
    el.innerHTML = lines.length ? lines.join("") : "<li class='fine'>—</li>";
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
      const err = new Error(t("unknownTx"));
      err.signature = sig;
      err.code = "unknown";
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

  function attemptRows() {
    try { return JSON.parse(localStorage.getItem(ATTEMPT_KEY) || "[]"); }
    catch { return []; }
  }

  function saveAttempt(row) {
    const rows = attemptRows().filter((item) => item.id !== row.id);
    rows.push(row);
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(rows.slice(-40)));
    renderLog();
  }

  function pendingSame(op) {
    const owner = walletAdapter && walletAdapter.publicKey ? walletAdapter.publicKey.toBase58() : "";
    return attemptRows().find((row) => row.owner === owner && row.op === op && (row.status === "unknown" || row.status === "submitted"));
  }

  function attemptLabel(status) {
    return {
      "awaiting-signature": t("statusWait"),
      submitted: t("statusSubmitted"),
      unknown: t("statusUnknown"),
      confirmed: t("statusConfirmed"),
      failed: t("statusFailed"),
      cancelled: t("statusCancelled"),
    }[status] || status;
  }

  async function resumeAttempts() {
    if (!connection) return;
    const rows = attemptRows();
    let changed = false;
    for (const row of rows) {
      if (!row.signature || (row.status !== "unknown" && row.status !== "submitted")) continue;
      try {
        const st = await connection.getSignatureStatuses([row.signature], { searchTransactionHistory: true });
        const val = st && st.value && st.value[0];
        if (!val) continue;
        row.status = val.err ? "failed" : (val.confirmationStatus === "confirmed" || val.confirmationStatus === "finalized") ? "confirmed" : row.status;
        changed = true;
      } catch { /* keep the signature; do not send a new transaction */ }
    }
    if (changed) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(rows.slice(-40)));
  }

  function parsePyth(data, feedHex) {
    const offsets = [41, 42];
    for (const feedOff of offsets) {
      if (feedOff + 32 + 36 > data.length) continue;
      if (data.subarray(feedOff, feedOff + 32).toString("hex") !== feedHex) continue;
      return {
        price: data.readBigInt64LE(feedOff + 32),
        conf: data.readBigUInt64LE(feedOff + 40),
        expo: data.readInt32LE(feedOff + 48),
        publishTime: data.readBigInt64LE(feedOff + 52),
      };
    }
    return null;
  }

  async function loadExternalQuote(id) {
    const feed = FEEDS[id];
    if (!feed) return;
    if (!quotes[id]) quotes[id] = { status: "loading", market: id };
    const math = S().math;
    try {
      const res = await fetch("https://hermes.pyth.network/v2/updates/price/latest?ids[]=" + feed, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        const body = await res.json();
        const price = body && body.parsed && body.parsed[0] && body.parsed[0].price;
        if (price && price.price != null) {
          const scaled = math.scaleToExpo(price.price, price.expo, -8);
          if (scaled > 0n) {
            quotes[id] = {
              status: "reference",
              market: id,
              raw: scaled.toString(),
              text: math.fmtPrice(scaled),
              source: "hermes",
            };
            noteTick(id, Number(quotes[id].text));
            return;
          }
        }
      }
    } catch { /* Hermes is optional */ }
    let reason = "unread";
    try {
      ensureClient();
      const Pub = S().PublicKey;
      const shard = S().Buffer.alloc(2);
      shard.writeUInt16LE(0, 0);
      const [pda] = Pub.findProgramAddressSync(
        [shard, S().Buffer.from(feed, "hex")],
        new Pub(PYTH_PUSH)
      );
      const info = await S().withBackoff(() => connection.getAccountInfo(pda), 4);
      if (!info || !info.data) reason = "no-account";
      else {
        const parsed = parsePyth(S().Buffer.from(info.data), feed);
        if (!parsed || parsed.price <= 0n) reason = "no-parse";
        else {
          const age = BigInt(Math.floor(Date.now() / 1000)) - parsed.publishTime;
          const scaled = math.scaleToExpo(parsed.price, parsed.expo, -8);
          if (scaled > 0n && age <= 180n && age >= -5n) {
            quotes[id] = {
              status: "reference",
              market: id,
              raw: scaled.toString(),
              text: math.fmtPrice(scaled),
              source: "pyth",
            };
            noteTick(id, Number(quotes[id].text));
            return;
          }
          reason = "stale " + age.toString();
        }
      }
    } catch (err) {
      reason = (err && err.message) ? err.message : String(err);
    }
    if (!quotes[id] || quotes[id].status === "loading" || quotes[id].status === "unavailable") {
      quotes[id] = { status: "unavailable", market: id, reason: reason.slice(0, 160) };
    }
  }

  function displayQuote() {
    if (market === "SOL/USD") {
      if (!snap || !snap.price) return { status: "unavailable", market };
      return {
        status: snap.price.source === "pyth" ? "execution" : "fixture",
        market,
        text: snap.price.text,
        raw: snap.price.raw,
        source: snap.price.source,
      };
    }
    return quotes[market] || { status: "loading", market };
  }

  async function prepareAndSend(buildFn, meta) {
    ensureClient();
    const owner = walletAdapter.publicKey;
    const blocked = pendingSame(meta.op);
    if (blocked && blocked.signature) {
      const err = new Error(t("unknownTx") + " " + blocked.signature);
      err.code = "unknown";
      err.signature = blocked.signature;
      throw err;
    }
    const row = {
      id: String(Date.now()) + "-" + Math.random().toString(16).slice(2, 8),
      op: meta.op,
      detail: meta.detail || "",
      owner: owner.toBase58(),
      status: "awaiting-signature",
      signature: "",
      at: Date.now(),
    };
    saveAttempt(row);
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
    let signed;
    try {
      signed = await walletAdapter.signTransaction(tx);
    } catch (err) {
      row.status = "cancelled";
      saveAttempt(row);
      throw err;
    }
    const raw = signed.serialize();
    const sig = await S().withBackoff(() =>
      connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" })
    , 6);
    row.status = "submitted";
    row.signature = sig;
    saveAttempt(row);
    let landed;
    try {
      landed = await pollConfirmed(sig);
    } catch (err) {
      row.status = err.code === "unknown" ? "unknown" : "failed";
      row.signature = err.signature || sig;
      saveAttempt(row);
      throw err;
    }
    row.status = "confirmed";
    const logs = (landed && landed.meta && landed.meta.logMessages) || [];
    const events = S().eventsFromLogs(logs);
    const receipt = receiptLine(events);
    if (receipt) row.detail = receipt;
    saveAttempt(row);
    return { ok: true, sig, logs, events };
  }

  function receiptLine(events) {
    const settle = (events || []).find((ev) => ev.name === "settle");
    if (!settle) return "";
    const f = settle.fields || {};
    const status = f.status === "2" ? t("liquidated") : t("closed");
    const realized = f.realized != null ? f.realized : f.pnl;
    const bits = [status];
    if (f.mark != null) bits.push((lang === "zh" ? "标记 " : "mark ") + f.mark);
    if (realized != null) bits.push((lang === "zh" ? "实际 " : "realized ") + realized);
    if (f.paid && f.paid !== "0") bits.push((lang === "zh" ? "到账 " : "paid ") + f.paid);
    if (f.queued && f.queued !== "0") bits.push((lang === "zh" ? "待兑付 " : "queued ") + f.queued);
    if (f.status === "2") bits.push(t("realizedAll"));
    return bits.join(" · ");
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
    const positions = (focusKey ? (raw.positions || []) : [])
      .filter((p) => p.owner === focusKey)
      .map((p) => {
        const mark = price ? BigInt(price.raw) : 0n;
        const upnl = p.status === 0 && price ? math.calcPnl(p.side, p.entryPrice, mark, p.notional) : p.pnl;
        const markPnl = p.status === 0 ? upnl : p.pnl;
        const realized = p.status === 2 ? -p.margin : p.status === 0 ? upnl : p.pnl;
        return {
          id: p.id.toString(),
          side: p.side === 0 ? "long" : "short",
          status: p.status === 0 ? "open" : p.status === 2 ? "liquidated" : "closed",
          leverage: p.leverage,
          margin: math.fmtMicro(p.margin),
          marginMicro: p.margin,
          notional: math.fmtMicro(p.notional),
          entry: math.fmtPrice(p.entryPrice),
          liq: math.fmtPrice(p.liqPrice),
          upnl: upnl == null ? "0" : math.fmtMicro(upnl),
          upnlMicro: upnl || 0n,
          markPnl: markPnl == null ? "0" : math.fmtMicro(markPnl),
          realized: realized == null ? "0" : math.fmtMicro(realized),
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
            staked: user ? math.fmtMicro(user.staked) : "0",
            scarFree: user ? math.fmtMicro(user.scar > user.staked ? user.scar - user.staked : 0n) : "0",
            claimable: user ? math.fmtMicro(user.claimable) : "0",
            hasSession: !!(user && user.hasSession),
            session: user ? user.session : "",
          }
        : null,
      positions,
      addresses: raw.addresses,
    };
    if (price && price.text) noteTick("SOL/USD", Number(price.text));
    render();
    return snap;
  }

  function quoteText(q) {
    const hero = Number(q && q.text);
    if (!Number.isFinite(hero)) return "—";
    return hero.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderQuote() {
    const px = $("px");
    const src = $("src");
    const delta = $("delta");
    const note = $("px-note");
    const q = displayQuote();
    const missing = !q || q.status === "unavailable" || q.status === "loading" || q.raw == null;
    if (missing) {
      px.textContent = q && q.status === "loading" ? "…" : "—";
      px.className = "q-px";
      px.title = "";
      src.textContent = q && q.status === "loading" ? t("loadingQuote") : (q && q.reason ? t("quoteMissing") : t("quoteMissing"));
      if (px) px.title = (q && q.reason) || "";
      src.className = "pill";
      delta.textContent = "—";
      if (note) {
        note.hidden = false;
        note.textContent = t("quoteMissing");
      }
      const marketNote = $("market-note");
      if (marketNote) marketNote.textContent = market === "SOL/USD" ? t("priceBlockedBody") : t("refOnly");
      return;
    }
    const raw = BigInt(q.raw);
    px.textContent = quoteText(q);
    px.title = q.text || "";
    const reference = market !== "SOL/USD";
    const fixture = q.source === "fixture" || q.status === "fixture";
    src.textContent = reference ? t("refOnly") : fixture ? (lang === "zh" ? "fixture · 暂定" : "fixture · provisional") : t("deskMark");
    src.className = "pill" + (fixture ? " fixture" : "");
    const prev = lastPxBy[market];
    if (prev != null && raw !== prev) {
      lastDirBy[market] = raw > prev ? 1 : -1;
      const diff = raw - prev;
      delta.textContent = (diff > 0n ? "+" : "") + S().math.fmtPrice(diff);
    } else if (prev == null) {
      delta.textContent = t("flatNote");
    }
    lastPxBy[market] = raw;
    const dir = lastDirBy[market] === 1 ? "up" : lastDirBy[market] === -1 ? "dn" : "";
    px.className = dir ? "q-px " + dir : "q-px";
    if (dir) delta.className = "delta " + dir;
    if (note) {
      note.hidden = false;
      note.textContent = reference
        ? t("refOnly")
        : fixture
          ? (lang === "zh" ? "fixture 暂定标记。新开仓先停，平仓仍可用。" : "Fixture mark. New opens stay paused. Closes stay available.")
          : (lang === "zh" ? "管理员抄写的链上标记，不是 Pyth 直连。本页不称它为 LIVE。" : "Admin-copied on-chain mark, not a direct Pyth stream. This page does not call it LIVE.");
    }
    const marketNote = $("market-note");
    if (marketNote) {
      marketNote.textContent = reference ? t("notTradable") + " · " + t("refOnly") : fixture ? t("priceBlockedBody") : "";
    }
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function renderAccount() {
    const a = snap && snap.actor;
    const dash = "—";
    if (!a) {
      ["bal", "queued", "wallet-dusd", "locked", "upnl", "scar-line", "scar-free", "scar-staked", "scar-claim"].forEach((id) => setText(id, dash));
      setText("who", lang === "zh" ? "连接后显示地址。" : "Address shows after you connect.");
      setText("session-state", t("sessionNone"));
      return;
    }
    const open = ((snap && snap.positions) || []).filter((p) => p.open);
    let locked = 0n;
    let upnl = 0n;
    open.forEach((p) => {
      locked += BigInt(p.marginMicro || 0);
      upnl += BigInt(p.upnlMicro || 0);
    });
    const math = S().math;
    const upText = (upnl > 0n ? "+" : "") + math.fmtMicro(upnl);
    setText("wallet-dusd", a.walletDusd + " dUSD");
    setText("bal", a.missing ? dash : a.balance + " dUSD");
    setText("locked", a.missing ? dash : math.fmtMicro(locked) + " dUSD");
    setText("upnl", a.missing ? dash : upText + " dUSD");
    setText("queued", a.missing ? dash : a.queued + " dUSD");
    setText("scar-line", a.missing ? dash : a.scar + " SCAR · " + a.claimable + " dUSD");
    setText("scar-free", a.missing ? dash : a.scarFree + " SCAR");
    setText("scar-staked", a.missing ? dash : a.staked + " SCAR");
    setText("scar-claim", a.missing ? dash : a.claimable + " dUSD");
    setText("who", (a.missing
      ? (lang === "zh" ? "这个钱包还没在 desk 上。" : "Not on the desk yet.")
      : short(a.pubkey)) + " · " + a.sol + " SOL");
    setText("session-state", a.hasSession
      ? t("sessionOn") + " " + short(a.session)
      : t("sessionNone"));
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
    renderHistory(rows);
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

  function renderHistory(rows) {
    const body = $("hist-body");
    if (!body) return;
    const done = (rows || []).filter((p) => !p.open);
    if (!done.length) {
      body.innerHTML = `<tr class="empty"><td colspan="5" class="fine">${t("noHist")}</td></tr>`;
      return;
    }
    body.innerHTML = done.map((p) => {
      const label = p.status === "liquidated" ? t("liquidated") : t("closed");
      const realized = p.status === "liquidated" ? p.realized + " · " + t("realizedAll") : p.realized;
      return `
      <tr>
        <td data-label="${t("thStatus")}">${label}</td>
        <td data-label="${t("thSide")}">${sideWord(p.side)}</td>
        <td data-label="${t("thMargin")}">${p.margin}</td>
        <td data-label="${t("thPnl")}">${p.markPnl}</td>
        <td data-label="${t("thRealized")}">${realized}</td>
      </tr>`;
    }).join("");
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
    const shown = displayQuote();
    const mark = shown && shown.raw != null && shown.status !== "loading" && shown.status !== "unavailable"
      ? BigInt(shown.raw)
      : null;
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

  function openBlock() {
    if (market !== "SOL/USD") return "market";
    const q = displayQuote();
    if (!q || q.source !== "pyth" || q.status !== "execution") return "price";
    return "";
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
    const blocked = openBlock();
    openLocked = ph === "open" && !!blocked;
    if (openLocked) {
      btn.textContent = blocked === "market" ? t("notTradable") : t("priceBlocked");
      if (reason) reason.textContent = blocked === "market" ? t("refOnly") : t("priceBlockedBody");
    }
    const eyebrow = $("market-eyebrow");
    if (eyebrow) eyebrow.textContent = market + " · Devnet";
    const ticketMarket = $("ticket-market");
    if (ticketMarket) {
      ticketMarket.textContent = market === "SOL/USD" ? t("ticketChain") : market + " · " + t("refOnly");
    }
    const posMarket = $("pos-market");
    if (posMarket) posMarket.textContent = "SOL/USD";
  }

  function noteTick(marketId, price) {
    if (!Number.isFinite(price) || price <= 0) return;
    const bucket = ticksByMarket[marketId] || (ticksByMarket[marketId] = []);
    const now = Date.now();
    const last = bucket[bucket.length - 1];
    if (last && now - last.t < 15000 && last.c === price) return;
    bucket.push({ t: now, c: price });
    if (bucket.length > 240) bucket.shift();
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
    const series = ticksByMarket[market] || [];
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
    const chartPill = $("chart-pill");
    if (chartPill) {
      chartPill.textContent = t("samplePill");
      chartPill.classList.remove("live");
    }
    const chartMarket = $("chart-market");
    if (chartMarket) chartMarket.textContent = market;
    const chartNote = $("chart-note");
    if (chartNote) chartNote.textContent = market === "SOL/USD" ? t("chartNote") : t("chartNoteRef");
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
    if ($("btn-open")) $("btn-open").disabled = !!busy || openLocked;
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
    if (op === "open" && openBlock() === "market") {
      toast(t("notTradable"), "bad");
      return null;
    }
    if (op === "open" && openBlock() === "price") {
      toast(t("priceBlockedBody"), "bad");
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
            fundFrom: "balance",
          });
        }
        if (op === "close") return client.close({ signer: handle, owner, positionIds: extra.positionIds });
        if (op === "stake") return client.stake(handle, owner, extra.amount, false);
        if (op === "unstake") return client.stake(handle, owner, extra.amount, true);
        if (op === "claim") return client.claim(handle, owner);
        if (op === "set-session") return client.setSession(handle, extra.session);
        if (op === "clear-session") return client.clearSession(handle);
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
    if (openBlock() === "market") {
      toast(t("notTradable"), "bad");
      return;
    }
    if (openBlock() === "price") {
      toast(t("priceBlockedBody"), "bad");
      return;
    }
    const margin = ($("margin").value || "").trim();
    const leverage = Number($("lev").value);
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
    if (Number(margin) > bal + 1e-9) {
      toast(lang === "zh" ? "可提现余额不够这笔保证金。先入金，或把保证金调小。" : "Withdrawable cash is below this margin. Deposit, or lower it.", "bad");
      return;
    }
    await runOp("open", {
      side,
      margin,
      leverage,
      fundFrom: "balance",
      detail: side + " " + margin + " @" + leverage + "x cash",
    });
  }

  function scarAmount() {
    const amount = (($("scar-amt") && $("scar-amt").value) || "").trim();
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
      toast(lang === "zh" ? "SCAR 金额须大于 0。" : "SCAR amount must be greater than 0.", "bad");
      return null;
    }
    return amount;
  }

  async function armSession() {
    const actor = snap && snap.actor;
    if (actor && actor.hasSession) {
      toast(t("sessionOn") + " " + short(actor.session), "ok");
      return;
    }
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { rec = null; }
    if (!rec || !rec.publicKey) {
      const kp = S().Keypair.generate();
      rec = { publicKey: kp.publicKey.toBase58(), secret: Array.from(kp.secretKey) };
      localStorage.setItem(SESSION_KEY, JSON.stringify(rec));
    }
    const result = await runOp("set-session", { session: rec.publicKey, detail: short(rec.publicKey) });
    if (result && result.ok === false) return;
  }

  async function clearSessionKey() {
    const result = await runOp("clear-session", { detail: "clear session" });
    if (result && result.ok !== false) {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* keep the chain result */ }
    }
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
      const bal = snap && snap.actor ? Number(snap.actor.balance || 0) : 0;
      if (Number(amount) > bal + 1e-9) {
        toast(t("withdrawCap"), "bad");
        return;
      }
      await runOp("withdraw", { amount, detail: "withdraw " + amount });
    });
    const stakeBtn = $("btn-stake");
    const unstakeBtn = $("btn-unstake");
    const claimBtn = $("btn-claim");
    if (stakeBtn) stakeBtn.addEventListener("click", async () => {
      const amount = scarAmount();
      if (!amount) return;
      await runOp("stake", { amount, detail: "stake " + amount });
    });
    if (unstakeBtn) unstakeBtn.addEventListener("click", async () => {
      const amount = scarAmount();
      if (!amount) return;
      await runOp("unstake", { amount, detail: "unstake " + amount });
    });
    if (claimBtn) claimBtn.addEventListener("click", () => runOp("claim", { detail: "claim" }));
    const armBtn = $("btn-session-arm");
    const clearBtn = $("btn-session-clear");
    if (armBtn) armBtn.addEventListener("click", () => armSession());
    if (clearBtn) clearBtn.addEventListener("click", () => clearSessionKey());
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
        if (market !== "SOL/USD" && (!quotes[market] || quotes[market].status === "unavailable")) {
          loadExternalQuote(market).then(() => render());
        }
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
      await Promise.all([
        loadState(),
        loadExternalQuote("BTC/USD"),
        loadExternalQuote("ETH/USD"),
        resumeAttempts(),
      ]);
    } catch (err) {
      toast(explain(err), "bad");
      setLink("error", explain(err));
    } finally {
      setBusy(false);
      render();
      renderLog();
      requestAnimationFrame(() => drawChart());
    }
    setInterval(async () => {
      if (busy) return;
      try {
        await loadState();
        await loadExternalQuote("BTC/USD");
        await loadExternalQuote("ETH/USD");
        if (market !== "SOL/USD") render();
      } catch { /* soft */ }
    }, 20000);
  }

  boot();
})();
