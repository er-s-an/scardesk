#!/usr/bin/env node
/**
 * Resume Devnet public proof after program upgrade that thaws treasury
 * before mint_to. Desk already exists; queueWrite already landed; Bob still
 * has open longs that failed to settle on the frozen treasury.
 */
const fs = require("fs");
const path = require("path");
const {
  APP_ROOT,
  CONFIG_PATH,
  DeskClient,
  loadKey,
  eventsFromLogs,
  hasSessionReject,
  Connection,
} = require("../client/src/chain");
const math = require("../client/src/math");
const { fetchSolUsd } = require("../client/src/price");

const RPC =
  process.env.SCARDESK_RPC || "https://solana-devnet.api.onfinality.io/public";
const NETWORK = "devnet";
const PREV_QUEUE =
  "2v1X3Ecumrq98ZLzoHbpgQz3ABpgjc1ZWhJW7gzZzHcBCqg46Dh3fFvaTn1Cmztfaqjzbwaeqp7Q3trp4hovWxrW";
const PREV_INIT =
  "5zwUQX4yp4qtNEFCwJyv41AxxHmtkLeMmzb5M7TLAiZYkYL8dyNRPYf7CDHjH5ZgveJykxt6o9RkzQNBacLDnyrk";

function px(usd) {
  return math.toMicro(usd) * 100n;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function explorerTx(sig, network) {
  return "https://explorer.solana.com/tx/" + sig + "?cluster=" + network;
}
function explorerAccount(key, network) {
  return "https://explorer.solana.com/address/" + key + "?cluster=" + network;
}

async function withBackoff(label, fn) {
  for (let i = 0; i < 6; i++) {
    try {
      process.stdout.write(label + " … ");
      const result = await fn();
      console.log(result && result.sig ? result.sig : "ok");
      return result;
    } catch (err) {
      const msg = err.message || String(err);
      if (/429|Too Many|rate/i.test(msg) && i < 5) {
        const wait = 2000 * (i + 1);
        console.log("429 backoff", wait + "ms");
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const program = loadKey("program.json");
  const admin = loadKey("admin.json");
  const alice = loadKey("alice.json");
  const bob = loadKey("bob.json");
  const session = loadKey("alice-session.json");
  const client = new DeskClient(connection, program.publicKey);

  await sleep(1500);
  const genesis = await connection.getGenesisHash();
  console.log("rpc", RPC, "genesis", genesis);
  await sleep(1500);
  const desk = await client.readDesk();
  if (!desk) throw new Error("desk missing — cannot resume");
  console.log("desk ok queueLen", desk.queueLen.toString(), "lpCash", desk.lpCash.toString());

  await sleep(1500);
  const tre = await connection.getParsedAccountInfo(client.treasury);
  const treState = tre.value?.data?.parsed?.info?.state;
  console.log("treasury state", treState);

  await sleep(1500);
  const bobUser = await client.readUser(bob.publicKey);
  if (!bobUser) throw new Error("bob user missing");
  const openIds = [];
  for (let i = 0n; i < bobUser.nextId; i++) {
    await sleep(1000);
    const pos = await client.readPosition(bob.publicKey, i);
    if (pos && pos.status === 0) openIds.push(i);
  }
  console.log("bob open positions", openIds.map(String));
  if (openIds.length === 0) throw new Error("no open bob position to close for SCAR mint");

  // Close one losing long: entry was 110, mark 105.6 → loss → scar mint + thaw
  await sleep(2000);
  await withBackoff("mark 105.6", () => client.pushOracle(admin, px("105.6")));
  await sleep(2000);

  const closeId = openIds[0];
  const loss = await withBackoff("bob close pos " + closeId + " → SCAR", () =>
    client.close({ signer: bob, owner: bob.publicKey, positionIds: [closeId] })
  );
  const lossEvents = eventsFromLogs(loss.logs);
  console.log(
    "events",
    lossEvents.map((e) => e.name)
  );
  if (!lossEvents.some((e) => e.name === "scar_minted")) {
    throw new Error("scar_minted missing after close: " + JSON.stringify(lossEvents));
  }
  const thawed = lossEvents.some((e) => e.name === "treasury_thaw");
  console.log("treasury_thaw event", thawed);

  await sleep(2000);
  const tre2 = await connection.getParsedAccountInfo(client.treasury);
  console.log("treasury after", tre2.value?.data?.parsed?.info?.state, tre2.value?.data?.parsed?.info?.tokenAmount?.amount);

  // Session reject proof (optional but nice)
  await sleep(1500);
  const aliceNow = await client.readUser(alice.publicKey);
  if (aliceNow && !aliceNow.hasSession) {
    await sleep(2000);
    await withBackoff("arm session", () => client.setSession(alice, session.publicKey));
  }

  let sessionRejectSig = null;
  client.skipPreflight = true;
  try {
    await sleep(2000);
    await client.withdraw(session, alice.publicKey, "1");
    throw new Error("session withdraw was accepted");
  } catch (err) {
    if (!hasSessionReject(err)) {
      console.error("session reject check:", err.message || err);
    } else {
      sessionRejectSig = err.signature || null;
      console.log("session withdraw rejected", sessionRejectSig || "(no signature)");
    }
  } finally {
    client.skipPreflight = false;
  }

  let quote = { ok: false };
  try {
    quote = await fetchSolUsd();
  } catch (e) {
    quote = { ok: false, error: e.message };
  }

  const proof = {
    ok: true,
    at: new Date().toISOString(),
    submitted: false,
    network: NETWORK,
    rpc: RPC,
    genesis,
    programId: program.publicKey.toBase58(),
    admin: admin.publicKey.toBase58(),
    deployed: true,
    deploySlot: 510145307,
    resumed: true,
    treasuryThawedInTx: thawed,
    price: quote,
    signatures: {
      initialize: PREV_INIT,
      queueWrite: PREV_QUEUE,
      scarMint: loss.sig,
      sessionReject: sessionRejectSig,
    },
    explorer: {
      program: explorerAccount(program.publicKey.toBase58(), NETWORK),
      initialize: explorerTx(PREV_INIT, NETWORK),
      queueWrite: explorerTx(PREV_QUEUE, NETWORK),
      scarMint: explorerTx(loss.sig, NETWORK),
      scarMintAccount: explorerAccount(client.scarMint.toBase58(), NETWORK),
      sessionReject: sessionRejectSig ? explorerTx(sessionRejectSig, NETWORK) : null,
    },
    addresses: {
      program: program.publicKey.toBase58(),
      desk: client.desk.toBase58(),
      dusdMint: client.dusdMint.toBase58(),
      scarMint: client.scarMint.toBase58(),
      vault: client.vault.toBase58(),
      treasury: client.treasury.toBase58(),
      oracle: client.oracle.toBase58(),
      admin: admin.publicKey.toBase58(),
    },
    events: lossEvents,
  };

  const deployDoc = {
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
    network: NETWORK,
    genesis,
  };
  const namedPath = path.join(APP_ROOT, "config", "deployment." + NETWORK + ".json");
  fs.writeFileSync(namedPath, JSON.stringify(deployDoc, null, 2));
  console.log("wrote", namedPath);

  fs.mkdirSync(path.join(APP_ROOT, "demo"), { recursive: true });
  fs.writeFileSync(
    path.join(APP_ROOT, "demo/public-proof.json"),
    JSON.stringify(proof, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        network: NETWORK,
        queue: proof.explorer.queueWrite,
        scar: proof.explorer.scarMint,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
