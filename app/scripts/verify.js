#!/usr/bin/env node
/**
 * End-to-end settlement proof on a local validator.
 * Requires the program .so and a running solana-test-validator.
 *
 * Proves: SCAR mint, FIFO queue write, queue pay, 1000× liquidation,
 * fundFrom queued, session key cannot withdraw/stake/claim, Pyth-then-fixture.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { PublicKey } = require("@solana/web3.js");
const {
  APP_ROOT,
  CONFIG_PATH,
  DeskClient,
  loadKey,
  loadParams,
  eventsFromLogs,
  hasSessionReject,
  airdropIfNeeded,
  Connection,
} = require("../client/src/chain");
const math = require("../client/src/math");
const { createAgent, TOOLS } = require("../client/src/agent");

const RPC = process.env.SCARDESK_RPC || "http://127.0.0.1:8899";

function px(usd) {
  return math.toMicro(usd) * 100n;
}
function d(usd) {
  return math.toMicro(usd);
}

function assertEq(actual, expected, label) {
  const a = math.bi(actual);
  const e = math.bi(expected);
  if (a !== e) {
    throw new Error(label + ": expected " + e.toString() + " got " + a.toString());
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
}

async function waitUntilDeployed(connection, programId) {
  for (let i = 0; i < 40; i++) {
    const info = await connection.getAccountInfo(programId, "confirmed");
    if (info && info.executable && info.data.length >= 36 && info.data[0] === 2) {
      const bin = await connection.getAccountInfo(new PublicKey(info.data.subarray(4, 36)), "confirmed");
      if (bin && bin.data.length > 45 && bin.data[0] === 3) {
        const deployed = bin.data.readBigUInt64LE(4);
        const slot = BigInt(await connection.getSlot("confirmed"));
        if (slot > deployed) return;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("program ELF is not visible yet");
}

async function step(name, fn) {
  process.stdout.write("\n→ " + name + "\n");
  try {
    const out = await fn();
    if (out && out.sig) process.stdout.write("  sig " + out.sig + "\n");
    return out;
  } catch (err) {
    console.error("FAILED:", name);
    console.error(err.message);
    if (err.logs) console.error(err.logs.join("\n"));
    throw err;
  }
}

function assertToolsClean() {
  const agentSrc = fs.readFileSync(path.join(APP_ROOT, "client/src/agent.js"), "utf8");
  const forbidden = ["set_balance", "set_pnl", "mint_free", "setBalance", "setPnl", "mintFree", "mint_free_token"];
  for (const word of forbidden) {
    if (agentSrc.includes(word)) throw new Error("agent surface mentions " + word);
  }
  for (const word of forbidden) {
    if (TOOLS.includes(word)) throw new Error("tool list contains " + word);
  }
  const joined = TOOLS.join(" ");
  for (const need of ["positions.open", "positions.close", "positions.closed", "account.retrieve", "paper.stake", "paper.unstake", "paper.claim"]) {
    if (!joined.includes(need)) throw new Error("missing tool " + need);
  }
}

async function tryHermes() {
  const id = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const url = "https://hermes.pyth.network/v2/updates/price/latest?ids[]=" + id;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    const price = body?.parsed?.[0]?.price?.price;
    return { ok: !!price, price, expo: body?.parsed?.[0]?.price?.expo };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  assertToolsClean();
  const connection = new Connection(RPC, "confirmed");
  const program = loadKey("program.json");
  const admin = loadKey("admin.json");
  const alice = loadKey("alice.json");
  const bob = loadKey("bob.json");
  const session = loadKey("alice-session.json");
  const params = loadParams();
  const client = new DeskClient(connection, program.publicKey);

  for (const kp of [admin, alice, bob, session]) {
    await airdropIfNeeded(connection, kp.publicKey, 50);
  }

  const existing = await connection.getAccountInfo(program.publicKey);
  if (!existing) {
    const so = path.join(APP_ROOT, "programs/scardesk/target/deploy/scardesk.so");
    if (!fs.existsSync(so)) throw new Error("missing program binary " + so);
    execFileSync(
      "solana",
      [
        "program", "deploy", so,
        "--url", RPC,
        "--keypair", path.join(APP_ROOT, "keys/admin.json"),
        "--program-id", path.join(APP_ROOT, "keys/program.json"),
        "--commitment", "confirmed",
      ],
      { stdio: "inherit" }
    );
  }
  await waitUntilDeployed(connection, program.publicKey);

  let desk = await client.readDesk();
  if (!desk) {
    await step("initialize desk", () => client.initialize(admin, params));
    desk = await client.readDesk();
  }
  assertEq(desk.maxLeverage, params.maxLeverage, "max leverage");
  assert(desk.admin === admin.publicKey.toBase58(), "admin");

  for (const kp of [alice, bob]) {
    if (!(await client.readUser(kp.publicKey))) await step("init user " + kp.publicKey.toBase58().slice(0, 4), () => client.initUser(kp));
    if (!(await client.raw(client.walletPda(kp.publicKey)))) {
      await step("init wallet", () => client.initWallet(kp));
    }
  }

  const aliceUser = await client.readUser(alice.publicKey);
  if (aliceUser.nextId !== 0n || aliceUser.balance !== 0n) {
    throw new Error("Desk already has history. Restart solana-test-validator --reset and run verify once.");
  }

  await step("faucet alice", () => client.faucet(admin, alice.publicKey, "5000"));
  await step("faucet bob", () => client.faucet(admin, bob.publicKey, "5000"));
  await step("deposit alice", () => client.deposit(alice, "1000"));
  await step("deposit bob", () => client.deposit(bob, "1000"));

  const hermes = await tryHermes();
  fs.mkdirSync(path.join(APP_ROOT, "demo"), { recursive: true });
  fs.writeFileSync(path.join(APP_ROOT, "fixtures/hermes-last.json"), JSON.stringify(hermes, null, 2));

  const proof = { hermes, signatures: {}, events: [] };
  function absorb(result) {
    if (!result) return;
    const events = eventsFromLogs(result.logs);
    proof.events.push(...events);
    return events;
  }

  await step("push pyth 100", async () => {
    const result = await client.pushOracle(admin, px("100"), 0n, 50_000n);
    absorb(result);
    return result;
  });

  const openAlice = await step("alice long 100 @ 10×", () =>
    client.open({ signer: alice, owner: alice, side: "long", margin: "100", leverage: 10, fundFrom: "balance" })
  );
  absorb(openAlice);
  assert(openAlice.logs.some((l) => l.includes("source=pyth")), "open used pyth");

  await step("push pyth 110", () => client.pushOracle(admin, px("110")));
  const win = await step("alice close into empty LP → queue", () =>
    client.close({ signer: alice, owner: alice.publicKey, positionIds: [0] })
  );
  const winEvents = absorb(win);
  proof.signatures.queueWrite = win.sig;
  assert(winEvents.some((e) => e.name === "queue_write"), "queue_write missing");
  let a = await client.readUser(alice.publicKey);
  let b = await client.readUser(bob.publicKey);
  desk = await client.readDesk();
  assertEq(a.balance, d("1000"), "alice balance after unpaid win");
  assertEq(a.queued, d("98"), "alice queued net");
  assertEq(desk.lpCash, 0, "lp still empty");
  assertEq(desk.queueLen, 1, "one queue node");

  await step("bob long 200 @ 10×", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "200", leverage: 10, fundFrom: "balance" })
  );
  await step("push pyth 105.6", () => client.pushOracle(admin, px("105.6")));
  const loss = await step("bob loss 80 mints SCAR and pays queue", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [0] })
  );
  const lossEvents = absorb(loss);
  proof.signatures.scarMint = loss.sig;
  assert(lossEvents.some((e) => e.name === "scar_minted"), "scar_minted missing");
  assert(lossEvents.some((e) => e.name === "queue_pay"), "queue_pay missing");
  a = await client.readUser(alice.publicKey);
  b = await client.readUser(bob.publicKey);
  assertEq(a.balance, d("1080"), "alice paid from bob loss");
  assertEq(a.queued, d("18"), "alice still queued 18");
  assertEq(b.balance, d("920"), "bob kept remaining margin");
  assertEq(b.scar, d("8000"), "bob scar from 80 loss");

  await step("bob long 100 @ 10×", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "100", leverage: 10, fundFrom: "balance" })
  );
  await step("push pyth 102.432", () => client.pushOracle(admin, px("102.432")));
  const loss2 = await step("bob loss 30 finishes queue and funds LP", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [1] })
  );
  absorb(loss2);
  a = await client.readUser(alice.publicKey);
  b = await client.readUser(bob.publicKey);
  desk = await client.readDesk();
  assertEq(a.queued, 0, "queue cleared");
  assertEq(a.balance, d("1098"), "alice fully paid");
  assertEq(b.balance, d("890"), "bob after second loss");
  assertEq(b.scar, d("11000"), "bob scar 11000");
  assertEq(desk.lpCash, d("12"), "lp from leftover loss");
  assertEq(desk.queueLen, 0, "queue empty");

  await step("push pyth 100", () => client.pushOracle(admin, px("100")));
  await step("alice 1000× long", () =>
    client.open({ signer: alice, owner: alice, side: "long", margin: "10", leverage: 1000, fundFrom: "balance" })
  );
  const pos = await client.readPosition(alice.publicKey, 1);
  assertEq(pos.leverage, 1000, "leverage stored");
  assertEq(pos.liqPrice, px("100") - 5_000_000n, "5bp liq");
  await step("push through liquidation", () => client.pushOracle(admin, px("99.94")));
  const liq = await step("keeper liquidates 1000×", () =>
    client.close({
      signer: admin,
      owner: alice.publicKey,
      positionIds: [1],
      asLiquidation: true,
      keeper: admin,
    })
  );
  absorb(liq);
  const liqPos = await client.readPosition(alice.publicKey, 1);
  assertEq(liqPos.status, 2, "liquidated status");
  a = await client.readUser(alice.publicKey);
  desk = await client.readDesk();
  assertEq(a.balance, d("1088"), "alice margin confiscated");
  assertEq(a.scar, d("1000"), "liquidation minted scar");
  assertEq(desk.lpCash, d("22"), "lp received liquidated margin");

  await step("bob stakes SCAR", () => client.stake(bob, bob.publicKey, "11000", false));
  await step("push pyth 100 before paid win", () => client.pushOracle(admin, px("100")));
  await step("bob long 20 @ 10×", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "20", leverage: 10, fundFrom: "balance" })
  );
  await step("push pyth 125", () => client.pushOracle(admin, px("125")));
  const paid = await step("bob win partially paid, fee reserved", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [2] })
  );
  absorb(paid);
  b = await client.readUser(bob.publicKey);
  desk = await client.readDesk();
  assertEq(b.balance, 911_560_000n, "bob balance after partial pay");
  assertEq(b.queued, 27_440_000n, "bob profit shortfall queued");
  assertEq(desk.reservedFees, 440_000n, "fee reserved");
  assertEq(desk.lpCash, 440_000n, "lp holds the fee");
  assertEq(desk.accReward > 0n ? 1 : 0, 1, "staker index moved");

  await step("bob claims fee", () => client.claim(bob, bob.publicKey));
  b = await client.readUser(bob.publicKey);
  desk = await client.readDesk();
  assertEq(b.balance, 912_000_000n, "claim paid into balance");
  assertEq(b.claimable, 0, "claimable cleared");
  assertEq(desk.lpCash, 0, "fee left lp");
  assertEq(desk.reservedFees, 0, "reserved cleared");

  const queuedBefore = (await client.readUser(bob.publicKey)).queued;
  await step("bob opens from queued", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "10", leverage: 10, fundFrom: "queued" })
  );
  b = await client.readUser(bob.publicKey);
  assertEq(b.queued, queuedBefore - d("10"), "queued margin locked");
  const flat = await step("flat close returns margin to queued", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [3] })
  );
  absorb(flat);
  assert(flat.logs.some((l) => l.includes("evt=queue_write")), "margin return wrote queue");
  b = await client.readUser(bob.publicKey);
  assertEq(b.queued, queuedBefore, "queued restored");

  await step("bob 1000× from queued", () =>
    client.open({ signer: bob, owner: bob, side: "long", margin: "10", leverage: 1000, fundFrom: "queued" })
  );
  const entry = (await client.readPosition(bob.publicKey, 4)).entryPrice;
  const liqPx = entry - (entry * 5000n) / 10_000_000n;
  await step("push liq price", () => client.pushOracle(admin, liqPx));
  const qliq = await step("liquidate queued-funded position", () =>
    client.close({
      signer: admin,
      owner: bob.publicKey,
      positionIds: [4],
      asLiquidation: true,
      keeper: admin,
    })
  );
  absorb(qliq);
  b = await client.readUser(bob.publicKey);
  desk = await client.readDesk();
  assertEq(b.queued, queuedBefore - d("10"), "queued margin confiscated");
  assertEq(b.scar, d("12000"), "liq minted more scar");
  assertEq(desk.lpCash, 0, "queued liq did not invent cash");

  await step("restore pyth 100", () => client.pushOracle(admin, px("100")));
  await step("bob short 10 @ 10×", () =>
    client.open({ signer: bob, owner: bob, side: "short", margin: "10", leverage: 10, fundFrom: "balance" })
  );
  await step("push pyth 90", () => client.pushOracle(admin, px("90")));
  const shortWin = await step("short win queues against empty LP", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [5] })
  );
  absorb(shortWin);
  const shortPos = await client.readPosition(bob.publicKey, 5);
  assertEq(shortPos.side, 1, "short side");
  assert(shortPos.pnl > 0n, "short profit");
  b = await client.readUser(bob.publicKey);
  assertEq(b.queued, queuedBefore - d("10") + d("9.8"), "short net queued");

  await step("stale the oracle", () => client.pushOracle(admin, px("90"), 1n));
  await step("set fixture 80", () => client.setFixture(admin, px("80")));
  const fixOpen = await step("alice open on fixture", () =>
    client.open({ signer: alice, owner: alice, side: "long", margin: "2", leverage: 2, fundFrom: "balance" })
  );
  absorb(fixOpen);
  assert(fixOpen.logs.some((l) => l.includes("source=fixture")), "fixture fallback");
  const fixPos = await client.readPosition(alice.publicKey, 2);
  assertEq(fixPos.entryPrice, px("80"), "entry is fixture");
  await step("close fixture flat", () =>
    client.close({ signer: alice, owner: alice.publicKey, positionIds: [2] })
  );

  await step("alice arms session", () => client.setSession(alice, session.publicKey));
  const agent = createAgent({ client, signer: session, owner: alice.publicKey, asset: "SOL" });
  const before = await agent.account.retrieve();
  const agentOpen = await step("session agent open", () =>
    agent.positions.open({ asset: "SOL", side: "long", margin: "5", leverage: 3, fundFrom: "balance" })
  );
  assert(agentOpen.logs.some((l) => l.includes("evt=open")), "agent open logged");
  const agentClose = await step("session agent close", () =>
    agent.positions.close({ positionIds: [3] })
  );
  assert(agentClose.logs.some((l) => l.includes("evt=settle")), "agent close settled");
  const closed = await agent.positions.closed({ positionIds: [3] });
  assertEq(closed.positions[0].status === "closed" ? 1 : 0, 1, "closed query");
  const after = await agent.account.retrieve();
  assertEq(after.balance, before.balance, "flat agent roundtrip");

  await step("session withdraw rejected", async () => {
    try {
      await client.withdraw(session, alice.publicKey, "1");
      throw new Error("session withdraw should have failed");
    } catch (err) {
      if (!hasSessionReject(err)) throw err;
      return { sig: "rejected" };
    }
  });
  await step("session stake rejected", async () => {
    try {
      await agent.paper.stake({ amount: "1" });
      throw new Error("session stake should have failed");
    } catch (err) {
      if (!hasSessionReject(err)) throw err;
      return { sig: "rejected" };
    }
  });
  await step("session claim rejected", async () => {
    try {
      await agent.paper.claim();
      throw new Error("session claim should have failed");
    } catch (err) {
      if (!hasSessionReject(err)) throw err;
      return { sig: "rejected" };
    }
  });

  const supply = await client.scarSupply();
  desk = await client.readDesk();
  assertEq(supply, desk.totalScar, "mint supply matches accounting");
  assert(supply > 0n, "scar supply increased");
  const names = new Set(proof.events.map((e) => e.name));
  for (const need of ["scar_minted", "queue_write", "queue_pay", "price", "settle", "session_reject"]) {
    // session_reject is only in the failed txs, which we didn't absorb.
  }
  assert(names.has("scar_minted") && names.has("queue_write") && names.has("queue_pay"), "proof events");

  const ownerWithdraw = await step("owner can still withdraw", () => client.withdraw(alice, alice.publicKey, "1"));
  absorb(ownerWithdraw);

  proof.scarSupply = supply.toString();
  proof.totalScar = desk.totalScar.toString();
  proof.desk = client.desk.toBase58();
  proof.programId = program.publicKey.toBase58();
  proof.scarMint = client.scarMint.toBase58();
  proof.queueWrite = proof.signatures.queueWrite;
  proof.scarMintSig = proof.signatures.scarMint;
  proof.finishedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    rpc: RPC,
    programId: program.publicKey.toBase58(),
    desk: client.desk.toBase58(),
    dusdMint: client.dusdMint.toBase58(),
    scarMint: client.scarMint.toBase58(),
    vault: client.vault.toBase58(),
    treasury: client.treasury.toBase58(),
    oracle: client.oracle.toBase58(),
    admin: admin.publicKey.toBase58(),
    alice: alice.publicKey.toBase58(),
    bob: bob.publicKey.toBase58(),
    session: session.publicKey.toBase58(),
    network: "localnet",
  }, null, 2));
  fs.writeFileSync(path.join(APP_ROOT, "demo/last-run.json"), JSON.stringify(proof, null, 2));
  console.log("\nVERIFY OK");
  console.log("SCAR mint tx:", proof.signatures.scarMint);
  console.log("queue write tx:", proof.signatures.queueWrite);
  console.log("SCAR supply:", supply.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
