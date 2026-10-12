# Scardesk pitch and demo script

Draft for recording. Not submitted. Lane does not submit.

Speak against the live public desk https://er-s-an.github.io/scardesk/trade.html (Architecture A, browser prepare+send on Devnet) or local `npm run desk:devnet` at http://127.0.0.1:8787. Explorer links below are from `app/demo/public-proof.json` (`ok: true`, checked 2026-10-12). Do not invent signatures.

Live facts (2026-10-12 ~15:30 HKT):
- Program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` on Devnet
- SCAR mint tx: https://explorer.solana.com/tx/4cM4cQMmFJnwebQ9LKEh3L1YzWoMjuHz6jYC1Dtjva7DyB12sjGDy32umSHsfukTwgD2QZ9DA5Sp3RTUaHiwEeUu?cluster=devnet
- Queue write tx: https://explorer.solana.com/tx/2v1X3Ecumrq98ZLzoHbpgQz3ABpgjc1ZWhJW7gzZzHcBCqg46Dh3fFvaTn1Cmztfaqjzbwaeqp7Q3trp4hovWxrW?cluster=devnet
- Pages trade path: connect → Faucet (IX 17 `demo_faucet`, 1000 dUSD / 60s) → Deposit → Open → Close
- Collateral is demo dUSD, not mainnet USDC. Hermes still 401 without `PYTH_API_KEY`; mark uses sponsored Pyth account (labeled). OnFinality public RPC can 429; toast says wait and retry.
- max leverage is 1001 this round (user-approved). Not affiliated with papertrade.xyz.

## 2 min 40 s — spoken, Chinese

Screen cues are in brackets. On-screen words stay the English labels on the desk.

**0:00–0:20 问题。** 合成永续如果结算在链下，或者藏在别人的 relayer 里，亏损铸币和排队兑付就没法核对。Scardesk 把这一环放在 Solana 程序里。

**0:20–0:45 是什么。** 主市场是 SOL/USD（台面还可看 BTC/ETH 标记，链上结算仍是 SOL desk PDA）。孤立保证金，一笔开仓、一次全平。亏损先还 FIFO 队列，再进 LP，并按合格亏损铸 SCAR。SCAR 不能转账。Session key 可以开平仓，不能提现、质押、领取。抵押是 demo stable，不是主网 USDC。和 papertrade.xyz 没有隶属关系。

**0:45–1:05 公网台面。** [打开 https://er-s-an.github.io/scardesk/trade.html 。] 浏览器直连 Devnet，不需要本机隧道。涨是红，跌是灰。标记来自 Devnet 上的 Pyth SOL/USD 账户。没有 Hermes key，所以不是 Hermes 拉取。

**1:05–1:25 连接。** [点 Phantom 或 Solflare；没有扩展就按页内提示。] 状态行走过连接与网络。手续费要一点点 Devnet SOL（页内链到 faucet.solana.com）。

**1:25–1:45 入金。** [点 Faucet，再 Deposit。] 水龙头是程序 IX 17 `demo_faucet`：调用者自己签，desk PDA 铸 1000 dUSD，每地址约 60 秒冷却。不是 Agent 工具，也不改仓位。

**1:45–2:10 亏损铸币。** [开一笔小多单，再 Close 到亏损。] 盖章出现 SCAR minted。可切到 explorer 展示真实 SCAR mint 交易。如果队列里有人，这笔亏损先付队首。

**2:10–2:30 盈利进队。** [再开一笔，在 LP 现金不足时 Close 到盈利。] 队列多一行，能看见队首和自己前面还有多少。赢的钱不会凭空进余额。可展示已有的 queue write explorer 链接。

**2:30–2:40 Session 和收束。** [若时间够：Arm session，Trade as session，再 Withdraw。] 开平成交；提现被程序拒绝，余额不动。收束一句：评委要看的是程序账户和 explorer，不是幻灯片。未点 Colosseum Submit 前不要说已提交。

## English, about 100 words, for a form field

Scardesk is a Solana desk for SOL/USD synthetic perps. Positions are isolated. A qualified loss mints non-transferable SCAR and pays a FIFO queue before the LP. A session key can trade and cannot withdraw, stake, or claim. The human ticket and the agent tools share one settlement path. Collateral is demo stable dUSD, not mainnet USDC. Public Devnet program E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b is live; judges can try https://er-s-an.github.io/scardesk/trade.html (connect, faucet, deposit, open, close). Scardesk is not affiliated with papertrade.xyz.

## Shot list

1. Pages trade.html footer / network shows Devnet.
2. Phantom or Solflare connect (or labeled browser key on local desk).
3. Faucet then deposit. Say "demo stable" once. Optional: explorer for faucet proof.
4. Open long, close at a loss. Toast or blotter: SCAR minted. Cut to explorer SCAR mint.
5. Open again, close when LP cannot fully pay. Queue row, head, distance. Cut to explorer queue write.
6. Optional: Arm session, trade as session, withdraw rejected.
7. End on program account page: https://explorer.solana.com/address/E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b?cluster=devnet

## Do not say

- That Hermes is live. It returns 401 without `PYTH_API_KEY`.
- That this is mainnet, real USDC, or a papertrade.xyz product.
- User counts, TVL, or invented explorer URLs.
- "Paper trading simulator" or Alpaca.
- That Colosseum Submit already happened.
- That Surfnet was used (CLI absent on the build machine).
