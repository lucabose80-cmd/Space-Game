// Cutscene-Ausbau 2: Hafenverkehr an Port Solaris, Rolltor-Cutscene (Laden öffnen/schließen), Begleiter-Rettung
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

module.exports = async ({ page }) => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const shot = (n) => page.screenshot({ path: path.join(outDir, n) });

  await page.evaluate(async () => { await window.__game.dungeonReady; });

  // 1. Startscreen: Hafenverkehr aktiv (mehrere Frames, Schiffe bewegen sich)
  await page.waitForTimeout(1800);
  const trafficOnTitle = await page.evaluate(() => !!window.__game.titleBackdrop.traffic);
  assert.ok(trafficOnTitle, 'Startscreen hat Hafenverkehr');
  await shot('traffic_title_a.png');
  await page.waitForTimeout(2500);
  await shot('traffic_title_b.png');

  await page.evaluate(() => { window.__game.ui.hideTitle?.(); });

  // 2. Intro-Panel 2 (Port Solaris) mit Verkehr
  await page.evaluate(() => {
    const g = window.__game;
    g.state.seenCutscenes = [];
    g.playPanelCutscene('intro_arrival');
    g.storyPanelCutscene?.seek(1, 3.0);
  });
  await page.waitForTimeout(250);
  await shot('traffic_intro_p2.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // 3. Rettungs-Cutscene Pip: Dialog → Hochziehen → Rückflug
  for (const who of ['pip', 'mina']) {
    await page.evaluate((w) => {
      const g = window.__game;
      g.state.seenCutscenes = [];
      g.transitionDir = 0; g.transitionAlpha = 0;
      g.playRescueCutscene(w);
      g.rescueCutscene.seek(2.5);
    }, who);
    await page.waitForTimeout(200);
    await shot(`rescue_${who}_dialog.png`);
    await page.evaluate(() => window.__game.rescueCutscene.seek(10.0 - 0.0));
    await page.waitForTimeout(150);
    await shot(`rescue_${who}_a.png`);
    const info = await page.evaluate(() => { const r = window.__game.rescueCutscene; return { t: r ? 'active' : 'gone' }; });
    assert.strictEqual(info.t, 'active');
    await page.evaluate(() => window.__game.rescueCutscene.seek(11.6));
    await page.waitForTimeout(150);
    await shot(`rescue_${who}_b.png`);
    await page.evaluate(() => window.__game.rescueCutscene.seek(13.4));
    await page.waitForTimeout(150);
    await shot(`rescue_${who}_c.png`);
    await page.evaluate(() => window.__game.rescueCutscene.seek(14.8));
    await page.waitForTimeout(150);
    await shot(`rescue_${who}_home.png`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const done = await page.evaluate((w) => ({ active: window.__game.rescueCutscene !== null, seen: window.__game.state.hasSeenCutscene('rescue_' + w) }), who);
    assert.deepStrictEqual(done, { active: false, seen: true }, JSON.stringify(done));
  }

  // 4. Einzug im Hub läuft direkt (die Befreiung + Abholung passiert im Dungeon-Käfig-Raum)
  await page.evaluate(() => {
    const g = window.__game;
    g.state.seenCutscenes = ['intro_arrival'];
    g.state.sector1Cleared = true; g.state.sector2Cleared = true;
    for (const id of ['celebration_s1', 'celebration_s2', 'story_mina_arrives']) g.state.markCutsceneSeen(id);
    g.state.rescuedCrew = ['mina', 'pip'];
    g.transitionDir = 0; g.transitionAlpha = 0;
    g.activeScene = 'hub'; g.ui.currentScene = 'hub';
    g.checkPendingHubCutscenes();
  });
  const order1 = await page.evaluate(() => ({ rescue: window.__game.rescueCutscene !== null, hub: window.__game.hubCutscene !== null }));
  assert.deepStrictEqual(order1, { rescue: false, hub: true }, JSON.stringify(order1));
  await page.evaluate(() => { const g = window.__game; g.hubCutscene?.dispose(); g.hubCutscene = null; g.setHudVisible(true); });

  // 4b. Abholung im echten Käfig-Raum (Overlay über dem Dungeon) für alle vier Begleiter
  for (const who of ['mina', 'pip', 'ping', 'midnight']) {
    await page.evaluate(async (w) => {
      const g = window.__game;
      const dng = await g.dungeonReady;
      g.state.seenCutscenes = [];
      g.transitionDir = 0; g.transitionAlpha = 0;
      g.activeScene = 'dungeon'; g.ui.currentScene = 'dungeon';
      dng.startRun({ mina: 1, pip: 2, ping: 3, midnight: 4 }[w]);
      g.playRescueCutscene(w, undefined, { mode: 'pickup', screenX: 240, screenY: 170 });
      g.rescueCutscene.seek(2.2);
    }, who);
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => window.__game.rescueCutscene.overDungeon), 'pickup = Overlay');
    await shot(`pickup_${who}.png`);
    await page.waitForTimeout(450);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const pd = await page.evaluate((w) => ({ active: window.__game.rescueCutscene !== null, seen: window.__game.state.hasSeenCutscene('rescue_' + w) }), who);
    assert.deepStrictEqual(pd, { active: false, seen: true }, JSON.stringify(pd));
  }

  // 5. Rolltor (Laden öffnen/schließen)
  await page.evaluate(() => {
    const g = window.__game;
    g.hubCutscene?.dispose(); g.hubCutscene = null; g.setHudVisible(true);
    g.transitionDir = 0; g.transitionAlpha = 0;
    g.activeScene = 'shop'; g.ui.currentScene = 'shop'; g.shopScene.onEnter('default');
    g.playShiftCutscene({ mode: 'open' });
    g.shiftCutscene.seek(0.4);
  });
  await page.waitForTimeout(120);
  await shot('shift_open_a.png');
  await page.evaluate(() => window.__game.shiftCutscene.seek(1.2));
  await page.waitForTimeout(120);
  await shot('shift_open_b.png');
  await page.evaluate(() => {
    const g = window.__game;
    g.shiftCutscene = null; g.shiftCutsceneOnDone = null;
    g.playShiftCutscene({ mode: 'close', itemsSold: 7, credits: 1240, nextLabel: 'MORGEN BRICHT AN · TAG 4' });
    g.shiftCutscene.seek(0.7);
  });
  await page.waitForTimeout(120);
  await shot('shift_close_a.png');
  await page.evaluate(() => window.__game.shiftCutscene.seek(1.6));
  await page.waitForTimeout(120);
  await shot('shift_close_b.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.strictEqual(await page.evaluate(() => window.__game.shiftCutscene), null);

  // 6. Weiterspielen-Anflug & Rückflug mit Verkehr
  await page.evaluate(() => {
    const g = window.__game;
    g.playShiftCutscene && (g.shiftCutscene = null);
    g.returnCutscene = null;
  });
};
