# BOSS_ENEMY_PIPELINE.md — Wiederholbarer Ablauf für Bosse, Gegner & Bossräume (*STARLIGHTER*)

> **Zweck:** Jeder neue oder überarbeitete Gegner, Boss oder Endboss-Raum soll **immer dieselbe Qualität** erreichen — egal welcher Chat oder welches Werkzeug (Claude Code, Antigravity) daran arbeitet. Diese Datei ist der **Ablauf**; die Messlatten stehen in den Checklisten:
> - normale Gegner: **G1–G9** (`BOSS_ANIMATION_PLAN.md` §4)
> - Bosse: **D1–D14** (`BOSS_ANIMATION_PLAN.md` §1)
> - Sektor-Endbosse (Ebene III) mit Arena: **A1–A10** (`MILESTONE_12_ARCHITECTURE.md` §2) **zusätzlich** zu D1–D14

---

## 0. Grundsatz: Sprites großzügig planen
Gute Animation scheitert fast immer an **zu wenigen Bildern**, nicht am Code. Deshalb gilt:
1. **Viele Sprites sind normal und erwünscht.** Lieber 2 Sheets mehr einplanen als eine Pose mit Code „verbiegen“ (Rotation/Skalierung eines einzelnen Bildes wirkt puppenhaft — Rückmeldung Projektinhaber zum Kern-Wächter).
2. **Fehlt ein Sprite → nie blockieren:** prozeduraler Fallback bzw. altes Sprite zeigen, **und sofort** in `SPRITE_QUEUE.md` einreihen (`AGENTS.md` §3 Regel 7). Ein Fallback ist ein *Notfall*, kein Endzustand.
3. **Nicht an Bild-Credits sparen** (Projektinhaber, 2026-11-27): Es ist genug Gemini-Guthaben da. Wenn es der Qualität dient, wird bestellt — auch mehrfach.
4. **Gefällt etwas nicht oder klappt es nicht → zurück auf neue Sheets:** jederzeit, in jeder Stufe (auch nach Stufe 8). Ersatz-Sheet (*„ersetzt `<datei>` — Grund: …“*) oder Zusatz-Sheet in `SPRITE_QUEUE.md` eintragen (§0 dort), Fallback bis zur Lieferung, danach Stufen 5–8 für die betroffenen Teile wiederholen. Ein schwaches Sheet zu behalten, nur weil es schon geliefert ist, ist **kein** gültiger Grund.
5. **Richtwerte (Mindest-Bedarf — eher mehr):**

| Art | Mindest-Sprites | typischer Umfang |
| :--- | :--- | :--- |
| Normaler Gegner | 1 Teile-Sheet `<kind>_rig.png` (6 Zellen) | + 1 Sheet Angriff/Tod/Effekte, wenn der Angriff mehr als Mündungsblitz ist |
| Boss (Ebene I/II) | Rumpf-Set + Arm-Sets L/R + Kopf-Set (≈ 4–6 Sheets) | 8–12 Sheets inkl. Beine, Effekte, Phase-2-Körper, Beschädigungsstufen (D12) |
| Sektor-Endboss + Arena | alles von „Boss“ **plus** Arena-Boden, Boss-Wand/Körper in der Map, Arena-Teile, Arena-Effekte, Trophäe (≈ +5) | 12–18 Sheets/Sprites |

## 1. Die 8 Stufen (für jedes Wesen gleich)
Jede Stufe hat ein **Tor**: erst weiter, wenn das Tor erfüllt ist. Status je Stufe im eigenen Blatt `handoff/<bereich>.md` abhaken.

| Stufe | Wer | Ergebnis | Tor (muss erfüllt sein) |
| :--- | :--- | :--- | :--- |
| **1 Steckbrief** | Claude Code | Steckbrief (§2) im Status-Blatt bzw. Plan-Dokument | Inhaber hat Rolle/Fantasie/Arena-Idee abgenickt |
| **2 Zustandstabelle** | Claude Code | jeder KI-Zustand (`bossState` / Gegner-Zustand) mit Dauer + gewünschter Pose je Abschnitt *Vorwarnung → Ausführung → Erholung* | keine Zelle „?“; jede Attacke hat eine Angriffsgrafik geplant (D11) |
| **3 Sprite-Liste** | Claude Code | Zellenliste je Sheet (was in Zelle 1–6), abgeleitet aus Stufe 2 + Beschädigungsstufen + Tod + Phase 2 (+ Arena) | **in `SPRITE_QUEUE.md` eingetragen** (ID, Zielpfad, Referenz, Prompt im Brief) |
| **4 Pilot-Sheet** | Antigravity — oder der Claude-Chat selbst per `npm run art:gen` (`AGENTS.md` Regel 15) | **ein** Sheet zuerst (meist Rumpf bzw. `<kind>_rig.png`) | `npm run art:check` ok, Maßstab passt zum alten Sprite, STOP-GATE bis Sichtprüfung |
| **5 Import & Rig** | Claude Code | `src/data/rigs/<id>.json`, `npm run art:import -- <id> --force`, Kontaktbogen `node scripts/rig-sheet.cjs <id>` | Gelenke sitzen in jeder Pose, nichts schwebt (D1/D13 bzw. G1) |
| **6 Posen & Bewegung** | Claude Code | `src/dungeon/anim/rigs/<id>.ts`: Zustand → Pose, Glättung/Impuls, Laufrhythmus aus Strecke, Treffer, Tod, Phase 2 | im Boss-Labor (`?bosslab`) bei 0,25× kein „Ploppen“; Hitbox/Schaden unverändert |
| **7 Prüfung gegen Checkliste** | Claude Code | jede Zeile G1–G9 / D1–D14 / A1–A10 im Status-Blatt mit ✅ + Nachweis (Test, Screenshot, Labor-Stelle) | eigener Test `tests/m11p…_<id>.cjs` bzw. `m12p…`, `npm run verify` grün, Screenshots in `tests/out/` angesehen |
| **8 Abnahme im Spiel** | Projektinhaber | 1–2 echte Kämpfe, Rückmeldung mit konkreten Stellen | Inhaber sagt „abgenommen“ → Status-Tabelle in `BOSS_ANIMATION_PLAN.md` §3 auf ✅ |

