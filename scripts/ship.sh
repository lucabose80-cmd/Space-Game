#!/usr/bin/env bash
# Sicher nach `main` pushen (mehrere Chats/Agenten arbeiten parallel):
#   npm run ship            # Arbeitsbaum muss committet sein
# Ablauf: fetch → origin/main einmergen (Abbruch bei Konflikt, nichts wird gepusht) → verify (nur wenn Code/Tests/Rigs betroffen) → push main (+ aktueller Branch).
# Schlägt ein Schritt fehl, wird NICHT gepusht.
#
# Wettlauf mit anderen Chats: Ein voller `verify` dauert > 10 min, in der Zeit landen oft neue Commits auf main → Push abgelehnt.
# Deshalb gilt ab dem 2. Versuch: Der eigene Stand ist schon einmal voll grün geprüft. Bringt der neue Merge nur Doku/Roh-Assets,
# wird nur `check:invariants` + `check:sprites` geprüft; bringt er Code, läuft eine Schnellprüfung (Build + Invarianten +
# Sprite-Check + die vom Merge geänderten/neuen Tests + Regressionstest t5, ≈ 1–2 min) und dann sofort der Push.
# Die Commits der anderen Seite haben ihren vollen `verify` vor ihrem eigenen Push bereits bestanden.
# Erzwingen eines vollen Laufs bei jedem Versuch: SHIP_FULL_VERIFY=1 npm run ship
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "✗ Es gibt uncommittete Änderungen — erst committen." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
CODE_RE='^(src/|scripts/|tests/|public/art/(rigs|sprites)/|package(-lock)?\.json|vite)'
needs_verify() { git diff --name-only "$1" HEAD | grep -qE "$CODE_RE" ; }
verified=""   # zuletzt voll (oder schnell nach vollem) geprüfter Stand

quick_verify() {
  local since="$1"
  local tests
  tests="$(git diff --name-only --diff-filter=AM "$since" HEAD -- 'tests/*.cjs' \
    | sed -nE 's#^tests/((t[0-9]|m[0-9]+[a-z]?p)[^/]*)\.cjs$#\1#p' | tr '\n' ' ')"
  echo "▶ Schnellprüfung (eigener Stand war voll grün): build + Invarianten + Sprite-Check + Tests: ${tests}t5"
  npm run build && npm run check:invariants && npm run check:sprites && npm test -- $tests t5
}

for attempt in 1 2 3 4 5; do
  git fetch -q origin
  before="$(git rev-parse HEAD)"
  if ! git merge --no-edit origin/main; then
    echo "✗ Merge-Konflikt mit origin/main — bitte lösen (git status), committen, dann erneut: npm run ship" >&2
    exit 2
  fi
  if [ -z "$verified" ] || [ "${SHIP_FULL_VERIFY:-0}" = "1" ]; then
    # verify, wenn der Merge/Stand Code berührt: gegen den letzten bekannten main vergleichen
    if needs_verify origin/main || [ "$(git rev-parse HEAD)" != "$before" ]; then
      echo "▶ npm run verify"
      npm run verify
    else
      echo "▶ Nur Doku/Roh-Assets: check:invariants + check:sprites"
      npm run check:invariants && npm run check:sprites
    fi
  elif git diff --name-only "$verified" HEAD | grep -qE "$CODE_RE"; then
    quick_verify "$verified"
  else
    echo "▶ Neuer Merge bringt nur Doku/Roh-Assets: check:invariants + check:sprites"
    npm run check:invariants && npm run check:sprites
  fi
  verified="$(git rev-parse HEAD)"
  if git push origin HEAD:main; then
    [ "$branch" != "main" ] && git push origin "HEAD:$branch" || true
    echo "✔ Auf main gepusht ($(git rev-parse --short HEAD))."
    exit 0
  fi
  echo "… Push abgelehnt (origin/main hat sich bewegt) — Versuch $attempt/5, merge erneut." >&2
done
echo "✗ Push nach 5 Versuchen nicht möglich." >&2
exit 3
