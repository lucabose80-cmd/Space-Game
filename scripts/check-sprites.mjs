// Listet optionale Sprites, für die es nur prozedurale Fallbacks gibt (Datei fehlt in public/art/sprites/).
// Immer Exit-Code 0 – es ist ein Hinweis, kein Fehler. Mit --strict Exit 1 bei fehlenden Dateien.
import { existsSync, readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/assets/artLoader.ts', import.meta.url), 'utf8');
const missing = [];
// Alle `export const <NAME>_OPTIONAL_SPRITES = { … } as const`-Blöcke lesen
for (const block of src.matchAll(/export const \w*OPTIONAL_SPRITES = \{([\s\S]*?)\} as const/g)) {
  for (const m of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
    if (!existsSync(new URL(`../public/art/sprites/${m[2]}.png`, import.meta.url))) missing.push({ key: m[1], file: `${m[2]}.png` });
  }
}
// M11: Animation — Teile-Sheets/Rigs laut src/data/rigs.json (Quelle in art_source/rigs, Ergebnis in public/art/rigs/<id>/)
const rigs = JSON.parse(readFileSync(new URL('../src/data/rigs.json', import.meta.url), 'utf8'));
const rigMissing = [];
for (const [id, rig] of Object.entries(rigs)) {
  const src = existsSync(new URL(`../art_source/rigs/${rig.sheet.file}_parts.png`, import.meta.url));
  const out = existsSync(new URL(`../public/art/rigs/${id}/import.json`, import.meta.url));
  if (!src) rigMissing.push(`  - art_source/rigs/${rig.sheet.file}_parts.png  (Teile-Sheet für ${id} fehlt → Prompt: MILESTONE_11_ARCHITECTURE.md §6.3)`);
  else if (!out) rigMissing.push(`  - ${id}: Sheet vorhanden, aber noch nicht importiert → npm run art:import`);
}
if (rigMissing.length) console.log(`ℹ Animation: ${rigMissing.length} Rig(s) ohne fertiges Teile-Sheet (bisherige Darstellung bleibt aktiv):\n${rigMissing.join('\n')}`);
else console.log('✔ Alle Rigs importiert.');

if (!missing.length) {
  console.log('✔ Alle optionalen Sprites vorhanden.');
} else {
  console.log(`⚠ ${missing.length} Sprite(s) fehlen – im Spiel läuft ein prozeduraler Fallback:`);
  for (const m of missing) console.log(`  - public/art/sprites/${m.file}  (art.${m.key})`);
  console.log('→ Prompts: ART_AND_DESIGN_GUIDE.md §7 · neue PNG ablegen, keine Codeänderung nötig.');
  if (process.argv.includes('--strict')) process.exit(1);
}
