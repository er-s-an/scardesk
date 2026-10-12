#!/bin/sh
# Push full program+client to er-s-an/scardesk with Pages from /docs. No Submit.
# Run ONLY after user nod. Scrubs keys; never force-add gitignored secrets.
set -e
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
# rebuild pages bundle into docs/
(cd app && npm run pages:bundle)
# refuse if keys would be staged
if git status --porcelain -u | grep -E 'keys/|keypair\.json|\.env$' ; then
  echo "REFUSING: secrets would be included" >&2
  exit 1
fi
# ensure Pages source path note
if ! grep -q 'github.io/scardesk' README.md 2>/dev/null; then
  true
fi
echo "Ready to push from $root"
echo "Next (manual after nod): git remote add/set origin + push main"
echo "Then: gh api -X PUT repos/er-s-an/scardesk/pages -f build_type=legacy -f source[branch]=main -f source[path]=/docs"
