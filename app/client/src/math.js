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
 * raw_target = raw_source × 10^(expo_source − expo_target).
 * expo −6 → −8 multiplies; expo −10 → −8 divides. Toward-zero on divide.
 */
function scaleToExpo(value, expo, target) {
  const v = bi(value);
  const e = Number(expo);
  const t = Number(target);
  if (!Number.isInteger(e) || !Number.isInteger(t)) throw new Error("bad expo");
  if (e < -18 || e > 18 || t < -18 || t > 18) throw new Error("expo out of range");
  const diff = e - t;
  if (diff === 0) return v;
  if (diff > 0) return v * (10n ** BigInt(diff));
  return v / (10n ** BigInt(-diff));
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

function priceFresh(price, expo, published, now, maxAge) {
  const stamp = bi(published);
  const age = bi(now) - stamp;
  return (
    bi(price) > 0n &&
    Number(expo) === -8 &&
    stamp > 0n &&
    stamp <= bi(now) + 5n &&
    age >= 0n &&
    age <= bi(maxAge)
  );
}

/**
 * Same window the program uses after the stale-price fix.
 * Fixture is not a silent fallback once fixture_time is outside oracle_max_age.
 */
function resolvePrice(desk, oracle, nowSec) {
  const now = bi(nowSec);
  if (priceFresh(oracle.price, oracle.expo, oracle.publishTime, now, desk.oracleMaxAge)) {
    return { price: bi(oracle.price), source: "pyth", fresh: true };
  }
  if (priceFresh(desk.fixturePrice, desk.fixtureExpo, desk.fixtureTime, now, desk.oracleMaxAge)) {
    return { price: bi(desk.fixturePrice), source: "fixture", fresh: true };
  }
  throw new Error("no usable price");
}

/**
 * Account list for one close/liquidate transaction.
 * Walks LP, reserved fees, and the FIFO the same way settle_many does,
 * including nodes created earlier in the same batch.
 * Does not mutate the inputs.
 */
function planBatch(positions, price, desk, queue) {
  let lpCash = bi(desk.lpCash);
  let reserved = bi(desk.reservedFees);
  let pending = bi(desk.pendingFees || 0);
  let head = bi(desk.queueHead);
  let tail = bi(desk.queueTail);
  let queueLen = bi(desk.queueLen);
  const haircut = bi(desk.haircutBps);
  const emission = bi(desk.emission || 0);
  const nodes = new Map();
  for (const n of queue || []) {
    const index = bi(n.index);
    nodes.set(index.toString(), {
      index,
      owner: n.owner,
      remaining: bi(n.remaining),
      pubkey: n.pubkey || null,
      isNew: false,
    });
  }
  const payPairs = [];
  let payIdx = 0;
  const newNodes = [];
  const receipts = [];

  function free() {
    const f = lpCash - reserved;
    return f > 0n ? f : 0n;
  }

  function enqueue(owner, amount, kind, positionId) {
    if (amount <= 0n) return;
    const index = tail;
    const node = {
      index,
      owner,
      remaining: amount,
      pubkey: null,
      isNew: true,
      kind,
      positionId,
    };
    nodes.set(index.toString(), node);
    newNodes.push({ index, kind, positionId, owner, amount });
    tail += 1n;
    queueLen += 1n;
  }

  function payQueue(cash) {
    if (cash === 0n || queueLen === 0n) return cash;
    let expect = head;
    let guard = 0;
    while (cash > 0n && queueLen > 0n) {
      if (guard++ > 100000) throw new Error("queue walk");
      if (payIdx >= payPairs.length) {
        const node = nodes.get(expect.toString());
        if (!node) throw new Error("missing queue node " + expect.toString());
        payPairs.push(node);
      }
      const node = payPairs[payIdx];
      if (node.index !== expect) throw new Error("queue cursor mismatch");
      payIdx += 1;
      if (node.remaining === 0n) {
        expect += 1n;
        head = expect;
        continue;
      }
      const pay = cash < node.remaining ? cash : node.remaining;
      node.remaining -= pay;
      cash -= pay;
      if (node.remaining === 0n) {
        queueLen -= 1n;
        expect += 1n;
        head = expect;
      } else {
        payIdx -= 1;
        break;
      }
    }
    if (cash > 0n && queueLen > 0n) throw new Error("queue accounts required");
    return cash;
  }

  for (const pos of positions) {
    const raw = calcPnl(pos.side, pos.entryPrice, price, pos.notional);
    if (raw == null) throw new Error("bad pnl");
    const liq = isLiquidatable(pos.side, price, pos.liqPrice);
    const margin = bi(pos.margin);
    const fund = pos.fundFrom === 1 || pos.fundFrom === "queued" ? 1 : 0;
    const owner = pos.owner;
    let loss = 0n;
    let returned = 0n;
    let userTake = 0n;
    let feeTake = 0n;
    let feeFull = 0n;
    let shortfall = 0n;
    let seized = 0n;

    if (liq) {
      loss = margin;
      seized = margin;
      if (fund === 0) lpCash += payQueue(loss);
    } else if (raw < 0n) {
      const mag = -raw;
      loss = mag > margin ? margin : mag;
      const rem = margin - loss;
      if (fund === 0) {
        returned = rem;
        lpCash += payQueue(loss);
      } else if (rem > 0n) {
        enqueue(owner, rem, "margin", pos.id);
      }
    } else if (raw === 0n) {
      if (fund === 0) returned = margin;
      else enqueue(owner, margin, "margin", pos.id);
    } else {
      const split = splitWin(raw, haircut, free());
      feeFull = split.feeFull;
      feeTake = split.feeTake;
      userTake = split.userTake;
      shortfall = split.shortfall;
      if (fund === 0) returned = margin;
      else enqueue(owner, margin, "margin", pos.id);
      if (userTake > 0n) {
        if (lpCash < userTake) throw new Error("insufficient lp");
        lpCash -= userTake;
      }
      if (feeTake > 0n) {
        pending += feeTake;
        reserved += feeTake;
      }
      if (shortfall > 0n) enqueue(owner, shortfall, "profit", pos.id);
    }

    const realized = liq ? -margin : raw < 0n ? -loss : raw;
    receipts.push({
      id: pos.id,
      raw,
      realized,
      liq,
      loss,
      seized,
      returned,
      userTake,
      feeTake,
      feeFull,
      shortfall,
      scar: loss > 0n ? loss * emission : 0n,
      status: liq ? "liquidated" : "closed",
    });
  }

  return {
    payNodes: payPairs.map((n) => ({
      index: n.index,
      owner: n.owner,
      pubkey: n.pubkey,
      isNew: !!n.isNew,
    })),
    newNodes: newNodes.map((n) => ({
      index: n.index,
      kind: n.kind,
      positionId: n.positionId,
      owner: n.owner,
      amount: n.amount,
    })),
    receipts,
    lpCash,
    reservedFees: reserved,
    pendingFees: pending,
    queueHead: head,
    queueTail: tail,
    queueLen,
  };
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
  priceFresh,
  scaleToExpo,
  planBatch,
};
