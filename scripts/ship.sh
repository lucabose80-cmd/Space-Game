#!/usr/bin/env bash
# Sicher nach `main` pushen (mehrere Chats/Agenten arbeiten parallel):
#   npm run ship            # Arbeitsbaum muss committet sein
# Ablauf: fetch → origin/main einmergen (Abbruch bei Konflikt, nichts wird gepusht) → verify (nur wenn Code/Tests/Rigs betroffen) → push main (+ aktueller Branch).
# Schlägt ein Schritt fehl, wird NICHT gepusht. Rejected Push (jemand war schneller) → bis zu 3× erneut mergen.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "✗ Es gibt uncommittete Änderungen — erst committen." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
needs_verify() { git diff --name-only "$1" HEAD | grep -qE '^(src/|scripts/|tests/|public/art/(rigs|sprites)/|package(-lock)?\.json|vite)' ; }

for attempt in 1 2 3; do
  git fetch -q origin
  before="$(git rev-parse HEAD)"
  if ! git merge --no-edit origin/main; then
    echo "✗ Merge-Konflikt mit origin/main — bitte lösen (git status), committen, dann erneut: npm run ship" >&2
    exit 2
  fi
  # verify, wenn der Merge/Stand Code berührt: gegen den letzten bekannten main vergleichen
  if needs_verify origin/main || [ "$(git rev-parse HEAD)" != "$before" ]; then
    echo "▶ npm run verify"
    npm run verify
  else
    echo "▶ Nur Doku/Roh-Assets: check:invariants + check:sprites"
    npm run check:invariants && npm run check:sprites
  fi
  if git push origin HEAD:main; then
    [ "$branch" != "main" ] && git push origin "HEAD:$branch" || true
    echo "✔ Auf main gepusht ($(git rev-parse --short HEAD))."
    exit 0
  fi
  echo "… Push abgelehnt (origin/main hat sich bewegt) — Versuch $attempt/3, merge erneut." >&2
done
echo "✗ Push nach 3 Versuchen nicht möglich." >&2
exit 3
