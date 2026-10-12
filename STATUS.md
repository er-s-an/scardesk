STATUS = Sign-loop proof: browser faucet+deposit + scripted open/close on Devnet. Not submitted.

Checked 2026-10-13 ~04:05 HKT. No Colosseum Submit.

## Browser path (Pages + browser key BJNU…qhXe)
- Mobile UI fixed (`7a37ee6`).
- Funded 0.05 SOL; init / faucet 1000 dUSD / deposit 100 dUSD confirmed.
- Open blocked in UI when OnFinality 429 aged the mark past oracleMaxAge 120s.

## Scripted open/close (same program, fresh trader `2XVDviv…Lsziq`)
Proof: `app/demo/signloop-proof.json`
- oracle push: https://explorer.solana.com/tx/3ufCmXf6PiW9ApDhg2Lzc2aqyAMSgpShfHtdZuTcmXjaMSJo3cuCJfsDjYq9nxVSjM7Jz2qALhHCmzpamL36w2cq?cluster=devnet
- open long 10 dUSD ×5: https://explorer.solana.com/tx/5ikVxiERHHKzsxYJzkwpr2vqpEruRGm1NVg83wgKRrsfPC6nkbFx9JdhKnyhbejbZW7t7A66thYRfgDc317nqy1L?cluster=devnet
- close: https://explorer.solana.com/tx/ifTxePP6YJZXV8g92pLBC4Q7wTC7eVYuyKurKaBSNiPxZLsyjps1Z5NU7nsVHEA2rmdaAARYwb2m7BeSzfQo2NA?cluster=devnet

Remaining ops risk: public Pages open still needs a mark younger than 120s; OnFinality rate limits can miss the window. Desk publisher should keep pushing.

---

STATUS = Public SOL loop honesty pass. Program upgraded on Devnet. trade.html is the entry. Not submitted.

Checked 2026-10-13. This build did not Submit. No mainnet. No user-interview numbers.

## What a new wallet does

1. Open https://er-s-an.github.io/scardesk/trade.html (GitHub Pages can lag after the push).
2. Switch the wallet to Devnet. Connect Phantom, Solflare, or the browser key.
3. Fee SOL: https://faucet.solana.com (at least 0.02). This RPC refuses airdrops.
4. On the page, sign「领水 1000 dUSD」. That mint is permissionless (IX 17), 60s cooldown, and lands in the wallet, not in a position.
5. Deposit. The six figures stay separate: wallet dUSD, withdrawable cash, locked margin, unrealized PnL, queued claim, SCAR / claimable reward. There is no combined total.
6. Open SOL/USD from withdrawable cash only. The ticket shows liquidation price and that a trigger takes the entire margin. 1001× is still the desk cap, not the default.
7. Close from the positions table. The receipt separates cash paid from a queued claim. History keeps closes and liquidations apart.
8. Withdraw only up to withdrawable cash.
9. BTC and ETH switch the quote. They do not reuse the SOL mark and they cannot open. SCAR is labeled 机制测试, with no price and no APY. Session register does not auto-trade; the program still has no margin budget, market, leverage, or expiry cap.

## Fixed this round

- B07 price scale is one integer function (`scaleToExpo`) with tests.
- B02 close account list walks the FIFO batch, including a partial head, in `planBatch`. `npm test` runs those vectors (`invariants ok`).
- B09 `prepareAs` saves and restores fee-payer state; overlapping prepares do not clobber each other. Covered by the invariant script.
- B01 deposit and withdraw compare vault balance with `vault_accounted` before the transfer. Surplus is logged and is not credited to a user. A short vault rejects the action. Host tests do not execute the token CPI.
- B03 reward index no longer republishes the same micro. Rust tests `reward_dust_is_not_reapplied` and `reward_flush_never_exceeds_pending` passed.
- B04 settle logs `mark` and `realized`. Liquidation realized is the full margin.
- B06 `push_oracle` rejects `publish_time <= 0` and a stamp outside `oracle_max_age` (120s on this desk). It does not rewrite 0 to now. Fixture fallback uses the same window. The local desk publisher now retries every 45s instead of 180s.
- Public UI: cash-only opens, six balances, market quotes, chart pill「采样」, tx rows for 等待签名 / 已提交 / 结果待确认 / 已结算. An unknown signature is kept and not resent.
- Index leads to trade.html. The frozen chart is labeled 样例. Alice figures are sample numbers. Faucet copy matches IX 17.

