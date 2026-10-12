# How to run Scardesk

Local demo first. A public cluster is a second step, and it has not succeeded on this machine. Do not Submit from this document.

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

The ticket will not open when the margin is larger than the desk balance or the queued claim, when leverage is outside 1–1000, or when the amount is not a number. Deposit and withdraw use the same number check. Lower the field and the button comes back. That guard is what stops a typed margin from being sent and rejected on chain.

This browser has no Phantom or Solflare extension. Those buttons toast that the extension is missing and name the other path. The loop in `BROWSER-PROOF.md` used the browser key.

## Read-only preview

`app/desk/public/preview.html` is a frozen blotter. The desk serves it at `http://127.0.0.1:8787/preview.html`. The same file is `docs/index.html`, with `docs/styles.css` beside it, for a static host such as GitHub Pages. Nothing on that page connects, signs, or calls the program. The numbers are a copy of the local ledger at 2026-10-12T00:54:43Z (Alice 1087 dUSD, three live queue nodes, LP cash 0). It is not a live cluster and it has no explorer link.

GitHub Pages was not turned on from this machine.

The spoken pitch and the click path are drafted in `PITCH.md`. Not recorded. Not submitted.

## Switch network

`app/config/networks.json` names `localnet`, `devnet`, `testnet`, and `mainnet-beta`.

| Variable | Effect |
| --- | --- |
| `SCARDESK_NETWORK` | Selects `config/deployment.<network>.json` when that file exists, and the RPC from `networks.json`. |
| `SCARDESK_RPC` | Overrides the RPC URL. |
| `SCARDESK_ALLOW_MAINNET=1` | Required before the desk will start on `mainnet-beta`. Leave it unset. This round is demo stable. |
| `SCARDESK_ACTIVATE=1` | Only for `npm run proof`, after a public deploy succeeds. Copies the current `deployment.json` to `deployment.local.json` if needed, then points `deployment.json` at the public deploy. |
| `PYTH_API_KEY` | Sent as `Authorization: Bearer` to Hermes. Without it, Hermes and the Pyth benchmark return 401. The desk then reads the sponsored Pyth SOL/USD account on devnet. If that read fails, the on-chain fixture is provisional. |
| `PYTH_READ_RPC` | Optional RPC used only to read that sponsored account. Unset, the reader tries OnFinality devnet, then a public mainnet RPC. Mainnet is never a deploy target. |

Switch the running desk only after a public deploy exists.

1. Confirm `app/demo/public-proof.json` has `"ok": true` and `app/config/deployment.devnet.json` exists.
2. Stop the desk process. Leave the local validator running if you still want this ledger.
3. From `app/`, start `SCARDESK_NETWORK=devnet npm run desk`.
4. Open `http://127.0.0.1:8787`. The footer must say devnet and the OnFinality host.
5. Leave `SCARDESK_ACTIVATE` unset. Leave `SCARDESK_ALLOW_MAINNET` unset. Do not Submit.

If step 1 is not true, do not switch. Starting with `SCARDESK_NETWORK=devnet` while `deployment.devnet.json` is missing keeps the addresses from `deployment.json` and shows a banner. That is not a deploy.

Official `https://api.devnet.solana.com` does not answer from this host. The sandbox DNS maps it to `198.18.0.1`. A request pinned to the public address `208.115.212.49` still ends in TLS EOF. `networks.json` points devnet at `https://solana-devnet.api.onfinality.io/public`, which returns genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.

## Public program

```
cd app
npm run proof
```

The script picks a public RPC, refuses mainnet, and tries to deploy. On success it writes `config/deployment.<network>.json` and `demo/public-proof.json`. It does **not** replace `deployment.json` unless `SCARDESK_ACTIVATE=1`.

The last run did not deploy. Rechecked 2026-10-12T00:54:43Z on `https://solana-devnet.api.onfinality.io/public` (genesis still `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`): admin `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U` has 0 lamports, and the spare deployer `7f6Tk3xuV1YarYsX5kieRaaka8XahCR5xMUHfEU8YMDi` has 0 lamports. No `HELIUS`, `QUICKNODE`, or `PYTH_API_KEY` is in the environment. This round did not wait on a faucet.

Earlier attempts, not retried this round: OnFinality `requestAirdrop` returns invalid request. `faucet.solana.com` stopped at a failed Turnstile check. The QuickNode faucet form did not leave the first step. Testnet `requestAirdrop` returned 429 for this IP, including three fresh keys. `solana rent` on the 215584-byte program is 1.50166872 SOL for the program data and the same again for the deploy buffer, so the script refuses to deploy below 3.2 SOL. No program transaction was sent. Surfnet CLI is not installed (`command -v surfnet` finds nothing). `app/demo/public-proof.json` stays `ok: false`.

Do not point the desk at devnet until `deployment.devnet.json` exists and the admin key can pay rent.
