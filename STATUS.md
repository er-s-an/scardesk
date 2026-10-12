STATUS = local desk can connect a wallet and can read a public Pyth account. Public program not deployed. Not submitted.

Checked 2026-10-12. This build did not Submit. Lane does not submit. `SCARDESK_ACTIVATE` was not set.

## What landed

The desk at `http://127.0.0.1:8787` is on localnet `http://127.0.0.1:8899`. `app/config/deployment.json` is still that localnet file. `SCARDESK_ACTIVATE` was not set.

A browser key, `81WmsuQuEx5zgoKsTYRjdiajy6dW7f4DxKgVdRCUtRfj`, signed in the page. The same pass deposited demo stable, opened and closed, minted SCAR on a loss, wrote a FIFO queue node on a win, armed session key `Ep6cxibDPBAdNiWCZXekmA9bYCKdSRpAmj7kRXB4Etdh`, and showed that key can trade and cannot withdraw or claim. Agent `positions.open` and `positions.close` used that session key. Phantom and Solflare are buttons on the desk. This browser has neither extension.

Alice still reads 1087 dUSD. The validator was not started with `--reset`.

Devnet RPC `https://solana-devnet.api.onfinality.io/public` returns genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Admin `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U` has 0 lamports there. Rechecked 2026-10-12T00:54:43Z, and the spare deployer `7f6Tk3xuV1YarYsX5kieRaaka8XahCR5xMUHfEU8YMDi` is also 0. No Helius key. No program was sent. `app/demo/public-proof.json` records `ok: false`. This round did not wait on a faucet.

The desk status line now names connect steps, a red toast is a refusal and a quiet toast is a land, and the ticket refuses an open the balance cannot fund. **Mine** returns the blotter to the connected wallet. A frozen read-only blotter is at `http://127.0.0.1:8787/preview.html` and `docs/index.html`. Spoken draft: `PITCH.md`. Not recorded.

This round's browser profile had no saved key, so Browser key created `GwJp3c4h87mKEPQZhCSaFktgKbWTm5C6ssWomdy1uAyu` (fee SOL, desk user, dUSD wallet, balance 0). It did not open a position. Disconnect returned the blotter to Alice at 1087 dUSD. Details are in `BROWSER-PROOF.md`.

SOL for that deploy did not arrive. Official `api.devnet.solana.com` is unreachable here (sandbox DNS `198.18.0.1`, and the public address `208.115.212.49` still TLS EOF). OnFinality disables `requestAirdrop`. Testnet airdrops returned 429 for this IP. `faucet.solana.com` failed Turnstile. The QuickNode form did not drip. No Helius, QuickNode, or Pyth key is in the environment. Upgradeable rent is about 3.2 SOL (`solana rent` 1.50166872 SOL for program data, again for the buffer). A fresh deployer `7f6Tk3xuV1YarYsX5kieRaaka8XahCR5xMUHfEU8YMDi` was not funded.

Hermes and the Pyth benchmark still return HTTP 401. The desk reads the sponsored Pyth SOL/USD account `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` on that same devnet RPC (about 111.10, expo −8) and pushes the number onto the local oracle. If the Pyth publish time is outside the local cluster clock, the program stamps the cluster clock and keeps the price. The fixture at 100 is the fallback and is labeled provisional. This is not a Hermes pull and not an explorer transaction.

## Gaps

- No Surfnet CLI on this machine, so there is no Surfnet signature.
- No `explorer.solana.com` transaction. Local `solana confirm` only works while the validator still has the block. Older browser signatures now return Not found. Account state still shows their effect. See `BROWSER-PROOF.md`.
- The public program is still not deployed. The blocker is SOL, not the `.so`.
- Mainnet is refused unless `SCARDESK_ALLOW_MAINNET=1`. That switch was not used. Collateral stays demo stable dUSD.

Pointers: `HOW-TO-RUN.md`, `GAP-CHECKLIST.md`, `BROWSER-PROOF.md`, `app/demo/browser/`.

## Submit pack

Submit pack drafted 2026-10-12 HKT: `SUBMISSION.md` + `SUBMIT-CHECKLIST.md`. Not submitted. Lane does not submit.
