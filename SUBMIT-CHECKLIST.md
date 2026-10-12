# Submit checklist — Scardesk (user nod required)

**Rule:** Do not click Colosseum Submit and do not call any submit API until every **Must be green** item is checked and Caesar / 谢佳辰 explicitly nods.
Lane / Paychannel is backup — **never** submit Lane for this slot.

Deadline target: **2026-10-13 ~14:59 HKT** (prefer a revisable upload earlier).

---

## Must be green before Submit

### A. Identity & lane

- [ ] Submitting **Scardesk** (not Lane, not Paychannel, not makebook)
- [ ] Product name **Scardesk**, loss token **SCAR**, brand Scardesk/SCAR
- [ ] Copy has **no** “paper trading simulator” / Alpaca narrative; no claim of affiliation with papertrade.xyz
- [ ] Team on form: **Caesar / 谢佳辰**; location Hong Kong; GitHub user `er-s-an`
- [ ] Track: **Solana Ecosystem**
- [ ] Explicit user nod to Submit (this checklist alone is not permission)

### B. Public Devnet program (currently BLOCKED)

- [ ] Admin funded ≥ **~3.2 SOL** on the Devnet RPC used for deploy (rent floor for upgradeable program + buffer)
- [ ] `npm run proof` (or equivalent) succeeds
- [ ] `app/demo/public-proof.json` has `"ok": true`
- [ ] `app/config/deployment.devnet.json` exists with program id + mints + desk accounts
- [ ] Program id and **at least one SCAR mint tx** + **at least one queue write tx** have **public explorer** links (paste real sigs only — do not invent)
- [ ] Desk can start with `SCARDESK_NETWORK=devnet` and footer shows Devnet / OnFinality (or chosen RPC)
- [ ] `SCARDESK_ACTIVATE` left unset unless intentionally pointing default `deployment.json` at public (document the choice)
- [ ] `SCARDESK_ALLOW_MAINNET` unset; no mainnet USDC claims

**Current blocker (2026-10-12):** Admin `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U` = **0 lamports** on reachable Devnet. Airdrop paths failed (OnFinality disabled, faucet Turnstile, testnet 429, etc.). See `STATUS.md` / `HOW-TO-RUN.md`.

### C. Desk URL & wallet flow

- [ ] Public or judge-reachable desk URL (not only `127.0.0.1:8787`), **or** a recorded demo that clearly shows Devnet explorer settles
- [ ] Wallet path: connect → faucet/deposit demo stable → open → close
- [ ] Loss path shows **SCAR minted**
- [ ] Win-with-empty-LP path shows **FIFO queue** write
- [ ] Session key: can open/close; withdraw/stake/claim rejected on chain
- [ ] Agent tools used in demo are only the allowed list (no balance-edit tools)
- [ ] Phantom and/or Solflare tested if claiming extension support (browser key alone is ok if labeled)

### D. GitHub & artifacts

- [ ] Public repo **`https://github.com/er-s-an/scardesk`** (or private + access for `hackathon@colosseum.com`)
- [ ] README matches honest status (local vs Devnet; provisional B1–B10)
- [ ] No secrets / private keys committed
- [ ] Logo or product graphic attached
- [ ] Pitch video **2–3 min** uploaded / linked
- [ ] Demo video **≤3 min** uploaded / linked (on-chain settle visible)
- [ ] `SUBMISSION.md` fields pasted into portal (edit Devnet/explorer placeholders to real values only)

### E. Honesty gates (fail = do not Submit)

- [ ] No fake explorer URLs or fake Devnet program ids
- [ ] No Surfnet claim unless Surfnet CLI proof exists
- [ ] No mainnet funds / mainnet USDC narrative
- [ ] Hermes/Pyth gaps disclosed if still 401 / fixture fallback
- [ ] Lane materials not mixed into this submission
- [ ] Pre-existing / third-party disclosure filled if the form asks

---

## Nice to have (not Submit blockers if A–E pass)

- [ ] Hermes live with `PYTH_API_KEY` (else sponsored account + provisional fixture stays labeled)
- [ ] Pages/docs site mirroring Lane’s public page pattern
- [ ] Weekly update video if still inside contest norms
- [ ] Second device / clean Phantom runthrough recording

---

## Local-only evidence (already done — not a substitute for B)

These support the draft but **do not** clear public Submit:

| Item | Where |
| --- | --- |
| Local desk + wallet loop | `BROWSER-PROOF.md`, `http://127.0.0.1:8787` |
| Verify settlement script | `README.md` worked example; `app/demo/last-run.json` |
| Screenshots | `app/demo/browser/` |
| Gap matrix | `GAP-CHECKLIST.md` (A11/A17/F3 still Gap until Devnet) |
| Public proof file | `app/demo/public-proof.json` → `ok: false` |

---

## Submit day procedure (human)

1. Re-read `STATUS.md` and confirm Devnet green.
2. Fill portal from `SUBMISSION.md` with **live** links/sigs.
3. Attach videos + logo + GitHub.
4. Double-check product is Scardesk, not Lane.
5. Caesar nods → click Submit once.
6. After Submit, keep iterating in-portal if the platform allows edits until the hard deadline.

**This checklist file does not grant Submit permission.**
