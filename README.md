# Scardesk

**Live trade UI (GitHub Pages):** https://er-s-an.github.io/scardesk/trade.html  
**Repo:** https://github.com/er-s-an/scardesk · Pages source: `main` branch path `/docs`

Synthetic perps · Loss-funded LP · FIFO payouts · Solana program + JS client.

SOL/USD settles on-chain (Devnet). BTC/ETH use desk-book marks until market PDAs exist. Loss token is **SCAR**. Collateral is **dUSD** (demo stable, 6 decimals). No mainnet funds. Independent experiment — not affiliated with papertrade.xyz. Not submitted to Colosseum.

高杠杆合成衍生品机制演示；非投顾；可能亏损本金；队列兑付依赖后续流入。

## Try it

1. Open **https://er-s-an.github.io/scardesk/trade.html**
2. Connect Phantom / Solflare (Devnet) or use the burner path on the page
3. Faucet demo dUSD → deposit → open/close. Session key may trade; withdraw/stake need the owner.

Static preview (no wallet): https://er-s-an.github.io/scardesk/

## Build & run from source

```bash
git clone https://github.com/er-s-an/scardesk.git
cd scardesk/app
npm install
npm test
# Devnet desk (reads app/config/deployment.devnet.json)
npm run desk:devnet
# then open http://127.0.0.1:8787
```

Localnet: start `solana-test-validator` (see `HOW-TO-RUN.md`), then `npm run desk:localnet`.

Rebuild the public Pages client bundle into `docs/`:

```bash
cd app && npm run pages:bundle
```

Program sources: `app/programs/scardesk/`. Client: `app/client/`. Desk UI: `app/desk/`. Public config: `app/config/` (`deployment.json` / `deployment.devnet.json` are addresses only — keypairs stay in gitignored `app/keys/`).

Full runbook: **`HOW-TO-RUN.md`**. Pitch / submission notes: `PITCH.md`, `SUBMISSION.md` (do **not** auto-Submit).

**STATUS:** Devnet desk is switchable. Public proof includes queue write, SCAR mint, and 1001×. See `STATUS.md`.

## What settles on chain

One native program (`app/programs/scardesk`). No order book. Each position is isolated: one fill, full close, no margin top-up. Notional = margin × leverage. A loss or a liquidation mints SCAR and pays the FIFO queue before any remainder reaches LP cash. A win the LP cannot cover returns margin and enqueues the unpaid net. `fundFrom: queued` spends the caller’s own queue nodes; a flat or winning close re-enqueues leftover margin, and a liquidation confiscates it.

Session key may open and close. Withdraw, stake, unstake, and claim require the owner. The program logs `evt=session_reject` and returns custom error 3. There is no `set_balance`, `set_pnl`, or `mint_free` instruction. The agent tool list is only:

`positions.open` · `positions.close` · `positions.closed` · `account.retrieve` · `paper.stake` · `paper.unstake` · `paper.claim`

`paper.*` is the Circuit-shaped API name. The token is SCAR. The faucet is an admin mint of dUSD into a wallet, then a deposit. It is not an agent tool.

## Formulas

Money is micro-dUSD (6 decimals). Price is i64 with expo −8. Integer division truncates toward zero.

```
pnl_long  = notional * (exit - entry) / entry
pnl_short = notional * (entry - exit) / entry
notional  = margin * leverage

move = entry * liq_fraction_bps / (leverage * 10000)
liq_long  = entry - move
liq_short = entry + move
```

Crossing the stored liquidation price forfeits the **entire** isolated margin. The stored `pnl` is still the formula result, which can be smaller than the margin. SCAR is minted on the qualified loss: the realized loss capped at margin, or the full margin on liquidation.

```
scar_raw = qualified_loss_micro * emission
```

With the provisional emission of 100, 1 dUSD of qualified loss mints 100 SCAR (6 decimals on the mint).

Win haircut applies only to the portion the LP can fund. Queue repayment of a stored net is not haircut again.

```
fee       = pnl * haircut_bps / 10000
net       = pnl - fee
budget    = min(pnl, lp_free)          lp_free = max(lp_cash - reserved_fees, 0)
fee_take  = fee * budget / pnl
user_take = budget - fee_take
shortfall = net - user_take
```

`user_take` leaves `lp_cash`. `fee_take` is added to `pending_fees` and `reserved_fees`. Stakers harvest on stake, unstake, and claim only (`acc_reward` × stake / 1e12). Claim pays `claimable` dUSD from LP cash into the user balance. If nobody is staked, fees sit in `pending_fees`.

