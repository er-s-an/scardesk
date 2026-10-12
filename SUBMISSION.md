# Submission draft — Scardesk (do NOT submit)

Paste-ready copy for the Colosseum Crypto World's Fair portal.
**This file is a draft only.** No Colosseum Submit was clicked. No submit API was called.
Lane / Paychannel is the **backup** track — do **not** submit Lane. Submission target is **Scardesk**.

Deadline target (project lock): **2026-10-13 ~14:59 HKT**. Prefer upload a revisable draft earlier; hard stop at the portal deadline.

Sources of truth for claims: `STATUS.md`, `README.md`, `FIDELITY.md`, `HOW-TO-RUN.md`, `BROWSER-PROOF.md`, `GAP-CHECKLIST.md`.
Do not invent explorer URLs or public Devnet program ids. Until `app/demo/public-proof.json` has `"ok": true` and `app/config/deployment.devnet.json` exists, leave public-deploy fields blank or marked PENDING.

---

## Portal fields (short)

| Field | Draft |
| --- | --- |
| Product name | **Scardesk** |
| Tagline / one line | Synthetic perps · Loss-funded LP · FIFO payouts — on Solana, with SCAR minted only on qualified loss. |
| Track | Solana Ecosystem |
| Loss token | **SCAR** |
| Brand | Scardesk / SCAR (not papertrade / PAPER) |
| GitHub | **PENDING** — intended `https://github.com/er-s-an/scardesk` (repo not created yet; 404 as of draft). If private at Submit, grant `hackathon@colosseum.com`. |
| Live app / desk | **PENDING public URL**. Local proof: `http://127.0.0.1:8787` on localnet (`HOW-TO-RUN.md`). |
| Demo video | **PENDING** ≤3 min — must show on-chain settle path (SCAR mint + queue write). Screenshots: `app/demo/browser/`. |
| Presentation / pitch video | **PENDING** 2–3 min — Problem → Solution → Demo → Team. |
| Logo / graphic | **PENDING** — red-black desk mark; not a pixel copy of papertrade.xyz. |
| Team | Solo: **Caesar / 谢佳辰** (CityU, Computer & Data Engineering). GitHub: `er-s-an`. |
| Location | Hong Kong |
| Collateral this round | Demo stable **dUSD** (6 decimals). Not mainnet USDC. |
| Public program | **BLOCKED** — admin `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U` has **0 SOL** on reachable Devnet RPC. `public-proof.json` → `ok: false`. |
| Lane | Backup only. **Do not Submit Lane.** |

---

## Description (short — portal “brief description”)

Scardesk is a Solana remake of the synthetic-perps / loss-funded LP loop (independent experiment; not affiliated with papertrade.xyz). Traders open isolated SOL/USD positions against a desk LP. Losses and liquidations mint **SCAR** and repay a FIFO payout queue before leftover cash hits the LP. Wins the LP cannot fund return margin and enqueue the unpaid net. A session key may open and close; withdraw, stake, unstake, and claim stay with the owner on chain.

This contest round settles on a local `solana-test-validator` with demo stable **dUSD**. The public Devnet program is **not deployed** yet (deployer has 0 SOL). Hermes needs a Pyth key; the desk can still read a sponsored Pyth SOL/USD account and fall back to a labeled provisional fixture.

---

## Longer description (optional paste / README blurb)

**What settles on chain**

One native program (`app/programs/scardesk`). No order book. Each position is isolated: one fill, full close, no margin top-up. Notional = margin × leverage (max 1000× in params). Qualified loss mints SCAR; win haircut applies only to the LP-funded portion. Queue repayment of a stored net is not haircut again. Vault SPL dUSD moves only on deposit and withdraw; settlement balances are internal and must equal vault accounted cash.

**Agent surface (Circuit-shaped names; token is SCAR)**

`positions.open` · `positions.close` · `positions.closed` · `account.retrieve` · `paper.stake` · `paper.unstake` · `paper.claim`

