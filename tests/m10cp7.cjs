module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { BOSS_DEFS } = await import('/src/dungeon/bosses/defs.ts');
    const { zoneContains, beamHits } = await import('/src/dungeon/bosses/bossFx.ts');
    const out = { bosses: {}, zones: {} };
    const toasts = [];
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast: (m) => toasts.push(m), onHudDirty() {} });
    dng.startRun(1); window.__dng = dng;
    const room = dng.currentRoom;
    const setup = () => { room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = []; dng.enemies.length = 0; dng.projectiles.length = 0; dng.bossFx.clear(); dng.mechanics.resetForRoom(); dng.rebuildNav(); dng.invulnTimer = 999; dng.playerX = 200; dng.playerY = 150; };
    // Geometrie der Zonen
    const z = (o) => ({ delay: 0, life: 1, color: '#fff', ...o });
    out.zones = {
      circle: [zoneContains(z({ shape: 'circle', x: 100, y: 100, r: 20 }), 110, 100), zoneContains(z({ shape: 'circle', x: 100, y: 100, r: 20 }), 160, 100)],
      rect: [zoneContains(z({ shape: 'rect', x: 100, y: 100, w: 40, h: 40 }), 118, 100), zoneContains(z({ shape: 'rect', x: 100, y: 100, w: 40, h: 40 }), 140, 100)],
      line: [zoneContains(z({ shape: 'line', x: 0, y: 100, x2: 200, y2: 100, width: 10 }), 100, 104), zoneContains(z({ shape: 'line', x: 0, y: 100, x2: 200, y2: 100, width: 10 }), 100, 130)],
      ringGap: [zoneContains(z({ shape: 'ring', x: 100, y: 100, r: 120, r0: 60, gapA: 0, gapHalf: 0.5 }), 190, 100), zoneContains(z({ shape: 'ring', x: 100, y: 100, r: 120, r0: 60, gapA: 0, gapHalf: 0.5 }), 10, 100), zoneContains(z({ shape: 'ring', x: 100, y: 100, r: 120, r0: 60, gapA: 0, gapHalf: 0.5 }), 110, 100)],
      beam: [beamHits({ x: 0, y: 0, angle: 0, len: 100, width: 8, color: '', warn: false }, 50, 3), beamHits({ x: 0, y: 0, angle: 0, len: 100, width: 8, color: '', warn: false }, 50, 30)],
    };
    // Jeder Boss: alle Züge durchlaufen, Phase 2 bei < 50 % HP, kein Absturz
    for (const kind of Object.keys(BOSS_DEFS)) {
      setup(); dng.spawnEnemy(kind, 240, 110); const e = dng.enemies[0]; e.hp = e.maxHp = 100000;
      const def = BOSS_DEFS[kind]; const seen = new Set(); let zonesMax = 0, projMax = 0, beamMax = 0, platesMax = 0, dmgTaken = 0;
      const hp0 = dng.state.hp; dng.invulnTimer = 0; // Schaden erlauben
      dng.state.hp = 99999;
      let t = 0; let p2At = null;
      for (; t < 70; t += 1 / 60) {
        dng.mechanicsClock += 1 / 60; dng.nav?.tick(1 / 60, dng.playerX, dng.playerY);
        dng.bossFx.beginFrame(); dng.enemyAi.updateEnemies(1 / 60); dng.bossFx.update(dng, 1 / 60);
        seen.add(e.bossStatusText);
        zonesMax = Math.max(zonesMax, dng.bossFx.zones.length); projMax = Math.max(projMax, dng.projectiles.length); beamMax = Math.max(beamMax, dng.bossFx.beams.length); platesMax = Math.max(platesMax, dng.bossFx.plates.length);
        dng.projectiles.length = 0; dng.invulnTimer = 0;
        if (!e.bossPhase2 && t > 28) e.hp = e.maxHp * 0.45;   // erzwinge Phase 2 nach der ersten Hälfte
        if (e.bossPhase2 && p2At === null) p2At = t;
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { seen.add('NaN'); break; }
      }
      dmgTaken = 99999 - dng.state.hp;
      out.bosses[kind] = { moves: def.moves.map((m) => m.name).filter((n) => seen.has(n)).length, total: def.moves.length, p2: e.bossPhase2 === true, zonesMax, projMax, beamMax, platesMax, nan: seen.has('NaN'), obst: room.obstacles.length, dmgTaken: dmgTaken > 0, pos: [Math.round(e.x), Math.round(e.y)] };
    }
    out.toast = toasts.some((m) => /PHASE II/.test(m));
    // Pillar-Obstacles beim Monolith in Phase 2
    out.pillars = room.obstacles.length;
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.zones.circle, [true, false]); assert.deepStrictEqual(r.zones.rect, [true, false]);
  assert.deepStrictEqual(r.zones.line, [true, false]); assert.deepStrictEqual(r.zones.ringGap, [false, true, false]); assert.deepStrictEqual(r.zones.beam, [true, false]);
  for (const [k, b] of Object.entries(r.bosses)) {
    assert.ok(!b.nan, k + ' NaN');
    assert.strictEqual(b.moves, b.total, `${k}: alle Züge gesehen (${b.moves}/${b.total})`);
    assert.ok(b.p2, k + ' Phase 2');
    assert.ok(b.zonesMax > 0 || b.beamMax > 0 || b.platesMax > 0 || b.projMax > 0, k + ' hat Effekte');
  }
  assert.ok(r.bosses.boss_chrono_sentinel.beamMax >= 2); assert.ok(r.bosses.boss_monolith_colossus.platesMax >= 4);
  assert.ok(r.bosses.boss_monolith_colossus.obst >= 3, 'Monolith: Säulen in Phase 2');
  assert.ok(r.toast);
  console.log('M10C PHASE7 OK');
};