Vault SPL dUSD moves only on deposit and withdraw. Settlement is internal: vault amount = desk.vault_accounted = sum of balances + open cash margins + lp_cash. Queued claims are not cash.

Provisional constants in `app/config/params.json`: max leverage 1001, haircut 200 bps, liquidation fraction 5000 bps, min margin 1 dUSD, emission 100, oracle max age 120 seconds. The Devnet desk account reads `maxLeverage` 1001. The worked example below was run when the local ceiling was 1000.

## Worked example (this ledger)

`node scripts/verify.js` exited 0 against program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b`. Both transactions below are `Status: Ok` on `http://127.0.0.1:8899`.

| Event | Signature |
| --- | --- |
| Queue write, Alice unpaid win 98 dUSD | `4gLDdW66LjoTgQMmCrKVS51G9tqdQrnasQLukzfwPbHij8qWCxdeypfUNcKiqukUYRQxzysq4ByEr6M5M8sETGvF` |
| SCAR mint, Bob qualified loss 80 dUSD → 8000 SCAR | `iKTGnY171uiC735bWaqnYoXKCTZHuTjWh8miZQtqEUP7biZr99YdSFuA51DeKtRuNAbsouSfAYM8nrbYT2NMZ37` |

Log lines: `evt=queue_write;index=0;amount=98000000` and `evt=scar_minted;amount=8000000000;loss=80000000`.

1. Alice long, margin 100, 10×, entry 100, exit 110. PnL 100, fee 2, net 98. LP was empty, so the whole net was queued and `fee_take` was 0. Alice balance 1000, queued 98. No SCAR.
2. Bob long, margin 200, 10×, entry 110, exit 105.6. PnL −80, above his liquidation price of 104.5. SCAR minted 8000. The loss paid 80 of Alice’s queue. Alice queued 18, balance 1080. Bob balance 920. LP still 0.
3. Bob long, margin 100, 10×, entry 105.6, exit 102.432. PnL −30. Pays the remaining 18 to Alice and leaves 12 in LP cash. Alice queued 0, balance 1098. Bob balance 890. Bob SCAR 11000.
4. Alice long, margin 10, 1000×, entry 100. Liquidation price 99.95. Exit 99.94. Formula PnL is −6. The isolated margin of 10 is forfeited in full, LP becomes 22, and Alice receives 1000 SCAR.
5. Bob stakes 11000 SCAR first. Then a long, margin 20, 10×, entry 100, exit 125. PnL 50, fee 1, net 49. LP free is 22, so `fee_take` = 0.44, `user_take` = 21.56, shortfall = 27.44. Balance path: 890 − 20 margin + 20 returned + 21.56 = **911.56**. Claim then pays the 0.44 into balance: **912**. LP cash and reserved fees return to 0.
6. Bob opens margin 10 from the queued 27.44 and closes flat: the margin is re-enqueued. A second queued 1000× long is liquidated: that margin is not returned. A later short, margin 10, 10×, entry 100, exit 90, PnL +10, fee 0.2, net 9.8, is queued because the LP is empty. Bob’s queued balance is **27.24** (7.44 profit still at the head, 10 margin, 9.8 profit).
7. A stale oracle (`publish_time = 1`) with fixture 80 opens on `source=fixture`. Alice’s session key opens and closes flat. Session withdraw, stake, and claim are rejected on chain. The owner can still withdraw. After that 1 dUSD owner withdraw, Alice’s balance is **1087**.

Mint supply equals `desk.total_scar`: **13000 SCAR** (Bob 12000, Alice 1000). Bob still has 11000 staked. Vault SPL is 1999, equal to Alice 1087 + Bob 912. Queue head is Bob’s 7.44.

After that proof, the desk UI was clicked through on the same ledger: two flat 1 dUSD session round-trips at mark 70 (ticket, then `positions.open` / `positions.close`). Balances and the queue were unchanged at that point. `scripts/verify.js` refuses to start twice on a ledger that already has Alice’s history.

A later pass on this same ledger, without `--reset`, is in `BROWSER-PROOF.md`. Alice is still 1087 dUSD. Bob’s queued 27.24 was paid, so the desk shows Bob at 939.24 dUSD. The live queue head is no longer Bob’s 7.44. Hermes is still HTTP 401. A later desk start reads the sponsored Pyth account `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` (about 111.10 at the 2026-10-12 read) and pushes that number. The fixture at 100 remains the fallback and is labeled provisional.

Local addresses: `app/config/deployment.json`. Devnet addresses: `app/config/deployment.devnet.json`. Raw local log: `app/demo/last-run.json`. Last price read: `app/fixtures/hermes-last.json`. Public proof: `app/demo/public-proof.json` (`ok: true`).

