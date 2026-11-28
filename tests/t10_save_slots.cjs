// Spielstand-Slots (Startscreen): 3 getrennte Spielstände, Wechsel ohne Datenverlust,
// Slot leeren (nur 2/3), „Neues Spiel“ nur im aktiven Slot, Cloud nur für Slot 1.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

module.exports = async ({ page }) => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(450);

  // Slot 1 mit Spielstand anlegen
  await page.evaluate(() => {
    const g = window.__game;
    g.state.captainName = 'Alpha';
    g.state.day = 5;
    g.state.credits = 900;
    g.state.save();
    g.ui.refreshTitle();
  });
  await page.waitForSelector('.ts-slot-star');
  assert.strictEqual(await page.locator('.ts-slot-star').count(), 3, '3 Slots erwartet');

  // Wechsel auf leeren Slot 2 → Frischstart, Slot 1 bleibt unangetastet
  await page.click('.ts-slot-star[data-slot="2"]');
  let s = await page.evaluate(() => ({
    slot: window.__game.state.activeSlot,
    hasSave: window.__game.state.hasSave(),
    hasContinue: !!document.querySelector('#btn-continue'),
    cloud: window.__game.state.isLeaderboardSlot(),
    credits: window.__game.state.credits,
  }));
  assert.deepStrictEqual(s, { slot: 2, hasSave: false, hasContinue: false, cloud: false, credits: 120 }, JSON.stringify(s));

  // In Slot 2 speichern (Neues Spiel nicht nötig – direkt Stand setzen)
  await page.evaluate(() => {
    const g = window.__game;
    g.state.captainName = 'Beta';
    g.state.day = 2;
    g.state.credits = 333;
    g.state.save();
    g.ui.refreshTitle();
  });
  await page.screenshot({ path: path.join(outDir, 'title_slots.png') });

  // Zurück auf Slot 1: Alpha unverändert; Slot 2 Vorschau bleibt
  await page.click('.ts-slot-star[data-slot="1"]');
  s = await page.evaluate(() => ({
    cap: window.__game.state.captainName,
    day: window.__game.state.day,
    credits: window.__game.state.credits,
    slot2: JSON.parse(localStorage.getItem('starlighter_save_v2_slot2') || 'null')?.captainName,
    active: localStorage.getItem('starlighter_active_slot'),
  }));
  assert.deepStrictEqual(s, { cap: 'Alpha', day: 5, credits: 900, slot2: 'Beta', active: '1' }, JSON.stringify(s));

  // Slot 1 lässt sich nicht „leeren“ (nur Neues Spiel) – Button fehlt
  assert.strictEqual(await page.locator('#btn-slot-clear').count(), 0);

  // Slot 2 leeren mit Bestätigung
  await page.click('.ts-slot-star[data-slot="2"]');
  await page.click('#btn-slot-clear');
  await page.waitForSelector('#btn-confirm-clear-yes');
  await page.click('#btn-confirm-clear-no');
  assert.ok(await page.evaluate(() => localStorage.getItem('starlighter_save_v2_slot2') !== null), 'Abbrechen darf nichts löschen');
  await page.click('#btn-slot-clear');
  await page.click('#btn-confirm-clear-yes');
  s = await page.evaluate(() => ({
    gone: localStorage.getItem('starlighter_save_v2_slot2') === null,
    slot1: JSON.parse(localStorage.getItem('starlighter_save_v2') || 'null')?.captainName,
  }));
  assert.deepStrictEqual(s, { gone: true, slot1: 'Alpha' }, JSON.stringify(s));

  // Cloud-Sync gilt nur für Slot 1
  const cloud = await page.evaluate(() => {
    const st = window.__game.state;
    const in2 = (st.switchSlot(2), st.isLeaderboardSlot());
    const in1 = (st.switchSlot(1), st.isLeaderboardSlot());
    return { in2, in1 };
  });
  assert.deepStrictEqual(cloud, { in2: false, in1: true });
};
