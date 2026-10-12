#!/bin/sh
# Check the static preview that GitHub Pages can serve from /docs.
# This script does not push, does not enable Pages, and does not Submit.
set -e
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
page="$root/docs/index.html"
css="$root/docs/styles.css"
test -f "$page"
test -f "$css"
grep -q "E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b" "$page"
grep -q "npm run desk:devnet" "$page"
echo "Static preview is ready: docs/index.html + docs/styles.css"
echo "It does not trade. It points at the Devnet program and tells a visitor how to start the desk."
echo
echo "Public open, three steps:"
echo "  1. Clone this repo, then: cd app && npm install"
echo "  2. npm run desk:devnet"
echo "  3. Open http://127.0.0.1:8787 and connect Phantom, Solflare, or Browser key"
echo
echo "To publish the picture later, in the GitHub repo settings choose Pages,"
echo "deploy from the branch that contains this tree, folder /docs."
echo "This script does not do that, and it does not Submit to Colosseum."
