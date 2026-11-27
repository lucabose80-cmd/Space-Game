// Kontaktbogen: zeichnet ein Rig in vielen Boss-Zuständen nebeneinander → tests/out/rig_<id>.png (zum Prüfen von Gelenken/Posen).
//   node scripts/rig-sheet.cjs core_warden|krall|turret|drone|drone_arc|spore_spitter|crystal_crawler [port]
// Läuft auf [port] (Standard 5199) bereits ein Vite-Dev-Server, wird er genutzt; sonst startet rig-sheet.cjs automatisch einen und beendet ihn am Ende.
const { chromium } = require('playwright');
const fs = require('fs');
const { ping, startVite } = require('../tests/harness.cjs');
const rigId = process.argv[2] || 'core_warden';
const port = Number(process.argv[3] || 5199);
const CASES = {
  turret: [['idle', {}], ['lauf', { vx: 70 }], ['vorwarnung', { telegraphTimer: 0.2 }], ['hit', { flashTimer: 0.1 }], ['hp 50%', { hp: 50 }], ['hp 20%', { hp: 20 }], ['hp 10%', { hp: 10 }], ['spieler links', {}, -80]],
  crystal_crawler: [['idle', {}], ['lauf', { vx: 56 }], ['lauf ←', { vx: -56 }], ['vorwarnung 0.1', { telegraphTimer: 0.34 }], ['vorwarnung 0.9', { telegraphTimer: 0.03 }], ['vorschnellen', { chargeActive: 0.2 }], ['hit', { flashTimer: 0.1 }], ['spieler links', {}, -80]],
  spore_spitter: [['idle', {}], ['hit', { flashTimer: 0.1 }], ['eingegraben', { scurryTimer: 0.5 }], ['vorwarnung 0.1', { telegraphTimer: 0.42 }], ['vorwarnung 0.4', { telegraphTimer: 0.3 }], ['vorwarnung 0.7', { telegraphTimer: 0.15 }], ['vorwarnung 1.0', { telegraphTimer: 0.02 }], ['spieler links', {}, -80]],
  drone: [['schweben', {}], ['hit', { flashTimer: 0.1 }], ['flug →', { vx: 90 }], ['flug ←', { vx: -90 }], ['dash ↘', { vx: 140, vy: 80 }], ['vorwarnung 0.1', { telegraphTimer: 0.4 }], ['vorwarnung 0.5', { telegraphTimer: 0.23 }], ['vorwarnung 1.0', { telegraphTimer: 0.02 }], ['schuss-kick', { subBurst: 1, burstDelay: 0.14 }], ['ziel oben', {}, 60, -80], ['ziel unten', {}, 60, 80], ['ziel nah', {}, 20, 0]],
  drone_arc: [['schweben', {}], ['hit', { flashTimer: 0.1 }], ['flug →', { vx: 90 }], ['flug ←', { vx: -90 }], ['vorwarnung 0.1', { telegraphTimer: 0.43 }], ['vorwarnung 0.5', { telegraphTimer: 0.24 }], ['vorwarnung 0.8', { telegraphTimer: 0.1 }], ['vorwarnung 1.0', { telegraphTimer: 0.01 }], ['ziel oben', {}, 60, -80], ['ziel unten', {}, 60, 80]],
  krall: [['idle', {}], ['hit', { flashTimer: 0.1 }], ['lauf', { vx: 60 }], ['stoß-windup', { bossSub: 'windup', bossStatusText: 'GREIFARM-STOSS', bossStateMax: 0.65, bossStateTimer: 0.1 }], ['stoß', { bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.8 }], ['stoß voll →', { bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.65, chargeDirX: 0.95, chargeDirY: 0.3 }], ['stoß zu ←', { bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.45, chargeDirX: -0.95, chargeDirY: -0.3 }], ['stoß-nachfedern', { bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.3 }], ['magnet-windup', { bossSub: 'windup', bossStatusText: 'MAGNET-ZUG', bossStateMax: 0.6, bossStateTimer: 0.1 }], ['magnet-sog', { bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8 }], ['wurf-windup', { bossSub: 'windup', bossStatusText: 'SCHROTT-WURF', bossStateMax: 0.5, bossStateTimer: 0.1 }], ['wurf', { bossSub: 'recover', bossStatusText: 'SCHROTT-WURF', bossStateTimer: 0.7 }], ['hagel-windup', { bossSub: 'windup', bossStatusText: 'SCHROTT-HAGEL', bossStateMax: 0.5, bossStateTimer: 0.1 }], ['hagel-stampf', { bossSub: 'recover', bossStatusText: 'SCHROTT-HAGEL', bossStateTimer: 0.95 }], ['P2 idle', { bossPhase2: true, hp: 40 }], ['P2 stoß', { bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.8, bossPhase2: true, hp: 40 }], ['P2 hagel', { bossSub: 'recover', bossStatusText: 'SCHROTT-HAGEL', bossStateTimer: 0.95, bossPhase2: true, hp: 40 }], ['P2 beschädigt', { bossPhase2: true, hp: 15 }], ['P1 <80 %', { hp: 75 }], ['P1 <65 %', { hp: 60 }], ['P2 <35 %', { bossPhase2: true, hp: 30 }], ['P2 <25 %', { bossPhase2: true, hp: 20 }], ['P2 kritisch', { bossPhase2: true, hp: 10 }], ['P2 magnet-sog verbogen', { bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8, bossPhase2: true, hp: 40 }], ['sog 50 %', { bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8, hp: 55 }], ['sog Stumpf', { bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8, bossPhase2: true, hp: 15 }], ['hagel Stumpf', { bossSub: 'recover', bossStatusText: 'SCHROTT-HAGEL', bossStateTimer: 0.95, bossPhase2: true, hp: 30 }], ['P2 humpeln', { bossPhase2: true, hp: 30, vx: 60 }], ['P2 hagel-hitze', { bossSub: 'windup', bossStatusText: 'SCHROTT-HAGEL', bossStateMax: 0.5, bossStateTimer: 0.05, bossPhase2: true, hp: 45 }]],
  core_warden: [['stalk', {}], ['blink', { id: 0 }], ['look L', {}, -80], ['look R', {}, 80], ['hit', { flashTimer: 0.1 }], ['windup 0.9', { bossState: 'charge_windup', bossStateMax: 0.64, bossStateTimer: 0.06 }], ['charge_dash', { bossState: 'charge_dash' }], ['jump 0.2', { bossState: 'slam_jump', bossStateMax: 0.4, bossStateTimer: 0.32 }], ['jump 0.7', { bossState: 'slam_jump', bossStateMax: 0.4, bossStateTimer: 0.1 }], ['slam_air', { bossState: 'slam_air', bossStateMax: 0.5, bossStateTimer: 0.25 }], ['impact 0.02', { bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.40 }], ['impact 0.3', { bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.12 }], ['laser_windup 0.2', { bossState: 'laser_windup', bossStateMax: 0.76, bossStateTimer: 0.6 }], ['laser_windup 0.8', { bossState: 'laser_windup', bossStateMax: 0.76, bossStateTimer: 0.1 }], ['laser_sweep', { bossState: 'laser_sweep' }], ['pylon', { bossState: 'pylon_barrage' }], ['pylon hit', { bossState: 'pylon_barrage', flashTimer: 0.1 }], ['stunned', { bossState: 'stunned', bossStateMax: 0.6, bossStateTimer: 0.35, chargeDirX: 1 }], ['P2', { bossPhase2: true }], ['P2 low hp', { bossPhase2: true, hp: 20 }], ['P2 laser', { bossPhase2: true, bossState: 'laser_sweep' }], ['P2 pylon', { bossPhase2: true, bossState: 'pylon_barrage' }], ['P2 stunned', { bossPhase2: true, bossState: 'stunned', bossStateMax: 0.6, bossStateTimer: 0.35 }], ['P1 hp<80%', { hp: 75 }], ['P1 hp<65%', { hp: 60 }], ['P2 hp<35%', { bossPhase2: true, hp: 30 }], ['P1 hp<15%', { hp: 10 }], ['roar', { bossPhase2: true, bossState: 'phase2_roar', bossStateMax: 1.1, bossStateTimer: 0.5 }]],
};
(async () => {
  if (!CASES[rigId]) {
    console.error(`Unbekanntes Rig "${rigId}". Verfügbar: ${Object.keys(CASES).join(', ')}`);
    process.exit(2);
  }
  const alreadyUp = await ping(`http://127.0.0.1:${port}/`);
  const server = alreadyUp ? null : await startVite(port);
  let b = null;
  try {
    b = await chromium.launch();
    const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => console.log('ERR', e.message));
    await page.goto(`http://127.0.0.1:${port}/?bosslab=1`);
    await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
    await page.waitForFunction(async (id) => !!(await import('/src/assets/artLoader.ts')).getHDArt().rigs[id], rigId, { timeout: 30000 });
    const data = await page.evaluate(async ([rigId, cases]) => {
      const { getHDArt } = await import('/src/assets/artLoader.ts');
      const { drawRig } = await import('/src/engine/rig.ts');
      const { RIGS } = await import('/src/data/rigs.ts');
      const { getBossPose } = await import('/src/dungeon/anim/bossAnims.ts');
      const art = getHDArt(); const Z = 4, cw = 120, ch = 110, cols = 4;
      const cv = document.createElement('canvas'); cv.width = cw * Z * cols; cv.height = ch * Z * Math.ceil(cases.length / cols);
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#334'; ctx.fillRect(0, 0, cv.width, cv.height);
      cases.forEach(([name, extra, lookDx, lookDy], i) => {
        const e = Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'x', bossPhase2: false, hp: 100, maxHp: 100 }, extra);
        ctx.save(); ctx.translate((i % cols) * cw * Z, Math.floor(i / cols) * ch * Z); ctx.scale(Z, Z);
        ctx.fillStyle = '#2a2a3a'; ctx.fillRect(0, 0, cw, ch);
        drawRig(ctx, RIGS[rigId], art.rigs[rigId], cw / 2, ch - 25, getBossPose(rigId, e, name === 'blink' ? 0 : 0.3, lookDx ?? 0, lookDy ?? 0), {});
        ctx.fillStyle = '#fff'; ctx.font = '5px monospace'; ctx.fillText(name, 3, 7); ctx.restore();
      });
      return cv.toDataURL('image/png');
    }, [rigId, CASES[rigId]]);
    fs.mkdirSync('tests/out', { recursive: true });
    fs.writeFileSync(`tests/out/rig_${rigId}.png`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`→ tests/out/rig_${rigId}.png`);
  } finally {
    if (b) await b.close().catch(() => {});
    if (server) server.stop();
  }
})();
