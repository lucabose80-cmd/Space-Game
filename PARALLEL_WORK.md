# PARALLEL_WORK.md — Mehrere Chats/Agenten gleichzeitig (ohne Merge-Chaos)

> Beispiel: Chat A riggt Krall, Chat B bindet die Drohne ein, Chat C arbeitet am Geschütz, Antigravity liefert Sprites. Mit den Regeln unten kollidieren sie praktisch nicht.

## 1. Eigentum je Bereich (jeder Chat nur in seinem Bereich ändern)
| Bereich | Status-Blatt | Animation | Rig-Daten | Test |
| :--- | :--- | :--- | :--- | :--- |
| Krall | `handoff/krall.md` | `src/dungeon/anim/rigs/krall.ts` (+ Angriffs-Zonen `bosses/defs.ts` Krall-Block, `bosses/bossFx.ts` `fx`) | `src/data/rigs/krall.json` | `tests/m11p5_krall.cjs` |
| Kern-Wächter | `handoff/core_warden.md` | `src/dungeon/anim/rigs/core_warden.ts` | `src/data/rigs/core_warden.json` | `tests/m11p2.cjs` |
| Geschütz | `handoff/enemy_turret.md` | `src/dungeon/anim/rigs/turret.ts` | `src/data/rigs/turret.json` | `tests/m11p7_turret.cjs` |
| Drohne / Phasen-Jäger / … | `handoff/enemy_<kind>.md` | `src/dungeon/anim/rigs/<rig-id>.ts` | `src/data/rigs/<rig-id>.json` | `tests/m11p…_<rig>.cjs` |

Rig-Animationen und Rig-Daten werden **automatisch gefunden** (`import.meta.glob`): ein neues Rig = neue Dateien, **keine** Änderung an gemeinsamen Dateien. Vorlage: `anim/rigs/turret.ts` (`export const anim: RigAnim`, Schnittstelle `anim/rigAnim.ts`).

## 2. Gemeinsame Dateien (heikel — kleine, gezielte Änderungen, vorher `git fetch`)
`anim/bossAnims.ts` (Engine) · `anim/animCommon.ts` · `anim/rigAnim.ts` · `engine/rig.ts` · `dungeonRenderer.ts` (Renderer-Zweig je Gegner) · `scripts/art-import.py` · `SPRITE_QUEUE.md` (**nur Zeilen der eigenen IDs ändern**, nichts umsortieren) · `HANDOFF.md` (nur bereichsübergreifend; Bereichs-Status gehört in `handoff/`).

## 3. Ablauf pro Sitzung
1. `git fetch origin && git merge origin/main` (oder `git pull --ff-only`), dann `handoff/<bereich>.md` und ggf. `SPRITE_QUEUE.md` lesen.
2. Arbeiten, **kleine Commits**.
3. Status in `handoff/<bereich>.md` aktualisieren (nicht in `HANDOFF.md`).
4. **`npm run ship`** statt manuellem Push: holt `origin/main`, merged (Abbruch bei Konflikt), führt `verify` aus (bei Doku-/Asset-only: Invarianten + Sprite-Check), pusht **nur bei Erfolg** nach `main` und auf den Arbeits-Branch, wiederholt bis zu 5×, falls jemand schneller war. Ab dem 2. Versuch läuft statt des vollen `verify` (> 10 min) nur eine **Schnellprüfung** (Build + Invarianten + Sprite-Check + die vom neuen Merge geänderten Tests + `t5`), denn der eigene Stand war schon voll grün und die fremden Commits haben ihren `verify` vor ihrem Push bestanden — sonst gewinnt bei vielen parallelen Chats nie jemand das Rennen. Voller Lauf bei jedem Versuch: `SHIP_FULL_VERIFY=1 npm run ship`.
5. Bei Merge-Konflikt: `git status`, Konflikt lösen (beide Seiten behalten — meist Status-Zeilen), `git add`, `git commit`, erneut `npm run ship`.

## 4. Regeln, die Konflikte vermeiden
- **Nie** direkt `git push` ohne vorheriges Merge + Tests; **nie** `verify || git push` oder `;`-Ketten (ein roter Test darf nicht pushen) — dafür gibt es `npm run ship`.
- Eigene Tests je Rig anlegen (`m11p…_<rig>.cjs`, wird vom Runner automatisch gefunden) statt `m11p2.cjs` zu erweitern.
- Sprite-Wünsche: neue Zeile in `SPRITE_QUEUE.md` mit **neuer, fortlaufender ID** in der passenden Priorität (kein Umnummerieren).
- `npm run art:import -- <rig> --force` ändert nur `public/art/rigs/<rig>/` — nie ohne Rig-ID für alle Rigs gleichzeitig laufen lassen.
- Test-/Screenshot-Hilfsdateien nicht committen (`tests/out/`, `tests/zz_*.cjs`).
