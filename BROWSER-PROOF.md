# Browser proof

## UX pass, 2026-10-12

Same desk, `http://127.0.0.1:8787`, ledger not reset. A fresh browser profile had no saved key, so **Browser key** created `GwJp3c4h87mKEPQZhCSaFktgKbWTm5C6ssWomdy1uAyu`, airdropped fee SOL (about 0.995 SOL left), and created the desk user and the dUSD wallet. Balance stayed 0 dUSD. No position was opened. Alice stayed 1087 dUSD, owner `CKiK…pmQh`.

Clicked and read back:

- Phantom, extension absent: toast and status line "Phantom is not installed in this browser. Use Solflare, or Browser key." Tone `bad`.
- Solflare, same shape, naming Browser key.
- Margin 9000 against 1087 dUSD: ticket note names the balance, **Open position** is disabled, notional still previews. Restoring 100 clears the note and enables the button.
- Amount `abc`: deposit does not send. Toast "Amount must be a number, like 100 or 12.5." Balance unchanged.
- Alice withdraw 5000: toast "Not enough dUSD on the desk. Faucet, deposit, or lower the amount." Balance stayed 1087. That is program error 0x6, not a raw simulation dump.
- Alice session withdraw 1: toast "Session key rejected. It can trade. It cannot withdraw, stake, or claim." Balance stayed 1087. Role read SESSION.
- Browser key connect: quiet toast "Browser key connected. Faucet 1000 dUSD, then deposit." Status `localnet · your wallet · Browser key GwJp…uAyu · 127.0.0.1:8899`. On a 0 dUSD wallet the ticket again blocks the open.
- Alice while that key stayed connected: status `localnet · alice · Browser key GwJp…uAyu`, balance 1087. **Mine** returned role WALLET.
- Reload kept the key and the status line. The price note read "Sponsored Pyth SOL/USD on devnet."
- Disconnect: Phantom / Solflare / Browser key came back, Mine hid, role OWNER, balance 1087, who-line `CKiK…pmQh`.

Mark after a down tick: class `q-px dn`, color `rgb(138, 132, 127)`. A positive settle cell was `rgb(255, 36, 24)` with a red inset bar. A loss cell used the ash bar.

At 390×844 the page scroll width was 390. Position rows were `display: grid` and the header row was hidden. Shots: `app/demo/browser/ux-desktop.png`, `ux-mobile-top.png`, `ux-mobile-mid.png`.

Read-only preview `http://127.0.0.1:8787/preview.html` has no app script. At 1440 the queue cell "active · pos 0" fit the panel (326px). At 390 the page scroll width was 390. Shots: `ux-preview-desktop.png`, `ux-preview-mobile.png`. The same file is `docs/index.html`.

## Earlier wallet loop

Session: agent-browser `scardesk`, Chrome, `http://127.0.0.1:8787`. Ledger `/tmp/scardesk-ledger` was not reset. Network line on the page: demo stable on localnet, `http://127.0.0.1:8899`.

Screenshots:

- `app/demo/browser/desktop-wallet.png` — 1440×900, browser key connected, role session, balance 92.5 dUSD, queued 18.375 dUSD.
- `app/demo/browser/mobile-bob.png` — 390×844 full page, actor Bob, balance 939.24 dUSD, queue head visible.
- `app/demo/browser/mobile-alice-top.png` — 390×844 top, Phantom / Solflare / Browser key, Alice 1087 dUSD, mark 80 PYTH.
- `app/demo/browser/mobile-alice.png` — same phone width, footer and operator rail. Page scroll width equals the viewport at both 1440 and 390. The positions table scrolls inside its panel (content about 667px in a 324px column).

## Wallet

Phantom click, extension absent: toast "Phantom is not installed in this browser."

Solflare click, extension absent: toast "Solflare is not installed in this browser."

Browser key connect: `81WmsuQuEx5zgoKsTYRjdiajy6dW7f4DxKgVdRCUtRfj`. Toast: "Browser key connected. Faucet, then deposit." The who-line after reconnect showed 0.938 SOL and session `Ep6cxibDPBAdNiWCZXekmA9bYCKdSRpAmj7kRXB4Etdh` still armed. The wallet line says Alice and Bob stay on the demo ledger.

Disconnect returns the blotter to Alice. Alice's balance stayed 1087 dUSD. Bob, clicked in between, showed owner `5Mgx…5zCF`, balance 939.24 dUSD, queued 0, SCAR free 1000 and 11000 staked. His earlier 27.24 queue nodes are paid. The live queue head is wallet `6NC6` for 12.067274, then `FyVU` 19.6, then this browser key 18.375.

## Loop on the browser key

The desk log recorded these when `sendTransaction` returned. The loss, the queue write, the arm, and the session rejects are older than the validator's retained block window (first available block was 4605 while the slot was near 4670). `solana confirm` on those older signatures now returns Not found. `getSignaturesForAddress` still returns the two agent signatures below, and `solana confirm -v` on them printed `Status: Ok`.

