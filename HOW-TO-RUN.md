# How to run Scardesk

Local demo and Devnet are both wired. Devnet program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` is already deployed. Do not Submit from this document.

Collateral is demo stable dUSD. Settlement rules match a 6-decimal stablecoin. There are no mainnet funds.

## Local desk

The ledger at `/tmp/scardesk-ledger` already holds the verify script and the browser wallet. Start the validator **without** `--reset`. Resetting it drops the account state those signatures describe.

```
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana-test-validator --ledger /tmp/scardesk-ledger --rpc-port 8899 --faucet-port 9900 --bind-address 127.0.0.1
cd app
npm install
npm test
npm run desk
```

Open `http://127.0.0.1:8787`.

`npm test` syntax-checks the client, the verify script, the desk server, and `desk/public/app.js`. `npm run verify` deploys if needed and writes `app/demo/last-run.json`. It refuses to start twice on a ledger that already has Alice's history. `npm run wallet` rebuilds `desk/public/wallet.js` from `desk/wallet-entry.js`.

`app/config/deployment.json` is the default the desk reads. It is localnet.

## Connect a wallet

The header has three buttons.

- **Phantom** uses `window.phantom.solana` when that extension is installed.
- **Solflare** uses `window.solflare` when that extension is installed.
- **Browser key** creates a key in this browser (`localStorage` key `scardesk-burner`) and signs with the same `signTransaction` shape. It is not Phantom and not Solflare.

On connect, the desk airdrops fee SOL if the wallet has under 0.02 SOL, then creates the user and the dUSD wallet if they are missing. **Faucet 1000 dUSD** is an admin mint of demo stable into that wallet. **Deposit** moves it onto the desk. Neither is an agent tool.

**Trade as session** arms nothing by itself. **Arm session** moves 0.05 SOL from the owner to a new session key stored in `sessionStorage` (`scardesk-session`), then sets that key on chain. The session key pays position-account rent. The owner pays the transaction fee. The session key may open and close, including through the agent tools. Withdraw, stake, unstake, and claim are sent and the program rejects them (`evt=session_reject`, custom error 3).

Alice and Bob stay on the demo keys. Disconnect returns the blotter to Alice. Their accounts are not the browser key. While a wallet is connected, **Mine** switches the blotter back to that wallet after you have looked at Alice, Bob, or Alice's session. The button labeled **Alice session** is the demo key's session, not the browser session.

The status line under the buttons names the step: connecting, reading the desk, requesting fee SOL, creating the user, creating the dUSD wallet, then connected. If a step stops, the line stays on the next action (Fee SOL, or reconnect). A success toast is quiet. A refusal stays red and names what to do next, including program errors such as not enough dUSD, not enough queued claim, and not enough free SCAR.

The ticket will not open when the margin is larger than the desk balance or the queued claim, when leverage is outside 1–1001, or when the amount is not a number. Deposit and withdraw use the same number check. Lower the field and the button comes back. That guard is what stops a typed margin from being sent and rejected on chain.

This browser has no Phantom or Solflare extension. Those buttons toast that the extension is missing and name the other path. The loop in `BROWSER-PROOF.md` used the browser key.

## Read-only preview

`app/desk/public/preview.html` is a frozen blotter. The desk serves it at `http://127.0.0.1:8787/preview.html`. The same file is `docs/index.html`, with `docs/styles.css` beside it, for a static host such as GitHub Pages. Nothing on that page connects, signs, or calls the program. The numbers are a copy of the local ledger at 2026-10-12T00:54:43Z (Alice 1087 dUSD). They are not a live Devnet balance. The page links the Devnet program, the queue write, the SCAR mint, and the 1001× open.

Public read-only UI already published: https://er-s-an.github.io/scardesk/ (repo https://github.com/er-s-an/scardesk). This round did not push, so that site can lag `docs/` in this tree. `scripts/export-pages.sh` checks the static file and prints the Pages switch. It does not push and does not Submit.

The spoken pitch and the click path are drafted in `PITCH.md`. Not recorded. Not submitted.



## Market switch (SOL / BTC / ETH)

The header has **SOL · BTC · ETH**. Mark, ticket, positions, and the chart follow the active market. Deep link: `http://127.0.0.1:8787/?market=BTC/USD&tf=15m`.

| Market | Settlement tonight |
| --- | --- |
| **SOL/USD** | On-chain Devnet desk PDA. Same open/close/SCAR/FIFO path as before. |
| **BTC/USD** | Desk mark from Pyth sponsored account / fixture. Opens use **desk-book** (not a second program PDA). |
| **ETH/USD** | Same as BTC — desk-book until a market-seeded PDA exists. |

Chart: default **Tick** (step + shade). From **15m** upward: candlesticks. Timeframes Tick / 1m / 5m / 15m / 1h / 4h / 1d. Optional EMA21 is off by default and is **not** a papertrade.xyz parity claim (source desk has no EMA/RSI pane; source markets are BTC+ETH only — Scardesk keeps SOL by user OVERRIDE).

Config: `app/config/markets.json`. Fixtures: `app/fixtures/sol-usd.json`, `btc-usd.json`, `eth-usd.json`. APIs: `GET /api/markets`, `POST /api/market`, `GET /api/history?market=…`, `POST /api/desk-book`.

