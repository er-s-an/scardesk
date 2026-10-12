/**
 * P0 regressions that do not touch the network.
 * B07 price exponent, B02 batch account plan, B04 receipt, B09 prepare lock.
 */
const assert = require("assert");
const { Keypair, PublicKey } = require("@solana/web3.js");
const math = require("../client/src/math");
const { DeskClient } = require("../client/src/chain");

const D = 1_000_000n;

function desk(over) {
  return {
    lpCash: 0n,
    reservedFees: 0n,
    pendingFees: 0n,
    queueHead: 0n,
    queueTail: 0n,
    queueLen: 0n,
    haircutBps: 200,
    emission: 100n,
    oracleMaxAge: 120n,
    fixturePrice: 0n,
    fixtureExpo: -8,
    fixtureTime: 0n,
    ...over,
  };
}

function pos(over) {
  return {
    id: 0n,
    owner: "Owner",
    side: 0,
    status: 0,
    fundFrom: 0,
    margin: 100n * D,
    entryPrice: 100n * 100_000_000n,
    liqPrice: 1n,
    notional: 100n * D,
    ...over,
  };
}

function testExpo() {
  assert.strictEqual(math.scaleToExpo(1234500n, -6, -8), 123450000n);
  assert.strictEqual(math.scaleToExpo(12345000000n, -10, -8), 123450000n);
  assert.strictEqual(math.scaleToExpo(123450000n, -8, -8), 123450000n);
  assert.strictEqual(math.scaleToExpo("1234500", -6, -8), 123450000n);
  assert.throws(() => math.scaleToExpo(1n, 1.5, -8), /bad expo/);
  assert.throws(() => math.scaleToExpo(1n, -30, -8), /expo out of range/);
}

function testBatchWins() {
  // Free LP = 100. Win 100, then win 1. First pays 98 and reserves 2.
  // Second must open a 0.98 claim. The old planner kept 2 free and omitted it.
  const price = 200n * 100_000_000n;
  const first = pos({
    id: 1n,
    margin: 10n * D,
    notional: 100n * D,
    entryPrice: 100n * 100_000_000n,
  });
  const second = pos({
    id: 2n,
    margin: 1n * D,
    notional: 1n * D,
    entryPrice: 100n * 100_000_000n,
  });
  // pnl = notional * (exit-entry) / entry. exit=200, entry=100 → pnl = notional.
  const plan = math.planBatch([first, second], price, desk({ lpCash: 100n * D }), []);
  assert.strictEqual(plan.newNodes.length, 1);
  assert.strictEqual(plan.newNodes[0].kind, "profit");
  assert.strictEqual(plan.newNodes[0].amount, 980_000n);
  assert.strictEqual(plan.newNodes[0].positionId, 2n);
  assert.strictEqual(plan.payNodes.length, 0);
  assert.strictEqual(plan.receipts[0].userTake, 98n * D);
  assert.strictEqual(plan.receipts[0].feeTake, 2n * D);
  assert.strictEqual(plan.receipts[0].shortfall, 0n);
  // The 2 dUSD fee stays inside LP cash and is reserved, so free LP is 0.
  assert.strictEqual(plan.lpCash, 2n * D);
  assert.strictEqual(plan.reservedFees, 2n * D);
  assert.strictEqual(plan.lpCash - plan.reservedFees, 0n);
}

function testLossThenWin() {
  // One mark for the whole batch. Loser entered higher, winner entered lower.
  // Cash loss 100 refills an empty LP. The following win is paid in full.
  const loser = pos({
    id: 1n,
    margin: 100n * D,
    notional: 200n * D,
    entryPrice: 100n * 100_000_000n,
    liqPrice: 1n,
  });
  const winner = pos({
    id: 2n,
    margin: 50n * D,
    notional: 50n * D,
    entryPrice: 25n * 100_000_000n,
    liqPrice: 1n,
  });
  const settled = math.planBatch([loser, winner], 50n * 100_000_000n, desk({}), []);
  assert.strictEqual(settled.receipts[0].loss, 100n * D);
  assert.strictEqual(settled.receipts[1].shortfall, 0n);
  assert.strictEqual(settled.receipts[1].userTake, 49n * D);
  assert.strictEqual(settled.newNodes.length, 0);
  assert.strictEqual(settled.payNodes.length, 0);
}

