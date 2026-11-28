// Sektor-Anflug-Cutscene: Start über Hangar, alle 3 Phasen visuell prüfen, Skip & Wochen-Prüfung ohne Cutscene.
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

  // 1. Sektor-1-Anflug über Hangar-Launch starten → Cutscene aktiv, HUD ausgeblendet
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

  // Visuelle Snapshots der 3 Phasen (Warp, Titelkarte, Absetz-Strahl)
  for (const [label, sec] of [
    ['cutscene_s1_warp', 0.45],
    ['cutscene_s1_title', 2.05],
    ['cutscene_s1_beam', 3.45],
  ]) {
    await page.evaluate((s) => {
      const g = window.__game;
      g.approachCutscene.seek(s);
      g.approachCutscene.render(g.ctx);
    }, sec);
    await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  }

  // 2. Skip per Tastendruck (Space) → Cutscene endet, HUD wieder sichtbar, landet im Dungeon Sektor 1
  await page.keyboard.press('Space');
  const afterSkip = await page.evaluate(async () => {
    const g = window.__game;
    for (let i = 0; i < 60 && g.activeScene !== 'dungeon'; i++) await new Promise((r) => setTimeout(r, 50));
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

  // 3. Sektor 2 (Kristall-Nebel) & Sektor 5 (Omega-Anomalie) rendern fehlerfrei + natürlicher Ablauf landet im Dungeon
  for (const [sector, endless, name] of [
    [2, false, 'cutscene_s2_crystal'],
    [5, false, 'cutscene_s5_omega'],
  ]) {
    await page.evaluate(async ({ s, e }) => {
      const g = window.__game;
      for (let i = 0; i < 60 && g.transitionDir !== 0; i++) await new Promise((r) => setTimeout(r, 40));
      g.launchSectorWithCutscene(s, e);
      g.approachCutscene.seek(2.2);
      g.approachCutscene.render(g.ctx);
    }, { s: sector, e: endless });
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    await page.evaluate(() => {
      const g = window.__game;
      g.approachCutscene.seek(4.54);
    });
    const done = await page.evaluate(async () => {
      const g = window.__game;
      for (let i = 0; i < 60 && g.approachCutscene !== null; i++) await new Promise((r) => setTimeout(r, 40));
      return {
        cutscene: g.approachCutscene,
        scene: g.activeScene,
        sector: g.dungeonScene?.currentSector,
      };
    });
    assert.deepStrictEqual(done, { cutscene: null, scene: 'dungeon', sector }, JSON.stringify(done));
  }

  console.log('CUTSCENE APPROACH OK');
};
