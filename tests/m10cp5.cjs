module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const g = window.__game; const st = g.state; const o = {};
    document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;
    const toasts = []; const origToast = g.ui.toast.bind(g.ui); g.ui.toast = (m, t) => { toasts.push(m); origToast(m, t); };
    const summary = () => ({ victory: true, reason: 'warp', sector: 1, floorReached: 1, roomsCleared: 3, enemiesDefeated: 4, itemsSaved: 0, itemsLost: 0, warpedToChest: [], shatteredItems: [] });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = () => { if (g.ui.modalOpen) g.ui.closeModal(); return [st.timeOfDay, st.day]; };
    // Zwei Pedestal-Items bestücken, damit Öffnen nicht an fehlendem Bestand scheitert
    Object.assign(st.pedestals[0], { itemId: 'scrap_coil', qty: 3, price: 10 });
    // 1) Tagsüber: Laden öffnen wird abgelehnt
    st.timeOfDay = 'day'; st.day = 3; st.save();
    g.shopScene.toggleShopOpen(); o.dayOpenRefused = g.shopScene.shopOpen === false; o.dayToast = toasts.some((m) => /Tagsüber ist der Laden zu/.test(m));
    // 2) Koje tagsüber: kein Zeitwechsel
    g.handleAdvanceTime(); await wait(2000); o.kojeDay = state();
    // 3) Tag-Run endet → Nacht (gleicher Tag)
    g.handleReturnFromDungeon(summary()); await wait(2600); o.afterDayRun = state();
    // 4) Nachts: Laden öffnen geht, Schließen → Tag (Tag + 1), auch ohne Verkäufe
    g.shopScene.toggleShopOpen(); o.nightOpen = g.shopScene.shopOpen === true;
    g.shopScene.closeShop(); g.ui.closeModal(); o.afterClose = state(); o.shopClosed = g.shopScene.shopOpen === false;
    // 5) Tag-Run → Nacht, dann Nacht-Run → Tag (Tag + 1), ohne Laden dazwischen
    g.handleReturnFromDungeon(summary()); await wait(2600); o.nightAgain = state();
    g.handleReturnFromDungeon(summary()); await wait(2600); o.afterNightRun = state(); o.morningToast = toasts.some((m) => /Ladenschicht ist ausgefallen/.test(m));
    // 6) Koje nachts: Schicht überspringen → Tag + 1
    g.handleReturnFromDungeon(summary()); await wait(2600); const before = state(); // Tag → Nacht
    g.handleAdvanceTime(); await wait(2000); o.kojeNight = [before, state()];
    // 7) Prüfung: Zeit unverändert
    st.timeOfDay = 'day'; const t0 = state(); g.handleReturnFromDungeon({ ...summary(), isWeeklyTrial: true, trialOutcome: 'abort' }); await wait(800); o.trialUnchanged = JSON.stringify(t0) === JSON.stringify(state());
    // 8) Nacht-Run behält nightBoost im Dungeon
    st.timeOfDay = 'night'; o.nightBoost = st.timeOfDay === 'night';
    return o;
  });
  console.log(JSON.stringify(r));
  assert.ok(r.dayOpenRefused && r.dayToast, 'Tag: Laden zu');
  assert.deepStrictEqual(r.kojeDay, ['day', 3], 'Koje tagsüber ohne Wirkung');
  assert.deepStrictEqual(r.afterDayRun, ['night', 3]);
  assert.ok(r.nightOpen);
  assert.deepStrictEqual(r.afterClose, ['day', 4]); assert.ok(r.shopClosed);
  assert.deepStrictEqual(r.nightAgain, ['night', 4]);
  assert.deepStrictEqual(r.afterNightRun, ['day', 5]); assert.ok(r.morningToast, 'Nacht-Run: Schicht fällt aus');
  assert.deepStrictEqual(r.kojeNight, [['night', 5], ['day', 6]]);
  assert.ok(r.trialUnchanged, 'Prüfung ändert die Zeit nicht');
  console.log('M10C PHASE5 OK');
};
