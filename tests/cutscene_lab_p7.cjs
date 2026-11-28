// Cutscene-Labor: neue Dungeon-Szenen (Befreiung, Käfig-Kammer, Heilquelle) sind per Knopf erreichbar; Zurück-Knopf führt in den Hub
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  await page.goto(page.url().split('?')[0] + '?cutscenelab');
  await page.waitForSelector('#cutscene-lab-panel [data-lab-dng]', { state: 'attached', timeout: 15000 });
  const r = {};
  await page.evaluate(() => { document.querySelector('#btn-cutscene-lab-toggle')?.click(); });
  for (const kind of ['rescue_pip', 'cell_mina', 'spring_3']) {
    await page.evaluate((k) => document.querySelector(`[data-lab-dng="${k}"]`).click(), kind);
    await page.waitForTimeout(600);
    r[kind] = await page.evaluate(() => {
      const g = window.__game; const d = g.dungeonScene;
      return { scene: g.activeScene, special: d.currentRoom.special, cine: d.rescueCine?.crew ?? null, saveLocked: g.state.saveLocked };
    });
  }
  await page.evaluate(() => document.querySelector('[data-lab-dng-back]').click());
  await page.waitForTimeout(2500);
  r.back = await page.evaluate(() => window.__game.activeScene);
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.rescue_pip, { scene: 'dungeon', special: 'cell', cine: 'pip', saveLocked: true });
  assert.deepStrictEqual(r.cell_mina, { scene: 'dungeon', special: 'cell', cine: null, saveLocked: true });
  assert.strictEqual(r.spring_3.special, 'spring');
  assert.strictEqual(r.back, 'hub');
  console.log('CUTSCENE-LAB P7 OK');
};
