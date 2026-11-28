// Cutscene-Suite Teil C:
// - Spielstart-Intro (4-Panel-Kino-Cutscene, Fortschritt, Skip, Save-Persistenz)
// - Sektor-1-Siegesfeier live auf Port Solaris nach A.E.G.I.S. Leviathan
// - Kaels neue Gehilfin Mina (Einzugs-Cutscene + dauerhaftes Sprite an der 2. Werkbank)
// - Upgrade-Cutscenes (Waffen-Schmieden mit Kael & Mina, Laden-Ausbau, schnelle Stufen-Animation)
// - Kino-Chronik im Logbuch + Geräte-Einstellung „Kurze Cutscenes“
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

  // 1. Spielstart-Intro (4 Panels)
  await page.evaluate(() => {
    const g = window.__game;
    g.state.seenCutscenes = [];
    g.playPanelCutscene('intro_arrival');
    g.storyPanelCutscene?.seek(0, 2.2);
  });
  const introCheck = await page.evaluate(() => {
    const g = window.__game;
    return {
      active: g.storyPanelCutscene !== null,
      id: g.storyPanelCutscene?.id,
      count: g.storyPanelCutscene?.panelCount,
    };
  });
  assert.deepStrictEqual(introCheck, { active: true, id: 'intro_arrival', count: 4 }, JSON.stringify(introCheck));
  await page.screenshot({ path: path.join(outDir, 'cutscene_intro_p1.png') });

  // Panel 3 (Astro-Barter Laden)
  await page.evaluate(() => {
    window.__game.storyPanelCutscene?.seek(2, 2.5);
  });
  await page.screenshot({ path: path.join(outDir, 'cutscene_intro_p3.png') });

  // Überspringen per ESC → wird als gesehen gespeichert
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const introDone = await page.evaluate(() => ({
    active: window.__game.storyPanelCutscene !== null,
    seen: window.__game.state.hasSeenCutscene('intro_arrival'),
  }));
  assert.deepStrictEqual(introDone, { active: false, seen: true }, JSON.stringify(introDone));

  // 2. Sektor-1-Siegesfeier auf Port Solaris nach Leviathan-Sieg
  await page.evaluate(() => {
    const g = window.__game;
    g.state.sector1Cleared = true;
    g.state.refreshStoryChapter(false);
    g.transitionDir = 0;
    g.transitionAlpha = 0;
    g.activeScene = 'hub';
    g.ui.currentScene = 'hub';
    g.hubScene.onEnter('dungeon');
    g.checkPendingHubCutscenes();
    g.hubCutscene?.seek(1, 2.2);
  });
  const celCheck = await page.evaluate(() => ({
    active: window.__game.hubCutscene !== null,
    id: window.__game.hubCutscene?.id,
  }));
  assert.deepStrictEqual(celCheck, { active: true, id: 'celebration_s1' }, JSON.stringify(celCheck));
  await page.screenshot({ path: path.join(outDir, 'cutscene_celebration_s1.png') });

  // Feier beenden
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const celDone = await page.evaluate(() => ({
    active: window.__game.hubCutscene !== null,
    seen: window.__game.state.hasSeenCutscene('celebration_s1'),
  }));
  assert.deepStrictEqual(celDone, { active: false, seen: true }, JSON.stringify(celDone));

  // 3. Kaels Gehilfin Mina: nach der Rettung (P7) → Einzugs-Cutscene + dauerhaft auf der Promenade
  await page.evaluate(() => {
    const g = window.__game;
    g.state.markSceneSeen('kael_c1');
    g.state.rescueCrew('mina'); // P7: Mina erscheint erst nach der Rettung im Dungeon
    g.checkPendingHubCutscenes();
    g.hubCutscene?.seek(1, 2.2);
  });
  const minaCheck = await page.evaluate(() => ({
    present: window.__game.state.isMinaPresent(),
    active: window.__game.hubCutscene !== null,
    id: window.__game.hubCutscene?.id,
  }));
  assert.deepStrictEqual(
    minaCheck,
    { present: true, active: true, id: 'story_mina_arrives' },
    JSON.stringify(minaCheck),
  );
  await page.screenshot({ path: path.join(outDir, 'cutscene_mina_arrives.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  // Dauerhafte Präsenz auf Port Solaris (ohne Overlay)
  await page.evaluate(() => {
    const g = window.__game;
    g.hubScene.playerX = 144;
    g.hubScene.playerY = 152;
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(outDir, 'hub_with_mina.png') });

  // 4. Upgrade-Cutscenes (Waffe geschmiedet mit Kael & Mina + Laden-Ausbau)
  await page.evaluate(() => {
    const g = window.__game;
    g.playUpgradeCutscene({
      kind: 'weapon',
      title: 'PLASMA-HAMMER',
      subtitle: 'Neu geschmiedet · Wechsle jederzeit mit [C]',
      accent: '#fb923c',
      major: true,
      minaPresent: true,
    });
    g.upgradeCutscene?.seek(1.25);
  });
  const upgCheck = await page.evaluate(() => ({
    active: window.__game.upgradeCutscene !== null,
    kind: window.__game.upgradeCutscene?.config.kind,
  }));
  assert.deepStrictEqual(upgCheck, { active: true, kind: 'weapon' }, JSON.stringify(upgCheck));
  await page.screenshot({ path: path.join(outDir, 'cutscene_upgrade_weapon.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // 5. Kino-Chronik im Logbuch + Geräte-Einstellung „Kurze Cutscenes“ (Hilfe-Tab)
  await page.evaluate(() => {
    window.__game.ui.openInventoryModal(false, 'logbook');
  });
  await page.waitForTimeout(80);
  const logbookCheck = await page.evaluate(() => ({
    hasKino: document.body.textContent.includes('KINO-CHRONIK'),
    replayBtns: document.querySelectorAll('[data-replay-cutscene]').length,
  }));
  assert(logbookCheck.hasKino, 'Kino-Chronik fehlt im Logbuch');
  assert(logbookCheck.replayBtns >= 3, `Zu wenige Replay-Buttons: ${logbookCheck.replayBtns}`);

  await page.evaluate(() => {
    window.__game.ui.openInventoryModal(false, 'help');
  });
  await page.waitForTimeout(80);
  const helpCheck = await page.evaluate(() => ({
    shortBtns: document.querySelectorAll('[data-dev-short-cut]').length,
  }));
  assert.strictEqual(helpCheck.shortBtns, 2, 'Kurze-Cutscenes-Schalter fehlt');

  await page.evaluate(() => window.__game.ui.closeModal());

  // 6. ?cutscenelab Teststudio prüfen (saveLocked + Story-/Upgrade-/Flug-Buttons)
  const baseUrl = page.url().split('?')[0];
  await page.goto(`${baseUrl}?cutscenelab`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cutscene-lab-panel', { timeout: 8000 });
  const labCheck = await page.evaluate(() => ({
    saveLocked: window.__game.state.saveLocked === true,
    storyBtns: document.querySelectorAll('[data-lab-story]').length,
    upgBtns: document.querySelectorAll('[data-lab-upg]').length,
    flightBtns: document.querySelectorAll('[data-lab-flight]').length,
  }));
  assert.strictEqual(labCheck.saveLocked, true, 'CutsceneLab muss saveLocked setzen');
  assert(labCheck.storyBtns >= 9, `Story-Buttons im Studio: ${labCheck.storyBtns}`);
  assert(labCheck.upgBtns >= 6, `Upgrade-Buttons im Studio: ${labCheck.upgBtns}`);
  assert(labCheck.flightBtns >= 7, `Flug-Buttons im Studio: ${labCheck.flightBtns}`);
  await page.screenshot({ path: path.join(outDir, 'cutscene_lab_studio.png') });
};
