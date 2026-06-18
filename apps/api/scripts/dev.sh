#!/bin/sh
set -a
. "$(dirname "$0")/../.env"
set +a
# Kill the tsx watch supervisor
pkill -f 'node.*tsx.*watch.*src/index' 2>/dev/null
# Also kill the worker node process spawned by tsx watch: it holds port 3000
# and becomes an orphan if the supervisor is killed without it.
# Pattern matches the preflight loader path Budget-Home uses, not paperclip's.
pkill -f 'tsx/dist/preflight.*src/index\.ts$' 2>/dev/null
sleep 0.5
exec tsx watch src/index.ts