## Chain proof

- Program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` upgraded. Last deployed slot **510362383** (was 510164873). Upgrade authority unchanged. No admin secret in Pages JS.
- After upgrade, a real Pyth publish was pushed (not clock-stamped): `5VTPQU2cxYwpn4A1cr2QhzwcDPLPQZEGmNfEzzDFP9LbQNAtz61iFNNH7NRjZK1DfWAQnyUFYiyPTztmsnqnVXsD`. Read-back: source pyth, 107.38093257, inside the 120s window. Vault accounted still `1300000000`.
- A failed first deploy left buffer `7EHdbewC8QNRdoMYYhibgsTN8VCxzAAEyQJqooqUYkGv`. It was closed. Authority balance returned to about 3.37 SOL.
- Browser on the local Pages files: SOL showed 链上标记 107.53 while the oracle was fresh; BTC showed 82,413.96 and ETH 2,513.65, each labeled 参考报价, chart pill 采样, not LIVE. Guest history and the six labels render. No wallet extension was available, so faucet, deposit, open, close, and withdraw were not signed in this browser.

## Still true

- The mark is an admin copy of a Pyth account (B05). The page says 链上标记, not LIVE.
- Queued-claim opens stay off. SCAR is not a cash price. Session has no hard budget, so the page will not trade unattended.
- BTC/ETH are not a second on-chain desk.
- If the publisher stops, SOL opens and closes wait. That is the stale-price rule, not a hidden fixture fill.
- This round did not send a user deposit or withdraw, so the surplus inequality was not proven with a wallet signature.
- Not submitted to Colosseum.

---

STATUS = trade.html Client-bundle-fail fixed (__dirname). Pages 3595290. Not submitted.

Checked 2026-10-12 ~14:02 HKT. This build did not Submit. Lane does not submit.

## trade.html fail fix (2026-10-12 ~14:02 HKT)

- **Root cause:** `scardesk-client.js` threw `ReferenceError: __dirname is not defined` at `chain.js` `path.resolve(__dirname, …)` → `window.Scardesk` never set → trade-app body replaced with “Client bundle failed to load.”
- **Fix:** guard `__dirname` in chain/price/markets-runtime; esbuild `--define:__dirname="/"`; rebuild; force-push `er-s-an/scardesk` **3595290**.
- **UX extras on Pages:** &lt;0.02 SOL gate + faucet.solana.com; 429 toast; mobile wallet deep links / hints.
- **Write-up:** `app/demo/trade-fail-fix.md`. Live: https://er-s-an.github.io/scardesk/trade.html (CDN may lag ~10 min).
- **No Submit.** No mainnet. 1001× unchanged.

---

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

## 2026-10-12 trade.html __dirname fix
- Root cause: chain.js `path.resolve(__dirname)` in browser bundle → ReferenceError → Client bundle failed.
- Fix: guard __dirname + esbuild `--define:__dirname="/"`; rebuilt scardesk-client.js; force-pushed er-s-an/scardesk `3595290`.
- Mobile: Phantom/Solflare browse deep links + narrow CSS + hint. No Submit.
- Live: https://er-s-an.github.io/scardesk/trade.html

## 2026-10-12 trade.html verified
- Live UI PASS after __dirname fix; mobile stack PASS; hint CSS cascade fixed in 6fd6785.
- Residual: OnFinality 429. No Submit until user walks connect→faucet→open.
