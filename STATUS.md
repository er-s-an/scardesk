STATUS = Public in-page dUSD faucet live (permissionless IX 17). Pages trade.html one-click. Not submitted.

Checked 2026-10-12 ~13:56 HKT (executor faucet follow-up). This build did not Submit. Lane does not submit. `SCARDESK_ACTIVATE` was not set. 1001× left in place. No mainnet.

## Permissionless demo faucet (2026-10-12 ~13:56 HKT)

- **Approach:** Program IX 17 `demo_faucet` — caller signs; desk PDA mints fixed 1000 dUSD; 60s cooldown via `User.last_faucet_ts`. Admin IX 3 kept. **No upgrade-authority / admin key in Pages JS.**
- **Devnet upgrade:** program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` redeployed (authority `FvrGAbp…Kh89U`).
- **Fresh-path proof:** `app/demo/faucet-proof.json`
  - owner `ARLfRT3RgqEVcbemWSo6CYELSmW4R9wes55QXkRCTYEc`
  - demoFaucet sig `4Yti6HKc6D6erGDeTUJgdj9MXWq9LWD81qFeNMiDJUUHFYXRVrHmqa28NcLFUrptQxB5GLo8Wek1RnzNGcJCWhL6`
  - wallet dUSD micro `1000000000` (1000 dUSD)
  - explorer: https://explorer.solana.com/tx/4Yti6HKc6D6erGDeTUJgdj9MXWq9LWD81qFeNMiDJUUHFYXRVrHmqa28NcLFUrptQxB5GLo8Wek1RnzNGcJCWhL6?cluster=devnet
- **Pages:** `trade.html` / `trade-app.js` / `scardesk-client.js` wire Faucet → `demoFaucet`. Fee SOL link stays https://faucet.solana.com.
- **Local desk:** faucet prefers `demoFaucet`; admin mint is fallback. SOL on-chain open unchanged. BTC/ETH desk-book labeled.
- **Key risk:** demo faucet is unbounded supply of **demo** dUSD (rate-limited per user). Mint authority remains the desk PDA. Upgrade authority stays offline in `app/keys/admin.json` (not in Pages). Do not put that key in static JS.

Not submitted to Colosseum.

---

STATUS = Multi-market desk (SOL+BTC+ETH) + Tick/candles chart on Devnet. Program still single-desk SOL PDA. 1001× unchanged. Not submitted.

Checked 2026-10-12 ~13:48 HKT (executor multi-market pass). This build did not Submit. Lane does not submit. `SCARDESK_ACTIVATE` was not set.

## Multi-market + chart (2026-10-12 ~13:48 HKT)

Shipped on the live desk (`npm run desk:devnet` → http://127.0.0.1:8787):

- **Markets:** header switcher SOL / BTC / ETH. Mark, ticket label, positions filter, and chart follow the active market.
- **Price feeds:** Hermes → sponsored Pyth account → labeled fixture per market (`app/config/markets.json`, `fixtures/{sol,btc,eth}-usd.json`). Hermes still 401 without `PYTH_API_KEY`.
- **On-chain honesty:** Devnet program PDA seeds stay `[desk]` / `[oracle]` — **one desk**. SOL opens still settle on-chain (Devnet `E7kH2K4Y…WXF4b`). BTC/ETH opens use **desk-book** (`/api/desk-book`, `demo/desk-book.json`) — same margin×lev math, soft SCAR credit on loss, **not** a second PDA. Documented; no Devnet upgrade this pass.
- **Chart:** default **Tick** (step + shade); **15m+ candlesticks**; timeframes Tick/1m/5m/15m/1h/4h/1d; LIVE pill; optional subtle EMA21 (off by default — not a papertrade parity claim). Red=#FF2418 up, ash down. `prefers-reduced-motion` respected. papertrade.xyz source is BTC+ETH only and has no EMA/RSI pane; Scardesk still ships SOL per user OVERRIDE.
- **Screenshots:** `app/demo/browser/multimarket-sol.png`, `multimarket-btc-chart.png`, `multimarket-eth-candles.png` (+ share/multi-market/).
- **Docs / Pages preview:** `docs/` updated with multi-market chrome + read-only chart stub; banner stays read-only.

**Not done / stub:** on-chain multi-desk PDAs for BTC/ETH; Hermes live without key; no Colosseum Submit; no mainnet; 1001× not rolled back.


本轮交付摘要：Devnet desk 可用 `npm run desk:devnet` 切到 `deployment.devnet.json`（maxLeverage 1001，未回滚）；浏览器密钥完成领水、入金、2× 开仓，保证金/杠杆/429/断线/缺扩展都有人话提示；平仓被 OnFinality 429 拦住未签名；Alice 1001× 仍开着；Pages 未重推，`scripts/export-pages.sh` 只检查不 Submit。

STATUS = Devnet desk switchable. max_leverage=1001 left in place. Browser faucet, deposit, and 2× open landed. Close of that 2× did not. Not submitted.

Checked 2026-10-12 afternoon HKT. This build did not Submit. Lane does not submit. `SCARDESK_ACTIVATE` was not set. The local validator was not killed. Alice's Devnet 1001× (position 2) was not closed and was not liquidated.

## What landed


Max leverage raised to **1001** (user approved via 小可). `MAX_LEVERAGE=1001` + admin `set_max_leverage` (IX 16). Proof: `app/demo/leverage-1001.json` and `public-proof.json` signatures `setMaxLeverage` / `leverage1001`. Not submitted.

Program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` is on Devnet (upgrade authority `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U`, last deployed slot ~510145307). RPC `https://solana-devnet.api.onfinality.io/public`.

