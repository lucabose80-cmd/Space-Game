module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { getCurrentWeeklyTrial } = await import('/src/systems/weeklyTrial.ts');
    const out = {};
    const orig = Math.random;
    const mk = (ng) => {
      const gs = new GameState(); gs.ngPlusLevel = ng; gs.sector1Cleared = true; gs.credits = 500;
      gs.inventory.cargo[0] = { itemId: 'scrap_coil', qty: 3 };
      gs.equippedCompanion = null;
      const summaries = [];
      const dng = new DungeonScene(gs, { onReturnToHub: (s) => summaries.push(s), onToast: () => {}, onHudDirty: () => {} });
      return { gs, dng, summaries };
    };
    const info = { ...getCurrentWeeklyTrial(new Date('2026-11-25T12:00:00Z')) };
    info.sector = 1; info.mutator = 'armored';
    const A = mk(0), B = mk(3);
    const sigs = [];
    for (const t of [A, B]) {
      const sig = [];
      t.dng.startWeeklyTrial(info); sig.push(JSON.stringify([...t.dng.floor.rooms.entries()]));
      t.dng.startFloor(2, false, 1); sig.push(JSON.stringify([...t.dng.floor.rooms.entries()]));
      t.dng.startFloor(3, false, 1); sig.push(JSON.stringify([...t.dng.floor.rooms.entries()]));
      sigs.push(sig);
    }
    out.restoredRandom = Math.random === orig;
    out.floorsEqual = sigs[0].every((x, i) => x === sigs[1][i]);
    out.floorsDifferAcrossFloors = sigs[0][0] !== sigs[0][1];
    out.noRiftPortals = !/riftPortal":\{/.test(sigs[0].join()) && !/isRiftChamber":true/.test(sigs[0].join());
    // enemy hp parity (NG+0 vs NG+3)
    const hp = [];
    for (const t of [A, B]) { t.dng.startWeeklyTrial(info); t.dng.enemies.length = 0; t.dng.spawnEnemy('boss_breacher', 200, 120); hp.push(t.dng.enemies[0].maxHp); t.dng.enemies[0].mutator !== undefined; }
    out.hp = hp; out.hpEqual = hp[0] === hp[1];
    out.mutator = A.dng.enemies[0].mutator;
    out.stats = [A.gs.getStats().maxHp, B.gs.getStats().bladeDamage];
    // boss kill -> no progression
    const T = A; T.dng.startWeeklyTrial(info);
    const before = JSON.stringify({ c: T.gs.credits, inv: T.gs.inventory, b: T.gs.bossDefeatedCount, s1: T.gs.sector1Cleared, te: T.gs.totalEnemiesDefeated, bd: T.gs.breacherDefeated, rec: T.gs.records.bestSectorClearSec });
    T.gs.sector1Cleared = false; // prove it is not set by the kill
    T.dng.enemies.length = 0; T.dng.spawnEnemy('boss_breacher', 200, 120);
    const boss = T.dng.enemies[0];
    T.dng.onEnemyKilled(boss);
    out.afterBoss = { floorBossDefeated: T.dng.floorBossDefeated, s1: T.gs.sector1Cleared, b: T.gs.bossDefeatedCount, breacher: T.gs.breacherDefeated, credits: T.gs.credits, drops: T.dng.drops.length, te: T.gs.totalEnemiesDefeated };
    T.gs.sector1Cleared = true;
    // loot drop blocked
    T.dng.spawnLootDrop(100, 100, 'scrap_coil'); out.dropsAfterSpawn = T.dng.drops.length;
    // defeat: cargo untouched
    T.dng.startWeeklyTrial(info);
    T.dng.triggerDefeat();
    out.defeat = { n: T.summaries.length, s: T.summaries[0]?.isWeeklyTrial, outcome: T.summaries[0]?.trialOutcome, cargo: T.gs.inventory.cargo[0], active: T.gs.activeTrial, isTrial: T.dng.isWeeklyTrial };
    // victory
    const V = B; V.dng.startWeeklyTrial(info);
    V.dng.startFloor(3, false, 1); V.dng.floorBossDefeated = true; V.dng.runElapsedSec = 630;
    V.dng.triggerSafeWarp('boss_victory', false);
    const sm = V.summaries[0];
    out.victory = { v: sm?.victory, outcome: sm?.trialOutcome, badge: sm?.trialResult?.badge, best: sm?.trialResult?.isNewBest, time: V.gs.weeklyTrial?.bestTimeSec, cargo: V.gs.inventory.cargo[0], credits: V.gs.credits, hist: V.gs.trialBadgeHistory };
    // left extraction on floor 1 = abort
    const X = mk(0); X.dng.startWeeklyTrial(info); X.dng.triggerSafeWarp('warp', true);
    out.abort = { outcome: X.summaries[0]?.trialOutcome, credits: X.gs.credits, victory: X.summaries[0]?.victory };
    // normal run resets
    const N = mk(0); N.dng.startWeeklyTrial(info); N.dng.finished = true; N.dng.startRun(1);
    out.normalAfter = [N.dng.isWeeklyTrial, N.gs.activeTrial, N.dng.activeCompanion];
    // render trial dungeon
    const R = mk(0); R.gs.unlockedCompanions.puck = true; R.gs.equippedCompanion = 'puck';
    R.dng.startWeeklyTrial(info);
    out.companionInTrial = R.dng.activeCompanion;
    R.dng.roomFade = 0; R.dng.runElapsedSec = 83;
    const { InputManager } = await import('/src/engine/input.ts');
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    const inp = new InputManager(canvas);
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    R.dng.render(ctx, inp);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/p4b_trial.png` });
  const ok = r.restoredRandom && r.floorsEqual && r.floorsDifferAcrossFloors && r.noRiftPortals && r.hpEqual && r.mutator === 'armored' &&
    r.afterBoss.floorBossDefeated && !r.afterBoss.s1 && r.afterBoss.b === 0 && !r.afterBoss.breacher && r.afterBoss.credits === 500 && r.afterBoss.drops === 0 && r.dropsAfterSpawn === 0 &&
    r.defeat.n === 1 && r.defeat.s && r.defeat.outcome === 'defeat' && r.defeat.cargo?.qty === 3 && r.defeat.active === null && !r.defeat.isTrial &&
    r.victory.v && r.victory.outcome === 'victory' && r.victory.badge === 'silver' && r.victory.time === 630 && r.victory.cargo?.qty === 3 && r.victory.credits === 500 &&
    r.abort.outcome === 'abort' && r.abort.credits === 500 && !r.abort.victory && r.normalAfter[0] === false && r.normalAfter[1] === null && r.companionInTrial === null;
  if (!ok) throw new Error('P4b assert failed');
  console.log('PHASE4b OK');
};
