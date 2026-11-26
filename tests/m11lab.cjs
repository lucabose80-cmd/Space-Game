// Boss-Labor (?bosslab): alle Bosse/Gegner auswählbar, Steuerung funktioniert, Spielstand bleibt unangetastet
module.exports = async ({ page, PORT }) => {
  const assert = require('node:assert');
  // Vorhandenen Spielstand simulieren, den das Labor nicht verändern darf
  await page.evaluate(() => { localStorage.setItem('starlighter_save_v2', JSON.stringify({ version: 11, day: 7, credits: 1234, marker: 'unberührt' })); });
  const before = await page.evaluate(() => localStorage.getItem('starlighter_save_v2'));
  await page.goto(`http://127.0.0.1:${PORT}/?bosslab=1`);
  await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
  await page.waitForTimeout(600);
  const c = await page.evaluate(() => ({ boss: document.querySelectorAll('#boss-lab [data-lab^="boss:"]').length, enemy: document.querySelectorAll('#boss-lab [data-lab^="enemy:"]').length, scene: window.__game.activeScene, locked: window.__game.state.saveLocked, title: window.__game.ui.titleVisible }));
  assert.deepStrictEqual([c.boss, c.enemy, c.scene, c.locked, c.title], [13, 21, 'dungeon', true, false], JSON.stringify(c));
  const kinds = await page.evaluate(() => [...document.querySelectorAll('#boss-lab [data-lab^="boss:"]')].map((b) => b.dataset.lab.slice(5)));
  const res = {};
  for (const kind of kinds) {
    await page.click(`#boss-lab [data-lab="boss:${kind}"]`);
    await page.waitForTimeout(450);
    res[kind] = await page.evaluate((kind) => { const g = window.__game; const e = g.dungeonScene.enemies.find((x) => x.kind === kind); return { found: !!e, hp: e ? Math.round(e.hp / e.maxHp * 100) : 0, status: e?.bossStatusText ?? null, finite: e ? Number.isFinite(e.x) && Number.isFinite(e.y) : false, info: document.querySelector('#boss-lab .bl-info').textContent }; }, kind);
    assert.ok(res[kind].found && res[kind].finite, `${kind}: Boss erscheint`);
  }
  // Steuerung an einem Boss mit eigener Engine (Krall)
  await page.click('#boss-lab [data-lab="boss:boss_breacher"]'); await page.waitForTimeout(300);
  await page.click('#boss-lab [data-lab="phase2"]'); await page.waitForTimeout(700);
  const p2 = await page.evaluate(() => window.__game.dungeonScene.enemies.find((e) => e.kind === 'boss_breacher')?.bossPhase2 === true);
  assert.ok(p2, 'Phase-II-Knopf löst Phase 2 aus');
  // Pause friert die Spielzeit ein, Zeitlupe verlangsamt
  await page.click('#boss-lab [data-lab="pause"]'); const t1 = await page.evaluate(() => window.__game.dungeonScene.time); await page.waitForTimeout(400); const t2 = await page.evaluate(() => window.__game.dungeonScene.time);
  assert.ok(Math.abs(t2 - t1) < 0.001, `Pause: Spielzeit steht (${t1} → ${t2})`);
  await page.click('#boss-lab [data-lab="pause"]'); await page.click('#boss-lab [data-lab="speed:0.25"]');
  const s1 = await page.evaluate(() => window.__game.dungeonScene.time); await page.waitForTimeout(1000); const s2 = await page.evaluate(() => window.__game.dungeonScene.time);
  assert.ok(s2 - s1 > 0.1 && s2 - s1 < 0.45, `Zeitlupe 0,25×: ${(s2 - s1).toFixed(2)} s in 1 s`);
  await page.click('#boss-lab [data-lab="speed:1"]');
  // Rig an/aus
  const rig1 = await page.evaluate(() => !!window.__rigCheck);
  void rig1;
  await page.click('#boss-lab [data-lab="rig"]'); const off = await page.evaluate(async () => { const { getHDArt } = await import('/src/assets/artLoader.ts'); return [getHDArt().rigs.krall === null, getHDArt().rigs.core_warden === null]; });
  await page.click('#boss-lab [data-lab="rig"]'); const on = await page.evaluate(async () => { const { getHDArt } = await import('/src/assets/artLoader.ts'); return [getHDArt().rigs.krall !== null, getHDArt().rigs.core_warden !== null]; });
  assert.deepStrictEqual([off, on], [[true, true], [true, true]], 'Rig-Schalter');
  // Unverwundbarkeit: Spieler direkt neben den Boss stellen, Boss greift an → HP bleiben voll; Boss ∞ hält den Boss am Leben
  const hold = await page.evaluate(async () => { const g = window.__game; const d = g.dungeonScene; const e = d.enemies.find((x) => x.kind === 'boss_breacher'); d.playerX = e.x - 12; d.playerY = e.y; e.hp = 1; await new Promise((r) => setTimeout(r, 700)); return { hp: g.state.hp, max: g.state.getStats().maxHp, boss: d.enemies.some((x) => x.kind === 'boss_breacher'), pct: Math.round(d.enemies[0].hp / d.enemies[0].maxHp * 100) }; });
  assert.ok(hold.hp === hold.max && hold.boss && hold.pct >= 5, JSON.stringify(hold));
  // Gegner
  await page.click('#boss-lab [data-lab="enemy:turret"]'); await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__game.dungeonScene.enemies[0]?.kind), 'turret');
  // Spielstand unverändert
  const after = await page.evaluate(() => localStorage.getItem('starlighter_save_v2'));
  assert.strictEqual(after, before, 'Spielstand wurde vom Labor nicht verändert');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.status]))));
  console.log('M11 LAB OK');
};
