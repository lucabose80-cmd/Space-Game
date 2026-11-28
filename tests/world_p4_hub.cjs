// Welt-Überarbeitung P4a: Hub-Gebäude öffnen durch Ereignisse (Tech-Labor, Schwarzmarkt, Terrasse), Alt-Save bleibt offen
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
    const hub = g.hubScene;
    const out = {};
    s.hubUnlocks = [];
    s.totalEnemiesDefeated = 0; s.totalSold = 0; s.sector1Cleared = false; s.bossDefeatedCount = 0; s.deepestFloor = 1;
    out.closed = ['techlab', 'blackmarket', 'terrace'].map((id) => s.isHubBuildingOpen(id));
    // Gesperrte Prompts
    const toasts = [];
    hub.callbacks.onToast = (m) => toasts.push(m);
    const press = { interactPressed: () => true };
    hub.playerX = 332; hub.playerY = 148; hub.updateInteraction(press, 0);
    out.techPrompt = hub.activePrompt?.label ?? '';
    hub.playerX = 152; hub.playerY = 148; hub.updateInteraction(press, 0);
    out.nyxPrompt = hub.activePrompt?.label ?? '';
    hub.playerX = 240; hub.playerY = 222; hub.updateInteraction(press, 0);
    out.terrPrompt = hub.activePrompt?.label ?? '';
    out.toasts = toasts.length;
    // Ereignisse
    s.totalEnemiesDefeated = 1; out.o1 = s.checkHubUnlocks();
    s.totalSold = 3; out.o2 = s.checkHubUnlocks();
    s.sector1Cleared = true; out.o3 = s.checkHubUnlocks();
    out.again = s.checkHubUnlocks().length;
    out.pending = s.pendingHubReveals.length;
    hub.onEnter('shop');
    out.pendingAfterEnter = s.pendingHubReveals.length;
    out.revealsRender = (() => { const c = document.createElement('canvas').getContext('2d'); hub.render(c); return true; })();
    // Läden-Stufen aus Upgrades
    const u = s.upgrades;
    Object.assign(u, { blade: 0, spear: 0, fists: 0, discus: 0, blaster: 0, hammer: 0, bioRegen: 0, stimpack: 0, modCrit: 0, modThruster: 0, modLuck: 0, shopTier: 0 });
    out.tier0 = JSON.stringify(s.getHubTiers());
    Object.assign(u, { blade: 5, bioRegen: 2, modCrit: 3, modThruster: 3, shopTier: 1 });
    out.tier1 = JSON.stringify(s.getHubTiers());
    { const c = document.createElement('canvas').getContext('2d'); hub.render(c); }
    // Standfeste Objekte der Stations-Entwicklung haben Kollisionskreise
    s.story.chapter = 6; s.story.flags = ['kael_memorial', 'lyra_clinic'];
    out.colliders = hub.getEvolution().getColliders().length;
    s.story.chapter = 0; s.story.flags = [];
    // Pip (Lyras Assistent) erscheint ab Kapitel 2
    s.story.chapter = 0; s.story.seenScenes = []; out.pip0 = s.isPipPresent();
    s.story.chapter = 2; out.pip2 = s.isPipPresent();
    s.seenCutscenes = s.seenCutscenes.filter((k) => k !== 'pip_arrives'); hub.onEnter('shop'); out.pipSeen = s.hasSeenCutscene('pip_arrives');
    { const c = document.createElement('canvas').getContext('2d'); hub.render(c); }
    s.story.chapter = 0;
    // Alt-Save ohne Feld → alles offen
    const payload = s.buildSavePayload(); delete payload.hubUnlocks;
    localStorage.setItem('starlighter_save_v2', JSON.stringify(payload));
    s.hubUnlocks = []; s.load();
    out.legacy = s.hubUnlocks.length;
    return out;
  });
  assert.deepStrictEqual(r.closed, [false, false, false], JSON.stringify(r));
  assert.ok(/Tech-Labor/.test(r.techPrompt) && /Schwarzmarkt/.test(r.nyxPrompt) && /Terrasse/.test(r.terrPrompt), JSON.stringify(r));
  assert.strictEqual(r.toasts, 3, JSON.stringify(r));
  assert.deepStrictEqual([r.o1, r.o2, r.o3], [['techlab'], ['blackmarket'], ['terrace']], JSON.stringify(r));
  assert.strictEqual(r.again, 0);
  assert.strictEqual(r.pending, 3);
  assert.strictEqual(r.pendingAfterEnter, 0);
  assert.ok(r.colliders >= 6, JSON.stringify(r));
  assert.deepStrictEqual([r.pip0, r.pip2, r.pipSeen], [false, true, true], JSON.stringify(r));
  assert.strictEqual(r.legacy, 3, JSON.stringify(r));
  assert.strictEqual(r.tier0, '{"forge":0,"med":0,"tech":0,"shop":0}', r.tier0);
  assert.strictEqual(r.tier1, '{"forge":2,"med":1,"tech":2,"shop":1}', r.tier1);
  console.log('WELT P4a HUB-GEBAEUDE OK');
};
