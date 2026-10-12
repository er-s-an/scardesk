# Public UI

**Pages URL:** https://er-s-an.github.io/scardesk/

**Trade (signable):** https://er-s-an.github.io/scardesk/trade.html

**Repo:** https://github.com/er-s-an/scardesk

## Modes

| Page | Role |
| --- | --- |
| `index.html` | Read-only red-black preview + ZH/EN. Points at Devnet program. |
| `trade.html` | **Architecture A** — browser prepare+send against OnFinality Devnet RPC. Phantom / Solflare / Browser key. No Node `/api/prepare`. No tunnel. |

Devnet program `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b`. maxLeverage **1001**. Banner: **Devnet · real signatures · not mainnet**. No private keys in the public repo. Local desk at `http://127.0.0.1:8787` unchanged (`npm run desk:devnet`).

## In-page Faucet (permissionless)

Program IX **17** `demo_faucet`: the connected wallet signs; desk PDA mints a fixed **1000 dUSD** into the caller's wallet PDA; **60s cooldown** per user (`last_faucet_ts`). Admin IX 3 faucet remains for operator scripts. **No admin / upgrade-authority key in Pages JS.**

Judge path on `trade.html`: connect → **Faucet 1000 dUSD** → Deposit → Open → Close (SOL/USD on-chain). Fee SOL: https://faucet.solana.com (OnFinality refuses `requestAirdrop`).

Proof (fresh wallet): `app/demo/faucet-proof.json` — explorer sig in that file.

## Bundle

```bash
cd app && npm run pages:bundle   # → docs/scardesk-client.js
```

Deploy: `scripts/publish-pages.sh` (copies `docs/{index,trade,trade-app,scardesk-client,styles}*` to `er-s-an/scardesk`).

Not submitted to Colosseum.
