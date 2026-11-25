module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { getCurrentWeeklyTrial } = await import('/src/systems/weeklyTrial.ts');
    const out = { sectors: {} };
    const orig = Math.random;
    const mk = () => { const gs = new GameState(); const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); return { gs, dng }; };
    for (const sec of [1, 2, 3, 4, 5]) {
      const { dng, gs } = mk();
      dng.startRun(sec); const a = JSON.stringify([...dng.floor.rooms.keys()].concat([...dng.floor.rooms.values()].map((r) => r.tileSeed)));
      dng.startRun(sec); const b = JSON.stringify([...dng.floor.rooms.keys()].concat([...dng.floor.rooms.values()].map((r) => r.tileSeed)));
      out.sectors[sec] = { differ: a !== b, trial: dng.isWeeklyTrial, active: gs.activeTrial };
    }
    const { dng, gs } = mk();
    const info = getCurrentWeeklyTrial();
    dng.startWeeklyTrial(info);
    dng.startEndlessRift();
    out.endless = { trial: dng.isWeeklyTrial, endless: dng.isEndlessRift, active: gs.activeTrial, depth: dng.riftDepth, mut: dng.activeRiftMutator !== null };
    dng.startWeeklyTrial(info); dng.startRun(5);
    out.omega = { trial: dng.isWeeklyTrial, sector: dng.currentSector, floor: dng.currentFloor };
    // normal run keeps companion/infusion behaviour
    const c = mk(); c.gs.unlockedCompanions.puck = true; c.gs.equippedCompanion = 'puck'; c.gs.unlockedWeapons.blade = true; c.gs.unlockedInfusions.blade = ['solar_burn']; c.gs.weaponInfusions.blade = 'solar_burn';
    c.dng.startRun(1); out.normalComp = [c.dng.activeCompanion, c.gs.getActiveInfusion()];
    out.randomRestored = Math.random === orig;
    // v9 save migration
    const g = new GameState(); g.credits = 777; g.day = 9; g.sector1Cleared = true;
    const v9 = JSON.parse(g.exportSaveJson()); v9.version = 9; for (const k of ['ghostGreeting', 'weeklyTrial', 'trialBadgeHistory']) delete v9[k];
    const g2 = new GameState(); const imp = g2.importSaveJson(JSON.stringify(v9));
    out.mig = [imp.ok, g2.credits, g2.day, g2.weeklyTrial, g2.ghostGreeting, JSON.parse(g2.exportSaveJson()).version];
    // normal flow: stats not normalised outside trial
    const hi = new GameState(); hi.upgrades.blade = 7; out.normalStats = hi.getStats().bladeDamage;
    // achievements count
    const comp = await import('/src/data/companions.ts'); out.achCount = comp.ACHIEVEMENT_DEFS.length;
    return out;
  });
  console.log(JSON.stringify(r));
  const ok = Object.values(r.sectors).every((x) => x.differ && !x.trial && x.active === null) && !r.endless.trial && r.endless.endless && r.endless.active === null && r.endless.depth === 1 &&
    !r.omega.trial && r.omega.sector === 5 && r.normalComp[0] === 'puck' && r.normalComp[1] === 'solar_burn' && r.randomRestored && r.mig[0] && r.mig[1] === 777 && r.mig[3] === null && r.mig[5] === 11 && r.normalStats === 162 && r.achCount === 18;
  if (!ok) throw new Error('regression assert failed');
  console.log('REGRESSION OK');
};
