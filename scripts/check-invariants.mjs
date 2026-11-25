// Prüft die harten Invarianten aus AGENTS.md (§3) ohne externe Tools.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const checks = [
  { name: 'Zero-Dungeon-Credits', re: /state\.credits\s*\+=/, files: ['src/scenes/DungeonScene.ts', ...walk('src/dungeon')] },
  { name: 'Kein Math.random in mechanicsGen.ts (Seed-Determinismus)', re: /Math\.random/, files: ['src/dungeon/mechanicsGen.ts'] },
];
let bad = 0;
for (const c of checks) {
  for (const f of c.files.filter((x) => x.endsWith('.ts'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (c.re.test(line)) { console.error(`✘ ${c.name}: ${f}:${i + 1}: ${line.trim()}`); bad++; } });
  }
}
console.log(bad ? `${bad} Invarianten-Verstöße` : '✔ Invarianten ok');
process.exit(bad ? 1 : 0);
