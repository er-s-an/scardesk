/**
 * SOL/BTC/ETH USD from Hermes, then from a sponsored Pyth price-feed account.
 * Fixture bytes are not produced here.
 *
 * Hermes price bytes have required an API key since 2026-08-26.
 * Set PYTH_API_KEY to send Authorization: Bearer. Without a key the
 * catalog still answers and the price endpoint returns 401.
 * The sponsored account is the public fallback: shard 0 of the Pyth
 * push oracle, readable with getAccountInfo. No key.
 */

const fs = require("fs");
const path = require("path");
const { PublicKey } = require("@solana/web3.js");
const { scaleToExpo } = require("./math");

const __d = typeof __dirname !== "undefined" ? __dirname : ".";
const APP_ROOT = path.join(__d, "..", "..");
const MARKETS_PATH = path.join(APP_ROOT, "config", "markets.json");

const FEED_SOL = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PUSH_ORACLES = [
  ["pyth-account", "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT"],
  ["pyth-account-pro", "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou"],
];
const READ_RPCS = [
  ["devnet", "https://solana-devnet.api.onfinality.io/public"],
  ["mainnet-beta", "https://solana.api.pocket.network"],
];

const DEFAULT_MARKETS = [
  {
    id: "SOL/USD",
    hermesId: FEED_SOL,
    fixturePrice: "10000000000",
    fixtureExpo: -8,
    onChain: true,
  },
  {
    id: "BTC/USD",
    hermesId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    fixturePrice: "6500000000000",
    fixtureExpo: -8,
    onChain: false,
  },
  {
    id: "ETH/USD",
    hermesId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    fixturePrice: "350000000000",
    fixtureExpo: -8,
    onChain: false,
  },
];

function loadMarketsConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(MARKETS_PATH, "utf8"));
    if (raw && Array.isArray(raw.markets) && raw.markets.length) {
      return {
        default: raw.default || raw.markets[0].id,
        markets: raw.markets,
      };
    }
  } catch {
    /* fall through */
  }
  return { default: "SOL/USD", markets: DEFAULT_MARKETS };
}

function listMarkets() {
  return loadMarketsConfig().markets.map((m) => ({
    id: m.id,
    base: m.base || String(m.id).split("/")[0],
    quote: m.quote || "USD",
    hermesId: m.hermesId,
    sponsoredAccount: m.sponsoredAccount || "",
    onChain: !!m.onChain,
    note: m.note || "",
    fixturePrice: String(m.fixturePrice || "0"),
    fixtureExpo: m.fixtureExpo == null ? -8 : Number(m.fixtureExpo),
  }));
}

function getMarket(id) {
  const cfg = loadMarketsConfig();
  const want = id || cfg.default;
  return (
    cfg.markets.find((m) => m.id === want || m.base === want) ||
    cfg.markets.find((m) => m.id === cfg.default) ||
    cfg.markets[0]
  );
}

function fromParsed(priceObj, source, attempts, feed, marketId) {
  if (!priceObj || priceObj.price == null) return null;
  const price = scaleToExpo(priceObj.price, priceObj.expo, -8);
  if (price <= 0n) return null;
  const conf = priceObj.conf == null ? 0n : scaleToExpo(priceObj.conf, priceObj.expo, -8);
  return {
    ok: true,
    market: marketId,
    source,
    feed,
    price: price.toString(),
    expo: -8,
    conf: (conf < 0n ? -conf : conf).toString(),
    publishTime: String(priceObj.publish_time || priceObj.publishTime || "0"),
    attempts,
  };
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  return { res, text };
}

function feedPda(programId, shard, feedHex) {
  const shardBuf = Buffer.alloc(2);
  shardBuf.writeUInt16LE(shard, 0);
  const feed = Buffer.from(feedHex, "hex");
  return PublicKey.findProgramAddressSync([shardBuf, feed], new PublicKey(programId))[0];
}

function parseUpdate(raw, feedHex) {
  const data = Buffer.from(raw);
  const offsets = [41, 42];
  for (const feedOff of offsets) {
    if (feedOff + 32 + 36 > data.length) continue;
    if (data.subarray(feedOff, feedOff + 32).toString("hex") !== feedHex) continue;
    const priceOff = feedOff + 32;
    const price = data.readBigInt64LE(priceOff);
    const conf = data.readBigUInt64LE(priceOff + 8);
    const expo = data.readInt32LE(priceOff + 16);
    const publishTime = data.readBigInt64LE(priceOff + 20);
    if (price <= 0n || !Number.isFinite(expo)) return null;
    return { price, conf, expo, publishTime };
  }
  return null;
}

