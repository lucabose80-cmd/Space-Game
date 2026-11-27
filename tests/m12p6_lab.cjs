// M12: Boss-Labor (?bosslab, auch ?BossLab) → Abschnitt „ARENEN“: Endboss-Raum wie im Spiel, ohne Durchspielen.
module.exports = async ({ page, PORT, scratch }) => {
  const assert = require('node:assert');
  await page.goto(`http://127.0.0.1:${PORT}/?BossLab`); // Groß-/Kleinschreibung egal
  await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
  await page.waitForTimeout(600);
  const open = async () => {
    const shown = await page.evaluate(() => getComputedStyle(document.querySelector('#boss-lab .bl-body')).display !== 'none');
    if (!shown) await page.click('#boss-lab .bl-head button:first-child');
    await page.click('#boss-lab [data-lab="tab:bosse"]');
  };
  await open();
  const btns = await page.evaluate(() => [...document.querySelectorAll('#boss-lab [data-lab^="arena:"]')].map((b) => b.dataset.lab));
  assert.deepStrictEqual(btns, ['arena:boss_leviathan'], 'Arena-Knopf für den Leviathan');
  await page.click('#boss-lab [data-lab="arena:boss_leviathan"]');
  await page.waitForTimeout(700);
  const a = await page.evaluate(() => { const d = window.__game.dungeonScene; const b = d.enemies.find((e) => e.kind === 'boss_leviathan'); return { arena: d.currentRoom.arenaKind, bounds: d.currentRoom.bounds, boss: !!b && !!b.levArena, banner: d.arenaBanner?.title ?? null, info: document.querySelector('#boss-lab .bl-info').textContent, locked: window.__game.state.saveLocked, sel: !!document.querySelector('#boss-lab [data-lab="arena:boss_leviathan"].sel') }; });
  assert.deepStrictEqual([a.arena, a.boss, a.locked, a.sel], ['boss_leviathan', true, true, true], JSON.stringify(a));
  assert.deepStrictEqual(a.bounds, { l: 68, r: 756, t: 46, b: 398 });
  assert.ok(a.banner && a.info.includes('🏟'), 'Auftritt läuft, Info nennt die Arena: ' + a.info);
  await page.waitForTimeout(3200);
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/m12p6_lab_arena.png` });
  // Respawn lädt die Arena neu; normaler Boss danach wieder im Laborraum (ohne Arena-Grenzen)
  await page.click('#boss-lab [data-lab="respawn"]');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => window.__game.dungeonScene.enemies.some((e) => e.kind === 'boss_leviathan' && e.levArena));
  assert.ok(r, 'Respawn: Arena-Kampf neu');
  await open();
  await page.click('#boss-lab [data-lab="boss:boss_leviathan"]');
  await page.waitForTimeout(500);
  const n = await page.evaluate(() => { const d = window.__game.dungeonScene; const b = d.enemies.find((e) => e.kind === 'boss_leviathan'); return { bounds: d.currentRoom.bounds ?? null, arena: !!b?.levArena, cam: [d.camera.x, d.camera.y] }; });
  assert.deepStrictEqual([n.bounds, n.arena, n.cam], [null, false, [0, 0]], 'normaler Boss: Standardraum, alter Kampf: ' + JSON.stringify(n));
  console.log('M12 LABOR-ARENA OK');
};
