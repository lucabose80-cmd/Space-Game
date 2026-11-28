// Welt-Überarbeitung P3: Quartier-Ausbau in Stufen (Drohnen-Dock & Jukebox erst ab Stufe II), Alt-Save-Migration, Kauf
const assert = require('node:assert');

module.exports = async ({ page }) => {
  await page.evaluate(async () => {
    const g = window.__game;
    await g.dungeonReady;
    g.ui.hideTitle?.();
  });
  const r = await page.evaluate(() => {
    const g = window.__game;
    const s = g.state;
    const out = {};
    out.startTier = s.upgrades.quartersTier;
    // Sperre bei Stufe 0
    s.upgrades.quartersTier = 0;
    const br = g.backroomScene;
    const toasts = [];
    br.callbacks.onToast = (m) => toasts.push(m);
    br.playerX = 164; br.playerY = 150;
    br.updateInteraction({ interactPressed: () => true, moveY: 0 }, 0);
    out.lockedPrompt = /Drohnen-Dock noch nicht gebaut/.test(br.activePrompt?.label ?? '');
    out.lockedToast = toasts.length === 1;
    br.playerX = 324; br.playerY = 150;
    br.updateInteraction({ interactPressed: () => false }, 0);
    out.jukeLocked = /Jukebox noch nicht installiert/.test(br.activePrompt?.label ?? '');
    // Kauf
    s.credits = 5000;
    s.inventory.cargo.fill(null);
    s.inventory.cargo[0] = { itemId: 'scrap_coil', qty: 3 };
    s.inventory.cargo[1] = { itemId: 'alien_prism', qty: 1 };
    out.bought = s.purchaseUpgrade('quartersTier');
    out.tierAfter = s.upgrades.quartersTier;
    // Stufe 1: Dock offen
    br.playerX = 164; br.playerY = 150;
    let opened = 0; br.callbacks.onOpenCompanionDock = () => opened++;
    br.updateInteraction({ interactPressed: () => true, moveY: 0 }, 0);
    out.dockOpens = opened === 1;
    // Render für alle 3 Stufen ohne Fehler
    const ctx = document.createElement('canvas').getContext('2d');
    for (const t of [0, 1, 2]) { s.upgrades.quartersTier = t; br.render(ctx); }
    return out;
  });
  assert.strictEqual(r.startTier, 0, JSON.stringify(r));
  assert.ok(r.lockedPrompt && r.lockedToast && r.jukeLocked, JSON.stringify(r));
  assert.ok(r.bought && r.tierAfter === 1 && r.dockOpens, JSON.stringify(r));

  // Alt-Save ohne Feld: Tag > 3 → Stufe 1; frischer Alt-Save (Tag 1, nichts freigeschaltet) → Stufe 0
  const m = await page.evaluate(() => {
    const g = window.__game;
    const s = g.state;
    const mk = (day) => {
      const payload = s.buildSavePayload();
      delete payload.upgrades.quartersTier;
      payload.day = day;
      payload.sector1Cleared = false;
      Object.keys(payload.unlockedCompanions ?? {}).forEach((k) => (payload.unlockedCompanions[k] = false));
      localStorage.setItem('starlighter_save_v2', JSON.stringify(payload));
      s.upgrades.quartersTier = 2;
      s.load();
      return s.upgrades.quartersTier;
    };
    return { fresh: mk(1), veteran: mk(6) };
  });
  assert.deepStrictEqual(m, { fresh: 0, veteran: 1 }, JSON.stringify(m));
  console.log('WELT P3 QUARTIER OK');
};
