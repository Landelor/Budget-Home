#!/bin/sh
set -a
. "$(dirname "$0")/../.env"
set +a
pkill -f 'node.*tsx.*watch.*src/index' 2>/dev/null
sleep 0.3
exec tsx watch src/index.ts
