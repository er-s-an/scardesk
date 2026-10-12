/**
 * Agent tool surface. Shape matches the Circuit-style wrapper:
 *   positions.open / close / closed
 *   account.retrieve
 *   paper.stake / unstake / claim
 *
 * There is no balance editor and no free mint. Stake and claim are sent
 * as the session key when that is the signer; the program rejects them.
 */

const math = require("./math");
const { eventsFromLogs } = require("./chain");

const TOOLS = Object.freeze([
  "positions.open",
  "positions.close",
  "positions.closed",
  "account.retrieve",
  "paper.stake",
  "paper.unstake",
  "paper.claim",
]);

function createAgent({ client, signer, owner, asset = "SOL" }) {
  const ownerKey = owner.publicKey || owner;

  async function open(args) {
    const market = args.asset || asset;
    if (market !== "SOL" && market !== "SOL/USD") {
      throw new Error("Scardesk lists SOL/USD only");
    }
    const side = args.side;
    const margin = args.margin;
    const leverage = Number(args.leverage);
    const fundFrom = args.fundFrom || "balance";
    const result = await client.open({
      signer,
      owner: ownerKey,
      side,
      margin,
      leverage,
      fundFrom,
    });
    return { ...result, events: eventsFromLogs(result.logs) };
  }

  async function close(args) {
    const ids = args.positionIds || args.position_ids;
    if (!ids || !ids.length) throw new Error("positionIds required");
    if (ids.length > 12) throw new Error("batch limit is 12");
    const result = await client.close({ signer, owner: ownerKey, positionIds: ids });
    return { ...result, events: eventsFromLogs(result.logs) };
  }

  async function closed(args) {
    const ids = (args.positionIds || []).map((id) => math.bi(id));
    const rows = [];
    for (const id of ids) {
      const pos = await client.readPosition(ownerKey, id);
      if (!pos) continue;
      rows.push({
        id: pos.id.toString(),
        status: pos.status === 2 ? "liquidated" : pos.status === 1 ? "closed" : "open",
        exitPrice: pos.exitPrice.toString(),
        pnl: pos.pnl.toString(),
        scarMinted: pos.scarMinted.toString(),
        paidOut: pos.paidOut.toString(),
        queuedCredit: pos.queuedCredit.toString(),
        fee: pos.fee.toString(),
      });
    }
    return { positions: rows };
  }

  async function retrieve() {
    const user = await client.readUser(ownerKey);
    const desk = await client.readDesk();
    const positions = [];
    if (user) {
      for (let id = 0n; id < user.nextId; id++) {
        const pos = await client.readPosition(ownerKey, id);
        if (pos && pos.status === 0) {
          positions.push({
            id: pos.id.toString(),
            side: pos.side === 0 ? "long" : "short",
            margin: pos.margin.toString(),
            leverage: pos.leverage,
            entryPrice: pos.entryPrice.toString(),
            liqPrice: pos.liqPrice.toString(),
            fundFrom: pos.fundFrom === 1 ? "queued" : "balance",
          });
        }
      }
    }
    return {
      balance: user ? user.balance.toString() : "0",
      queued: user ? user.queued.toString() : "0",
      scar: user ? user.scar.toString() : "0",
      staked: user ? user.staked.toString() : "0",
      claimable: user ? user.claimable.toString() : "0",
      positions,
      lpCash: desk ? desk.lpCash.toString() : "0",
      queueLen: desk ? desk.queueLen.toString() : "0",
    };
  }

  return {
    tools: TOOLS,
    positions: { open, close, closed },
    account: { retrieve },
    paper: {
      stake: async ({ amount }) => {
        const result = await client.stake(signer, ownerKey, amount, false);
        return { ...result, events: eventsFromLogs(result.logs) };
      },
      unstake: async ({ amount }) => {
        const result = await client.stake(signer, ownerKey, amount, true);
        return { ...result, events: eventsFromLogs(result.logs) };
      },
      claim: async () => {
        const result = await client.claim(signer, ownerKey);
        return { ...result, events: eventsFromLogs(result.logs) };
      },
    },
  };
}

module.exports = { TOOLS, createAgent };
