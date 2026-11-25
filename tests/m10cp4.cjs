module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const g = window.__game; const ui = g.ui; const st = g.state;
    document.getElementById('title-overlay')?.classList.add('hidden'); ui.titleVisible = false;
    for (const w of ['blade', 'spear', 'blaster', 'hammer']) st.unlockedWeapons[w] = true;
    st.equippedWeapon = 'blade'; st.secondaryWeapon = null;
    const o = {};
    const snap = () => [st.equippedWeapon, st.secondaryWeapon];
    ui.openLoadoutModal();
    const m = document.getElementById('modal-layer');
    o.rack = { slots: m.querySelectorAll('.lo-slot').length, cards: m.querySelectorAll('.lo-card').length, swapDisabled: m.querySelector('[data-lo-swap]').disabled, logbook: !!m.querySelector('#btn-rack-logbook') };
    const click = (sel) => { document.querySelector(sel).click(); };
    click('[data-lo-assign="spear:2"]'); o.afterSpear2 = snap();
    click('[data-lo-assign="blaster:2"]'); o.afterBlaster2 = snap();   // ersetzt ②
    click('[data-lo-swap]'); o.afterSwap = snap();                     // blaster ①, blade ②
    click('[data-lo-assign="blade:1"]'); o.afterBladeTo1 = snap();     // blade in ② → ①: tauscht (blaster ②)
    click('[data-lo-assign="hammer:1"]'); o.afterHammer1 = snap();     // hammer ①, ② bleibt blaster (alte ① ist nur abgelegt)
    click('[data-lo-clear2]'); o.afterClear = snap(); o.swapDisabledAfterClear = document.querySelector('[data-lo-swap]').disabled;
    // main weapon → ② ohne Zweitwaffe: deaktiviert
    o.mainTo2Disabled = document.querySelector('[data-lo-assign="hammer:2"]').disabled;
    o.mainTo1Disabled = document.querySelector('[data-lo-assign="hammer:1"]').disabled;
    // Fracht-Modal nutzt dasselbe Panel
    ui.openInventoryModal(false, 'bag'); o.bagPanel = !!document.querySelector('#modal-layer .loadout.compact') && !document.querySelector('.btn-equip-bag');
    // Schmiede
    ui.closeModal(); ui.openForgeModal?.(); o.forgePanel = !!document.querySelector('#modal-layer .loadout') && !document.querySelector('.btn-equip-forge');
    // Logbuch-Knopf öffnet das Logbuch
    ui.openLoadoutModal(); click('#btn-rack-logbook'); o.logbookTitle = document.querySelector('#modal-layer .modal-title')?.textContent;
    return o;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.rack.slots, 2); assert.ok(r.rack.cards >= 4); assert.ok(r.rack.swapDisabled && r.rack.logbook);
  assert.deepStrictEqual(r.afterSpear2, ['blade', 'spear']);
  assert.deepStrictEqual(r.afterBlaster2, ['blade', 'blaster']);
  assert.deepStrictEqual(r.afterSwap, ['blaster', 'blade']);
  assert.deepStrictEqual(r.afterBladeTo1, ['blade', 'blaster']);
  assert.deepStrictEqual(r.afterHammer1, ['hammer', 'blaster']);
  assert.deepStrictEqual(r.afterClear, ['hammer', null]); assert.ok(r.swapDisabledAfterClear);
  assert.ok(r.mainTo2Disabled && r.mainTo1Disabled);
  assert.ok(r.bagPanel, 'Fracht zeigt Loadout'); assert.ok(r.forgePanel, 'Schmiede zeigt Loadout');
  assert.ok(/LOGBUCH/i.test(r.logbookTitle), r.logbookTitle);
  // Screenshots: Waffenschrank Desktop + Mobil
  for (const [name, w, h] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { const g = window.__game; g.state.equippedWeapon = 'blade'; g.state.secondaryWeapon = 'spear'; g.ui.openLoadoutModal(); });
    await page.screenshot({ path: `${scratch}/cp4_rack_${name}.png` });
  }
  console.log('M10C PHASE4 OK');
};