**Fehlen in Stufe 5–7 Bilder oder überzeugen die gelieferten nicht:** nicht mit Code überbrücken, sondern zurück zu Stufe 3 (neue Queue-Zeile bzw. Ersatz-Sheet, Priorität P0 für laufende Bosse), Fallback bis dahin. **Rückmeldung des Inhabers „gefällt mir nicht“ in Stufe 8** → betroffene Sheets als Ersatz bestellen, nicht nur den Code nachjustieren.

## 2. Steckbrief-Vorlage (Stufe 1)
```md
### <Name> (`kind` / rig-id) — Sektor X, Ebene Y
- Rolle im Sektor: (Einstieg / Mitte / Endboss mit Arena)
- Fantasie in einem Satz: (z. B. „Reaktor-KI, deren Körper die Nordwand ist“)
- Bewegung: (läuft / schwebt / in Map verankert) · Körperbau: (Teile, die sich bewegen)
- Attacken je Phase: Name · Vorwarnung · Ausführung · Erholung · Arena-Bezug
- Phase 2 (und 3 bei Endboss): sichtbare Verwandlung + Arena-Änderung
- Beschädigungsstufen: was bricht/raucht bei 80/65/35/25/<15 % (D12)
- Tod: was passiert mit den Teilen
- Belohnung (nur Bosse): Items/Flags — nie Credits
- Referenzbilder: vorhandene Sprites, Palette des Sektors
```

## 3. Bossraum-Vorlage (zusätzlich für Sektor-Endbosse)
Für jeden Ebene-III-Boss wird in `MILESTONE_12_ARCHITECTURE.md` ein §6-Block nach dem Muster des Leviathan angelegt:
1. **Ort & Bild:** wo im Sektor, wie der Boss in der Map verankert ist (Wand, Boden, Krater, Plattformen).
2. **Arena-Grundriss:** Größe (≥ 2×2 Bildschirme), Eingang, Deckung, Gefahrenflächen als Kachel-Raster (`src/data/arenas/<kind>.ts`) — **ohne Zufall**.
3. **Phasen-Tabelle:** HP-Spanne · Arena-Änderung · Attacken · Schwachstelle (mind. 3 Phasen).
4. **Belohnung:** Trophäen-Relikt, Waffen-Arten-Freischaltung (§5.1 dort), Hub-Trophäe.
5. **Sprite-Liste:** Arena-Boden, Boss-Wand/Körper, Arena-Teile (Typ P), Arena-Effekte (Typ E), Trophäe + Item-Icon → `SPRITE_QUEUE.md`.
6. **Werte:** HP/Kampfdauer in `balance.ts`, Messung mit `m10cp8`.

## 4. Qualitäts-Regeln, die immer gelten
- **Lesbarkeit vor Show:** Gefahr kommt aus Telegraph-Zonen (`bossFx`), Vorwarnung ≥ 0,4 s (Arena-Änderungen ≥ 0,8 s); Animation erzeugt nie neuen Schaden.
- **Kein globaler Zufall** in Layout, Mechanik und Animation (Seeds der Wochen-Prüfung).
- **Ein Wesen = eigene Dateien** (`anim/rigs/<id>.ts`, `data/rigs/<id>.json`, `handoff/<id>.md`, eigener Test) — gemeinsame Dateien nur klein ändern (`PARALLEL_WORK.md`).
- **Pilot zuerst:** neue Serie (neuer Gegner-Typ, neue Arena-Art) immer erst mit einem Exemplar bis Stufe 8, dann Serie.
- **Push nur mit `npm run ship`.**

## 5. Verknüpfte Dokumente
[AGENTS.md](AGENTS.md) §3 Regeln 7, 11–13 · [BOSS_ANIMATION_PLAN.md](BOSS_ANIMATION_PLAN.md) · [MILESTONE_12_ARCHITECTURE.md](MILESTONE_12_ARCHITECTURE.md) · [RIGGING_GUIDE.md](RIGGING_GUIDE.md) · [ART_BRIEF_M11.md](ART_BRIEF_M11.md) · [ART_BRIEF_M11_ENEMIES.md](ART_BRIEF_M11_ENEMIES.md) · [SPRITE_QUEUE.md](SPRITE_QUEUE.md) · [PARALLEL_WORK.md](PARALLEL_WORK.md)
