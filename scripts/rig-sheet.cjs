// Kontaktbogen: zeichnet ein Rig in vielen Boss-Zuständen nebeneinander → tests/out/rig_<id>.png (zum Prüfen von Gelenken/Posen).
//   npm run dev -- --host 127.0.0.1 --port 5199 --strictPort     (in einem zweiten Terminal)
//   node scripts/rig-sheet.cjs core_warden|krall [port]
const { chromium } = require('playwright');
const fs = require('fs');
const rigId = process.argv[2] || 'core_warden';
const port = process.argv[3] || '5199';
const CASES = {
  krall: [['idle', {}], ['stoß-windup', { bossSub: 'windup', bossStatusText: 'GREIFARM-STOSS' }], ['stoß', { bossSub: 'active', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 1 }], ['magnet', { bossSub: 'windup', bossStatusText: 'MAGNET-ZUG' }], ['wurf-windup', { bossSub: 'windup', bossStatusText: 'SCHROTT-WURF' }], ['wurf', { bossSub: 'recover', bossStatusText: 'SCHROTT-WURF' }], ['hagel', { bossSub: 'windup', bossStatusText: 'SCHROTT-HAGEL' }]],
  core_warden: [['stalk', {}], ['charge_windup', { bossState: 'charge_windup' }], ['charge_dash', { bossState: 'charge_dash' }], ['slam_air', { bossState: 'slam_air' }], ['slam_impact', { bossState: 'slam_impact' }], ['laser_windup', { bossState: 'laser_windup' }], ['laser_sweep', { bossState: 'laser_sweep' }], ['pylon', { bossState: 'pylon_barrage' }], ['stunned', { bossState: 'stunned' }], ['hit', { flashTimer: 0.1 }], ['phase 2', { bossPhase2: true }], ['roar 0.2', { bossPhase2: true, bossState: 'phase2_roar', bossStateTimer: 0.88, bossStateMax: 1.1 }], ['roar 0.6', { bossPhase2: true, bossState: 'phase2_roar', bossStateTimer: 0.44, bossStateMax: 1.1 }]],
};
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://127.0.0.1:${port}/?bosslab=1`);
  await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
  await page.waitForFunction(async () => Object.keys((await import('/src/assets/artLoader.ts')).getHDArt().rigs).length > 0, null, { timeout: 30000 });
  const data = await page.evaluate(async ([rigId, cases]) => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { drawRig } = await import('/src/engine/rig.ts');
    const { RIGS } = await import('/src/data/rigs.ts');
    const { getBossPose } = await import('/src/dungeon/anim/bossAnims.ts');
    const art = getHDArt(); const Z = 4, cw = 120, ch = 110, cols = 4;
    const cv = document.createElement('canvas'); cv.width = cw * Z * cols; cv.height = ch * Z * Math.ceil(cases.length / cols);
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#334'; ctx.fillRect(0, 0, cv.width, cv.height);
    cases.forEach(([name, extra], i) => {
      const e = Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'x', bossPhase2: false }, extra);
      ctx.save(); ctx.translate((i % cols) * cw * Z, Math.floor(i / cols) * ch * Z); ctx.scale(Z, Z);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(0, 0, cw, ch);
      drawRig(ctx, RIGS[rigId], art.rigs[rigId], cw / 2, ch - 25, getBossPose(rigId, e, 0.3), {});
      ctx.fillStyle = '#fff'; ctx.font = '5px monospace'; ctx.fillText(name, 3, 7); ctx.restore();
    });
    return cv.toDataURL('image/png');
  }, [rigId, CASES[rigId]]);
  fs.mkdirSync('tests/out', { recursive: true });
  fs.writeFileSync(`tests/out/rig_${rigId}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`→ tests/out/rig_${rigId}.png`);
  await b.close();
})();