Do not Submit. Do not set mainnet.

## Switch network

`app/config/networks.json` names `localnet`, `devnet`, `testnet`, and `mainnet-beta`.

From `app/`, one command either way. Stop the other desk first. They share port 8787.

```
npm run desk:localnet
npm run desk:devnet
```

The same switches are `scripts/use-network.sh localnet` and `scripts/use-network.sh devnet` from the repo root. A copied `app/.env` is read only for variables the shell did not set. See `app/.env.example`.

| Variable | Effect |
| --- | --- |
| `SCARDESK_NETWORK` | Selects `config/deployment.<network>.json` when that file exists, and the RPC from `networks.json`. |
| `SCARDESK_RPC` | Overrides the RPC URL. It does not change program addresses. Set `SCARDESK_NETWORK` as well. |
| `SCARDESK_ALLOW_MAINNET=1` | Required before the desk will start on `mainnet-beta`. Leave it unset. This round is demo stable. |
| `SCARDESK_ACTIVATE=1` | Only for `npm run proof`, after a public deploy succeeds. Copies the current `deployment.json` to `deployment.local.json` if needed, then points `deployment.json` at the public deploy. Leave it unset to trade. |
| `PYTH_API_KEY` | Sent as `Authorization: Bearer` to Hermes. Without it, Hermes and the Pyth benchmark return 401. The desk then reads the sponsored Pyth SOL/USD account on devnet. If that read fails, the on-chain fixture is provisional. |
| `PYTH_READ_RPC` | Optional RPC used only to read that sponsored account. Unset, the reader tries OnFinality devnet, then a public mainnet RPC. Mainnet is never a deploy target. |

`npm run desk:devnet` reads `config/deployment.devnet.json` (program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b`). The footer must say devnet, `deployment.devnet.json`, and the RPC host. Leave `SCARDESK_ACTIVATE` unset. Leave `SCARDESK_ALLOW_MAINNET` unset. Do not Submit.

If `deployment.devnet.json` is missing, the desk keeps the addresses in `deployment.json` and shows a banner. That is not a deploy.

OnFinality answers, and it returns 429 when too many calls share the public budget. The desk retries a refused read a few times, spaced out, and leaves web3.js's built-in 429 burst off. Confirmation polls `getTransaction` over HTTP and does not subscribe on the OnFinality websocket. If the retries still fail, the page says the RPC is busy and slows its refresh. Nothing new is signed on that error. A SOL balance that reads as a dash does not trigger an airdrop. The sponsored Pyth push waits 45 seconds after startup, then repeats every three minutes. Official `https://api.devnet.solana.com` does not answer from this host. The sandbox DNS maps it to `198.18.0.1`. `networks.json` points devnet at `https://solana-devnet.api.onfinality.io/public`, genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.

## Clone and connect to Devnet

Someone else does not need a local validator.

1. Clone the repo. `cd app && npm install`.
2. Confirm `config/deployment.devnet.json` exists and `demo/public-proof.json` has `"ok": true`. Both are in this tree.
3. `npm run desk:devnet`. The demo operator key in `app/keys` signs oracle pushes (and admin faucet fallback). It is a Devnet demo key, not a mainnet treasury. Prefer the public trade page faucet when possible.
4. Open `http://127.0.0.1:8787` (or https://er-s-an.github.io/scardesk/trade.html). Connect Phantom, Solflare, or Browser key. Faucet 1000 dUSD (permissionless), deposit, then open. The ticket toasts and does not send when margin is above the desk balance or leverage is outside 1–1001. A loss stamps SCAR minted. A win the LP cannot pay toasts a queue write. Arm session, then withdraw: the program rejects it and the toast says the session key can trade and cannot withdraw.
5. Do not set `SCARDESK_ACTIVATE`. Do not Submit.

`npm run desk` with no variable still reads `deployment.json`, which stays on localnet.

## Public trade.html (no local desk)

Judges can skip `npm run desk:devnet`:

1. Open https://er-s-an.github.io/scardesk/trade.html
2. Get Devnet fee SOL from https://faucet.solana.com (OnFinality refuses `requestAirdrop`).
3. Connect Phantom / Solflare / Browser key. The page creates the user + dUSD wallet if missing.
4. Click **Faucet 1000 dUSD** — wallet signs permissionless IX 17 (`demo_faucet`). 60s cooldown.
5. Deposit → Open SOL/USD → Close. BTC/ETH stay desk-book labeled (not a second PDA).

Local `npm run desk:devnet` still works; faucet prefers the same permissionless path (admin mint is fallback only).

## Public program

The program is already on Devnet. Do not run `npm run proof` unless you mean to deploy again. Proofs are in `app/demo/public-proof.json` (`ok: true`): queue write, SCAR mint, and the 1001× open. `npm run proof` refuses mainnet and does not replace `deployment.json` unless `SCARDESK_ACTIVATE=1`.

Surfnet CLI is not installed (`command -v surfnet` finds nothing). No `HELIUS`, `QUICKNODE`, or `PYTH_API_KEY` is required to open the desk. Hermes stays 401 until a Pyth key exists. OnFinality `requestAirdrop` is not a reliable faucet; the desk sponsors a small fee from the demo operator when that operator has SOL.
