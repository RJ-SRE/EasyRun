#!/usr/bin/env bash
set -euo pipefail
WORDRUNNER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORDRUNNER_ROOT"
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  if [[ "$(uname -s)" == Darwin ]] && command -v brew >/dev/null; then
    HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 brew install ffmpeg
  else
    echo 'Install ffmpeg and ffprobe using the system package manager, then rerun.' >&2
    exit 1
  fi
fi
./scripts/bootstrap.sh
./scripts/setup-xbuilder-reference.sh
./scripts/wr doctor
echo 'Setup complete. Start: ./scripts/wr dev | Verify: ./scripts/wr check'
