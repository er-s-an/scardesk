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

### B. Public Devnet program (LIVE as of 2026-10-12 ~15:30 HKT)

- [x] Admin funded ≥ **~3.2 SOL** on the Devnet RPC used for deploy (live read ~3.37 SOL on `FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U`)
- [x] Public proof landed (`app/demo/public-proof.json` → `"ok": true`)
- [x] `app/config/deployment.devnet.json` exists with program id + mints + desk accounts
- [x] Program id + SCAR mint + queue write have public explorer links (see `public-proof.json` / `PITCH.md`)
- [x] Desk starts with `SCARDESK_NETWORK=devnet` / `npm run desk:devnet` (footer Devnet · OnFinality)
- [x] `SCARDESK_ACTIVATE` left unset; default `deployment.json` stays localnet
- [x] `SCARDESK_ALLOW_MAINNET` unset; no mainnet USDC claims
- [x] Pages trade desk: https://er-s-an.github.io/scardesk/trade.html (IX 17 permissionless `demo_faucet`)

**Residual (not a deploy blocker):** OnFinality public RPC can 429 on send/confirm; toast asks retry. Hermes still 401 without `PYTH_API_KEY` (sponsored Pyth account labeled). Hard-refresh retest of Pages signing loop still waiting on Caesar before Submit.

**Local media (2026-10-12 ~19:11 HKT, not Submit-green until reviewed + uploaded):** pitch `videos/scardesk-agent-market-huashu.mp4` (~2:40); demo `videos/scardesk-demo.mp4` (~2:48); logo `docs/scardesk-logo.png`. See `videos/DELIVERY.md`.

### C. Desk URL & wallet flow

- [x] Public or judge-reachable desk URL: https://er-s-an.github.io/scardesk/trade.html (plus explorer settle proofs). Local desk still at `127.0.0.1:8787`
- [ ] Wallet path: connect → faucet/deposit demo stable → open → close
- [ ] Loss path shows **SCAR minted**
- [ ] Win-with-empty-LP path shows **FIFO queue** write
- [ ] Session key: can open/close; withdraw/stake/claim rejected on chain
- [ ] Agent tools used in demo are only the allowed list (no balance-edit tools)
- [ ] Phantom and/or Solflare tested if claiming extension support (browser key alone is ok if labeled)

### D. GitHub & artifacts

- [x] Public repo **`https://github.com/er-s-an/scardesk`** (Pages published from it)
- [ ] README matches honest status (local vs Devnet; provisional B1–B10)
- [ ] No secrets / private keys committed
- [ ] Logo or product graphic attached (local draft: `docs/scardesk-logo.png` — not uploaded)
- [ ] Pitch video **2–3 min** uploaded / linked (local draft: `videos/scardesk-agent-market-huashu.mp4` ~2:40 — not uploaded)
- [ ] Demo video **≤3 min** uploaded / linked (local draft: `videos/scardesk-demo.mp4` ~2:48 — not uploaded)
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
| Public proof file | `app/demo/public-proof.json` → `ok: true` (Devnet) |

---

## Submit day procedure (human)

1. Re-read `STATUS.md` and confirm Devnet green.
2. Fill portal from `SUBMISSION.md` with **live** links/sigs.
3. Attach videos + logo + GitHub.
4. Double-check product is Scardesk, not Lane.
5. Caesar nods → click Submit once.
6. After Submit, keep iterating in-portal if the platform allows edits until the hard deadline.

**This checklist file does not grant Submit permission.**
