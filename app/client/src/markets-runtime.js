/**
 * Desk multi-market runtime: SOL (on-chain) + BTC/ETH (desk-book).
 * Keeps price caches, mark history for the chart, and a soft desk-book
 * for non-on-chain markets. Does not change program PDAs.
 */

const fs = require("fs");
const path = require("path");
const {
  listMarkets,
  getMarket,
  fetchMarketUsd,
  fixtureQuote,
  scaleToExpo,
} = require("./price");
const math = require("./math");

const __d = typeof __dirname !== "undefined" ? __dirname : ".";
const APP_ROOT = path.join(__d, "..", "..");
const HISTORY_LEN = 120;
const BOOK_PATH = path.join(APP_ROOT, "demo", "desk-book.json");

function emptyFeeds() {
  const feeds = {};
  for (const m of listMarkets()) {
    feeds[m.id] = fixtureQuote(getMarket(m.id));
  }
  return feeds;
}

function loadBook() {
  try {
    if (!fs.existsSync(BOOK_PATH)) return { nextId: 1, positions: [] };
    const raw = JSON.parse(fs.readFileSync(BOOK_PATH, "utf8"));
    return {
      nextId: Number(raw.nextId) || 1,
      positions: Array.isArray(raw.positions) ? raw.positions : [],
    };
  } catch {
    return { nextId: 1, positions: [] };
  }
}

function saveBook(book) {
  try {
    fs.mkdirSync(path.dirname(BOOK_PATH), { recursive: true });
    fs.writeFileSync(BOOK_PATH, JSON.stringify(book, null, 2));
  } catch {
    /* demo dir may be read-only */
  }
}

function seedHistory(marketId, priceRaw) {
  const bars = [];
  let px = BigInt(priceRaw || "0");
  if (px <= 0n) px = 1n;
  const now = Date.now();
  // Walk backward so the chart is not empty on first paint.
  let cursor = px;
  for (let i = HISTORY_LEN - 1; i >= 0; i--) {
    const wobble = Number((cursor / 200n) || 1n);
    const drift = BigInt(Math.round((Math.sin(i / 7) + Math.cos(i / 11)) * wobble));
    const open = cursor;
    const close = cursor + drift;
    const high = open > close ? open + (open - close) / 3n : close + (close - open) / 3n;
    const low = open < close ? open - (close - open) / 4n : close - (open - close) / 4n;
    bars.push({
      t: now - i * 60_000,
      o: open.toString(),
      h: (high > 0n ? high : 1n).toString(),
      l: (low > 0n ? low : 1n).toString(),
      c: (close > 0n ? close : 1n).toString(),
      v: String(80 + ((i * 17) % 40)),
    });
    cursor = close > 0n ? close : 1n;
  }
  // Force last close to the live mark.
  if (bars.length) {
    const last = bars[bars.length - 1];
    last.c = px.toString();
    if (BigInt(last.h) < px) last.h = px.toString();
    if (BigInt(last.l) > px) last.l = px.toString();
  }
  return bars;
}

