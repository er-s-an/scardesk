/** Integer settlement math. Must match programs/scardesk/src/math.rs. */

const BPS = 10_000n;

function sideCode(side) {
  if (side === "long" || side === 0 || side === "0") return 0;
  if (side === "short" || side === 1 || side === "1") return 1;
  throw new Error("side must be long or short");
}

function bi(n) {
  if (typeof n === "bigint") return n;
  if (typeof n === "number") {
    if (!Number.isFinite(n)) throw new Error("bad number");
    return BigInt(Math.trunc(n));
  }
  return BigInt(n);
}

/** Human dUSD (or a decimal string) → 6-decimal micro. */
function toMicro(amount) {
  if (typeof amount === "bigint") return amount;
  const text = String(amount).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error("bad amount " + text);
  const neg = text.startsWith("-");
  const [whole, frac = ""] = (neg ? text.slice(1) : text).split(".");
  const frac6 = (frac + "000000").slice(0, 6);
  const v = BigInt(whole) * 1_000_000n + BigInt(frac6);
  return neg ? -v : v;
}

function fmtMicro(amount, digits = 6) {
  const n = bi(amount);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const scale = 10n ** BigInt(digits);
  const whole = a / scale;
  let frac = (a % scale).toString().padStart(digits, "0").replace(/0+$/, "");
  const s = frac.length ? whole.toString() + "." + frac : whole.toString();
  return (neg ? "-" : "") + s;
}

function fmtPrice(price) {
  return fmtMicro(price, 8);
}

function calcPnl(side, entry, exit, notional) {
  side = sideCode(side);
  entry = bi(entry);
  exit = bi(exit);
  notional = bi(notional);
  if (entry <= 0n || exit <= 0n) return null;
  const diff = side === 0 ? exit - entry : entry - exit;
  return (notional * diff) / entry;
}

function calcLiq(side, entry, leverage, liqBps) {
  side = sideCode(side);
  entry = bi(entry);
  const move = (entry * bi(liqBps)) / (bi(leverage) * BPS);
  return side === 0 ? entry - move : entry + move;
}

function isLiquidatable(side, price, liqPrice) {
  side = sideCode(side);
  price = bi(price);
  liqPrice = bi(liqPrice);
  return side === 0 ? price <= liqPrice : price >= liqPrice;
}

function splitWin(pnl, haircutBps, lpFree) {
  const gross = bi(pnl);
  const fee = (gross * bi(haircutBps)) / BPS;
  const net = gross - fee;
  const free = bi(lpFree);
  const budget = gross < free ? gross : free;
  const feeTake = gross === 0n ? 0n : (fee * budget) / gross;
  const userTake = budget - feeTake;
  const shortfall = net - userTake;
  return { userTake, feeTake, shortfall, feeFull: fee, net, gross };
}

function scarForLoss(loss, emission) {
  return bi(loss) * bi(emission);
}

function lpFreeOf(desk) {
  const free = bi(desk.lpCash) - bi(desk.reservedFees);
  return free > 0n ? free : 0n;
}

/**
 * Predict queue-node creates and cash that must be offered to the FIFO
 * before this one position is settled. `price` is the mark that will be used.
 */
function planSettle(position, price, desk) {
  const raw = calcPnl(position.side, position.entryPrice, price, position.notional);
  const liq = isLiquidatable(position.side, price, position.liqPrice);
  const margin = bi(position.margin);
  const fund = position.fundFrom;
  const kinds = [];
  let payCash = 0n;
  let loss = 0n;
  if (liq) {
    loss = margin;
    if (fund === 0) payCash = loss;
  } else if (raw < 0n) {
    const mag = -raw;
    loss = mag > margin ? margin : mag;
    const rem = margin - loss;
    if (fund === 1 && rem > 0n) kinds.push("margin");
    if (fund === 0) payCash = loss;
  } else if (raw === 0n) {
    if (fund === 1 && margin > 0n) kinds.push("margin");
  } else {
    const split = splitWin(raw, desk.haircutBps, lpFreeOf(desk));
    if (fund === 1) kinds.push("margin");
    if (split.shortfall > 0n) kinds.push("profit");
  }
  return { raw, liq, loss, payCash, kinds };
}

function resolvePrice(desk, oracle, nowSec) {
  const now = bi(nowSec);
  const published = bi(oracle.publishTime);
  const age = now - published;
  const fresh =
    bi(oracle.price) > 0n &&
    oracle.expo === -8 &&
    published > 0n &&
    published <= now + 5n &&
    age >= 0n &&
    age <= bi(desk.oracleMaxAge);
  if (fresh) return { price: bi(oracle.price), source: "pyth" };
  if (bi(desk.fixturePrice) > 0n && desk.fixtureExpo === -8) {
    return { price: bi(desk.fixturePrice), source: "fixture" };
  }
  throw new Error("no usable price");
}

module.exports = {
  BPS,
  sideCode,
  bi,
  toMicro,
  fmtMicro,
  fmtPrice,
  calcPnl,
  calcLiq,
  isLiquidatable,
  splitWin,
  scarForLoss,
  lpFreeOf,
  planSettle,
  resolvePrice,
};
