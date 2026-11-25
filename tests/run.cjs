// Usage: node tests/run.cjs [name ...]   – ohne Argumente laufen alle Tests.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const all = fs.readdirSync(__dirname).filter((f) => /^(t\d|m\d+p).*\.cjs$/.test(f)).map((f) => f.replace('.cjs', '')).sort();
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : all;
let failed = 0;
for (const n of names) {
  const r = spawnSync('node', [path.join(__dirname, 'harness.cjs'), path.join(__dirname, n + '.cjs')], { encoding: 'utf8' });
  const ok = r.status === 0;
  const last = (r.stdout || '').trim().split('\n').pop();
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : '\n' + (r.stderr || r.stdout).split('\n').slice(0, 12).join('\n')} ${ok ? '— ' + last : ''}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Tests grün');
process.exit(failed ? 1 : 0);
