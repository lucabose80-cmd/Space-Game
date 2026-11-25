module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const gs = new GameState();
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(1);
    const out = {};
    const room = dng.currentRoom;
    const setup = (obstacles) => {
      dng.enemies.length = 0; dng.projectiles.length = 0;
      room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.spawns = [];
      room.obstacles = obstacles; dng.mechanics.resetForRoom(); dng.rebuildNav();
      dng.playerX = 380; dng.playerY = 134; dng.invulnTimer = 999;
    };
    const wall = [{ x: 235, y: 90, w: 20, h: 140, kind: 'crate' }]; // Lücke oben (y 46–90)
    const run = (kind, maxSec) => {
      dng.enemies.length = 0; dng.spawnEnemy(kind, 110, 160); const e = dng.enemies[0]; e.hp = e.maxHp = 99999;
      let t = 0; let reached = null;
      for (; t < maxSec; t += 1 / 60) {
        dng.mechanicsClock += 1 / 60; dng.mechanics.update(1 / 60); dng.nav.tick(1 / 60, dng.playerX, dng.playerY);
        dng.enemyAi.updateEnemies(1 / 60); dng.playerX = 380; dng.playerY = 134; dng.invulnTimer = 999;
        if (reached === null && Math.hypot(e.x - 380, e.y - 134) < 30) { reached = t; break; }
      }
      return reached;
    };
    setup(wall);
    out.slime = run('slime', 14);
    out.crawler = run('void_crawler', 14);
    out.golem = run('forge_golem', 20);
    // ohne Hindernis: Lenkung = unverändert (Winkel-Abweichung < 0,01 rad)
    setup([]);
    dng.spawnEnemy('slime', 100, 100); const e2 = dng.enemies[0];
    const dx = 380 - e2.x, dy = 134 - e2.y, d = Math.hypot(dx, dy);
    const s = dng.enemyAi.steer(e2, dx / d, dy / d, d, 1 / 60);
    out.freeDiff = Math.abs(Math.atan2(s.y, s.x) - Math.atan2(dy, dx));
    // Nicht-Läufer (Turm) bleiben unberührt
    dng.spawnEnemy('turret', 150, 150); const t2 = dng.enemies[1];
    const s2 = dng.enemyAi.steer(t2, 1, 0, 100, 1 / 60); out.turretUnchanged = s2.x === 1 && s2.y === 0;
    return out;
  });
  console.log(JSON.stringify(r));
  const assert = require('node:assert');
  assert.ok(r.slime !== null && r.slime < 12, 'Slime erreicht den Spieler: ' + r.slime);
  assert.ok(r.crawler !== null && r.crawler < 12, 'Crawler: ' + r.crawler);
  assert.ok(r.golem !== null && r.golem < 18, 'Golem: ' + r.golem);
  assert.ok(r.freeDiff < 0.01, 'freie Bahn unverändert');
  assert.ok(r.turretUnchanged, 'Turm unverändert');
  console.log('M10C PHASE1 OK');
};
