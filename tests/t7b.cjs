// Polish Teil 2: Schadenszahlen zusammenfassen, Hit-Stop (Phase 2 / Boss- & Elite-Kill), Kern-Wächter-Schritte aus Strecke.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(1);
    const room = dng.currentRoom;
    room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    dng.enemies.length = 0; dng.floats.length = 0; dng.roomFade = 0;
    const out = {};
    // --- Schadenszahlen: 3 Treffer in < 0,3 s = 1 Zahl, Summe stimmt; nach > 0,3 s neue Zahl
    dng.spawnEnemy('slime', 200, 120); const e = dng.enemies[0]; e.hp = e.maxHp = 100000;
    const nums = () => dng.floats.filter((f) => f.enemyId === e.id);
    dng.time = 10; dng.damageEnemy(e, 7, 1, 0, 0); dng.time = 10.1; dng.damageEnemy(e, 5, 1, 0, 0); dng.time = 10.2; dng.damageEnemy(e, 3, 1, 0, 0);
    out.mergedCount = nums().length; out.mergedText = nums()[0] && nums()[0].text;
    dng.time = 10.5; dng.damageEnemy(e, 4, 1, 0, 0);
    out.afterCount = nums().length;
    // Obergrenze
    for (let i = 0; i < 80; i++) dng.floats.push({ x: 0, y: 0, text: 'x', color: '#fff', life: 1, maxLife: 1 });
    dng.time = 20; dng.damageEnemy(e, 1, 1, 0, 0); out.cap = dng.floats.length <= 49;
    // --- Hit-Stop bei Boss-Kill / Elite-Kill
    dng.enemies.length = 0; dng.heavyStop = 0;
    dng.spawnEnemy('boss', 240, 110); const boss = dng.enemies[0];
    dng.onEnemyKilled(boss); out.bossStop = dng.heavyStop;
    dng.enemies.length = 0; dng.heavyStop = 0;
    dng.spawnEnemy('drone', 240, 110); const el = dng.enemies[0]; el.elite = true;
    dng.onEnemyKilled(el); out.eliteStop = dng.heavyStop;
    dng.enemies.length = 0; dng.heavyStop = 0;
    dng.spawnEnemy('drone', 240, 110); dng.onEnemyKilled(dng.enemies[0]); out.normalStop = dng.heavyStop;
    // --- Phase 2 einmalig
    dng.enemies.length = 0; dng.heavyStop = 0; dng.roomFade = 0;
    dng.spawnEnemy('boss', 240, 110); const b2 = dng.enemies[0]; b2.hp = b2.maxHp = 100000; b2.bossPhase2 = true;
    dng.update(1 / 60, new InputManager(document.getElementById('game-canvas')));
    out.p2Flag = b2.phase2FxShown === true; out.p2Stop = dng.heavyStop > 0;
    // --- Kern-Wächter: im Stand keine Schritt-Phase-Änderung, beim Laufen schon
    const mk = () => ({ id: 3, kind: 'boss', hp: 1000, maxHp: 1000, x: 0, y: 0, vx: 0, vy: 0, radius: 10, bossPhase2: false, bossState: 'stalk', bossStateTimer: 0, bossStateMax: 1, flashTimer: 0 });
    const still = mk(); const p0 = JSON.stringify(anim.getBossPose('core_warden', still, 1.0));
    for (let t = 1.0; t < 2.0; t += 1 / 60) anim.getBossPose('core_warden', still, t);
    const p1 = JSON.stringify(anim.getBossPose('core_warden', still, 2.0));
    out.stillSame = p0 === p1;
    const walker = mk(); walker.vx = 40; const w0 = JSON.stringify(anim.getBossPose('core_warden', walker, 1.0));
    let changed = false; for (let t = 1.0; t < 1.5; t += 1 / 60) { if (JSON.stringify(anim.getBossPose('core_warden', walker, t)) !== w0) changed = true; }
    out.walkMoves = changed;
    return out;
  });
  assert.strictEqual(r.mergedCount, 1, JSON.stringify(r)); assert.strictEqual(r.mergedText, '15', JSON.stringify(r));
  assert.strictEqual(r.afterCount, 2, JSON.stringify(r)); assert.ok(r.cap, JSON.stringify(r));
  assert.ok(r.bossStop >= 0.12 - 1e-9 && r.eliteStop >= 0.06 - 1e-9 && r.normalStop === 0, JSON.stringify(r));
  assert.ok(r.p2Flag && r.p2Stop, JSON.stringify(r));
  assert.ok(r.walkMoves, JSON.stringify(r));
  console.log('T7B POLISH TEIL 2 OK');
};