function testWinThenLossPaysNewClaim() {
  // LP 0, empty queue. Win 50 creates a 49 claim. Cash loss 100 pays that new node.
  const winner = pos({
    id: 1n,
    owner: "Alice",
    margin: 50n * D,
    notional: 50n * D,
    entryPrice: 25n * 100_000_000n,
  });
  const loser = pos({
    id: 2n,
    owner: "Bob",
    margin: 100n * D,
    notional: 200n * D,
    entryPrice: 100n * 100_000_000n,
    liqPrice: 1n,
  });
  const plan = math.planBatch([winner, loser], 50n * 100_000_000n, desk({}), []);
  assert.strictEqual(plan.newNodes.length, 1);
  assert.strictEqual(plan.newNodes[0].amount, 49n * D);
  assert.strictEqual(plan.payNodes.length, 1);
  assert.strictEqual(plan.payNodes[0].isNew, true);
  assert.strictEqual(plan.payNodes[0].index, plan.newNodes[0].index);
  assert.strictEqual(plan.payNodes[0].owner, "Alice");
  assert.strictEqual(plan.lpCash, 51n * D);
}

function testLiquidationReceipt() {
  // 100 margin, 1001x, entry 100. Mark just through the threshold.
  // Raw PnL is about -50, realized loss is the whole margin.
  const entry = 100n * 100_000_000n;
  const lev = 1001n;
  const liqBps = 5000n;
  const liq = entry - (entry * liqBps) / (lev * 10000n);
  const margin = 100n * D;
  const notional = margin * lev;
  const p = pos({
    margin,
    notional,
    entryPrice: entry,
    liqPrice: liq,
    leverage: 1001,
  });
  const plan = math.planBatch([p], liq, desk({}), []);
  const row = plan.receipts[0];
  assert.strictEqual(row.liq, true);
  assert.strictEqual(row.loss, margin);
  assert.strictEqual(row.realized, -margin);
  assert.ok(row.raw > -margin);
  assert.ok(row.raw < 0n);
  assert.notStrictEqual(row.raw, row.realized);
}

function testStaleFixture() {
  const now = 1_000n;
  const d = desk({
    fixturePrice: 100n * 100_000_000n,
    fixtureExpo: -8,
    fixtureTime: 1n,
    oracleMaxAge: 120n,
  });
  const oracle = { price: 0n, expo: -8, publishTime: 0n };
  assert.throws(() => math.resolvePrice(d, oracle, now), /no usable price/);
  const fresh = desk({
    fixturePrice: 100n * 100_000_000n,
    fixtureExpo: -8,
    fixtureTime: 900n,
    oracleMaxAge: 120n,
  });
  const hit = math.resolvePrice(fresh, oracle, now);
  assert.strictEqual(hit.source, "fixture");
  const pyth = math.resolvePrice(
    d,
    { price: 42n, expo: -8, publishTime: 990n },
    now
  );
  assert.strictEqual(pyth.source, "pyth");
  assert.strictEqual(pyth.price, 42n);
}

async function testPrepareLock() {
  const programId = Keypair.generate().publicKey;
  const client = new DeskClient({}, programId);
  const a = Keypair.generate().publicKey;
  const b = Keypair.generate().publicKey;
  const seen = [];
  const first = client.prepareAs(a, async () => {
    seen.push("a1:" + client.externalFeePayer.toBase58());
    await new Promise((r) => setTimeout(r, 40));
    seen.push("a2:" + client.externalFeePayer.toBase58());
    return "A";
  });
  const second = client.prepareAs(b, async () => {
    seen.push("b1:" + client.externalFeePayer.toBase58());
    await new Promise((r) => setTimeout(r, 5));
    seen.push("b2:" + client.externalFeePayer.toBase58());
    return "B";
  });
  const out = await Promise.all([first, second]);
  assert.deepStrictEqual(out, ["A", "B"]);
  assert.deepStrictEqual(seen, [
    "a1:" + a.toBase58(),
    "a2:" + a.toBase58(),
    "b1:" + b.toBase58(),
    "b2:" + b.toBase58(),
  ]);
  assert.strictEqual(client.prepareOnly, undefined);
  assert.strictEqual(client.externalFeePayer, undefined);
  void PublicKey;
}

async function main() {
  testExpo();
  testBatchWins();
  testLossThenWin();
  testWinThenLossPaysNewClaim();
  testLiquidationReceipt();
  testStaleFixture();
  await testPrepareLock();
  console.log("invariants ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
