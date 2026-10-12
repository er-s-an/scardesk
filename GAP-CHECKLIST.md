# Gap checklist

Authority: `FIDELITY.md` A1–A19 and F1–F5. Checked 2026-10-12 against the local ledger and the browser pass in `BROWSER-PROOF.md`. "Local" means the behavior is on this validator and is not on a public explorer.

| # | Status | Evidence |
| --- | --- | --- |
| A1 | Local | No order book. Opens and closes settle against the desk LP and the FIFO queue. |
| A2 | Local | One fill, full close, no margin top-up. Ticket copy and the program match. |
| A3 | Local | Max leverage 1000 in `app/config/params.json`. Alice's 1000× liquidation is still in the positions table. |
| A4 | Local | A loss pays the queue, then LP cash. The browser loss of 7.5 dUSD paid queue index 4 in full. |
| A5 | Local | SCAR mints on qualified loss only. Browser mint was 750 SCAR on 7.5 dUSD. No `mint_free`. Bob still shows 11000 staked from the verify script. The browser session cannot stake or claim. |
| A6 | Local | Queue rows show head, kind, and amount left. The browser win wrote 18.375 dUSD at index 6 because LP cash was 0. |
| A7 | Local, not re-clicked | `fundFrom: queued` is in the program and in the verify script. This browser pass funded opens from balance. |
| A8 | Local | Session `Ep6c…Etdh` opened and closed. Withdraw and claim logged `evt=session_reject`. Balance did not move. |
| A9 | Local | Tool list is `positions.open`, `positions.close`, `positions.closed`, `account.retrieve`, `paper.stake`, `paper.unstake`, `paper.claim`. This pass ran agent open, agent close, and `paper.claim` (rejected). It did not click `account.retrieve`, `paper.stake`, or `paper.unstake`. |
| A10 | Local | The ticket and the agent both call the same `client.open` / `client.close` path. |
| A11 | Gap | Accounts are readable on localnet. There is no public explorer transaction. Older local signatures fall out of the validator's block window and `solana confirm` returns Not found. |
| A12 | Local | Account, ticket, positions, queue, SCAR, and the agent log are on one desk. At 390px they stack in that order. At 720px and below, queue and position rows become labeled cards so Close is not trapped in a wide scroll. |
| A13 | Local | The loss close logged `scar_minted` and the desk toasts "SCAR minted." The queue shows distance to the head. A refused action names the next step (dUSD, queued claim, free SCAR, fee SOL, missing extension) instead of a raw simulation dump. The ticket blocks an open that the balance cannot fund. |
| A14 | Local | Copy is synthetic perps, loss-funded LP, FIFO. The page does not say paper-trading simulator or Alpaca. |
| A15 | Local | Red `#ff2418` is up. Ash `#8a847f` is down. Measured on mark 81, 79, and 80 in this pass. Not a pixel copy. |
| A16 | Local | Loss mint and a queued win both happened on the browser key. The queued win was not later paid out by a following loss in this pass. The verify script did pay a queue with a later loss. |
| A17 | Gap | Surfnet CLI is absent. Devnet RPC answers and the genesis matches. Rechecked 2026-10-12T00:54:43Z: admin and the spare deployer are both 0 lamports. No Helius or QuickNode key in the environment. Faucet paths were not retried this round. No program was deployed. Collateral is dUSD, not mainnet USDC. |
| A18 | Local | SOL/USD only. |
| A19 | Partial | Role is Pyth mid, then fixture when the publish time is outside the desk window. Hermes and the Pyth benchmark return 401 without `PYTH_API_KEY`. The desk reads sponsored account `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` on devnet and pushes that SOL/USD number. The fixture at 100 is provisional when that read fails. There is still no Hermes key and no public price transaction. |
| F1 | Local config | `app/config/networks.json` plus `SCARDESK_NETWORK` and `SCARDESK_RPC`. Mainnet is refused unless `SCARDESK_ALLOW_MAINNET=1`. The running desk is still localnet. See `HOW-TO-RUN.md`. |
| F2 | Written | `README.md` points here. `HOW-TO-RUN.md` covers the validator, the three wallet buttons, Mine, the ticket guard, and the env switches. `docs/index.html` is a read-only blotter. `PITCH.md` is the spoken draft. Not recorded. |
| F3 | Local only | The wallet loop was clicked on localnet. It was not repeated on devnet or Surfnet, because the program is not there. |
| F4 | Held | No Hyperliquid or HyperEVM fork. No pixel copy. No mainnet USDC. |
| F5 | Not submitted | 10-12 iteration is this tree. Submit waits for an explicit user nod. Deadline target remains about 2026-10-13 14:59 HKT. |

Provisional parameter deltas B1–B10 stay in the README table. They are implemented as documented there. B1's live Hermes pull is still closed. The sponsored Pyth account read is the public substitute and is labeled as such.