Public proof `app/demo/public-proof.json` records `ok: true`, `deployed: true`:

- queueWrite: https://explorer.solana.com/tx/2v1X3Ecumrq98ZLzoHbpgQz3ABpgjc1ZWhJW7gzZzHcBCqg46Dh3fFvaTn1Cmztfaqjzbwaeqp7Q3trp4hovWxrW?cluster=devnet
- scarMint: https://explorer.solana.com/tx/4cM4cQMmFJnwebQ9LKEh3L1YzWoMjuHz6jYC1Dtjva7DyB12sjGDy32umSHsfukTwgD2QZ9DA5Sp3RTUaHiwEeUu?cluster=devnet

Root cause of the first failed SCAR mint: treasury `BNRKAuPgosZpfq78ULf2NMtxsbo5dEU4y6iK6DhNL64L` was Frozen by an older `.so` that still called `freeze_account` on init. Source already said do-not-freeze. Fix: rebuild without freeze; `mint_scar` now thaws the treasury (desk PDA) before `mint_to` when state is Frozen. Upgrade landed; resume close minted 8e9 SCAR and thawed the treasury.

`app/config/deployment.devnet.json` written. `app/config/deployment.json` left on localnet (`SCARDESK_ACTIVATE` not set). Watcher not restarted.

## This afternoon

`npm run desk:devnet` and `scripts/use-network.sh devnet` start the desk on `deployment.devnet.json`. `SCARDESK_RPC` overrides the URL only. Footer on the live desk read `devnet · deployment.devnet.json`. Reads retry a 429 a few times. Sends confirm by HTTP `getTransaction`, not an OnFinality websocket. The sponsored Pyth push waits 45s, then every 3 minutes.

Browser key `D2BaytRugcWMvFJXdPMggJWTFGH7akjfv8HqnsadkQch` on `http://127.0.0.1:8787`:

- Faucet moved wallet dUSD 0 → 1000. Desk log prefix `3Yc3ss9ugBCa`. The full signature was buried under later oracle pushes and was not re-fetched.
- Deposit 100: `4ifRgaatz1NdX4ybmsgJQ9UDcq3oFghqSGzbUVMSb2deBMFssu26X7QBdJVMDHMBB2kB8qkCMKTd1yd9JFbn582h`. Desk balance 100, wallet 900.
- Open long 2× margin 10: `5JbCwfY99dNk4ZfKGeGWrmBHLMvsGhX5Z793RBGExrmG8F9bQaKhFMSetwiZNNaUWCdpFc1T7tJvjhidWcCTU6V5`. Desk balance 90. One earlier open attempt logged 429 and did not land.
- Close of that 2× was clicked. The toast was "The RPC is busy (429). Wait a few seconds. Nothing new was signed." The position was still open afterward. It was not retried until it landed.
- Ticket click at 0 dUSD: "Desk balance is 0 dUSD. Faucet, then deposit, or lower the margin." Leverage 1002: "Leverage must be from 1 to 1001."
- Phantom and Solflare, extensions absent, name the other path. Disconnect returns the blotter to Alice (479 dUSD) and says the browser key stays in this browser.
- Signature rejection copy is the same `explain()` path: "The wallet rejected the signature. Nothing was sent." This browser has no extension popup, so that sentence was checked by calling `explain` with a rejection error. It was not produced by a wallet dialog.
- Session withdraw rejection was clicked earlier the same day on Alice's session. Screenshot `app/demo/browser/devnet-session-reject.png`. This continuation did not send another session withdraw.
- Queue (Alice profit 18 at the head, 98 behind) and SCAR supply 8000 (Bob's closed loss) were on screen. This pass did not mint new SCAR and did not write a new queue node.
- Alice position 2, 1001×, entry 100, liq 99.95004996, stayed open (uPnL about +125 at mark ~112.5).

Static preview `http://127.0.0.1:8787/preview.html` shows the three-step open and the explorer links. `scripts/export-pages.sh` checks `docs/` and does not push. https://er-s-an.github.io/scardesk/ was not republished.

## Gaps

- No Surfnet CLI on this machine.
- Hermes / Pyth benchmarks still HTTP 401 without `PYTH_API_KEY`. Sponsored-account pushes do land and are labeled clock-stamped when the publish time is outside the cluster window.
- OnFinality 429 is still real. The 2× close did not confirm. No Helius or QuickNode key.
- The browser-key 2× long is still open. Closing it needs a quieter RPC.
- Mainnet refused unless `SCARDESK_ALLOW_MAINNET=1`.
- GitHub Pages not republished this round.
- Not submitted to Colosseum.

Pointers: `HOW-TO-RUN.md`, `app/demo/public-proof.json`, `SUBMISSION.md`.

## Submit pack

Submit pack drafted earlier: `SUBMISSION.md` + `SUBMIT-CHECKLIST.md`. Not submitted. Lane does not submit.

## Public Pages trade (2026-10-12 ~13:50 HKT)

Architecture A shipped: https://er-s-an.github.io/scardesk/trade.html (HTTP 200). Browser prepare+send via OnFinality Devnet; no tunnel. Open/close proven with same DeskClient prepare+send path (Alice): open `wNd7jLcjLFEjL6JHmkVxRRrizUPsjq1VzQzRo3yH21yaBhhLvhtpW7eL7CRjzRccK3VDz3SdKRjDde3EUPVRNej`, close `58QfepjGLRXsyTEAw7qEKGNvQ8LgmrFNFPUiRcZYmM9B4zsawioHh5AgjagrKvfosuduYubzQeQCZVdBxJkDNRzQ`. Faucet still admin-only. Local :8787 unchanged. Not submitted.
