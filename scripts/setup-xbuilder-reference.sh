#!/usr/bin/env bash
set -euo pipefail
WORDRUNNER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORDRUNNER_BUILDER_REF=e2a4c45dfa0574ac7700fad94d2d4a6da7da8083
WORDRUNNER_BUILDER_DIR="$WORDRUNNER_ROOT/.tools/xbuilder"
mkdir -p "$WORDRUNNER_ROOT/.tools"
if [[ ! -e "$WORDRUNNER_BUILDER_DIR" ]]; then
  git init -q "$WORDRUNNER_BUILDER_DIR"
  git -C "$WORDRUNNER_BUILDER_DIR" remote add origin https://github.com/goplus/builder.git
fi
if ! git -C "$WORDRUNNER_BUILDER_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  if [[ "$(git -C "$WORDRUNNER_BUILDER_DIR" remote get-url origin)" != 'https://github.com/goplus/builder.git' ]]; then
    echo 'Unexpected reference repository; it has been left unchanged.' >&2
    exit 1
  fi
  git -C "$WORDRUNNER_BUILDER_DIR" fetch --depth 1 origin "$WORDRUNNER_BUILDER_REF"
  git -C "$WORDRUNNER_BUILDER_DIR" checkout --detach "$WORDRUNNER_BUILDER_REF"
elif [[ "$(git -C "$WORDRUNNER_BUILDER_DIR" rev-parse HEAD)" != "$WORDRUNNER_BUILDER_REF" ]]; then
  echo 'Existing XBuilder checkout differs; it has been left unchanged.' >&2
  exit 1
fi
git -C "$WORDRUNNER_BUILDER_DIR" log -1 --format='%h %s'
echo 'Reference source is ready. This does not install or start the XBuilder platform.'