There is no `set_balance`, `set_pnl`, or `mint_free`. The faucet is an admin mint of dUSD, then a deposit — not an agent tool.

**What is proven locally (not public explorer)**

- Desk at `http://127.0.0.1:8787` on localnet `http://127.0.0.1:8899`.
- Browser key wallet connected; deposit → open/close → SCAR on loss → FIFO queue on unpaid win → session arm → session can trade, cannot withdraw/claim (`BROWSER-PROOF.md`).
- Verify script exit 0 against local program id in `app/config/deployment.json` (local only — do not paste as Devnet).
- Screenshots under `app/demo/browser/` (desktop + mobile).

**Honest gaps at draft time**

- No Surfnet CLI on the build machine → no Surfnet claim.
- No `explorer.solana.com` transaction yet.
- Public Devnet deploy blocked on SOL (~3.2 SOL rent floor for upgradeable deploy). Official `api.devnet.solana.com` unreachable from this host; OnFinality Devnet answers but airdrop is disabled.
- Hermes / Pyth benchmark HTTP 401 without `PYTH_API_KEY`.
- GitHub `scardesk` and public desk URL not published yet.
- Videos not recorded yet.

---

## Blockchains & tools

| Layer | Choice |
| --- | --- |
| Chain | Solana (localnet this round; Devnet when funded) |
| Program | Native SBF (`cargo-build-sbf`), custom `scardesk` program — **not** Anchor, **not** a Hyperliquid / HyperEVM fork |
| Client | Node.js (`@solana/web3.js`), desk server + red-black blotter UI |
| Oracle | Pyth SOL/USD role: Hermes when keyed; else sponsored account read `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` on Devnet RPC; else provisional fixture @ 100 |
| Wallets | Phantom / Solflare buttons; browser key for extension-less proof |
| Collateral | dUSD demo stable (same 6-decimal settlement rules as a stablecoin) |
| Networks config | `app/config/networks.json` + `SCARDESK_NETWORK` / `SCARDESK_RPC` |

---

## Team

| Role | Person |
| --- | --- |
| Founder / solo | **Caesar / 谢佳辰** — City University of Hong Kong, Computer & Data Engineering (undergrad). Builds with AI coding agents; prior Web3 / agent work as self-reported in other contest packs. |
| GitHub | `er-s-an` |
| Location | Hong Kong |

Background for the portal (keep factual; do not inflate): AI-agent builder; AdventureX 2026 Web3 track 1st (self-reported elsewhere); Tencent Photon AI Agent internship (self-reported elsewhere). Adjust wording to whatever Caesar confirms on the form.

---

## Pitch video outline (2–3 min — NOT recorded)

Spoken draft with the click path: `PITCH.md`. Do not record from the outline below if it drifts from that file.

1. **Problem (20s):** Synthetic perps that settle against a protocol LP, with loss mining and FIFO when the LP is thin, are hard to verify if settlement lives off-chain or behind a closed relayer.
2. **Solution (40s):** Scardesk puts the loop on Solana — isolated positions, SCAR on qualified loss, FIFO queue, session key ≠ vault authority.
3. **Demo (60–90s):** Desk blotter → loss mints SCAR → win queues → session open/close ok, withdraw rejected. Prefer **public explorer** once Devnet is up; until then, local desk + `solana confirm` on retained blocks / account state.
4. **Team (15s):** Caesar / 谢佳辰, Hong Kong. Experimental remake; demo stable; not affiliated with papertrade.xyz.
5. **Ask (10s):** Solana track — looking for judges to pull the program, not a slide deck.

---

## Demo video outline (≤3 min — NOT recorded)

Must show the settlement loop (FIDELITY A16):

1. Open desk; show network line (devnet once live, else clearly localnet).
2. Connect wallet (Phantom/Solflare or browser key).
3. Faucet + deposit dUSD (label demo stable).
4. Open long → close at a loss → toast **SCAR minted** + mint event.
5. Open → close a win the LP cannot fund → queue row with head/distance.
6. Arm session → trade as session → withdraw/claim rejected on chain.
7. Optional: agent `positions.open` / `positions.close` in the agent log.
8. End on explorer links **only if** Devnet deploy succeeded (fill from `deployment.devnet.json` + `public-proof.json`).

