// Boss-Labor: „ANGRIFFE & STATI“ — jeder Boss-Angriff einzeln auslösbar, HP-Stufen/Phase II, Treffer/Tod/Neu, Gegner-Angriff.
module.exports = async ({ page, PORT }) => {
  const assert = require('node:assert');
  await page.goto(`http://127.0.0.1:${PORT}/?bosslab=1`);
  await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
  await page.waitForTimeout(600);
  const open = async (tab) => {
    const shown = await page.evaluate(() => getComputedStyle(document.querySelector('#boss-lab .bl-body')).display !== 'none');
    if (!shown) await page.click('#boss-lab .bl-head button:first-child');
    await page.click(`#boss-lab [data-lab="tab:${tab}"]`);
  };
  const boss = (kind) => page.evaluate((k) => {
    const e = window.__game.dungeonScene.enemies.find((x) => x.kind === k);
    return e ? { sub: e.bossSub, st: e.bossState, hp: e.hp, max: e.maxHp, p2: e.bossPhase2 === true } : null;
  }, kind);
  const labels = (pane) => page.evaluate((pn) => [...document.querySelectorAll(`#boss-lab [data-pane="${pn}"] button`)].map((b) => b.textContent), pane);

  // Bosse mit Zugplan/Zustandsmaschine: jeder Angriffsknopf startet den Angriff
  const expect = {
    boss_breacher: 3, boss_slag_overlord: 3, boss_forge_warden: 3, boss_vulkan_titan: 3, boss_chrono_sentinel: 3,
    boss_monolith_colossus: 3, boss_star_archon: 3, boss: 4, boss_quartz_golem: 2, boss_prism_weaver: 2, boss_prisma_archon: 3, boss_omega_archon: 3,
  };
  let total = 0;
  for (const [kind, minAtks] of Object.entries(expect)) {
    await open('bosse');
    await page.click(`#boss-lab [data-lab="boss:${kind}"]`);
    await page.waitForTimeout(350);
    const btns = await labels('bosse');
    const iA = btns.indexOf('⏭ Nächster');
    assert.ok(iA >= 0, `${kind}: kein Angriffs-Abschnitt`);
    const iS = btns.indexOf('100 %');
    const names = btns.slice(iA + 1, iS);
    assert.ok(names.length >= minAtks, `${kind}: zu wenige Angriffsknöpfe ${JSON.stringify(names)}`);
    for (const name of names) {
      await page.locator('#boss-lab [data-pane="bosse"] button', { hasText: new RegExp(`^${name.replace(/[/()]/g, '\\$&')}$`) }).first().click();
      await page.waitForTimeout(220);
      const b = await boss(kind);
      const started = b && (b.sub === 'windup' || b.sub === 'active' || (b.st && !['stalk', 's2_idle'].includes(b.st)));
      assert.ok(started, `${kind}/${name}: Angriff startet nicht ${JSON.stringify(b)}`);
      total++;
    }
    // Stati: 50 % → Phase II, 100 % → zurück in Phase I
    await page.locator('#boss-lab [data-pane="bosse"] button', { hasText: '50 % · Phase II' }).first().click();
    await page.waitForTimeout(500);
    let b = await boss(kind);
    assert.ok(b.hp <= b.max * 0.51 && b.p2, `${kind}: Phase II über Stufe 50 % ${JSON.stringify(b)}`);
    await page.locator('#boss-lab [data-pane="bosse"] button', { hasText: /^100 %$/ }).first().click();
    await page.waitForTimeout(250);
    b = await boss(kind);
    assert.ok(b.hp >= b.max * 0.99 && !b.p2, `${kind}: 100 % setzt Phase I zurück ${JSON.stringify(b)}`);
  }

  // Tod & Neu (Krall)
  await open('bosse');
  await page.click('#boss-lab [data-lab="boss:boss_breacher"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: require('node:path').join(__dirname, 'out', 'lab_attacks.png') });
  await page.locator('#boss-lab [data-pane="bosse"] button', { hasText: '☠ Tod' }).first().click();
  await page.waitForTimeout(900);
  const dead = await page.evaluate(() => window.__game.dungeonScene.enemies.filter((e) => e.kind === 'boss_breacher' && e.hp > 0).length);
  assert.strictEqual(dead, 0, 'Tod-Knopf tötet den Boss');
  await page.locator('#boss-lab [data-pane="bosse"] button', { hasText: '↺ Neu' }).first().click();
  await page.waitForTimeout(300);
  assert.ok(await boss('boss_breacher'), '↺ Neu spawnt den Boss erneut');

  // Gegner: Angriff jetzt + Stufen + Treffer
  await open('gegner');
  await page.click('#boss-lab [data-lab="enemy:drone"]');
  await page.waitForTimeout(300);
  const gl = await labels('gegner');
  assert.ok(gl.includes('⚔ Angriff jetzt') && gl.includes('33 %') && gl.includes('💥 Treffer'), JSON.stringify(gl.slice(0, 12)));
  await page.locator('#boss-lab [data-pane="gegner"] button', { hasText: '⚔ Angriff jetzt' }).first().click();
  await page.locator('#boss-lab [data-pane="gegner"] button', { hasText: /^33 %$/ }).first().click();
  const hp = await page.evaluate(() => { const e = window.__game.dungeonScene.enemies.find((x) => x.kind === 'drone'); return e.hp / e.maxHp; });
  assert.ok(hp > 0.3 && hp < 0.36, `Gegner-Stufe 33 %: ${hp}`);
  console.log('Lab-Angriffe getestet:', total);
};
