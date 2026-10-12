/**
 * SOL/USD from Hermes, then from a sponsored Pyth price-feed account.
 * Fixture bytes are not produced here.
 *
 * Hermes price bytes have required an API key since 2026-08-26.
 * Set PYTH_API_KEY to send Authorization: Bearer. Without a key the
 * catalog still answers and the price endpoint returns 401.
 * The sponsored account is the public fallback: shard 0 of the Pyth
 * push oracle, readable with getAccountInfo. No key.
 */

const { PublicKey } = require("@solana/web3.js");

const FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PUSH_ORACLES = [
  ["pyth-account", "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT"],
  ["pyth-account-pro", "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou"],
];
const READ_RPCS = [
  ["devnet", "https://solana-devnet.api.onfinality.io/public"],
  ["mainnet-beta", "https://solana.api.pocket.network"],
];

function scaleToExpo(value, expo, target) {
  let v = BigInt(value);
  let e = Number(expo);
  if (!Number.isFinite(e)) throw new Error("bad expo");
  while (e > target) {
    v /= 10n;
    e -= 1;
  }
  while (e < target) {
    v *= 10n;
    e += 1;
  }
  return v;
}

function fromParsed(priceObj, source, attempts) {
  if (!priceObj || priceObj.price == null) return null;
  const price = scaleToExpo(priceObj.price, priceObj.expo, -8);
  if (price <= 0n) return null;
  const conf = priceObj.conf == null ? 0n : scaleToExpo(priceObj.conf, priceObj.expo, -8);
  return {
    ok: true,
    source,
    feed: FEED,
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

async function fetchSolUsd() {
  const attempts = [];
  const headers = { accept: "application/json", "user-agent": "scardesk/1.0" };
  if (process.env.PYTH_API_KEY) headers.authorization = "Bearer " + process.env.PYTH_API_KEY;
  const latest = "https://hermes.pyth.network/v2/updates/price/latest?ids[]=" + FEED;
  try {
    const { res, text } = await getJson(latest, headers);
    attempts.push({ source: "hermes", status: res.status });
    if (res.ok) {
      const body = JSON.parse(text);
      const hit = fromParsed(body?.parsed?.[0]?.price, "hermes", attempts);
      if (hit) return hit;
      attempts[attempts.length - 1].error = "no parsed price";
    } else {
      attempts[attempts.length - 1].error = text.slice(0, 120);
    }
  } catch (err) {
    attempts.push({ source: "hermes", error: err.message });
  }

  const bench =
    "https://benchmarks.pyth.network/v1/updates/price/latest?ids[]=" + FEED;
  try {
    const { res, text } = await getJson(bench, headers);
    attempts.push({ source: "pyth-benchmarks", status: res.status });
    if (res.ok) {
      const body = JSON.parse(text);
      const hit = fromParsed(body?.parsed?.[0]?.price, "pyth-benchmarks", attempts);
      if (hit) return hit;
    } else {
      attempts[attempts.length - 1].error = text.slice(0, 120);
    }
  } catch (err) {
    attempts.push({ source: "pyth-benchmarks", error: err.message });
  }

  const account = await readSponsoredAccount(attempts);
  if (account) return account;

  return {
    ok: false,
    source: "",
    feed: FEED,
    attempts,
    provisional: true,
    error: "Hermes/Pyth price unavailable",
    note: "Hermes and the Pyth benchmark need PYTH_API_KEY (401 without it). The sponsored price-feed account was also unreadable or older than 120 seconds. The desk keeps the on-chain fixture, which is provisional.",
  };
}

function feedPda(programId, shard) {
  const shardBuf = Buffer.alloc(2);
  shardBuf.writeUInt16LE(shard, 0);
  const feed = Buffer.from(FEED, "hex");
  return PublicKey.findProgramAddressSync([shardBuf, feed], new PublicKey(programId))[0];
}

function parseUpdate(raw) {
  const data = Buffer.from(raw);
  const offsets = [41, 42];
  for (const feedOff of offsets) {
    if (feedOff + 32 + 36 > data.length) continue;
    if (data.subarray(feedOff, feedOff + 32).toString("hex") !== FEED) continue;
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

async function readSponsoredAccount(attempts) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const rpcOverride = process.env.PYTH_READ_RPC || "";
  const rpcs = rpcOverride ? [["custom", rpcOverride]] : READ_RPCS;
  for (const [cluster, rpc] of rpcs) {
    for (const [source, programId] of PUSH_ORACLES) {
      const address = feedPda(programId, 0).toBase58();
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
        const parsed = parseUpdate(Buffer.from(b64, "base64"));
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
          source,
          cluster,
          account: address,
          rpc,
          feed: FEED,
          price: scaled.toString(),
          expo: -8,
          conf: (conf < 0n ? -conf : conf).toString(),
          publishTime: parsed.publishTime.toString(),
          attempts,
          note: "Sponsored Pyth price-feed account on " + cluster + ". Hermes still returns 401 without PYTH_API_KEY.",
        };
      } catch (err) {
        attempts.push({ source, cluster, account: address, error: err.message });
      }
    }
  }
  return null;
}

module.exports = { FEED, fetchSolUsd, scaleToExpo };
