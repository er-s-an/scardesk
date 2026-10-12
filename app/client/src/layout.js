/** Decoders. Offsets match programs/scardesk/src/state.rs. */

const { PublicKey } = require("@solana/web3.js");

function u64(buf, at) {
  return buf.readBigUInt64LE(at);
}
function u128(buf, at) {
  const lo = buf.readBigUInt64LE(at);
  const hi = buf.readBigUInt64LE(at + 8);
  return (hi << 64n) + lo;
}
function i64(buf, at) {
  return buf.readBigInt64LE(at);
}
function pk(buf, at) {
  return new PublicKey(buf.subarray(at, at + 32));
}

function decodeDesk(buf) {
  if (buf.length < 512 || buf[0] !== 1) throw new Error("not a desk account");
  return {
    bump: buf[1],
    version: buf[2],
    admin: pk(buf, 4).toBase58(),
    dusdMint: pk(buf, 36).toBase58(),
    scarMint: pk(buf, 68).toBase58(),
    vault: pk(buf, 100).toBase58(),
    scarTreasury: pk(buf, 132).toBase58(),
    oracle: pk(buf, 164).toBase58(),
    fixturePrice: i64(buf, 196),
    fixtureExpo: buf.readInt32LE(204),
    fixtureTime: i64(buf, 208),
    oracleMaxAge: u64(buf, 216),
    maxLeverage: buf.readUInt16LE(224),
    haircutBps: buf.readUInt16LE(226),
    liqFractionBps: buf.readUInt16LE(228),
    minMargin: u64(buf, 232),
    emission: u64(buf, 240),
    queueHead: u64(buf, 248),
    queueTail: u64(buf, 256),
    queueLen: u64(buf, 264),
    lpCash: u64(buf, 272),
    reservedFees: u64(buf, 280),
    pendingFees: u64(buf, 288),
    vaultAccounted: u64(buf, 296),
    totalScar: u64(buf, 304),
    totalStaked: u64(buf, 312),
    accReward: u128(buf, 320),
  };
}

function decodeUser(buf) {
  if (buf.length < 256 || buf[0] !== 2) throw new Error("not a user account");
  return {
    bump: buf[1],
    hasSession: buf[2] === 1,
    owner: pk(buf, 4).toBase58(),
    session: pk(buf, 36).toBase58(),
    balance: u64(buf, 68),
    queued: u64(buf, 76),
    scar: u64(buf, 84),
    staked: u64(buf, 92),
    claimable: u64(buf, 100),
    rewardDebt: u128(buf, 108),
    nextId: u64(buf, 124),
    openCount: buf.readUInt32LE(132),
    lastFaucetTs: buf.length >= 144 ? i64(buf, 136) : 0n,
  };
}

function decodePosition(buf) {
  if (buf.length < 256 || buf[0] !== 3) throw new Error("not a position");
  return {
    side: buf[1],
    status: buf[2],
    fundFrom: buf[3],
    bump: buf[4],
    owner: pk(buf, 8).toBase58(),
    id: u64(buf, 40),
    margin: u64(buf, 48),
    leverage: buf.readUInt16LE(56),
    entryPrice: i64(buf, 60),
    exitPrice: i64(buf, 68),
    notional: u64(buf, 76),
    liqPrice: i64(buf, 84),
    pnl: i64(buf, 92),
    fee: u64(buf, 100),
    scarMinted: u64(buf, 108),
    openedAt: i64(buf, 116),
    closedAt: i64(buf, 124),
    cashMargin: u64(buf, 132),
    queuedMargin: u64(buf, 140),
    paidOut: u64(buf, 148),
    queuedCredit: u64(buf, 156),
  };
}

function decodeQueue(buf) {
  if (buf.length < 128 || buf[0] !== 4) throw new Error("not a queue node");
  return {
    status: buf[1],
    kind: buf[2],
    bump: buf[3],
    index: u64(buf, 8),
    owner: pk(buf, 16).toBase58(),
    total: u64(buf, 48),
    remaining: u64(buf, 56),
    positionId: u64(buf, 64),
    enqueuedAt: i64(buf, 72),
  };
}

function decodeOracle(buf) {
  if (buf.length < 128 || buf[0] !== 5) throw new Error("not an oracle");
  return {
    source: buf[1],
    price: i64(buf, 8),
    expo: buf.readInt32LE(16),
    publishTime: i64(buf, 24),
    conf: u64(buf, 32),
  };
}

function tokenAmount(buf) {
  return buf.readBigUInt64LE(64);
}

function mintSupply(buf) {
  return buf.readBigUInt64LE(36);
}

module.exports = {
  decodeDesk,
  decodeUser,
  decodePosition,
  decodeQueue,
  decodeOracle,
  tokenAmount,
  mintSupply,
};
