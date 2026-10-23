#!/usr/bin/env bash
set -euo pipefail

WORDRUNNER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORDRUNNER_NODE_VERSION="$(cat "$WORDRUNNER_ROOT/.node-version")"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) WORDRUNNER_PLATFORM=darwin-arm64 ;;
  Darwin-x86_64) WORDRUNNER_PLATFORM=darwin-x64 ;;
  Linux-aarch64) WORDRUNNER_PLATFORM=linux-arm64 ;;
  Linux-x86_64) WORDRUNNER_PLATFORM=linux-x64 ;;
  *) echo 'Unsupported platform; this setup is verified on macOS arm64.' >&2; exit 1 ;;
esac

WORDRUNNER_NODE_BIN="$WORDRUNNER_ROOT/.tools/node-v$WORDRUNNER_NODE_VERSION-$WORDRUNNER_PLATFORM/bin"
if [[ ! -x "$WORDRUNNER_NODE_BIN/node" ]]; then
  echo 'Project Node is missing. Run ./scripts/bootstrap.sh first.' >&2
  exit 1
fi
export PATH="$WORDRUNNER_NODE_BIN:$WORDRUNNER_ROOT/.tools/package-manager/node_modules/.bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$WORDRUNNER_ROOT/.cache/ms-playwright"
if [[ "$(node --version 2>/dev/null || true)" != "v$WORDRUNNER_NODE_VERSION" ]]; then
  echo 'Project Node is missing. Run ./scripts/bootstrap.sh first.' >&2
  exit 1
fi
cd "$WORDRUNNER_ROOT"
exec "$@"
