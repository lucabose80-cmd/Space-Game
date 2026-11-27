// Listet optionale Sprites, für die es nur prozedurale Fallbacks gibt (Datei fehlt in public/art/sprites/).
// Immer Exit-Code 0 – es ist ein Hinweis, kein Fehler. Mit --strict Exit 1 bei fehlenden Dateien.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const src = readFileSync(new URL('../src/assets/artLoader.ts', import.meta.url), 'utf8');
const missing = [];
// Alle `export const <NAME>_OPTIONAL_SPRITES = { … } as const`-Blöcke lesen
for (const block of src.matchAll(/export const \w*OPTIONAL_SPRITES = \{([\s\S]*?)\} as const/g)) {
  for (const m of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
    if (!existsSync(new URL(`../public/art/sprites/${m[2]}.png`, import.meta.url))) missing.push({ key: m[1], file: `${m[2]}.png` });
  }
}
// M11: Animation — Teile-Sheets/Rigs laut src/data/rigs/*.json (Quelle in art_source/rigs, Ergebnis in public/art/rigs/<id>/)
import { readdirSync } from 'node:fs';
const rigsDirUrl = new URL('../src/data/rigs/', import.meta.url);
const rigs = Object.fromEntries(readdirSync(rigsDirUrl).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, rigsDirUrl), 'utf8'))]));
const rigMissing = [];
// Geplante, noch nicht in rigs.json eingetragene Sheets (Antigravity-Aufträge) — Hinweis, bis sie vorhanden sind.
const PLANNED_SHEETS = [
  ['krall_legs_R', 'ART_BRIEF_M11.md §4.1'],
  ['krall_legs_L', 'ART_BRIEF_M11.md §4.1'],
  ['krall_effects', 'ART_BRIEF_M11.md §4.1'],
  ['core_warden_arms_R3', 'BOSS_ANIMATION_PLAN.md §2.3 (S6)'],
  ['core_warden_arms_L3', 'BOSS_ANIMATION_PLAN.md §2.3 (S6)'],
];
// Gleicher Hash wie scripts/art-import.py (sha1, erste 16 Hex-Zeichen)
const sheetHash = (f) => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 16);
const rigsDir = new URL('../art_source/rigs/', import.meta.url);
for (const [id, rig] of Object.entries(rigs)) {
  const srcName = rig.sheet.srcFile ? `${rig.sheet.srcFile}.png` : `${rig.sheet.file}_parts.png`;
  const src = existsSync(new URL(srcName, rigsDir));
  const metaUrl = new URL(`../public/art/rigs/${id}/import.json`, import.meta.url);
  const out = existsSync(metaUrl);
  if (!src) rigMissing.push(`  - art_source/rigs/${srcName}  (Teile-Sheet für ${id} fehlt → Prompt: MILESTONE_11_ARCHITECTURE.md §6.3)`);
  else if (!out) rigMissing.push(`  - ${id}: Sheet vorhanden, aber noch nicht importiert → npm run art:import -- ${id} --force`);
  else {
    for (const set of rig.sheet.sets ?? []) {
      if (!existsSync(new URL(`${set.file}.png`, rigsDir))) rigMissing.push(`  - art_source/rigs/${set.file}.png  (Pose-Set-Sheet für ${id} fehlt, siehe ART_BRIEF_M11.md)`);
    }
    // Veraltet? Hashes der Quell-Sheets mit dem letzten Import vergleichen
    const old = JSON.parse(readFileSync(metaUrl, 'utf8')).sheets ?? {};
    const stale = Object.entries(old).filter(([name, h]) => existsSync(new URL(name, rigsDir)) && sheetHash(new URL(name, rigsDir)) !== h).map(([name]) => name);
    if (stale.length) rigMissing.push(`  - ${id}: Sheet geändert (${stale.join(', ')}) → neu importieren: npm run art:import -- ${id} --force`);
  }
}
for (const [name, where] of PLANNED_SHEETS) {
  if (!existsSync(new URL(`${name}.png`, rigsDir))) rigMissing.push(`  - art_source/rigs/${name}.png  (geplant, noch nicht geliefert → ${where})`);
}
if (rigMissing.length) console.log(`ℹ Animation: ${rigMissing.length} Hinweis(e) zu Rigs/Sheets (bisherige Darstellung bleibt aktiv):\n${rigMissing.join('\n')}`);
else console.log('✔ Alle Rigs importiert.');

if (!missing.length) {
  console.log('✔ Alle optionalen Sprites vorhanden.');
} else {
  console.log(`⚠ ${missing.length} Sprite(s) fehlen – im Spiel läuft ein prozeduraler Fallback:`);
  for (const m of missing) console.log(`  - public/art/sprites/${m.file}  (art.${m.key})`);
  console.log('→ Prompts: ART_AND_DESIGN_GUIDE.md §7 (Promenade) · §8 (Boss-Sprites) · neue PNG ablegen, keine Codeänderung nötig.');
}

// SPRITE_QUEUE.md prüfen: Abgleich mit Dateisystem, neue Fallbacks erkennen, nächste Aufträge anzeigen
const queueUrl = new URL('../SPRITE_QUEUE.md', import.meta.url);
if (existsSync(queueUrl)) {
  const queueText = readFileSync(queueUrl, 'utf8');
  const queueFiles = new Set();
  const ready = [];
  const syncHints = [];
  let lockedGate = false;
  let gateNotice = '';
  for (const line of queueText.split('\n')) {
    if (/^>\s*\*\*⛔\s*STOP-GATE\s*\(GESPERRT\)/i.test(line)) {
      if (!lockedGate) {
        lockedGate = true;
        gateNotice = line.replace(/^>\s*/, '').trim();
      }
      continue;
    }
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*\[( |x|~|!)\]\s*\|\s*`([^`]+)`\s*\|/);
    if (!m) continue;
    const [, id, status, relPath] = m;
    queueFiles.add(relPath);
    const present = existsSync(new URL(`../${relPath}`, import.meta.url));
    if ((status === ' ' || status === '~') && present) {
      syncHints.push(`  - ${id} (${relPath}) existiert bereits → in SPRITE_QUEUE.md auf [x] setzen`);
    } else if (status === 'x' && !present) {
      syncHints.push(`  - ⚠ ${id} (${relPath}) ist [x], aber Datei fehlt im Repo!`);
    } else if (status === ' ' && !present && !lockedGate) {
      ready.push({ id, relPath });
    }
  }
  for (const m of missing) {
    const rel = `public/art/sprites/${m.file}`;
    if (!queueFiles.has(rel)) {
      syncHints.push(`  - ⚠ ${rel} (art.${m.key}) fehlt in SPRITE_QUEUE.md → bitte priorisiert einsortieren!`);
    }
  }
  if (syncHints.length) console.log(`ℹ Sprite-Queue-Abgleich:\n${syncHints.join('\n')}`);
  if (ready.length) {
    const next = ready.slice(0, 2).map((r) => `${r.id} (${r.relPath})`).join(', ');
    console.log(`▶ Sprite-Queue (SPRITE_QUEUE.md): ${ready.length} bereit vor nächstem STOP-GATE · Nächste: ${next}`);
  } else if (lockedGate) {
    console.log(`⏸ Sprite-Queue (SPRITE_QUEUE.md): vor STOP-GATE angehalten — ${gateNotice}`);
  } else {
    console.log('✔ Sprite-Queue (SPRITE_QUEUE.md): keine offenen Aufträge.');
  }
}

if (missing.length && process.argv.includes('--strict')) process.exit(1);

