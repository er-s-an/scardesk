# Gap checklist

Authority: `FIDELITY.md` A1–A19 and F1–F5. Rechecked 2026-10-12 afternoon against the Devnet desk (`deployment.devnet.json`, program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b`) and `BROWSER-PROOF.md`. "Local" means an older validator pass. "Devnet" means an explorer transaction or a live account read this afternoon. B1–B10 stay provisional.

| # | Status | Evidence |
| --- | --- | --- |
| A1 | Devnet open, local settlement | No order book. The browser key opened a 2× long on Devnet. That close did not confirm (RPC 429). Older local closes still settled against the LP and the FIFO queue. |
| A2 | Local close, Devnet open | One fill, full close, no margin top-up. Ticket copy matches. The Devnet 2× was not closed in this pass. |
| A3 | Devnet | `params.json` and the live desk account are max leverage 1001. Alice position 2 is a 1001× long, still open, liq 99.95004996. This pass did not call `set_max_leverage` and did not roll it back to 1000. |
| A4 | Devnet visible, path local | Bob's closed Devnet long shows −80 and 8000 SCAR. The step-by-step queue payment was the local browser loss. This pass did not close a new loss. |
| A5 | Devnet visible | SCAR supply on the desk is 8000. Bob's closed row shows 8000. Public mint: `4cM4cQMmFJnwebQ9LKEh3L1YzWoMjuHz6jYC1Dtjva7DyB12sjGDy32umSHsfukTwgD2QZ9DA5Sp3RTUaHiwEeUu`. No `mint_free`. This browser key did not mint new SCAR. |
| A6 | Devnet visible | Queue index 0 is Alice profit 18 at the head. Index 1 is Alice profit 98. Alice's distance read "0 ahead · 0 dUSD". This pass did not append a node. |
| A7 | Local, not re-clicked | `fundFrom: queued` is in the program and the verify script. Devnet opens this pass used balance. |
| A8 | Devnet, earlier click | Alice session withdraw toasted "Session key rejected. It can trade. It cannot withdraw, stake, or claim." Balance stayed 479. Screenshot `app/demo/browser/devnet-session-reject.png`. Not repeated after the RPC heated up. |
| A9 | Local | Tool list unchanged. This Devnet pass did not click the agent tools. |
| A10 | Devnet open | The wallet open uses the same prepare/send path as `client.open`. Signature `5JbCwfY99dNk4ZfKGeGWrmBHLMvsGhX5Z793RBGExrmG8F9bQaKhFMSetwiZNNaUWCdpFc1T7tJvjhidWcCTU6V5`. |
| A11 | Devnet | Public explorer transactions exist: queue write, SCAR mint, `set_max_leverage`, the 1001× open (`app/demo/public-proof.json`, `app/demo/leverage-1001.json`), plus this pass's deposit and 2× open. |
| A12 | Devnet layout | Account, ticket, queue, positions, and SCAR are one desk. At 390px the header, wallets, banner, and account stack. A full 720px card remeasure was not repeated. |
| A13 | Devnet toasts | Margin, leverage 1002, RPC 429, missing Phantom, missing Solflare, and disconnect all use plain sentences. The open button stays clickable and toasts instead of sending. A new SCAR-mint toast was not produced this pass. |
| A14 | Held | Copy is synthetic perps, loss-funded LP, FIFO. The page does not say paper-trading simulator or Alpaca. |
| A15 | Local measurement | Red `#ff2418` up and ash `#8a847f` down were measured on the local pass. This Devnet pass showed an up tick in red. Not a pixel copy. |
| A16 | Devnet visible, not re-settled | Bob's 8000 SCAR and Alice's unpaid queue are on the live blotter. The browser key's 2× is still open, about flat to a tiny profit, so it neither minted nor queued. |
| A17 | Devnet deployed, Surfnet absent | Program is on Devnet (IX 17 demo_faucet upgraded). Surfnet CLI still missing. Collateral is dUSD. Public Pages faucet is permissionless (proof in `app/demo/faucet-proof.json`). No Helius or QuickNode key. |
| A18 | Partial (desk) | SOL/USD + BTC/USD + ETH/USD switcher on desk. SOL settles on Devnet desk PDA. BTC/ETH marks+chart+desk-book; **not** separate on-chain market PDAs yet. Screenshots in `app/demo/browser/multimarket-*.png`. |
| A19 | Partial | Sponsored Pyth account reads and clock-stamped pushes landed (operator log prefixes `TFSVgeFHXNKA`, `TCRdwP6z5JF7`, and others). Hermes and benchmarks stay 401 without `PYTH_API_KEY`. Fixture 100 remains the fallback when that read fails. |
| F1 | Devnet running | `networks.json`, `SCARDESK_NETWORK`, `SCARDESK_RPC`. `npm run desk:devnet` reads `deployment.devnet.json`. Mainnet stays refused unless `SCARDESK_ALLOW_MAINNET=1`. The process on port 8787 was devnet when this was written. |
| F2 | Written | `README.md` has the three-step open. `HOW-TO-RUN.md` has the switch, the clone steps, and the 429 behavior. `docs/index.html` is the read-only blotter. `scripts/export-pages.sh` checks it and does not push. |
| F3 | Devnet, incomplete close | Faucet, deposit, and 2× open were clicked on Devnet. Close of that position returned 429 and stayed open. Not repeated on Surfnet. |
| F4 | Held | No Hyperliquid or HyperEVM fork. No pixel copy. No mainnet USDC. |
| F5 | Not submitted | This tree was not submitted. Submit waits for an explicit user nod. |

Provisional parameter deltas B1–B10 stay in the README table. They are implemented as documented there. B1's live Hermes pull is still closed. The sponsored Pyth account read is the public substitute and is labeled as such.

