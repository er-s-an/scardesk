# trade.html fail — root cause + fix

**When:** 2026-10-12 ~14:01 HKT  
**Live:** https://er-s-an.github.io/scardesk/trade.html  
**Pages commit:** `3595290` on `er-s-an/scardesk` (`fix: browser __dirname crash + mobile wallet deep links`)  
**No Submit.**

## Symptom

Browser showed only: `Client bundle failed to load. Reload.`  
Screenshot: `app/demo/browser/trade-fail-loaded.png`.

`trade-app.js` checks `window.Scardesk` after loading `scardesk-client.js`. If missing, it replaces the body with that message.

## Root cause

`app/client/src/chain.js` evaluated at bundle load:

```js
path.resolve(__dirname, "../..")
```

esbuild IIFE (`platform=browser`) does not define `__dirname`.  
→ `ReferenceError: __dirname is not defined` ~line 23091 of `scardesk-client.js`  
→ `root.Scardesk = {…}` never ran  
→ trade UI wiped.

Same class of hazard in `price.js` / `markets-runtime.js` (guarded in the same pass).

**Not** the primary cause (though still hardened): Devnet SOL < ~0.02, Phantom on mainnet, OnFinality 429. Local chain path with funded key already proved initUser→initWallet→demoFaucet (see `app/demo/faucet-proof.json` and later local faucet sig `3f21WFtM…`).

## Fix (parent + executor)

1. Guard `__dirname` in Node sources (`typeof __dirname !== "undefined" ? … : "."`).
2. `npm run pages:bundle` with `--define:__dirname="/"`.
3. Rebuilt `docs/scardesk-client.js`; smoke load assigns `window.Scardesk` + `IX.demoFaucet === 17`.
4. Force-push Pages repo `er-s-an/scardesk` @ `3595290`.
5. UX also shipped on Pages `trade-app.js`:
   - Before init-user: if lamports &lt; 0.02 SOL → clear ZH/EN toast + open faucet.solana.com
   - 429 → “RPC 忙 / RPC busy” copy
   - Mobile Phantom/Solflare browse deep links + hint; CSS safe-area/touch
6. Confirm path prefers HTTP `getSignatureStatuses` where present (cuts websocket 429).

## Verify

- GitHub raw (immediate): `scardesk-client.js` has `var __d = true ? "/" : "."` (no bare `__dirname`).
- Pages CDN may lag up to ~10 min (`Cache-Control: max-age=600`). Hard-reload or wait.
- Expected UI: full masthead, markets, connect buttons, desk meta — not the monospace fail line.
- Explorer proof of faucet path (earlier): https://explorer.solana.com/tx/4Yti6HKc6D6erGDeTUJgdj9MXWq9LWD81qFeNMiDJUUHFYXRVrHmqa28NcLFUrptQxB5GLo8Wek1RnzNGcJCWhL6?cluster=devnet

## Program

Devnet `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b` · IX 17 `demo_faucet` unchanged.
