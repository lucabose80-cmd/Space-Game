module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const wt = await import('/src/systems/weeklyTrial.ts');
    const bal = await import('/src/data/balance.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const out = { par: wt.TRIAL_PAR_TIMES, ttk: {} };
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startWeeklyTrial(wt.getCurrentWeeklyTrial(new Date('2026-12-09T10:00:00Z')));
    out.isTrial = dng.isWeeklyTrial; dng.activeRiftMutator = null; // Wochen-Mutator (z. B. gepanzert ×1,3) neutralisieren — Messung der Basis-Kalibrierung
    const bosses = { 1: ['boss_breacher', 'boss', 'boss_leviathan'], 2: ['boss_quartz_golem', 'boss_prism_weaver', 'boss_prisma_archon'], 3: ['boss_slag_overlord', 'boss_forge_warden', 'boss_vulkan_titan'], 4: ['boss_chrono_sentinel', 'boss_monolith_colossus', 'boss_star_archon'] };
    const dps4 = wt.averageWeaponDps(wt.TRIAL_COMBAT_LEVELS.blade);
    let total = {};
    for (const s of [1, 2, 3, 4]) { let sum = 0; out.ttk[s] = []; for (const k of bosses[s]) { dng.enemies.length = 0; dng.spawnEnemy(k, 240, 120); const e = dng.enemies[0]; const t = e.maxHp / dps4; out.ttk[s].push([+t.toFixed(1), bal.BOSS_EXPECTED[k].band]); sum += t; } total[s] = +sum.toFixed(0); }
    out.total = total;
    // Normalspiel: Faktor 1 (kein Trial)
    const dn = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dn.startRun(1); dn.spawnEnemy('boss_chrono_sentinel', 240, 120);
    out.normalHp = dn.enemies[0].maxHp; out.factor = wt.trialBossHpFactor('boss_chrono_sentinel'); out.factorS1 = wt.trialBossHpFactor('boss_breacher');
    out.badges = [wt.getTrialBadge(1, true, 599), wt.getTrialBadge(1, true, 700), wt.getTrialBadge(1, true, 900), wt.getTrialBadge(4, true, 779), wt.getTrialBadge(4, true, 1019)];
    return out;
  });
  console.log(JSON.stringify(r));
  assert.ok(r.isTrial);
  assert.deepStrictEqual(r.par, { 1: { gold: 600, silver: 840 }, 2: { gold: 660, silver: 900 }, 3: { gold: 720, silver: 960 }, 4: { gold: 780, silver: 1020 } });
  for (const s of [1, 2, 3, 4]) r.ttk[s].forEach(([t, band], i) => assert.ok(t >= band[0] && t <= band[1] * 1.1, `Prüfung S${s} Boss ${i + 1}: ${t}s außerhalb ${band}`));
  for (const s of [1, 2, 3, 4]) assert.ok(r.total[s] >= 100 && r.total[s] <= 140, `Boss-Zeit gesamt S${s}: ${r.total[s]}`);
  assert.ok(r.factor < 0.5 && r.factorS1 > 0.8, `Faktoren ${r.factor} / ${r.factorS1}`);
  assert.ok(r.normalHp >= 18000, 'Normalspiel: volle Boss-HP ' + r.normalHp);
  assert.deepStrictEqual(r.badges, ['gold', 'silver', 'bronze', 'gold', 'silver']);
  console.log('M10C PHASE10 OK');
};
