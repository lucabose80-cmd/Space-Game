// Perf Teil 3: Dungeon-Code lädt nach dem Start nach; Run-Start funktioniert danach normal.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const d = await g.dungeonReady;
    return {
      same: d === g.dungeonScene,
      hasRun: typeof d.startRun === 'function' && typeof d.update === 'function',
      scene: g.activeScene,
    };
  });
  assert.ok(r.same && r.hasRun, JSON.stringify(r));
  assert.notStrictEqual(r.scene, 'dungeon', 'ohne Run-Start bleibt der Dungeon inaktiv');
  // Echter Run-Start über den Szenenübergang (Fade → startRun → Dungeon-Update/-Render laufen ohne Fehler)
  const r2 = await page.evaluate(async () => {
    const g = window.__game;
    g.ui.hideTitle?.(); g.pendingDungeonSector = 1; g.pendingEndlessRift = false; g.pendingWeeklyTrial = null;
    g.transitionTo('dungeon', 'hangar');
    for (let i = 0; i < 60 && g.activeScene !== 'dungeon'; i++) await new Promise((res) => setTimeout(res, 50));
    await new Promise((res) => setTimeout(res, 300));
    const d = g.dungeonScene;
    return { scene: g.activeScene, room: !!d.currentRoom, sector: d.currentSector };
  });
  assert.deepStrictEqual([r2.scene, r2.room, r2.sector], ['dungeon', true, 1], JSON.stringify(r2));
  console.log('T8 DUNGEON LAZY OK');
};
