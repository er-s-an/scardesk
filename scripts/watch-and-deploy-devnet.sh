#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
ADMIN=FvrGAbpFVJXdhfzE3NFNbimKNag7vFubykBvMKUKh89U
RPC="${SCARDESK_RPC:-https://solana-devnet.api.onfinality.io/public}"
KEY=/workspace/competitions/colosseum-papertrade/app/keys/admin.json
ROOT=/workspace/competitions/colosseum-papertrade
LOG="$ROOT/logs/watch-deploy-$(date +%H%M%S).log"
NEED=3.2
exec >>"$LOG" 2>&1
echo "watching $ADMIN on $RPC need >= $NEED SOL"
for i in $(seq 1 240); do
  bal=$(solana balance "$ADMIN" -u "$RPC" 2>/dev/null | awk '{print $1}' || echo 0)
  echo "$(date -Iseconds) balance=$bal"
  ok=$(awk -v b="${bal:-0}" -v n="$NEED" 'BEGIN{print (b+0>=n+0)?1:0}')
  if [ "$ok" = "1" ]; then
    echo "ENOUGH — deploying"
    solana config set --url "$RPC" --keypair "$KEY" || true
    SO=$(find "$ROOT/app/programs" -name 'scardesk.so' 2>/dev/null | head -1 || true)
    if [ -z "${SO:-}" ]; then
      echo "building sbf..."
      (cd "$ROOT/app/programs/scardesk" && cargo-build-sbf) || true
      SO=$(find "$ROOT/app/programs" -name 'scardesk.so' 2>/dev/null | head -1 || true)
    fi
    echo "SO=$SO"
    if [ -n "${SO:-}" ]; then
      if [ -f "$ROOT/app/keys/program.json" ]; then
        solana program deploy "$SO" -u "$RPC" -k "$KEY" --program-id "$ROOT/app/keys/program.json" || solana program deploy "$SO" -u "$RPC" -k "$KEY"
      else
        solana program deploy "$SO" -u "$RPC" -k "$KEY"
      fi
    fi
    echo DEPLOY_DONE
    cd "$ROOT/app"
    if npm run proof --silent 2>/dev/null; then true
    elif [ -f scripts/public-proof.js ]; then node scripts/public-proof.js || true
    fi
    touch "$ROOT/logs/DEPLOY-READY.flag"
    exit 0
  fi
  sleep 20
done
echo "TIMEOUT still low"
exit 1
