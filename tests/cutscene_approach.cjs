// Cutscene-Suite: Geparkte Schiffe im Hangar, Kurvenflug + Drop-Pod (Anflug),
// Extraktion & verletzte Notfall-Bergung (Rückkehr nach Port Solaris) + Skip.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

module.exports = async ({ page }) => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  await page.evaluate(async () => {
    const g = window.__game;
    await g.dungeonReady;
    g.ui.hideTitle?.();
  });

  // 1. Sektor-1-Anflug starten: Kurvenflug (Banking) + Titelkarte + Absetzkapsel (Drop-Pod)
  const started = await page.evaluate(() => {
    const g = window.__game;
    g.launchSectorWithCutscene(1, false);
    const hud = document.getElementById('hud-layer');
    return {
      active: !!g.approachCutscene,
      sector: g.approachCutscene?.config.sector,
      hudHidden: hud?.style.visibility === 'hidden',
    };
  });
  assert.deepStrictEqual(started, { active: true, sector: 1, hudHidden: true }, JSON.stringify(started));

  for (const [label, sec] of [
    ['cutscene_s1_curve', 0.78],
    ['cutscene_s1_pod', 3.42],
  ]) {
    await page.evaluate((s) => {
      const g = window.__game;
      g.approachCutscene.seek(s);
      g.approachCutscene.render(g.ctx);
    }, sec);
    await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  }

  // 2. Skip per Tastendruck (Space) → landet sauber im Dungeon
  await page.keyboard.press('Space');
  const afterSkip = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && g.activeScene !== 'dungeon'; i++) await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 40 && g.transitionDir !== 0; i++) await new Promise((r) => setTimeout(r, 40));
    const hud = document.getElementById('hud-layer');
    return {
      cutscene: g.approachCutscene,
      scene: g.activeScene,
      sector: g.dungeonScene?.currentSector,
      hudVisible: hud?.style.visibility !== 'hidden',
    };
  });
  assert.deepStrictEqual(
    afterSkip,
    { cutscene: null, scene: 'dungeon', sector: 1, hudVisible: true },
    JSON.stringify(afterSkip),
  );

  // 3. Extraktions-Cutscene (freiwillige Rückkehr → Port Solaris)
  await page.evaluate(() => {
    const g = window.__game;
    g.handleReturnFromDungeon({
      victory: true,
      reason: 'warp',
      sector: 1,
      floorReached: 2,
      roomsCleared: 5,
      enemiesDefeated: 12,
      itemsSaved: 4,
      itemsLost: 0,
      warpedToChest: [],
      shatteredItems: [],
    });
  });
  for (const [label, sec] of [
    ['cutscene_extract_p1', 0.58],
    ['cutscene_extract_solaris', 2.45],
  ]) {
    await page.evaluate((s) => {
      const g = window.__game;
      g.returnCutscene.seek(s);
      g.returnCutscene.render(g.ctx);
    }, sec);
    await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  }
  await page.evaluate(() => window.__game.returnCutscene.skip());
  const afterExtract = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && (g.returnCutscene !== null || g.activeScene !== 'hangar'); i++) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (g.ui.modalOpen) g.ui.closeModal();
    return { scene: g.activeScene, ret: g.returnCutscene };
  });
  assert.deepStrictEqual(afterExtract, { scene: 'hangar', ret: null }, JSON.stringify(afterExtract));

  // 4. Notfall-Bergung (0 HP / defeat → Med-Evac-Drohne → Port Solaris)
  await page.evaluate(() => {
    const g = window.__game;
    g.handleReturnFromDungeon({
      victory: false,
      reason: 'defeat',
      sector: 2,
      floorReached: 1,
      roomsCleared: 2,
      enemiesDefeated: 5,
      itemsSaved: 0,
      itemsLost: 3,
      warpedToChest: [],
      shatteredItems: [],
    });
  });
  for (const [label, sec] of [
    ['cutscene_rescue_p1', 0.92],
    ['cutscene_rescue_solaris', 2.65],
  ]) {
    await page.evaluate((s) => {
      const g = window.__game;
      g.returnCutscene.seek(s);
      g.returnCutscene.render(g.ctx);
    }, sec);
    await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  }
  await page.evaluate(() => window.__game.returnCutscene.seek(3.94));
  const afterRescue = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && g.returnCutscene !== null; i++) await new Promise((r) => setTimeout(r, 40));
    const modal = g.ui.modalOpen;
    if (modal) g.ui.closeModal();
    return { scene: g.activeScene, ret: g.returnCutscene, modal };
  });
  assert.deepStrictEqual(afterRescue, { scene: 'hangar', ret: null, modal: true }, JSON.stringify(afterRescue));

  console.log('CUTSCENE FULL SUITE OK');
};