Shot list assets already on disk: `app/demo/browser/desktop-wallet.png`, `mobile-bob.png`, `mobile-alice-top.png`, `mobile-alice.png`.

---

## GTM / demand / distribution (experimental — portal expects a view)

**Positioning:** On-chain-verifiable synthetic perps desk for Solana-native traders and agent operators who want loss-funded LP + FIFO semantics without trusting a closed venue stack.

**First user (concrete):** A Solana power user or agent builder who already runs a bot against perps APIs, wants session keys that cannot withdraw, and needs explorer-checkable SCAR / queue state for a demo or research fork.

**Go-to-market (post-hackathon, provisional):**

1. Open-source the program + desk; ship Devnet faucet days.
2. Agent tool surface as the distribution wedge (same tools as the human ticket).
3. Keep collateral as demo stable until a separate, explicit mainnet-risk round.

**Demand validation:** Hackathon-era validation is the working local loop + browser proof, not volume. Do not claim users, TVL, or mainnet flow.

**Business model (provisional):** Protocol win haircut (200 bps on LP-funded PnL) accruing to SCAR stakers; later possible infra/API tier for agent desks. Fair-launch narrative for SCAR (mint only on qualified loss — no team pre-mint in the program). Mark **experimental**.

---

## Competitive landscape (honest)

Closest reference is papertrade.xyz / Circuit-shaped agent tools on another venue stack. Scardesk does **not** claim affiliation, official relayer access, or a pixel UI copy. Differentiation for this contest: Solana-native settlement, visible session separation, SCAR + FIFO enforced in a single program, red-black original skin. Not a Hyperliquid fork. Not an Alpaca-style paper-trading simulator.

---

## Problem / technical / audience / future (longer portal boxes)

**Problem statement**  
Venue-style synthetic perps with loss mining and FIFO payouts are hard for outsiders to audit when the relayer and settlement stack are closed. Builders who want that loop on Solana need a program where SCAR mint, queue writes, and session rejects are readable on chain — with a desk UX that mirrors the blotter flow, not a thin simulator shell.

**Technical approach**  
Custom Solana program + Node client. Opens/closes settle against LP cash and a FIFO queue PDA chain. Oracle mid from Pyth (sponsored account / Hermes when keyed) with a labeled fixture fallback. Desk serves the blotter; Phantom/Solflare/browser-key sign transactions; session account may trade only. Config-driven `localnet` / `devnet` / `mainnet-beta` (mainnet refused unless `SCARDESK_ALLOW_MAINNET=1`).

**Target audience**  
Solo: a Solana trader/agent-operator who wants to click or script isolated high-leverage SOL/USD tickets against a loss-funded LP and prove SCAR + queue on explorer before trusting any mainnet cash.

**Future vision**  
Devnet public deploy → public desk URL → Hermes-keyed live mid → optional multi-market later. Mainnet USDC is **out of scope** for this submission. Continue as an open experimental desk if the Solana track feedback is strong.

---

## Tags (if the portal offers them)

Prefer: `trading`, `defi`, `ai` (agent tool surface). Max whatever the form allows.

---

## Disclosure

- Independent remake / experiment inspired by publicly described papertrade-style mechanics. **Not affiliated** with papertrade.xyz.
- Pre-existing work: research and PRD in this tree during the contest window; disclose any earlier sketches if the form asks.
- Third-party: Solana runtime, Pyth price accounts, wallet extensions. No Hyperliquid / HyperEVM code.
- Lane Paychannel is a **separate backup** project and must **not** be the submitted product.

---

## Status line for humans

Drafted 2026-10-12 HKT. **Ready to paste after:** Devnet deploy + explorer sigs, public GitHub `scardesk`, desk URL, two videos, logo. See `SUBMIT-CHECKLIST.md`. **Do not Submit until Caesar nods.**
