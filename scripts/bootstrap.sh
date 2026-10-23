#!/usr/bin/env bash
set -euo pipefail

WORDRUNNER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORDRUNNER_ROOT"
WORDRUNNER_NODE_VERSION="$(cat .node-version)"
WORDRUNNER_PNPM_VERSION=11.9.0
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) WORDRUNNER_PLATFORM=darwin-arm64 ;;
  Darwin-x86_64) WORDRUNNER_PLATFORM=darwin-x64 ;;
  Linux-aarch64) WORDRUNNER_PLATFORM=linux-arm64 ;;
  Linux-x86_64) WORDRUNNER_PLATFORM=linux-x64 ;;
  *) echo 'Unsupported platform.' >&2; exit 1 ;;
esac
WORDRUNNER_ARCHIVE="node-v$WORDRUNNER_NODE_VERSION-$WORDRUNNER_PLATFORM.tar.gz"
WORDRUNNER_NODE_DIR="$WORDRUNNER_ROOT/.tools/node-v$WORDRUNNER_NODE_VERSION-$WORDRUNNER_PLATFORM"
mkdir -p .tools .cache/downloads .tools/package-manager
if [[ ! -x "$WORDRUNNER_NODE_DIR/bin/node" ]]; then
  curl --fail --location --retry 3 --connect-timeout 20 --max-time 600 \
    "https://nodejs.org/dist/v$WORDRUNNER_NODE_VERSION/$WORDRUNNER_ARCHIVE" \
    -o ".cache/downloads/$WORDRUNNER_ARCHIVE.part"
  mv ".cache/downloads/$WORDRUNNER_ARCHIVE.part" ".cache/downloads/$WORDRUNNER_ARCHIVE"
  curl --fail --location --retry 3 --connect-timeout 20 --max-time 120 \
    "https://nodejs.org/dist/v$WORDRUNNER_NODE_VERSION/SHASUMS256.txt" \
    -o ".cache/downloads/node-v$WORDRUNNER_NODE_VERSION-SHASUMS256.txt"
  (
    cd .cache/downloads
    awk -v archive="$WORDRUNNER_ARCHIVE" '$2 == archive {print; found=1} END {if (!found) exit 1}' \
      "node-v$WORDRUNNER_NODE_VERSION-SHASUMS256.txt" | shasum -a 256 -c -
  )
  tar -xzf ".cache/downloads/$WORDRUNNER_ARCHIVE" -C .tools
fi
export PATH="$WORDRUNNER_NODE_DIR/bin:$WORDRUNNER_ROOT/.tools/package-manager/node_modules/.bin:$PATH"
if [[ ! -x .tools/package-manager/node_modules/.bin/pnpm ]] || [[ "$(.tools/package-manager/node_modules/.bin/pnpm --version)" != "$WORDRUNNER_PNPM_VERSION" ]]; then
  npm install --prefix .tools/package-manager --save-exact --ignore-scripts "pnpm@$WORDRUNNER_PNPM_VERSION"
fi
node --version
pnpm --version
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile --store-dir .pnpm-store
else
  pnpm install --store-dir .pnpm-store
fi
export PLAYWRIGHT_BROWSERS_PATH="$WORDRUNNER_ROOT/.cache/ms-playwright"
pnpm exec playwright install --no-shell chromium webkit
echo 'Local runtime and browser test tools are ready. Run ./scripts/wr doctor.'