async function readSponsoredAccount(attempts, feedHex, marketId) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const rpcOverride = process.env.PYTH_READ_RPC || "";
  const rpcs = rpcOverride ? [["custom", rpcOverride]] : READ_RPCS;
  for (const [cluster, rpc] of rpcs) {
    for (const [source, programId] of PUSH_ORACLES) {
      const address = feedPda(programId, 0, feedHex).toBase58();
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [address, { encoding: "base64", commitment: "confirmed" }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        const body = await res.json();
        const b64 = body?.result?.value?.data?.[0];
        if (!res.ok || !b64) {
          attempts.push({
            source,
            cluster,
            account: address,
            status: res.status,
            error: body?.error?.message || "account missing",
          });
          continue;
        }
        const parsed = parseUpdate(Buffer.from(b64, "base64"), feedHex);
        if (!parsed) {
          attempts.push({ source, cluster, account: address, error: "unparsed price update" });
          continue;
        }
        const age = now - parsed.publishTime;
        if (age > 120n || age < -5n) {
          attempts.push({
            source,
            cluster,
            account: address,
            error: "publish_time age " + age.toString() + "s",
            publishTime: parsed.publishTime.toString(),
          });
          continue;
        }
        const scaled = scaleToExpo(parsed.price, parsed.expo, -8);
        const conf = scaleToExpo(parsed.conf, parsed.expo, -8);
        if (scaled <= 0n) continue;
        attempts.push({ source, cluster, account: address, status: 200 });
        return {
          ok: true,
          market: marketId,
          source,
          cluster,
          account: address,
          rpc,
          feed: feedHex,
          price: scaled.toString(),
          expo: -8,
          conf: (conf < 0n ? -conf : conf).toString(),
          publishTime: parsed.publishTime.toString(),
          attempts,
          note:
            "Sponsored Pyth " +
            marketId +
            " account on " +
            cluster +
            ". Hermes still returns 401 without PYTH_API_KEY.",
        };
      } catch (err) {
        attempts.push({ source, cluster, account: address, error: err.message });
      }
    }
  }
  return null;
}

function fixtureQuote(market) {
  const feed = market.hermesId || FEED_SOL;
  let price = String(market.fixturePrice || "0");
  let expo = market.fixtureExpo == null ? -8 : Number(market.fixtureExpo);
  if (market.fixtureFile) {
    try {
      const file = path.join(APP_ROOT, "fixtures", market.fixtureFile);
      const snap = JSON.parse(fs.readFileSync(file, "utf8"));
      if (snap.snapshotPrice) price = String(snap.snapshotPrice);
      if (snap.expo != null) expo = Number(snap.expo);
    } catch {
      /* keep config defaults */
    }
  }
  const scaled = scaleToExpo(price, expo, -8);
  return {
    ok: false,
    market: market.id,
    source: "fixture",
    feed,
    price: scaled.toString(),
    expo: -8,
    conf: "0",
    publishTime: "0",
    provisional: true,
    attempts: [],
    error: "Hermes/Pyth price unavailable",
    note:
      "Hermes and the Pyth benchmark need PYTH_API_KEY (401 without it). The sponsored " +
      market.id +
      " account was also unreadable or older than 120 seconds. Using labeled fixture.",
  };
}

async function fetchMarketUsd(marketId) {
  const market = getMarket(marketId);
  const feed = market.hermesId || FEED_SOL;
  const attempts = [];
  const headers = { accept: "application/json", "user-agent": "scardesk/1.0" };
  if (process.env.PYTH_API_KEY) headers.authorization = "Bearer " + process.env.PYTH_API_KEY;

  const latest = "https://hermes.pyth.network/v2/updates/price/latest?ids[]=" + feed;
  try {
    const { res, text } = await getJson(latest, headers);
    attempts.push({ source: "hermes", status: res.status, market: market.id });
    if (res.ok) {
      const body = JSON.parse(text);
      const hit = fromParsed(body?.parsed?.[0]?.price, "hermes", attempts, feed, market.id);
      if (hit) return hit;
      attempts[attempts.length - 1].error = "no parsed price";
    } else {
      attempts[attempts.length - 1].error = text.slice(0, 120);
    }
  } catch (err) {
    attempts.push({ source: "hermes", error: err.message, market: market.id });
  }

  const bench = "https://benchmarks.pyth.network/v1/updates/price/latest?ids[]=" + feed;
  try {
    const { res, text } = await getJson(bench, headers);
    attempts.push({ source: "pyth-benchmarks", status: res.status, market: market.id });
    if (res.ok) {
      const body = JSON.parse(text);
      const hit = fromParsed(body?.parsed?.[0]?.price, "pyth-benchmarks", attempts, feed, market.id);
      if (hit) return hit;
    } else {
      attempts[attempts.length - 1].error = text.slice(0, 120);
    }
  } catch (err) {
    attempts.push({ source: "pyth-benchmarks", error: err.message, market: market.id });
  }

  const account = await readSponsoredAccount(attempts, feed, market.id);
  if (account) return account;

  const fail = fixtureQuote(market);
  fail.attempts = attempts;
  // Surface fixture as usable provisional quote (ok=false but price present).
  return fail;
}

async function fetchSolUsd() {
  return fetchMarketUsd("SOL/USD");
}

async function fetchAllMarkets() {
  const markets = listMarkets();
  const out = {};
  for (const m of markets) {
    out[m.id] = await fetchMarketUsd(m.id);
  }
  return out;
}

module.exports = {
  FEED: FEED_SOL,
  FEED_SOL,
  fetchSolUsd,
  fetchMarketUsd,
  fetchAllMarkets,
  listMarkets,
  getMarket,
  loadMarketsConfig,
  scaleToExpo,
  fixtureQuote,
};
