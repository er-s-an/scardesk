#!/bin/sh
# Publish docs static site to er-s-an/scardesk (Pages root). Does not Submit.
set -e
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root/app"
npm run pages:bundle
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp "$root/docs/index.html" "$root/docs/trade.html" "$root/docs/trade-app.js" \
  "$root/docs/scardesk-client.js" "$root/docs/styles.css" "$tmp/"
cp "$root/PUBLIC-UI.md" "$tmp/README.md"
# Keep a short README for the Pages repo
cat > "$tmp/README.md" << 'MD'
# Scardesk (GitHub Pages)

- Preview: https://er-s-an.github.io/scardesk/
- **Trade (Devnet signatures):** https://er-s-an.github.io/scardesk/trade.html

Browser prepare+send against Devnet. In-page permissionless demo faucet (IX 17).
No admin/upgrade keys in this repo. Fee SOL: faucet.solana.com. Not mainnet. Do not Submit.
MD
cd "$tmp"
git init -b main
git add .
git -c user.email="92594860+er-s-an@users.noreply.github.com" -c user.name="er-s-an" commit -m "Pages: in-page permissionless dUSD faucet (IX 17)

Architecture A: trade.html prepare+send + demo_faucet (wallet signs, 1000 dUSD,
60s cooldown). No admin keys. Fee SOL via faucet.solana.com. No Submit."
git remote add origin "https://github.com/er-s-an/scardesk.git"
git push -u origin main --force
echo "Pushed. Check https://er-s-an.github.io/scardesk/trade.html"
