// Vollständige Cutscene-Suite (Teil A + Teil B):
// - 2-Szenen-Allflug (Tiefraum mit echtem 3/4-Schräglagen-Sprite + Einflug in die Schleuse)
// - In-Map Drop-Pod-Landung & Aussteigen im Dungeon-Startraum (+ offene Kapsel bleibt stehen)
// - In-Map Teleporter-Extraktion → Rückflug nach Port Solaris
// - In-Map Med-Evac-Drohnen-Bergung (0 HP) → Notflug nach Port Solaris
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

  // 1. 2-Szenen-Sektor-Anflug (Szene 1: Tiefraum diagonal · Szene 2: Einflug in die Schleuse)
  await page.evaluate(() => {
    window.__game.launchSectorWithCutscene(1, false);
  });
  for (const [label, sec] of [
    ['cutscene_deepspace', 0.82],
    ['cutscene_approach_entry', 2.55],
  ]) {
    await page.evaluate((s) => {
      const g = window.__game;
      g.approachCutscene.seek(s);
      g.approachCutscene.render(g.ctx);
    }, sec);
    await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  }

  // 2. Natürliches Ende des Anflugs → In-Map Drop-Pod-Landung im echten Dungeon-Startraum!
  await page.evaluate(() => window.__game.approachCutscene.seek(4.34));
  const mapLandActive = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && !g.mapCutscene; i++) await new Promise((r) => setTimeout(r, 40));
    g.transitionAlpha = 0;
    g.transitionDir = 0;
    return {
      scene: g.activeScene,
      mode: g.mapCutscene?.config.mode,
      playerHidden: g.dungeonScene?.hidePlayerForCutscene,
    };
  });
  assert.deepStrictEqual(
    mapLandActive,
    { scene: 'dungeon', mode: 'land', playerHidden: true },
    JSON.stringify(mapLandActive),
  );

  // Screenshot mitten im Aussteigen aus der geöffneten Absetzkapsel auf der echten Map!
  await page.evaluate(() => {
    const g = window.__game;
    g.mapCutscene.seek(0.92);
    g.dng.render(g.ctx, g.input);
    g.mapCutscene.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_map_land.png') });

  // Drop-Pod-Landung beenden → Spieler sichtbar, geöffnete Kapsel bleibt im Startraum stehen!
  await page.evaluate(() => window.__game.mapCutscene?.seek(1.31));
  const afterLand = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && g.mapCutscene !== null; i++) await new Promise((r) => setTimeout(r, 40));
    return {
      playerHidden: g.dungeonScene?.hidePlayerForCutscene,
      hasLandedPod: !!g.dungeonScene?.landedPod,
      hudVisible: document.getElementById('hud-layer')?.style.visibility !== 'hidden',
    };
  });
  assert.deepStrictEqual(
    afterLand,
    { playerHidden: false, hasLandedPod: true, hudVisible: true },
    JSON.stringify(afterLand),
  );

  // 3. In-Map Teleporter-Extraktion direkt auf der Dungeon-Map!
  await page.evaluate(() => {
    window.__game.handleReturnFromDungeon({
      victory: true,
      reason: 'warp',
      sector: 1,
      floorReached: 1,
      roomsCleared: 3,
      enemiesDefeated: 6,
      itemsSaved: 3,
      itemsLost: 0,
      warpedToChest: [],
      shatteredItems: [],
    });
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.mapCutscene?.seek(0.55);
    g.dng.render(g.ctx, g.input);
    g.mapCutscene?.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_map_extract.png') });
  // Nach Ende der Map-Extraktion startet automatisch der Weltraum-Rückflug nach Port Solaris
  await page.evaluate(() => window.__game.mapCutscene?.seek(1.04));
  const afterMapExtract = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && !g.returnCutscene; i++) await new Promise((r) => setTimeout(r, 40));
    const mode = g.returnCutscene?.config.mode;
    g.returnCutscene.skip();
    for (let i = 0; i < 60 && (g.returnCutscene !== null || g.activeScene !== 'hangar'); i++) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (g.ui.modalOpen) g.ui.closeModal();
    return { mode, scene: g.activeScene };
  });
  assert.deepStrictEqual(afterMapExtract, { mode: 'extract', scene: 'hangar' }, JSON.stringify(afterMapExtract));

  // 4. In-Map Med-Evac-Drohnen-Rettung (0 HP direkt auf der Dungeon-Map!)
  await page.evaluate(() => {
    const g = window.__game;
    g.activeScene = 'dungeon';
    g.dng.startRun(2);
    g.handleReturnFromDungeon({
      victory: false,
      reason: 'defeat',
      sector: 2,
      floorReached: 1,
      roomsCleared: 2,
      enemiesDefeated: 4,
      itemsSaved: 0,
      itemsLost: 2,
      warpedToChest: [],
      shatteredItems: [],
    });
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.mapCutscene?.seek(0.76);
    g.dng.render(g.ctx, g.input);
    g.mapCutscene?.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_map_rescue.png') });
  await page.evaluate(() => window.__game.mapCutscene?.seek(1.49));
  await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && !g.returnCutscene; i++) await new Promise((r) => setTimeout(r, 40));
    g.returnCutscene?.seek(0.75);
    g.returnCutscene?.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_return_rescue_p1.png') });
  await page.evaluate(() => {
    const g = window.__game;
    g.returnCutscene?.seek(2.25);
    g.returnCutscene?.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_return_rescue_p2.png') });
  const afterMapRescue = await page.evaluate(async () => {
    const g = window.__game;
    const mode = g.returnCutscene?.config.mode;
    g.returnCutscene?.skip();
    for (let i = 0; i < 60 && (g.returnCutscene !== null || g.activeScene !== 'backroom'); i++) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (g.ui.modalOpen) g.ui.closeModal();
    return { mode, scene: g.activeScene };
  });
  assert.deepStrictEqual(afterMapRescue, { mode: 'rescue', scene: 'backroom' }, JSON.stringify(afterMapRescue));

  // 5. Visuelle Prüfung: Neue seitliche Schiffe im Hangar (geparkt + Aussteigen über Rampe) & Aufwachen in der Koje
  await page.evaluate(() => {
    const g = window.__game;
    g.state.sector1Cleared = true;
    g.state.sector2Cleared = true;
    g.state.sector3Cleared = true;
    g.activeScene = 'hangar';
    g.hangarScene.onEnter('hub', 1);
    g.transitionAlpha = 0;
    g.transitionDir = 0;
    g.hangarScene.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_hangar_docked.png') });

  await page.evaluate(() => {
    const g = window.__game;
    g.hangarScene.startDisembark(1);
    g.hangarScene.update(0.95, g.input);
    g.hangarScene.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_hangar_disembark.png') });

  await page.evaluate(() => {
    const g = window.__game;
    g.activeScene = 'backroom';
    g.backroomScene.onEnter('rescue');
    g.backroomScene.update(0.75, g.input);
    g.backroomScene.render(g.ctx);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_backroom_wakeup.png') });

  console.log('CUTSCENE FULL IN-MAP + SPACE + HANGAR + WAKEUP OK');
};