| Step | What the page showed | Signature |
| --- | --- | --- |
| Loss close, price 77 | SCAR minted 750. Balance 100 → 92.5. The loss paid queue index 4 (`6NC6`, 7.5 dUSD). | `33bwoyESZiEU9m23jPYx2xEfVrkquy1woGjW4jJ1ETcacwQbBHCqzU97RN5xzA6CZvTRHpt4x13GVMwAeqFQAzqK` |
| Open long, margin 15, 10×, entry 80 | Position 1 opened on the fixture. | `KqUDj2a51kb5YaubJNjNE1qb4p2nF9zGMGXTyLwhQcqgZWg7rEjgTEu9NSgjf7Ax4wuMEHnu2SmqkDrLMYdhLgm` |
| Operator push 90, then close | Queue write index 6, 18.375 dUSD. PnL 18.75, fee 0.375, paid 0. | `UtKwotLjnmLTtYncKavhtT4PEiRJ5Xp8VEmDVhnJGjUGaxTwF5ZNzAYnYqwLrvJjYc9iJ8BJPbA6NYubGrstHUm` |
| Arm session | `evt=session_set` for `Ep6cxibDPBAdNiWCZXekmA9bYCKdSRpAmj7kRXB4Etdh`. | `4mSSYgFVCi9QEDWNfxod4vbbZCrFqYyLotaRp4EYa35twKRwNuiy4uWJdWrKWNxxCyPKoDAzTdTYEGLo2iCtN6Uc` |
| Trade as session, open margin 5 at 2×, then close | Flat. `evt=settle` pnl 0. | open `485Si5DwnHiL34WX9QxapwQB2cWswmdt2divnoxHaRmbs9joRfjnSvRzYcLtCZirrLa8R3JCF7aUB4N2sSCTXw5S`, close `2sTWbqCdqNKNhZj2LCWNVuUboytQzwKHwuD2uCaNtXBnoHT3sUYbWXxBXVVLFwFe1df5Rz4yQJXgArEnKEVDHbB4` |
| Withdraw as that session | Toast: session key rejected. Balance stayed 92.5. Log `evt=session_reject;op=withdraw`. | `2M9igQsp5BEoieUyWtVjW4bRCmhLbQtfSNYnDo4wrb2zpiLRmjnMWBXdsmUYvMYwhfmWB7fNFN9kJE6UjGGmDmYM` |
| Agent `paper.claim` as that session | Same reject toast. `evt=session_reject;op=claim`. | `3je5gj2aKHXTCDKNbwtvz131AiicJBWJ71HpvVpgf55wfLrQmCJts1TbqZKyFaXzEiwrCQVmHSeHkmwW3nDZ2b2T` |
| Agent `positions.open` margin 2, leverage 2, long | Opens 0 → 1. Balance 92.5 → 90.5. Position 3, entry 80, liq 60. Confirmed in slot 4829. Fee payer is the owner. Session signer paid the position rent (0.04732736 → 0.04465472 SOL). | `4Y7v4PEa8WYasFnUKagii4tG6UFCgNfqwJfXN97uB6DQ9XZT6HTFcfchRiEAenthdLaALWsy3QPYcVqS3DmVvRck` |
| Agent `positions.close` position 3 | Opens 1 → 0. Balance back to 92.5. `evt=settle;pos=3;pnl=0`. Status Ok. | `4n8F9on3R5TVvrPsMfXtcbPxHTkPLXtpHEGeWAeh2WZCo4vrD67m7pD3Cd1aLgFkixYndv37qrA1LiwjYiQRVqL1` |

Faucet and deposit for this wallet happened earlier in the same ledger. Their signatures are not in the current desk log. The account state is the remaining evidence: the wallet exists, balance is 92.5 dUSD, free SCAR is 750, queued is 18.375.

Queue distance on that wallet read "2 ahead · 31.667274 dUSD", which is 12.067274 + 19.6 ahead of its own 18.375 node.

## Mark color

Operator push while the connected wallet was the actor:

- 81: `#px` class `q-px up`, computed color `rgb(255, 36, 24)` (`#ff2418`). Source PYTH.
- 79: class `q-px dn`, color `rgb(138, 132, 127)` (`#8a847f`).
- 80: class `q-px up` again. Left there.

The push at 80 confirmed: `H9B2Ygoof84rUjEbqCUo6cQmQy5QiotJ6UNvLZsGsaYV47fZXLR1K6NvBRkcPJAMnnUvZSNNkqhAVoEhy3NnTpd`, log `evt=oracle_push;price=8000000000`. The response did not toast "connected wallet has no public key yet". That error was the previous bug when `/api/act` reloaded the wallet view without an owner. Hermes itself is still HTTP 401, so this push is an operator mirror, not a live Hermes read.

An earlier open in this session failed simulation with custom program error `0x6` because the margin field had become 2077 against a 92.5 balance. The following open used margin 15 and landed. That was a bad input, not a settlement bug.
