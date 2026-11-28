// Startscreen & Account-Einstieg:
// - Atmosphärischer Startscreen (ohne Save & mit Save-Vorschau)
// - Cloud-Konto-Drawer (Google, Anmelden, Konto erstellen mit Kapitäns-Name)
// - Sicherheitsabfrage bei „Neues Spiel“ mit bestehendem Spielstand
// - Sanfter Übergang in ContinueIntroCutscene (Weiterspielen) + Skip in den Laden
// - Sanfter Übergang in intro_arrival (Neues Spiel)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

module.exports = async ({ page }) => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  // Warten bis HD-Art geladen ist, damit der Startscreen-Backdrop in voller Qualität gerendert wird
  await page.waitForTimeout(450);

  // 1. Frischer Startscreen (ohne lokalen Spielstand)
  const freshState = await page.evaluate(() => ({
    titleVisible: window.__game.ui.titleVisible,
    hasNewBtn: !!document.querySelector('#btn-new-game'),
    hasAccountBtn: !!document.querySelector('#btn-title-account'),
    hasContinueBtn: !!document.querySelector('#btn-continue'),
  }));
  assert.strictEqual(freshState.titleVisible, true, 'Startscreen sollte beim Laden sichtbar sein');
  assert.strictEqual(freshState.hasNewBtn, true, '#btn-new-game fehlt');
  assert.strictEqual(freshState.hasAccountBtn, true, '#btn-title-account fehlt');
  assert.strictEqual(freshState.hasContinueBtn, false, 'Ohne Save darf #btn-continue nicht sichtbar sein');
  await page.screenshot({ path: path.join(outDir, 'title_fresh.png') });

  // 2. Cloud-Konto-Drawer öffnen & auf „Konto erstellen“ umschalten
  await page.click('#btn-title-account');
  await page.waitForSelector('.ts-account-drawer');
  await page.click('[data-ts-authmode="register"]');
  const drawerCheck = await page.evaluate(() => ({
    google: !!document.querySelector('#btn-title-google'),
    captainInput: !!document.querySelector('#input-ts-captain'),
    emailInput: !!document.querySelector('#input-ts-email'),
    passInput: !!document.querySelector('#input-ts-pass'),
  }));
  assert.deepStrictEqual(drawerCheck, {
    google: true,
    captainInput: true,
    emailInput: true,
    passInput: true,
  });
  await page.screenshot({ path: path.join(outDir, 'title_account_drawer.png') });
  await page.click('#btn-title-account-close');

  // 3. Startscreen mit bestehendem Spielstand (Welt-Vorschau + Sicherheitsabfrage)
  await page.evaluate(() => {
    const g = window.__game;
    g.state.captainName = 'Kapitän Nova';
    g.state.day = 7;
    g.state.timeOfDay = 'night';
    g.state.credits = 1450;
    g.state.sector1Cleared = true;
    g.state.sector2Cleared = true;
    g.state.save();
    g.ui.refreshTitle();
  });
  await page.waitForTimeout(150);
  const saveCardCheck = await page.evaluate(() => ({
    hasContinue: !!document.querySelector('#btn-continue'),
    saveCardText: document.querySelector('.ts-save-card')?.textContent ?? '',
  }));
  assert.strictEqual(saveCardCheck.hasContinue, true, 'Mit Save muss #btn-continue sichtbar sein');
  assert.ok(saveCardCheck.saveCardText.includes('Kapitän Nova'), 'Kapitänsname fehlt in der Vorschau');
  assert.ok(saveCardCheck.saveCardText.includes('Tag 7'), 'Tag-Anzeige fehlt in der Vorschau');
  await page.screenshot({ path: path.join(outDir, 'title_with_save.png') });

  // Sicherheitsabfrage bei „Neues Spiel“ prüfen
  await page.click('#btn-new-game');
  await page.waitForSelector('#btn-confirm-new-yes');
  await page.click('#btn-confirm-new-no');

  // 4. „Weiterspielen“ → weicher Übergang in ContinueIntroCutscene → Skip in den Laden
  await page.click('#btn-continue');
  await page.waitForTimeout(550);
  const contActive = await page.evaluate(() => ({
    titleVisible: window.__game.ui.titleVisible,
    continueCutscene: window.__game.continueCutscene !== null,
  }));
  assert.deepStrictEqual(contActive, { titleVisible: false, continueCutscene: true }, JSON.stringify(contActive));
  await page.screenshot({ path: path.join(outDir, 'title_continue_cutscene.png') });

  // Per Escape überspringen → landet sauber in Astro-Barter
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const afterSkip = await page.evaluate(() => ({
    continueCutscene: window.__game.continueCutscene !== null,
    scene: window.__game.activeScene,
    hudVisible: document.getElementById('hud-layer')?.style.visibility !== 'hidden',
  }));
  assert.deepStrictEqual(afterSkip, { continueCutscene: false, scene: 'shop', hudVisible: true });

  // 5. Zurück zum Startscreen → „Neues Spiel“ bestätigen → startet sauber intro_arrival
  await page.evaluate(() => {
    window.__game.ui.showTitle();
  });
  await page.click('#btn-new-game');
  await page.waitForSelector('#btn-confirm-new-yes');
  await page.click('#btn-confirm-new-yes');
  await page.waitForTimeout(550);
  const introCheck = await page.evaluate(() => ({
    titleVisible: window.__game.ui.titleVisible,
    storyId: window.__game.storyPanelCutscene?.id ?? null,
    captain: window.__game.state.captainName,
  }));
  assert.strictEqual(introCheck.titleVisible, false);
  assert.strictEqual(introCheck.storyId, 'intro_arrival');
  assert.strictEqual(introCheck.captain, 'Kapitän Nova', 'Kapitänsname sollte erhalten bleiben');
};
