module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const wt = await import('/src/systems/weeklyTrial.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const out = {};
    out.completedBeatsIncomplete = wt.computeTrialScore({ completed: true, timeSec: 5000, floorReached: 3, roomsCleared: 20 }) < wt.computeTrialScore({ completed: false, timeSec: 10, floorReached: 3, roomsCleared: 900 });
    out.fasterBetter = wt.computeTrialScore({ completed: true, timeSec: 300, floorReached: 3, roomsCleared: 1 }) < wt.computeTrialScore({ completed: true, timeSec: 301, floorReached: 3, roomsCleared: 1 });
    out.deeperBetter = wt.computeTrialScore({ completed: false, timeSec: 1, floorReached: 2, roomsCleared: 1 }) < wt.computeTrialScore({ completed: false, timeSec: 1, floorReached: 1, roomsCleared: 9 });
    out.badges = [wt.getTrialBadge(1, true, 400), wt.getTrialBadge(1, true, 500), wt.getTrialBadge(1, true, 900), wt.getTrialBadge(1, false, 100)];
    const a = wt.getCurrentWeeklyTrial(new Date('2026-11-25T10:00:00Z')), b = wt.getCurrentWeeklyTrial(new Date('2026-11-29T23:00:00Z')), c = wt.getCurrentWeeklyTrial(new Date('2026-11-30T00:00:01Z'));
    out.sameWeek = JSON.stringify(a) === JSON.stringify(b); out.nextWeek = a.weekId !== c.weekId; out.info = a;
    const sectors = new Set(); for (let w = 0; w < 30; w++) sectors.add(wt.getCurrentWeeklyTrial(new Date(Date.UTC(2026, 0, 5 + w * 7))).sector);
    out.sectorsSeen = sectors.size;
    // stats normalisation
    const mk = (lvl) => { const g = new GameState(); g.upgrades.blade = lvl; g.upgrades.suit = lvl; g.upgrades.spear = lvl; g.activeAlchemyBuff = 'solar_espresso'; g.weaponInfusions.blade = 'none'; return g; };
    const lo = mk(0), hi = mk(7);
    lo.activeTrial = a; hi.activeTrial = a;
    const sl = lo.getStats(), sh = hi.getStats();
    out.normStats = sl.bladeDamage === sh.bladeDamage && sl.maxHp === sh.maxHp && sl.spearDamage === sh.spearDamage && sl.bladeDamage === 70 && sl.maxHp === 320;
    hi.activeTrial = null; out.unnormHigher = hi.getStats().bladeDamage > 70;
    // infusion guard
    const g = new GameState(); g.unlockedWeapons.blade = true; g.unlockedInfusions.blade = ['solar_burn']; g.weaponInfusions.blade = 'solar_burn';
    out.inf1 = g.getActiveInfusion(); g.activeTrial = a; out.inf2 = g.getActiveInfusion();
    g.activeTrial = null;
    // record results
    const base = { weekId: '2026-W48', sector: 2, floorReached: 3, roomsCleared: 10 };
    const r1 = g.recordWeeklyTrialResult({ ...base, completed: false, timeSec: 100, floorReached: 1, roomsCleared: 3 });
    const r2 = g.recordWeeklyTrialResult({ ...base, completed: true, timeSec: 700 }); // sector2 silver<720 → silver
    const r3 = g.recordWeeklyTrialResult({ ...base, completed: true, timeSec: 800 }); // worse
    const r4 = g.recordWeeklyTrialResult({ ...base, completed: true, timeSec: 470 }); // gold
    out.rec = [r1.isNewBest, r2.isNewBest, r2.badge, r3.isNewBest, r4.isNewBest, r4.badge, g.weeklyTrial.attempts, g.weeklyTrial.bestTimeSec];
    out.hist = g.trialBadgeHistory; out.uploaded = g.weeklyTrial.uploaded;
    out.ach = g.unlockedAchievements.filter((x) => x.startsWith('trial'));
    const r5 = g.recordWeeklyTrialResult({ weekId: '2026-W49', sector: 3, completed: true, timeSec: 900, floorReached: 3, roomsCleared: 5 });
    out.newWeek = [g.weeklyTrial.weekId, g.weeklyTrial.attempts, r5.badge, g.trialBadgeHistory['2026-W48'], g.trialBadgeHistory['2026-W49']];
    out.counts = g.getTrialBadgeCounts();
    // roundtrip
    const g2 = new GameState(); g2.importSaveJson(g.exportSaveJson());
    out.rt = g2.weeklyTrial.weekId === '2026-W49' && g2.trialBadgeHistory['2026-W48'] === 'gold';
    out.activeTrialNotSaved = JSON.parse(g.exportSaveJson()).activeTrial === undefined;
    // leaderboard entry has no undefined (Firestore rejects undefined)
    const { firebaseService } = await import('/src/services/firebaseService.ts');
    const e = firebaseService.buildLeaderboardEntry(g, 'u', 'Test');
    out.undef = Object.entries(e).filter(([, v]) => v === undefined).map(([k]) => k);
    out.entryTrial = [e.trialBadges, e.bestTrialWeekId, e.bestTrialTimeSec];
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.completedBeatsIncomplete && r.fasterBetter && r.deeperBetter && r.badges.join() === 'gold,silver,bronze,' && r.sameWeek && r.nextWeek && r.sectorsSeen >= 3 && r.normStats && r.unnormHigher && r.inf1 === 'solar_burn' && r.inf2 === 'none' &&
    r.rec.join() === 'true,true,silver,false,true,gold,4,470' && r.hist['2026-W48'] === 'gold' && r.uploaded === false && r.ach.length === 2 && r.newWeek.join() === '2026-W49,1,bronze,gold,bronze' && r.rt && r.undef.length === 0;
  if (!ok) throw new Error('P4a assert failed');
  console.log('PHASE4a OK');
};
