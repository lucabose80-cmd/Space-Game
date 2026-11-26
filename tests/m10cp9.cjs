module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const comp = await import('/src/data/companions.ts');
    const bal = await import('/src/data/balance.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const out = {};
    // --- BA2: Bots
    const base = { totalSold: 0, shopTier: 0, totalEnemiesDefeated: 0, bossDefeatedCount: 0, breacherDefeated: false, coreWatcherDefeated: false, deepestFloor: 1, sector1Cleared: false, sector2Cleared: false };
    const u = (id, o) => comp.evaluateCompanionUnlock(id, { ...base, ...o }).unlocked;
    out.puck = [u('puck', { totalSold: 59, shopTier: 1 }), u('puck', { totalSold: 60, shopTier: 0 }), u('puck', { totalSold: 60, shopTier: 1 }), u('puck', { totalSold: 15, shopTier: 1 })];
    out.spark = [u('spark', { coreWatcherDefeated: true, totalEnemiesDefeated: 199 }), u('spark', { coreWatcherDefeated: false, totalEnemiesDefeated: 300 }), u('spark', { coreWatcherDefeated: true, totalEnemiesDefeated: 200 }), u('spark', { breacherDefeated: true, bossDefeatedCount: 1, totalEnemiesDefeated: 30 })];
    out.luma = [u('luma', { sector1Cleared: true, bossDefeatedCount: 3 }), u('luma', { sector1Cleared: false, bossDefeatedCount: 9 }), u('luma', { sector1Cleared: true, bossDefeatedCount: 4 }), u('luma', { coreWatcherDefeated: true, deepestFloor: 3 })];
    out.halo = [u('halo', { sector1Cleared: true }), u('halo', { sector2Cleared: true })];
    // Altspielstand: freigeschaltete Bots bleiben
    const gs = new GameState(); gs.unlockedCompanions.puck = true; gs.checkCompanionUnlocks(false); out.keeps = gs.unlockedCompanions.puck === true;
    // --- BA3: Rift-Faktoren (12 Kombinationen)
    out.hp = []; out.dmg = [];
    for (const s of [1, 2, 3, 4]) for (const f of [1, 2, 3]) { out.hp.push(+bal.RIFT_SCALING.hpFactor(s, f).toFixed(2)); out.dmg.push(+bal.RIFT_SCALING.damageFactor(s, f).toFixed(2)); }
    // --- Kammer: HP-Faktor, Wellen, Elite, Schaden
    const res = {};
    for (const fl of [1, 2, 3]) {
      const sector = 2; let floor = null, host = null;
      for (let i = 0; i < 300 && !host; i++) { floor = gen.generateSectorFloor(sector, fl); host = [...floor.rooms.values()].find((r) => r.isRiftChamber); }
      const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
      dng.startRun(sector); dng.floor = floor; dng.currentFloor = fl; dng.currentSector = sector;
      dng.enterRoom(host.key, null); dng.invulnTimer = 0; dng.state.hp = 99999;
      const first = dng.enemies.map((e) => ({ kind: e.kind, maxHp: e.maxHp, elite: !!e.elite, mut: e.mutator ?? null }));
      // gleicher Typ außerhalb der Kammer (Referenz)
      const refRoom = dng.currentRoom; dng.currentRoom = { ...refRoom, isRiftChamber: false }; dng.enemies.length = 0; dng.spawnEnemy(first[1].kind, 200, 130); const refHp = dng.enemies[0].maxHp; dng.currentRoom = refRoom; dng.enemies.length = 0;
      const wave1 = first.length;
      // Wellen: alle Gegner töten
      const waves = [wave1]; const elites = [first.filter((e) => e.elite).length]; let eliteMut = first.some((e) => e.elite && e.mut);
      for (let w = 0; w < 4; w++) {
        dng.enemies.length = 0; dng.enemies.push({ id: 9999, kind: 'slime', x: 0, y: 0, hp: 0, maxHp: 1, radius: 5, vx: 0, vy: 0, flashTimer: 0, aiTimer: 0, phase: 0, subBurst: 0, burstDelay: 0 });
        dng.onEnemyKilled(dng.enemies[0]);
        if (dng.enemies.length === 0) break; waves.push(dng.enemies.length); elites.push(dng.enemies.filter((e) => e.elite).length); if (dng.enemies.some((e) => e.elite && e.mutator)) eliteMut = true;
      }
      // Schaden: Faktor auf Treffer
      dng.state.hp = 1000; dng.invulnTimer = 0; dng.damagePlayer(10, 1, 0); const lost = 1000 - dng.state.hp;
            res[fl] = { hpRatio: +(first[1].maxHp / refHp / (first[1].mut === 'armored' ? 1.25 : 1)).toFixed(2), waves, elites, lost, eliteHasMut: eliteMut, stars: dng.riftDangerStars(2, fl) };
    }
    out.rift = res;
    // --- Prüfung: keine Risse
    const gs2 = new GameState(); const dt = new DungeonScene(gs2, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    const wt = await import('/src/systems/weeklyTrial.ts'); dt.startWeeklyTrial(wt.getCurrentWeeklyTrial(new Date('2026-12-09T10:00:00Z'))); out.trialNoRift = [...dt.floor.rooms.values()].every((r) => !r.isRiftChamber && !r.riftPortal);
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.puck, [false, false, true, false]);
  assert.deepStrictEqual(r.spark, [false, false, true, false]);
  assert.deepStrictEqual(r.luma, [false, false, true, false]);
  assert.deepStrictEqual(r.halo, [false, true]); assert.ok(r.keeps);
  assert.deepStrictEqual(r.hp, [1.6, 1.85, 2.1, 1.95, 2.2, 2.45, 2.3, 2.55, 2.8, 2.65, 2.9, 3.15]);
  assert.deepStrictEqual(r.dmg, [1.3, 1.4, 1.5, 1.45, 1.55, 1.65, 1.6, 1.7, 1.8, 1.75, 1.85, 1.95]);
  const expHp = { 1: 1.95, 2: 2.2, 3: 2.45 }; // Sektor 2
  for (const fl of [1, 2, 3]) {
    const x = r.rift[fl]; assert.ok(Math.abs(x.hpRatio - expHp[fl]) < 0.25, `HP-Faktor F${fl}: ${x.hpRatio}`);
    assert.strictEqual(x.waves.length, fl === 1 ? 2 : 3, `Wellen F${fl}: ${JSON.stringify(x.waves)}`);
    assert.strictEqual(x.lost, Math.round(10 * (1.3 + 0.1 * (fl - 1) + 0.15)), `Schaden F${fl}: ${x.lost}`);
    assert.ok(x.stars.length === 3);
  }
  assert.ok(r.rift[3].elites.every((n) => n >= 1) && r.rift[3].eliteHasMut === true, 'Ebene III: Elite in jeder Welle mit Mutator');
  assert.ok(r.rift[1].elites.every((n) => n === 0));
  assert.ok(r.trialNoRift);
  console.log('M10C PHASE9 OK');
};
