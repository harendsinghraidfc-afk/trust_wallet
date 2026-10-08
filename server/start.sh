#!/bin/sh
set -eu
mkdir -p /app/data /data
chown node:node /app/data /data
exec su-exec node "$@"

