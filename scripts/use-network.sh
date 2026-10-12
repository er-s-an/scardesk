#!/bin/sh
# Start the desk on localnet or devnet. Does not Submit.
set -e
network="${1:-}"
if [ "$network" != "localnet" ] && [ "$network" != "devnet" ]; then
  echo "usage: scripts/use-network.sh localnet|devnet" >&2
  exit 1
fi
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root/app"
if [ ! -d node_modules ]; then
  npm install
fi
if [ "$network" = "devnet" ] && [ ! -f config/deployment.devnet.json ]; then
  echo "config/deployment.devnet.json is missing. The desk would keep local addresses. Stop." >&2
  exit 1
fi
echo "Starting Scardesk on $network. Open http://127.0.0.1:${PORT:-8787}"
echo "Stop with Ctrl-C. Do not Submit."
exec env SCARDESK_NETWORK="$network" node desk/server.js