## Desk

`http://127.0.0.1:8787` while `npm run desk` is running inside `app/`.

Blotter: Account, Ticket, Positions, Queue, SCAR, Agent log. Desktop puts the queue beside the ticket. Below 980px the sections stack in that order. Red (`#ff2418`) is up, including a positive uPnL. A down tick is ash (`#8a847f`). A loss that mints SCAR stamps **SCAR MINTED**. Queue rows show head, kind, and amount left. The agent log prints the tool name. Session deposit and faucet are disabled; withdraw, stake, and claim are sent and rejected by the program.

Checked in a browser at 1440×900 and 390×844: actor switch (Alice balance 1087, Bob queued 27.24 at distance 0, session role), session withdraw / stake / `paper.claim` rejected with balance unchanged, mark red on an up tick and ash on a down tick after a later poll, ticket preview `100 × 10 = 1000` dUSD, session open and close from the ticket and from the agent, proofs box showing both signatures above. The positions table scrolls inside its panel on the phone width (content 667px, viewport column 324px) and the page itself stays within 390px.

## Run

```
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana-test-validator --reset --ledger /tmp/scardesk-ledger --rpc-port 8899 --faucet-port 9900 --bind-address 127.0.0.1
cd app
npm install
npm run verify          # deploys if needed, writes deployment.json and demo/last-run.json
npm run desk            # http://127.0.0.1:8787
solana confirm -v <signature> --url http://127.0.0.1:8899
```

The current ledger at `/tmp/scardesk-ledger` already holds the proof. Resetting it drops those signatures. Rebuild the program with platform-tools v1.41 (`cargo-build-sbf`); the host cargo must not rewrite `Cargo.lock` to version 4. `npm test` is a syntax check of the client, verify script, and desk.

Wallet buttons and the Devnet switch are in `HOW-TO-RUN.md`. `deployment.json` stays on localnet. `SCARDESK_ACTIVATE` was not set. Gaps are in `GAP-CHECKLIST.md`. The clicked loop is in `BROWSER-PROOF.md`.

## Provisional deltas

Each row is a simplification relative to the reference product. The behavior it names is implemented.

| # | *provisional* choice | This demo |
| --- | --- | --- |
| B1 | Price is a Pyth mid plus a fixture, not an exchange BBO | SOL/USD feed `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`, expo −8. Hermes HTTP 401 without `PYTH_API_KEY`. The desk reads sponsored account `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` on devnet. Fresh if `publish_time` is inside the desk window. A publish time outside the cluster clock is stored as the cluster timestamp, and the price number is kept. Else the fixture at 100, labeled provisional. |
| B2 | Emission curve | 100 SCAR per 1 dUSD of qualified loss while the tracked LP is small. |
| B3 | Win haircut | 200 bps, pro-rata on the LP-funded portion only. |
| B4 | Liquidation threshold | `liq_fraction_bps = 5000`. At 1001× about 5 bp adverse move liquidates the whole margin. |
| B5 | Staker fee split | Minimal harvest: fees accrue in `acc_reward` and pay out on claim. No soft-cap curve. |
| B6 | Minimum margin | 1 dUSD, relaxed so a faucet demo can open. Isolated margin is unchanged. |
| B7 | Session / relayer | Self-built session account. No official relayer. |
| B8 | Markets | SOL/USD only. |
| B9 | Visual | Red-black desk, own type (Newsreader, IBM Plex Mono). Layout and flow match the blotter. Not a pixel copy. |
| B10 | Collateral | Demo stable dUSD. Same settlement rules. No mainnet USDC. |

| | Reference | Scardesk |
| --- | --- | --- |
| Chain | venue stack | Solana program on Devnet, local validator still available |
| Price | venue BBO mid | Sponsored Pyth account, else provisional fixture |
| Market | multiple | SOL/USD |
| Cash | mainnet stablecoin | dUSD demo stable |
| Trade key | venue relayer | on-chain session, separate from the owner |
| Loss token | venue loss token | SCAR, desk-owned treasury, no user token account |
| Look | original site | red-black, red = up |
| Parameters | venue curves | emission, haircut, and liquidation constants above |
| Relayer | official | none |
| Mainnet cash | production | out of scope |

## Layout

```
app/programs/scardesk    native program
app/client/src           math, layout, chain client, agent tools
app/scripts/verify.js    settlement proof
app/desk                 blotter server and red-black UI
app/config               params and deployment
app/keys                 local demo keys
app/fixtures             SOL/USD snapshot and last Hermes result
```
