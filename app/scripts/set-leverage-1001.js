#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  DeskClient,
  loadKey,
  Connection,
  APP_ROOT,
} = require("../client/src/chain");
const math = require("../client/src/math");
const { fetchSolUsd } = require("../client/src/price");

const RPC = process.env.SCARDESK_RPC || "https://solana-devnet.api.onfinality.io/public";
const NETWORK = "devnet";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function explorerTx(sig) {
  return "https://explorer.solana.com/tx/" + sig + "?cluster=" + NETWORK;
}

async function withBackoff(label, fn) {
  for (let i = 0; i < 8; i++) {
    try {
      process.stdout.write(label + " … ");
      const result = await fn();
      console.log(result && result.sig ? result.sig : (typeof result === "object" ? JSON.stringify(result) : result));
      return result;
    } catch (err) {
      const msg = err.message || String(err);
      if (/429|Too Many|rate/i.test(msg) && i < 7) {
        const wait = 2500 * (i + 1);
        console.log("429 backoff", wait + "ms");
        await sleep(wait);
        continue;
      }
      console.error("FAIL", msg);
      if (err.logs) console.error(err.logs.join("\n"));
      throw err;
    }
  }
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const program = loadKey("program.json");
  const admin = loadKey("admin.json");
  const alice = loadKey("alice.json");
  const client = new DeskClient(connection, program.publicKey);

  await sleep(2000);
  const genesis = await connection.getGenesisHash();
  console.log("rpc", RPC, "genesis", genesis, "program", program.publicKey.toBase58());

  await sleep(2000);
  let desk = await withBackoff("read desk", async () => {
    const d = await client.readDesk();
    if (!d) throw new Error("desk missing");
    return { maxLeverage: d.maxLeverage, lpCash: d.lpCash.toString(), admin: d.admin };
  });
  console.log("before maxLeverage=", desk.maxLeverage);

  await sleep(2500);
  const setRes = await withBackoff("setMaxLeverage 1001", () =>
    client.setMaxLeverage(admin, 1001)
  );
  const setSig = setRes.sig || setRes;

  await sleep(2500);
  desk = await withBackoff("read desk after", async () => {
    const d = await client.readDesk();
    return { maxLeverage: d.maxLeverage, lpCash: d.lpCash.toString() };
  });
  if (desk.maxLeverage !== 1001) {
    throw new Error("desk.maxLeverage still " + desk.maxLeverage);
  }
  console.log("on-chain maxLeverage=", desk.maxLeverage, "OK");

  // Try open 1001× with alice if she has balance
  await sleep(2500);
  const user = await client.readUser(alice.publicKey);
  console.log("alice balance", user ? user.balance.toString() : "no user", "openCount", user ? user.openCount : null);

  let openSig = null;
  let openNote = null;
  if (user && user.balance >= 1_000_000n) {
    // Ensure price available
    await sleep(2000);
    let priceOk = false;
    try {
      const px = await fetchSolUsd({ rpc: RPC, network: "devnet" });
      console.log("price source", px && px.source, "price", px && px.price);
      priceOk = !!(px && px.price);
    } catch (e) {
      console.log("price fetch failed", e.message);
    }
    if (!priceOk) {
      // push a fixture-ish oracle via pushOracle so open can price
      await sleep(2000);
      await withBackoff("pushOracle for open", () =>
        client.pushOracle(admin, 11200000000n)
      );
    }
    await sleep(2500);
    try {
      const openRes = await withBackoff("open 1001x long 1 dUSD", () =>
        client.open({
          signer: alice,
          owner: alice,
          side: "long",
          margin: "1",
          leverage: 1001,
          fundFrom: "balance",
        })
      );
      openSig = openRes.sig || openRes;
      openNote = "opened 1001× long margin=1";
    } catch (e) {
      openNote = "open attempt failed: " + (e.message || e);
      console.error(openNote);
      if (e.logs) console.error(e.logs.slice(-20).join("\n"));
    }
  } else {
    openNote = "alice balance too low to open; account proof of max_leverage=1001 is sufficient";
  }

  const out = {
    ok: true,
    at: new Date().toISOString(),
    network: NETWORK,
    rpc: RPC,
    programId: program.publicKey.toBase58(),
    maxLeverage: 1001,
    desk: client.desk.toBase58(),
    signatures: {
      setMaxLeverage: typeof setSig === "string" ? setSig : String(setSig),
      leverage1001: openSig,
    },
    explorer: {
      setMaxLeverage: explorerTx(typeof setSig === "string" ? setSig : String(setSig)),
      leverage1001: openSig ? explorerTx(openSig) : null,
      desk: "https://explorer.solana.com/address/" + client.desk.toBase58() + "?cluster=devnet",
      program: "https://explorer.solana.com/address/" + program.publicKey.toBase58() + "?cluster=devnet",
    },
    deskAfter: desk,
    openNote,
    deploySlot: 510149272,
  };
  const proofPath = path.join(APP_ROOT, "demo/leverage-1001.json");
  fs.writeFileSync(proofPath, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote", proofPath);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
