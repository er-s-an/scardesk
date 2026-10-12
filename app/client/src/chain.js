/**
 * Scardesk chain client. Builds the program instructions and reads accounts.
 * Settlement itself runs inside the Solana program.
 */

const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const math = require("./math");
const layout = require("./layout");

const APP_ROOT = path.resolve(__dirname, "../..");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const CONFIG_PATH = path.join(APP_ROOT, "config", "deployment.json");
const PARAMS_PATH = path.join(APP_ROOT, "config", "params.json");

const IX = {
  init: 0,
  initUser: 1,
  initWallet: 2,
  faucet: 3,
  deposit: 4,
  withdraw: 5,
  setSession: 6,
  clearSession: 7,
  pushOracle: 8,
  setFixture: 9,
  open: 10,
  close: 11,
  liquidate: 12,
  stake: 13,
  unstake: 14,
  claim: 15,
};

function loadKey(name) {
  const file = path.join(APP_ROOT, "keys", name);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

function loadParams() {
  return JSON.parse(fs.readFileSync(PARAMS_PATH, "utf8"));
}

function u64buf(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(math.bi(n));
  return b;
}

function pda(programId, seeds) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function metas(list) {
  return list.map(([pubkey, w, s]) => ({
    pubkey,
    isWritable: !!w,
    isSigner: !!s,
  }));
}

function ix(programId, data, accounts) {
  return new TransactionInstruction({ programId, keys: accounts, data });
}

class DeskClient {
  constructor(connection, programId) {
    this.connection = connection;
    this.programId = programId;
    this.desk = pda(programId, [Buffer.from("desk")]);
    this.dusdMint = pda(programId, [Buffer.from("dusd")]);
    this.scarMint = pda(programId, [Buffer.from("scar")]);
    this.vault = pda(programId, [Buffer.from("vault")]);
    this.treasury = pda(programId, [Buffer.from("treasury")]);
    this.oracle = pda(programId, [Buffer.from("oracle")]);
  }

  userPda(owner) {
    const key = owner instanceof PublicKey ? owner : new PublicKey(owner);
    return pda(this.programId, [Buffer.from("user"), key.toBuffer()]);
  }

  walletPda(owner) {
    const key = owner instanceof PublicKey ? owner : new PublicKey(owner);
    return pda(this.programId, [Buffer.from("w"), key.toBuffer()]);
  }

  positionPda(owner, id) {
    const key = owner instanceof PublicKey ? owner : new PublicKey(owner);
    return pda(this.programId, [Buffer.from("pos"), key.toBuffer(), u64buf(id)]);
  }

  queuePda(index) {
    return pda(this.programId, [Buffer.from("q"), u64buf(index)]);
  }

  async send(feePayer, instructions, signers = []) {
    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
    for (const item of this.prefixIxs || []) tx.add(item);
    for (const item of instructions) tx.add(item);
    const payer = this.externalFeePayer || feePayer;
    tx.feePayer = payerKeyOf(payer);
    const uniq = [];
    const seen = new Set();
    for (const kp of [feePayer, ...signers]) {
      if (!kp || !kp.secretKey) continue;
      const id = kp.publicKey.toBase58();
      if (!seen.has(id)) {
        seen.add(id);
        uniq.push(kp);
      }
    }
    if (this.prepareOnly) {
      const latest = await this.connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      if (uniq.length) tx.partialSign(...uniq);
      const prepared = Buffer.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      ).toString("base64");
      return { sig: null, logs: [], prepared };
    }
    try {
      const sig = await sendAndConfirmTransaction(this.connection, tx, uniq, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
        skipPreflight: !!this.skipPreflight,
      });
      const logs = await this.logsOf(sig);
      return { sig, logs };
    } catch (err) {
      const logs = err.logs || [];
      const wrapped = new Error(err.message || "transaction failed");
      wrapped.logs = logs;
      wrapped.signature = err.signature;
      throw wrapped;
    }
  }

  /**
   * Build the same instruction the sender would submit, but return an
   * unsigned transaction. `feePayer` pays the fee even when the instruction
   * signer is a session key the server does not hold.
   */
  async prepareAs(feePayer, fn) {
    const prevPrepare = this.prepareOnly;
    const prevPayer = this.externalFeePayer;
    this.prepareOnly = true;
    this.externalFeePayer = payerKeyOf(feePayer);
    try {
      return await fn();
    } finally {
      this.prepareOnly = prevPrepare;
      this.externalFeePayer = prevPayer;
    }
  }

  async logsOf(sig) {
    const tx = await this.connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    return tx?.meta?.logMessages || [];
  }

  async clock() {
    const info = await this.connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
    if (!info) throw new Error("clock sysvar missing");
    return info.data.readBigInt64LE(32);
  }

  async raw(pubkey) {
    return this.connection.getAccountInfo(pubkey);
  }

  async readDesk() {
    const info = await this.raw(this.desk);
    if (!info) return null;
    return layout.decodeDesk(info.data);
  }

  async readOracle() {
    const info = await this.raw(this.oracle);
    if (!info) return null;
    return layout.decodeOracle(info.data);
  }

  async readUser(owner) {
    const info = await this.raw(this.userPda(owner));
    if (!info) return null;
    return layout.decodeUser(info.data);
  }

  async readPosition(owner, id) {
    const info = await this.raw(this.positionPda(owner, id));
    if (!info) return null;
    const pos = layout.decodePosition(info.data);
    pos.pubkey = this.positionPda(owner, id).toBase58();
    return pos;
  }

  async readQueue(index) {
    const info = await this.raw(this.queuePda(index));
    if (!info) return null;
    const node = layout.decodeQueue(info.data);
    node.pubkey = this.queuePda(index).toBase58();
    return node;
  }

  async scarSupply() {
    const info = await this.raw(this.scarMint);
    if (!info) return 0n;
    return layout.mintSupply(info.data);
  }

  async vaultAmount() {
    const info = await this.raw(this.vault);
    if (!info) return 0n;
    return layout.tokenAmount(info.data);
  }

  async snapshot(owners) {
    const desk = await this.readDesk();
    const oracle = desk ? await this.readOracle() : null;
    const now = await this.clock();
    const price = desk && oracle ? math.resolvePrice(desk, oracle, now) : null;
    const users = {};
    const positions = [];
    for (const owner of owners) {
      const key = owner instanceof PublicKey ? owner : new PublicKey(owner);
      const user = await this.readUser(key);
      users[key.toBase58()] = user;
      if (!user) continue;
      for (let id = 0n; id < user.nextId; id++) {
        const pos = await this.readPosition(key, id);
        if (pos) positions.push(pos);
      }
    }
    const queue = [];
    if (desk) {
      for (let i = 0n; i < desk.queueTail; i++) {
        const node = await this.readQueue(i);
        if (node) queue.push(node);
      }
    }
    return {
      now,
      desk,
      oracle,
      price,
      users,
      positions,
      queue,
      scarSupply: desk ? await this.scarSupply() : 0n,
      vaultAmount: desk ? await this.vaultAmount() : 0n,
      addresses: {
        program: this.programId.toBase58(),
        desk: this.desk.toBase58(),
        dusdMint: this.dusdMint.toBase58(),
        scarMint: this.scarMint.toBase58(),
        vault: this.vault.toBase58(),
        treasury: this.treasury.toBase58(),
        oracle: this.oracle.toBase58(),
      },
    };
  }

  async initialize(admin, params) {
    const data = Buffer.alloc(45);
    data[0] = IX.init;
    data.writeUInt16LE(params.maxLeverage, 1);
    data.writeUInt16LE(params.haircutBps, 3);
    data.writeUInt16LE(params.liqFractionBps, 5);
    data.writeUInt16LE(0, 7);
    data.writeBigUInt64LE(math.bi(params.minMargin), 9);
    data.writeBigUInt64LE(math.bi(params.emission), 17);
    data.writeBigUInt64LE(math.bi(params.oracleMaxAge), 25);
    data.writeBigInt64LE(math.bi(params.fixturePrice), 33);
    data.writeInt32LE(params.fixtureExpo, 41);
    const accounts = metas([
      [admin.publicKey, 1, 1],
      [this.desk, 1, 0],
      [this.dusdMint, 1, 0],
      [this.scarMint, 1, 0],
      [this.vault, 1, 0],
      [this.treasury, 1, 0],
      [this.oracle, 1, 0],
      [SystemProgram.programId, 0, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
      [SYSVAR_RENT_PUBKEY, 0, 0],
    ]);
    return this.send(admin, [ix(this.programId, data, accounts)], []);
  }

  async initUser(owner) {
    const data = Buffer.from([IX.initUser]);
    const accounts = metas([
      [owner.publicKey, 1, 1],
      [this.userPda(owner.publicKey), 1, 0],
      [SystemProgram.programId, 0, 0],
    ]);
    return this.send(owner, [ix(this.programId, data, accounts)], []);
  }

  async initWallet(owner) {
    const data = Buffer.from([IX.initWallet]);
    const accounts = metas([
      [owner.publicKey, 1, 1],
      [this.walletPda(owner.publicKey), 1, 0],
      [this.dusdMint, 0, 0],
      [this.desk, 0, 0],
      [SystemProgram.programId, 0, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
      [SYSVAR_RENT_PUBKEY, 0, 0],
    ]);
    return this.send(owner, [ix(this.programId, data, accounts)], []);
  }

  async faucet(admin, owner, amount) {
    const data = Buffer.alloc(9);
    data[0] = IX.faucet;
    data.writeBigUInt64LE(math.toMicro(amount), 1);
    const accounts = metas([
      [admin.publicKey, 1, 1],
      [this.desk, 0, 0],
      [this.dusdMint, 1, 0],
      [this.walletPda(owner), 1, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
    ]);
    return this.send(admin, [ix(this.programId, data, accounts)], []);
  }

  async deposit(owner, amount) {
    const data = Buffer.alloc(9);
    data[0] = IX.deposit;
    data.writeBigUInt64LE(math.toMicro(amount), 1);
    const accounts = metas([
      [owner.publicKey, 1, 1],
      [this.userPda(owner.publicKey), 1, 0],
      [this.walletPda(owner.publicKey), 1, 0],
      [this.vault, 1, 0],
      [this.desk, 1, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
    ]);
    return this.send(owner, [ix(this.programId, data, accounts)], []);
  }

  async withdraw(signer, ownerPubkey, amount) {
    const data = Buffer.alloc(9);
    data[0] = IX.withdraw;
    data.writeBigUInt64LE(math.toMicro(amount), 1);
    const accounts = metas([
      [signer.publicKey, 1, 1],
      [this.userPda(ownerPubkey), 1, 0],
      [this.walletPda(ownerPubkey), 1, 0],
      [this.vault, 1, 0],
      [this.desk, 1, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
    ]);
    return this.send(signer, [ix(this.programId, data, accounts)], []);
  }

  async setSession(owner, sessionPubkey) {
    const data = Buffer.alloc(33);
    data[0] = IX.setSession;
    const raw = (sessionPubkey instanceof PublicKey ? sessionPubkey : new PublicKey(sessionPubkey)).toBuffer();
    raw.copy(data, 1);
    const accounts = metas([
      [owner.publicKey, 1, 1],
      [this.userPda(owner.publicKey), 1, 0],
    ]);
    return this.send(owner, [ix(this.programId, data, accounts)], []);
  }

  async clearSession(owner) {
    const data = Buffer.from([IX.clearSession]);
    const accounts = metas([
      [owner.publicKey, 1, 1],
      [this.userPda(owner.publicKey), 1, 0],
    ]);
    return this.send(owner, [ix(this.programId, data, accounts)], []);
  }

  async pushOracle(admin, price, publishTime = 0n, conf = 0n) {
    const data = Buffer.alloc(33);
    data[0] = IX.pushOracle;
    data.writeBigInt64LE(math.bi(price), 1);
    data.writeInt32LE(-8, 9);
    data.writeBigInt64LE(math.bi(publishTime), 17);
    data.writeBigUInt64LE(math.bi(conf), 25);
    const accounts = metas([
      [admin.publicKey, 1, 1],
      [this.desk, 0, 0],
      [this.oracle, 1, 0],
    ]);
    return this.send(admin, [ix(this.programId, data, accounts)], []);
  }

  async setFixture(admin, price) {
    const data = Buffer.alloc(13);
    data[0] = IX.setFixture;
    data.writeBigInt64LE(math.bi(price), 1);
    data.writeInt32LE(-8, 9);
    const accounts = metas([
      [admin.publicKey, 1, 1],
      [this.desk, 1, 0],
    ]);
    return this.send(admin, [ix(this.programId, data, accounts)], []);
  }

  async open({ signer, owner, side, margin, leverage, fundFrom }) {
    const ownerKey = owner.publicKey || owner;
    const ownerKp = owner.publicKey ? owner : null;
    const signerKp = signer;
    const sideN = math.sideCode(side);
    const fund = fundFrom === "queued" || fundFrom === 1 ? 1 : 0;
    const marginMicro = math.toMicro(margin);
    const desk = await this.readDesk();
    const user = await this.readUser(ownerKey);
    if (!desk || !user) throw new Error("desk or user missing");
    const nodes = [];
    if (fund === 1) {
      let need = marginMicro;
      for (let i = 0n; i < desk.queueTail && need > 0n; i++) {
        const node = await this.readQueue(i);
        if (!node || node.owner !== ownerKey.toBase58() || node.status !== 0 || node.remaining === 0n) {
          continue;
        }
        nodes.push(node);
        need -= need < node.remaining ? need : node.remaining;
      }
      if (need !== 0n) throw new Error("not enough queued nodes to fund margin");
    }
    const data = Buffer.alloc(14);
    data[0] = IX.open;
    data[1] = sideN;
    data[2] = fund;
    data.writeUInt16LE(leverage, 3);
    data.writeBigUInt64LE(marginMicro, 5);
    data[13] = nodes.length;
    const accounts = [
      [signerKp.publicKey, 1, 1],
      [ownerKey, 0, 0],
      [this.userPda(ownerKey), 1, 0],
      [this.desk, 1, 0],
      [this.oracle, 0, 0],
      [this.positionPda(ownerKey, user.nextId), 1, 0],
      [SystemProgram.programId, 0, 0],
    ];
    for (const node of nodes) accounts.push([new PublicKey(node.pubkey), 1, 0]);
    const extra = [];
    if (ownerKp && ownerKp.publicKey.toBase58() !== signerKp.publicKey.toBase58()) {
      /* owner is not a signer on a session trade */
    }
    return this.send(signerKp, [ix(this.programId, data, metas(accounts))], extra);
  }

  async close({ signer, owner, positionIds, asLiquidation = false, keeper = null }) {
    const ownerKey = owner.publicKey ? owner.publicKey : owner;
    const signerKp = asLiquidation ? keeper : signer;
    const desk = await this.readDesk();
    const user = await this.readUser(ownerKey);
    const now = await this.clock();
    const oracle = await this.readOracle();
    const price = math.resolvePrice(desk, oracle, now).price;
    const ids = positionIds.map((id) => math.bi(id));
    const queue = [];
    for (let i = 0n; i < desk.queueTail; i++) queue.push(await this.readQueue(i));

    const plans = [];
    let lpFree = math.lpFreeOf(desk);
    let head = desk.queueHead;
    const active = queue.filter(Boolean);
    for (const id of ids) {
      const pos = await this.readPosition(ownerKey, id);
      if (!pos || pos.status !== 0) throw new Error("position " + id + " is not open");
      const plan = math.planSettle(pos, price, { ...desk, lpCash: lpFree + desk.reservedFees, reservedFees: desk.reservedFees });
      // planSettle uses lpFreeOf(desk). Pass a desk whose free balance is the running free.
      plans.push({ id, pos, ...math.planSettle(pos, price, {
        haircutBps: desk.haircutBps,
        lpCash: lpFree,
        reservedFees: 0n,
      }) });
      const last = plans[plans.length - 1];
      if (last.raw > 0n) {
        const split = math.splitWin(last.raw, desk.haircutBps, lpFree);
        lpFree -= split.userTake;
        if (lpFree < 0n) lpFree = 0n;
      }
      if (pos.fundFrom === 0 && last.loss > 0n) {
        // cash loss refills free LP after the queue, approximated after we assign pay pairs
      }
      void head;
      void active;
      void user;
    }

    // Pay pairs are shared across the batch, starting at the current head.
    // Recompute pay cash per position in order and consume a cursor over the queue.
    let cursor = desk.queueHead;
    const payPairs = [];
    const newIndexes = [];
    let tail = desk.queueTail;
    const existingTail = desk.queueTail;
    for (const plan of plans) {
      if (plan.payCash > 0n && desk.queueLen > 0n) {
        let cash = plan.payCash;
        while (cash > 0n && cursor < existingTail) {
          const node = queue[Number(cursor)];
          if (!node) throw new Error("missing queue node " + cursor);
          payPairs.push(node);
          if (node.remaining > 0n) {
            const pay = cash < node.remaining ? cash : node.remaining;
            node.remaining -= pay;
            cash -= pay;
          }
          if (node.remaining === 0n) cursor += 1n;
          else break;
        }
      }
      for (const kind of plan.kinds) {
        newIndexes.push({ index: tail, kind, positionId: plan.id });
        tail += 1n;
      }
    }

    const nPos = ids.length;
    const nPay = payPairs.length;
    const nNew = newIndexes.length;
    let built;
    if (asLiquidation) {
      if (nPos !== 1) throw new Error("liquidate one position");
      built = Buffer.alloc(11);
      built[0] = IX.liquidate;
      built[1] = nPay;
      built[2] = nNew;
      built.writeBigUInt64LE(ids[0], 3);
    } else {
      built = Buffer.alloc(5 + nPos * 8);
      built[0] = IX.close;
      built[1] = nPos;
      built[2] = nPay;
      built[3] = nNew;
      let at = 5;
      for (const id of ids) {
        built.writeBigUInt64LE(id, at);
        at += 8;
      }
    }

    const accounts = [
      [signerKp.publicKey, 1, 1],
      [ownerKey, 0, 0],
      [this.userPda(ownerKey), 1, 0],
      [this.desk, 1, 0],
      [this.oracle, 0, 0],
      [this.scarMint, 1, 0],
      [this.treasury, 1, 0],
      [TOKEN_PROGRAM_ID, 0, 0],
      [SystemProgram.programId, 0, 0],
    ];
    for (const id of ids) accounts.push([this.positionPda(ownerKey, id), 1, 0]);
    for (const node of payPairs) {
      accounts.push([new PublicKey(node.pubkey), 1, 0]);
      accounts.push([this.userPda(node.owner), 1, 0]);
    }
    for (const created of newIndexes) accounts.push([this.queuePda(created.index), 1, 0]);
    return this.send(signerKp, [ix(this.programId, built, metas(accounts))], []);
  }

  async stake(signer, ownerPubkey, amount, unstake = false) {
    const owner = ownerPubkey.publicKey || ownerPubkey;
    const data = Buffer.alloc(9);
    data[0] = unstake ? IX.unstake : IX.stake;
    data.writeBigUInt64LE(math.toMicro(amount), 1);
    const accounts = metas([
      [signer.publicKey, 1, 1],
      [this.userPda(owner), 1, 0],
      [this.desk, 1, 0],
    ]);
    return this.send(signer, [ix(this.programId, data, accounts)], []);
  }

  async claim(signer, ownerPubkey) {
    const owner = ownerPubkey.publicKey || ownerPubkey;
    const data = Buffer.from([IX.claim]);
    const accounts = metas([
      [signer.publicKey, 1, 1],
      [this.userPda(owner), 1, 0],
      [this.desk, 1, 0],
    ]);
    return this.send(signer, [ix(this.programId, data, accounts)], []);
  }
}

function eventsFromLogs(logs) {
  const events = [];
  for (const line of logs || []) {
    const at = line.indexOf("evt=");
    if (at === -1) continue;
    const body = line.slice(at + 4);
    const [name, ...rest] = body.split(";");
    const fields = {};
    for (const part of rest) {
      const i = part.indexOf("=");
      if (i === -1) continue;
      fields[part.slice(0, i)] = part.slice(i + 1);
    }
    events.push({ name, fields, line });
  }
  return events;
}

function payerKeyOf(payer) {
  if (!payer) throw new Error("missing fee payer");
  if (payer instanceof PublicKey) return payer;
  if (payer.publicKey) return payer.publicKey;
  throw new Error("bad fee payer");
}

function hasSessionReject(err) {
  const logs = err.logs || [];
  const text = logs.join("\n") + "\n" + (err.message || "");
  return text.includes("session_reject") || text.includes("custom program error: 0x3");
}

async function airdropIfNeeded(connection, pubkey, sol = 20) {
  const bal = await connection.getBalance(pubkey);
  if (bal > 2_000_000_000) return bal;
  const sig = await connection.requestAirdrop(pubkey, sol * 1_000_000_000);
  await connection.confirmTransaction(sig, "confirmed");
  return connection.getBalance(pubkey);
}

module.exports = {
  APP_ROOT,
  CONFIG_PATH,
  PARAMS_PATH,
  TOKEN_PROGRAM_ID,
  IX,
  DeskClient,
  loadKey,
  loadParams,
  eventsFromLogs,
  hasSessionReject,
  airdropIfNeeded,
  Connection,
  PublicKey,
  Keypair,
};
