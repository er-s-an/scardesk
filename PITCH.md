# Scardesk pitch and demo script

Draft only. Not recorded. Not submitted. Lane does not submit.

Say this out loud only against the live desk (`http://127.0.0.1:8787` on localnet) or, if a later run actually deploys, against Devnet explorer links written in `app/demo/public-proof.json`. Do not invent an explorer URL.

Checked 2026-10-12T00:54:43Z: admin `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U` and the spare deployer `7f6Tk3xuV1YarYsX5kieRaaka8XahCR5xMUHfEU8YMDi` both had **0 lamports** on OnFinality devnet. No Helius, QuickNode, or Pyth key is in the environment. The public program is not deployed.

A judge who cannot run the validator can open the frozen blotter at `docs/index.html` (or `http://127.0.0.1:8787/preview.html`). That page does not sign.

## 2 min 40 s — spoken, Chinese

Screen cues are in brackets. On-screen words stay the English labels on the desk.

**0:00–0:20 问题。** 合成永续如果结算在链下，或者藏在别人的 relayer 里，亏损铸币和排队兑付就没法核对。Scardesk 把这一环放在 Solana 程序里。

**0:20–0:45 是什么。** 只有 SOL/USD。孤立保证金，一笔开仓、一次全平。亏损先还 FIFO 队列，再进 LP，并按合格亏损铸 SCAR。SCAR 不能转账。Session key 可以开平仓，不能提现、质押、领取。抵押是 demo stable，不是主网 USDC。和 papertrade.xyz 没有隶属关系。

**0:45–1:05 台面。** [桌面全屏，页脚网络行。] 现在这条是本地 validator，`127.0.0.1:8899`。涨是红，跌是灰。标记来自 Devnet 上的 Pyth SOL/USD 账户，本地时钟盖章。没有 Hermes key，所以不是 Hermes 拉取。公网程序还没部署，因为部署地址上没有 SOL。

**1:05–1:25 连接。** [点 Phantom，再点 Solflare。] 这台机器没有这两个扩展，页面会直接说装好再用，或者改用浏览器密钥。 [点 Browser key。] 状态行会走过：连上、要手续费 SOL、建用户、建 dUSD 钱包。浏览器密钥走同一条签名，它不是 Phantom。Alice 和 Bob 仍是演示账。

**1:25–1:40 入金。** [Faucet 1000 dUSD，再 Deposit。] 水龙头是管理员铸造的 demo stable，不是 Agent 工具，也不改仓位。

**1:40–2:05 亏损铸币。** [开一笔小多单。Operator rail 把价格打低，再 Close。] 盖章出现 SCAR minted。余额下降。如果队列里有人，这笔亏损先付队首。

**2:05–2:25 盈利进队。** [再开一笔。把价格打高，LP 现金为 0 时 Close。] 队列多一行，能看见队首和自己前面还有多少。赢的钱不会凭空进余额。

**2:25–2:40 Session 和 Agent。** [Arm session，Trade as session，开平一笔，再 Withdraw。] 开平成交。提现被程序拒绝，余额不动。Agent 日志里的 `positions.open` / `positions.close` 走同一条结算。`paper.claim` 这个名字是接口名，币是 SCAR，session 一样会被拒绝。

收束一句：评委要看的是程序账户，不是一张幻灯片。Devnet 签名等 SOL 到账再补。在此之前不要 Submit。

## English, about 90 words, for a form field

Scardesk is a Solana desk for SOL/USD synthetic perps. Positions are isolated. A qualified loss mints non-transferable SCAR and pays a FIFO queue before the LP. A session key can trade and cannot withdraw, stake, or claim. The human ticket and the agent tools share one settlement path. Collateral is demo stable, not mainnet USDC. The working proof is a local validator and an in-browser key. A public Devnet deploy is blocked because the admin has no SOL. Scardesk is not affiliated with papertrade.xyz.

## Shot list

1. Footer shows localnet, or devnet only after `public-proof.json` is `ok: true`.
2. Phantom and Solflare, then Browser key. Status line names the step.
3. Faucet, then deposit. Say "demo stable" once.
4. Open long, move the mark down, close. Toast: SCAR minted.
5. Open again, move the mark up with LP cash at 0, close. Queue row, head, distance.
6. Arm session, trade as session, withdraw rejected, balance unchanged.
7. Optional: agent `positions.open` and `positions.close` in the log.
8. Explorer only if the deploy file exists. Otherwise stop on the local signature or the account state.

## Do not say

- That an explorer transaction exists.
- That Hermes is live. It returns 401 without `PYTH_API_KEY`.
- That this is mainnet, real USDC, or a papertrade.xyz product.
- User counts, TVL, or that the queue was paid out in the browser pass. The verify script paid a queue. The browser pass wrote one and left it waiting.
- "Paper trading simulator" or Alpaca.
