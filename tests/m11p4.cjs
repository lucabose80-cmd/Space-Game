// M11 — Teilen: Quarz-Koloss & Sternen-Archon spalten sich in Phase 2; gemeinsamer HP-Pool, Sieg/Belohnung nur einmal,
// Wiedervereinigung bei ≤ 15 % HP, Rollenverteilung der Hälften.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const toasts = [];
    const idle = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
    const mk = () => { const g = new GameState(); g.saveLocked = true; const d = new DungeonScene(g, { onReturnToHub() {}, onToast(m) { toasts.push(m); }, onHudDirty() {} }); d.startRun(1); const room = d.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = []; room.doors = { north: false, south: false, east: false, west: false }; d.playerX = 120; d.playerY = 190; d.invulnTimer = 9999; return { g, d }; };
    const out = {};
    for (const kind of ['boss_quartz_golem', 'boss_star_archon']) {
      const { g, d } = mk();
      d.enemies.length = 0; d.spawnEnemy(kind, 300, 120);
      const boss = d.enemies[0]; const max = boss.maxHp;
      const step = (n) => { for (let i = 0; i < n; i++) d.update(0.016, idle); };
      const res = { n0: d.enemies.length };
      boss.hp = max * 0.45; // Phase 2
      try { step(5); } catch (e) { res.err = String(e); }
      res.n1 = d.enemies.filter((e) => e.kind === kind).length;
      const halves = d.enemies.filter((e) => e.kind === kind);
      res.sameGroup = halves.length === 2 && halves[0].splitGroup === halves[1].splitGroup && halves[0].splitGroup !== undefined;
      res.roles = halves.map((e) => e.splitRole).sort().join('');
      res.smaller = halves.every((e) => e.radius < boss.radius + 1) && halves[0].radius < (kind === 'boss_quartz_golem' ? 18 : 25);
      // Pool: Schaden an Hälfte B senkt auch Hälfte A
      if (halves.length < 2) { res.dbg = [halves.length, boss.hp, boss.bossPhase2, d.enemies.map((e) => e.kind)]; out[kind] = res; continue; }
      const [a, b] = halves; const before = a.hp; d.damageEnemy(b, 100, 0, 0, 0, true, false);
      res.pool = [Math.round(before - a.hp), a.hp === b.hp];
      // beide Hälften im selben Frame treffen → Summe
      const h0 = a.hp; d.damageEnemy(a, 50, 0, 0, 0, true, false); d.damageEnemy(b, 50, 0, 0, 0, true, false); res.both = Math.round(h0 - a.hp);
      // keine zweite Teilung
      step(10); res.stillTwo = d.enemies.filter((e) => e.kind === kind).length;
      // Wiedervereinigung
      d.enemies.filter((e) => e.kind === kind).forEach((e) => (e.hp = max * 0.1)); step(3);
      const rest = d.enemies.filter((e) => e.kind === kind); res.merged = [rest.length, rest[0]?.splitGroup === undefined];
      out[kind] = res;
      // Sieg nur einmal: neu teilen, dann töten
      const t = mk(); t.d.enemies.length = 0; t.d.spawnEnemy(kind, 300, 120); const bb = t.d.enemies[0]; bb.hp = bb.maxHp * 0.45;
      for (let i = 0; i < 5; i++) t.d.update(0.016, idle);
      const hv = t.d.enemies.filter((e) => e.kind === kind); const c0 = t.g.bossDefeatedCount; const drops0 = t.d.lootDrops?.length ?? 0;
      hv.forEach((e) => (e.hp = 0)); t.d.onEnemyKilled(hv[0]); t.d.onEnemyKilled(hv[1]);
      out[kind].kill = { left: t.d.enemies.filter((e) => e.kind === kind).length, bossCount: t.g.bossDefeatedCount - c0, defeated: t.d.floorBossDefeated };
    }
    return out;
  });
  console.log(JSON.stringify(r));
  for (const [k, v] of Object.entries(r)) {
    assert.ok(!v.err, k + ' ' + v.err);
    assert.deepStrictEqual([v.n0, v.n1], [1, 2], `${k}: teilt sich genau einmal: ` + JSON.stringify(v));
    assert.ok(v.sameGroup && v.roles === '01', `${k}: gemeinsame Gruppe, Rollen A/B`);
    assert.deepStrictEqual(v.pool, [100, true], `${k}: Schaden an einer Hälfte = Pool`);
    assert.strictEqual(v.both, 100, `${k}: Schaden an beiden = Summe`);
    assert.strictEqual(v.stillTwo, 2, `${k}: keine weitere Teilung`);
    assert.deepStrictEqual(v.merged, [1, true], `${k}: Wiedervereinigung bei ≤ 15 %`);
    assert.deepStrictEqual([v.kill.left, v.kill.bossCount, v.kill.defeated], [0, 1, true], `${k}: Sieg nur einmal: ` + JSON.stringify(v.kill));
  }
  console.log('M11 TEILEN OK');
};
