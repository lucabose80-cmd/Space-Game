// M12 Phase E: Waffen-Arten-Sperre, Trophäen-Relikt „A.E.G.I.S.-Herzlinse“, Hub-Vitrine
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const bal = await import('/src/data/balance.ts');
    const items = await import('/src/data/items.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { HubEvolutionRenderer } = await import('/src/scenes/hubEvolution.ts');
    const wt = await import('/src/systems/weeklyTrial.ts');
    const out = {};
    const rich = () => { const g = new GameState(); g.credits = 99999; return g; };
    out.gateKeys = Object.keys(bal.WEAPON_TYPE_GATES).sort();
    const g = rich();
    out.lockStart = { spear: g.getWeaponTypeLock('spear'), discus: g.getWeaponTypeLock('discus'), hammer: g.getWeaponTypeLock('hammer'), blaster: g.getWeaponTypeLock('blaster'), fists: g.getWeaponTypeLock('fists') };
    out.canSpearLocked = g.canCraftWeapon('spear');
    g.sector1Cleared = true;
    out.lockS1 = { spear: g.getWeaponTypeLock('spear'), discus: g.getWeaponTypeLock('discus') };
    const g2 = new GameState(); g2.records.bestSectorClearSec[2] = 500;
    out.recordCounts = g2.getWeaponTypeLock('discus');
    const g3 = new GameState(); g3.ngPlusLevel = 1;
    out.ngPlus = ['spear', 'discus', 'hammer'].map((w) => g3.getWeaponTypeLock(w));
    out.save = g.save ? 11 : 0;
    // Relikt
    const d = items.getItemDef('trophy_leviathan');
    out.item = { rarity: d.rarity, maxStack: d.maxStack, name: d.name, value: d.baseValue };
    // Sieg: Relikt-Drop nur beim Erstsieg, keine Credits
    const gs = new GameState(); const cb = { onReturnToHub() {}, onToast() {}, onHudDirty() {} };
    const dng = new DungeonScene(gs, cb); dng.startRun(1);
    const credBefore = gs.credits;
    dng.spawnEnemy('boss_leviathan', 240, 120); const e = dng.enemies[0];
    out.trophyBefore = gs.hasLeviathanTrophy();
    dng.drops.length = 0; e.hp = 0; dng.onEnemyKilled ? dng.onEnemyKilled(e) : dng.killEnemy(e);
    out.firstDrops = dng.drops.map((x) => x.itemId).filter((x) => x === 'trophy_leviathan').length;
    out.creditsDelta = gs.credits - credBefore;
    out.trophyAfter = gs.hasLeviathanTrophy();
    dng.enemies.length = 0; dng.spawnEnemy('boss_leviathan', 240, 120); const e2 = dng.enemies[0]; dng.drops.length = 0; e2.hp = 0;
    dng.onEnemyKilled ? dng.onEnemyKilled(e2) : dng.killEnemy(e2);
    out.secondDrops = dng.drops.map((x) => x.itemId).filter((x) => x === 'trophy_leviathan').length;
    // Wochen-Prüfung: keine Belohnung
    const gt = new GameState(); const dt = new DungeonScene(gt, cb);
    dt.startWeeklyTrial(wt.getCurrentWeeklyTrial(new Date('2026-12-09T10:00:00Z')));
    dt.enemies.length = 0; dt.spawnEnemy('boss_leviathan', 240, 120); const et = dt.enemies[0]; et.hp = 0;
    dt.onEnemyKilled ? dt.onEnemyKilled(et) : dt.killEnemy(et);
    out.trial = { drops: dt.drops.length, cleared: gt.sector1Cleared, trophy: gt.hasLeviathanTrophy() };
    // Hub-Vitrine inkl. Fallback
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270; const ctx = canvas.getContext('2d');
    const anchors = { forge: { x: 100, y: 100 }, medbay: { x: 380, y: 100 }, nyxNpc: { x: 300, y: 200 }, techNpc: { x: 150, y: 200 }, guild: { x: 240, y: 90 } };
    const none = new GameState(); const h0 = new HubEvolutionRenderer(none, anchors);
    out.hubBefore = h0.getDrawables(ctx, 1).length;
    const h1 = new HubEvolutionRenderer(g, anchors); h1.spritesEnabled = false;
    out.hubAfter = h1.getDrawables(ctx, 1).length;
    out.hubDrawables = out.hubAfter - out.hubBefore;
    h1.getDrawables(ctx, 1).forEach((x) => x.draw());
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.gateKeys, ['discus', 'hammer', 'spear']);
  assert.ok(r.lockStart.spear?.includes('A.E.G.I.S. Leviathan') && r.lockStart.discus?.includes('Prisma-Archon') && r.lockStart.hammer?.includes('Vulkan-Titan'));
  assert.strictEqual(r.lockStart.blaster, null); assert.strictEqual(r.lockStart.fists, null);
  assert.strictEqual(r.canSpearLocked, false);
  assert.strictEqual(r.lockS1.spear, null); assert.ok(r.lockS1.discus);
  assert.strictEqual(r.recordCounts, null);
  assert.deepStrictEqual(r.ngPlus, [null, null, null]);
  assert.deepStrictEqual(r.item, { rarity: 'epic', maxStack: 1, name: 'A.E.G.I.S.-Herzlinse', value: r.item.value });
  assert.strictEqual(r.trophyBefore, false); assert.strictEqual(r.trophyAfter, true);
  assert.strictEqual(r.firstDrops, 1, 'Erstsieg: genau ein Relikt');
  assert.strictEqual(r.secondDrops, 0, 'Folgesieg: kein weiteres Relikt');
  assert.strictEqual(r.creditsDelta, 0, 'keine Credits');
  assert.deepStrictEqual(r.trial, { drops: 0, cleared: false, trophy: false }, 'Prüfung ohne Belohnung');
  assert.strictEqual(r.hubDrawables, 1, 'Vitrine nur nach Erstsieg');
  console.log('M12 PHASE E OK');
};