function createRuntime() {
  const feeds = emptyFeeds();
  const history = {};
  const busy = {};
  let activeMarket = listMarkets()[0]?.id || "SOL/USD";
  let book = loadBook();

  for (const m of listMarkets()) {
    history[m.id] = seedHistory(m.id, feeds[m.id].price);
  }

  function setActive(id) {
    const m = getMarket(id);
    activeMarket = m.id;
    return activeMarket;
  }

  function remember(marketId, quote) {
    feeds[marketId] = quote;
    try {
      const file =
        marketId === "BTC/USD"
          ? "btc-hermes-last.json"
          : marketId === "ETH/USD"
            ? "eth-hermes-last.json"
            : "hermes-last.json";
      fs.writeFileSync(
        path.join(APP_ROOT, "fixtures", file),
        JSON.stringify({ ...quote, at: new Date().toISOString() }, null, 2)
      );
    } catch {
      /* ignore */
    }
    pushHistory(marketId, quote.price);
  }

  function pushHistory(marketId, priceRaw) {
    if (!history[marketId]) history[marketId] = [];
    const bars = history[marketId];
    const px = BigInt(priceRaw || "0");
    if (px <= 0n) return;
    const now = Date.now();
    const last = bars[bars.length - 1];
    if (last && now - last.t < 55_000) {
      last.c = px.toString();
      if (BigInt(last.h) < px) last.h = px.toString();
      if (BigInt(last.l) > px) last.l = px.toString();
      last.v = String(Number(last.v || "0") + 1);
      return;
    }
    const open = last ? BigInt(last.c) : px;
    bars.push({
      t: now,
      o: open.toString(),
      h: (px > open ? px : open).toString(),
      l: (px < open ? px : open).toString(),
      c: px.toString(),
      v: "1",
    });
    while (bars.length > HISTORY_LEN) bars.shift();
  }

  async function syncOne(marketId, { pushOracle } = {}) {
    if (busy[marketId]) return feeds[marketId];
    busy[marketId] = true;
    try {
      const quote = await fetchMarketUsd(marketId);
      // Fixture path returns ok:false but still has a usable price.
      if (!quote.price || BigInt(quote.price) <= 0n) {
        const fallback = fixtureQuote(getMarket(marketId));
        remember(marketId, fallback);
        return fallback;
      }
      if (typeof pushOracle === "function" && marketId === "SOL/USD" && quote.ok) {
        try {
          const pushed = await pushOracle(quote);
          if (pushed) {
            quote.sig = pushed.sig;
            quote.pushedPublishTime = pushed.publish;
            quote.clamped = !!pushed.clamped;
            if (pushed.note) quote.note = (quote.note || "") + " " + pushed.note;
          }
        } catch (err) {
          quote.pushError = err.message || String(err);
          quote.note =
            (quote.note || "") + " On-chain push failed: " + String(quote.pushError).slice(0, 160);
        }
      }
      remember(marketId, quote);
      return quote;
    } finally {
      busy[marketId] = false;
    }
  }

  async function syncAll(opts) {
    const out = {};
    for (const m of listMarkets()) {
      out[m.id] = await syncOne(m.id, opts);
    }
    return out;
  }

  function feedView(marketId) {
    const id = marketId || activeMarket;
    const feed = feeds[id] || fixtureQuote(getMarket(id));
    return {
      ok: !!feed.ok,
      market: id,
      source: feed.source || "",
      cluster: feed.cluster || "",
      note: feed.note || feed.error || "",
      publishTime: feed.publishTime || "",
      provisional: feed.ok ? !!feed.provisional : true,
      clamped: !!feed.clamped,
      pushError: feed.pushError || "",
      account: feed.account || "",
      price: feed.price || "0",
      expo: feed.expo == null ? -8 : feed.expo,
    };
  }

  function priceView(marketId, onChainPrice) {
    const id = marketId || activeMarket;
    const market = getMarket(id);
    // SOL prefers on-chain oracle when present; BTC/ETH always use desk feed.
    if (market.onChain && onChainPrice && onChainPrice.price != null) {
      return {
        text: math.fmtPrice(onChainPrice.price),
        source: onChainPrice.source || "oracle",
        raw: onChainPrice.price.toString(),
        market: id,
        onChain: true,
      };
    }
    const feed = feeds[id] || fixtureQuote(market);
    const raw = BigInt(feed.price || "0");
    return {
      text: math.fmtPrice(raw),
      source: feed.ok ? feed.source || "pyth" : "fixture",
      raw: raw.toString(),
      market: id,
      onChain: !!market.onChain,
      provisional: !feed.ok || !!feed.provisional,
    };
  }

  function historyView(marketId) {
    const id = marketId || activeMarket;
    const bars = history[id] || [];
    return {
      market: id,
      bars: bars.map((b) => ({
        t: b.t,
        o: math.fmtPrice(BigInt(b.o)),
        h: math.fmtPrice(BigInt(b.h)),
        l: math.fmtPrice(BigInt(b.l)),
        c: math.fmtPrice(BigInt(b.c)),
        oRaw: b.o,
        hRaw: b.h,
        lRaw: b.l,
        cRaw: b.c,
        v: b.v,
      })),
    };
  }

  function marketsPayload() {
    return listMarkets().map((m) => {
      const feed = feedView(m.id);
      return {
        id: m.id,
        base: m.base,
        quote: m.quote,
        onChain: m.onChain,
        note: m.note,
        hermesId: m.hermesId,
        sponsoredAccount: m.sponsoredAccount,
        mark: math.fmtPrice(BigInt(feed.price || "0")),
        markRaw: feed.price,
        source: feed.ok ? feed.source : "fixture",
        provisional: feed.provisional,
      };
    });
  }

  function openBook({ market, owner, who, side, marginMicro, leverage, fundFrom, liqFractionBps }) {
    const m = getMarket(market);
    if (m.onChain) {
      const err = new Error("SOL opens settle on-chain. Use the normal ticket path.");
      err.status = 400;
      throw err;
    }
    const feed = feeds[m.id] || fixtureQuote(m);
    const entry = BigInt(feed.price || "0");
    if (entry <= 0n) {
      const err = new Error("No mark for " + m.id + ". Wait for the price feed.");
      err.status = 400;
      throw err;
    }
    const margin = BigInt(marginMicro);
    const lev = Number(leverage);
    if (margin <= 0n || !Number.isFinite(lev) || lev < 1 || lev > 1001) {
      const err = new Error("Margin and leverage must be valid.");
      err.status = 400;
      throw err;
    }
    const notional = margin * BigInt(lev);
    const bps = BigInt(liqFractionBps || 5000);
    // Match program-ish liq: entry * (1 ± 1/lev * liqFraction)
    const move = (entry * bps) / (10000n * BigInt(lev));
    const isLong = side === "long" || side === 0;
    const liq = isLong ? entry - move : entry + move;
    const id = "desk-" + book.nextId++;
    const row = {
      id,
      market: m.id,
      owner: String(owner || ""),
      who: who || "You",
      side: isLong ? "long" : "short",
      status: "open",
      fundFrom: fundFrom === "queued" ? "queued" : "balance",
      leverage: lev,
      margin: margin.toString(),
      notional: notional.toString(),
      entryPrice: entry.toString(),
      liqPrice: (liq > 0n ? liq : 1n).toString(),
      exitPrice: "0",
      pnl: "0",
      scarMinted: "0",
      queuedCredit: "0",
      paidOut: "0",
      openedAt: new Date().toISOString(),
      deskBook: true,
    };
    book.positions.push(row);
    saveBook(book);
    return row;
  }

  function closeBook(id, owner) {
    const row = book.positions.find((p) => p.id === id && p.status === "open");
    if (!row) {
      const err = new Error("Desk-book position not found.");
      err.status = 404;
      throw err;
    }
    if (owner && row.owner && row.owner !== owner) {
      const err = new Error("That desk-book position belongs to another account.");
      err.status = 403;
      throw err;
    }
    const feed = feeds[row.market] || fixtureQuote(getMarket(row.market));
    const mark = BigInt(feed.price || row.entryPrice);
    const side = row.side === "long" ? 0 : 1;
    const pnl = math.calcPnl(side, BigInt(row.entryPrice), mark, BigInt(row.notional));
    row.status = "closed";
    row.exitPrice = mark.toString();
    row.pnl = (pnl == null ? 0n : pnl).toString();
    // Soft SCAR credit on qualified loss (desk-book only, not on-chain mint).
    if (pnl != null && pnl < 0n) {
      const loss = -pnl;
      row.scarMinted = (loss * 100n).toString(); // emission 100 SCAR / 1 dUSD
    }
    saveBook(book);
    return row;
  }

  function bookPositions(focusOwner, names, marketFilter) {
    return book.positions
      .filter((p) => !marketFilter || p.market === marketFilter)
      .map((p) => {
        const feed = feeds[p.market] || fixtureQuote(getMarket(p.market));
        const mark = BigInt(feed.price || p.entryPrice);
        const side = p.side === "long" ? 0 : 1;
        const upnl =
          p.status === "open"
            ? math.calcPnl(side, BigInt(p.entryPrice), mark, BigInt(p.notional))
            : BigInt(p.pnl || "0");
        const liqNow =
          p.status === "open" &&
          math.isLiquidatable(side, mark, BigInt(p.liqPrice));
        return {
          id: p.id,
          market: p.market,
          owner: p.owner,
          who: names[p.owner] || p.who || p.owner.slice(0, 4),
          side: p.side,
          status: p.status,
          fundFrom: p.fundFrom,
          leverage: p.leverage,
          margin: math.fmtMicro(BigInt(p.margin)),
          notional: math.fmtMicro(BigInt(p.notional)),
          mark: math.fmtPrice(mark),
          entry: math.fmtPrice(BigInt(p.entryPrice)),
          exit: p.status === "open" ? "" : math.fmtPrice(BigInt(p.exitPrice || "0")),
          liq: math.fmtPrice(BigInt(p.liqPrice)),
          upnl: upnl == null ? "0" : math.fmtMicro(upnl),
          upnlRaw: upnl == null ? "0" : upnl.toString(),
          scar: math.fmtMicro(BigInt(p.scarMinted || "0")),
          scarRaw: p.scarMinted || "0",
          queuedCredit: math.fmtMicro(BigInt(p.queuedCredit || "0")),
          paid: math.fmtMicro(BigInt(p.paidOut || "0")),
          liqNow,
          mine: !focusOwner || p.owner === focusOwner,
          deskBook: true,
          onChain: false,
        };
      });
  }

  return {
    listMarkets,
    getMarket,
    setActive,
    getActive: () => activeMarket,
    feeds,
    remember,
    syncOne,
    syncAll,
    feedView,
    priceView,
    historyView,
    marketsPayload,
    openBook,
    closeBook,
    bookPositions,
    scaleToExpo,
  };
}

module.exports = { createRuntime, listMarkets, getMarket };
