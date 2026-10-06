#!/bin/bash
# One-line local server for the viewer. Static files only, no build.
# Usage: bin/serve.sh [port]   (default 8390)   then open the printed URL.
cd "$(dirname "$0")/.." || exit 1
PORT="${1:-8390}"
echo "swarmview: http://localhost:$PORT/viewer/"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
