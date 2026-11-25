module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(1); window.__dng = dng;
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    dng.mechanics.resetForRoom(); dng.rebuildNav(); dng.invulnTimer = 999;
    const o = {};
    const mk = (kind) => { dng.enemies.length = 0; dng.spawnEnemy(kind, 300, 130); const e = dng.enemies[0]; e.hp = e.maxHp = 1000; e.aimAngle = 0; e.shieldDownTimer = 0; e.shieldHeat = 0; e.aiTimer = 99; e.telegraphTimer = 0; dng.playerX = 100; dng.playerY = 130; return e; };
    const front = (e, piercing = false) => dng.damageEnemy(e, 50, -1, 0, 100, piercing, false); // Angreifer im Osten (Blickrichtung)
    const rear = (e) => dng.damageEnemy(e, 50, 1, 0, 100, false, false);                         // Angreifer im Westen (Rücken)
    // --- Shield-Drone: frontal 100 % Block
    let e = mk('shield_drone'); const hp0 = e.hp;
    front(e); front(e); front(e); o.after3 = [e.hp === hp0, e.shieldHeat, e.shieldDownTimer];
    front(e); o.afterOverheat = [e.hp === hp0, e.shieldDownTimer > 0, e.shieldHeat];       // 4. Block überhitzt
    front(e); o.whileDown = e.hp < hp0;                                                     // Schild unten → voller Schaden
    // --- Rücken & Durchdringen wirken immer voll
    e = mk('shield_drone'); const h1 = e.hp; rear(e); o.rear = h1 - e.hp;
    e = mk('shield_drone'); const h2 = e.hp; front(e, true); o.pierce = h2 - e.hp;
    // --- Angriff öffnet den Schild (Telegraph → Fenster ≥ 1 s)
    e = mk('shield_drone'); e.aiTimer = 0; dng.enemyAi.updateEnemies(1 / 60); o.attackOpens = [e.telegraphTimer > 0, e.shieldDownTimer >= 0.9];
    const h3 = e.hp; front(e); o.attackWindowDamage = h3 - e.hp > 0;
    // Fenster läuft ab → wieder Block
    for (let i = 0; i < 120; i++) dng.enemyAi.updateEnemies(1 / 60); e.aimAngle = 0; e.shieldHeat = 0; const h4 = e.hp; e.x = 300; e.y = 130; front(e); o.blockAgain = [e.shieldDownTimer <= 0, e.hp === h4];
    // Hitze klingt ab
    e = mk('shield_drone'); front(e); front(e); const heatA = e.shieldHeat; for (let i = 0; i < 120; i++) dng.enemyAi.updateEnemies(1 / 60); o.heatDecay = [heatA, e.shieldHeat];
    // --- Resonanz-Wächter: 5 Blocks bis zur Überhitzung
    e = mk('resonance_warden'); const hw = e.hp; for (let i = 0; i < 4; i++) front(e); o.wardenBlocks4 = [e.hp === hw, e.shieldDownTimer]; front(e); o.wardenOverheat = [e.hp === hw, e.shieldDownTimer > 0];
    // --- Bildschirm: Schild intakt / aufgeheizt / unten
    return o;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.after3, [true, 3, 0]);
  assert.deepStrictEqual(r.afterOverheat, [true, true, 0]);
  assert.ok(r.whileDown, 'Schild unten: voller Schaden');
  assert.strictEqual(r.rear, 50); assert.strictEqual(r.pierce, 50);
  assert.deepStrictEqual(r.attackOpens, [true, true]); assert.ok(r.attackWindowDamage);
  assert.deepStrictEqual(r.blockAgain, [true, true]);
  assert.ok(r.heatDecay[0] > r.heatDecay[1], 'Hitze klingt ab');
  assert.deepStrictEqual(r.wardenBlocks4, [true, 0]); assert.deepStrictEqual(r.wardenOverheat, [true, true]);
  // Screenshot: intakt · aufgeheizt · unten
  await page.evaluate(async () => {
    const dng = window.__dng; const { InputManager } = await import('/src/engine/input.ts');
    dng.enemies.length = 0;
    for (const [i, st] of [['a', 0], ['b', 3], ['c', -1]].map((v, idx) => [idx, v[1]])) {
      dng.spawnEnemy('shield_drone', 150 + i * 70, 130); const e = dng.enemies[i]; e.aimAngle = 0; e.aiTimer = 99;
      if (st === -1) e.shieldDownTimer = 5; else e.shieldHeat = st;
    }
    dng.spawnEnemy('resonance_warden', 150, 190); dng.enemies[3].aiTimer = 99; dng.enemies[3].shieldDownTimer = 0;
    dng.spawnEnemy('resonance_warden', 220, 190); dng.enemies[4].aiTimer = 99; dng.enemies[4].shieldDownTimer = 5;
    dng.playerX = 400; dng.playerY = 130;
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    dng.roomFade = 0; dng.time = 1; dng.render(ctx, new InputManager(canvas));
  });
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/cp6b_shields.png`, clip: { x: 200, y: 140, width: 560, height: 280 } });
  console.log('M10C PHASE6b OK');
};
