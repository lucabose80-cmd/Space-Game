// P7: Crew-Begleiter gefangen im Dungeon (Ebene II) → Rettung, Shop-Effekte, Hinweise der Besitzer, Alt-Save-Migration
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const g = window.__game;
    await g.dungeonReady;
    g.ui.hideTitle?.();
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const o = {};
    const s = g.state;
    s.rescuedCrew = [];
    // 1) Preise ohne/mit Begleiter
    o.base = [s.getForgeCreditCost(1000, 'forge'), s.getForgeCreditCost(1000, 'medbay'), s.getForgeCreditCost(1000, 'techlab'), s.getForgeCreditCost(1000, 'shop_terminal')];
    s.rescueCrew('mina'); s.rescueCrew('pip'); s.rescueCrew('ping');
    o.disc = [s.getForgeCreditCost(1000, 'forge'), s.getForgeCreditCost(1000, 'medbay'), s.getForgeCreditCost(1000, 'techlab'), s.getForgeCreditCost(1000, 'shop_terminal')];
    o.again = s.rescueCrew('mina');
    s.nyxStock = s.generateNyxStock(); const n0 = s.nyxStock.length;
    const price0 = s.getNyxOfferPrice({ price: 200 });
    s.rescueCrew('midnight');
    o.nyxExtra = s.nyxStock.length - n0; o.nyxPrice = [price0, s.getNyxOfferPrice({ price: 200 })];
    // 2) Alt-Save-Migration: Feld fehlt → aus Kapitel/Szenen abgeleitet
    const payload = s.buildSavePayload(); delete payload.rescuedCrew; payload.story.chapter = 3; payload.story.seenScenes = [];
    localStorage.setItem('starlighter_save_v2', JSON.stringify(payload));
    s.rescuedCrew = []; s.load();
    o.legacy = [...s.rescuedCrew].sort().join(',');
    // 3) Dungeon: Käfig nur Ebene II, nur ungeretteter Begleiter, passender Sektor
    const gs = new GameState(); const toasts = [];
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast: (m) => toasts.push(m), onHudDirty() {} });
    const capOf = (f) => [...f.rooms.values()].filter((x) => x.captive);
    o.cap = {};
    for (const [sec, fl] of [[1, 1], [1, 2], [1, 3], [2, 2], [3, 2], [4, 2]]) {
      dng.startRun(sec); dng.startFloor(fl, false, sec);
      const c = capOf(dng.floor);
      o.cap[`${sec}-${fl}`] = c.map((x) => [x.captive.crew, x.type]).join('|');
    }
    // gleiche Ebene ohne Käfig nach Rettung
    // 4) Weder Layout noch globale Zufallsfolge verändert: seeded Floor identisch
    const rng = await import('/src/systems/seededRng.ts');
    const sig = (f) => JSON.stringify([...f.rooms.values()].map((x) => [x.key, x.spawns.length, x.obstacles.length]));
    const a = rng.withSeededRandom('p7:a', () => gen.generateSectorFloor(1, 2));
    const b = rng.withSeededRandom('p7:a', () => gen.generateSectorFloor(1, 2));
    o.seeded = sig(a) === sig(b) && capOf(a).length === 0;
    // 5) Interaktion: verriegelt bis Raum-Clear, dann befreien (speichert sofort)
    dng.startRun(1); dng.startFloor(2, false, 1);
    const host = capOf(dng.floor)[0]; const cage = host.captive;
    dng.enterRoom(host.key, null); dng.enemies.length = 0; host.cleared = false;
    const inp = new InputManager(document.getElementById('game-canvas'));
    dng.playerX = cage.x; dng.playerY = cage.y + 10;
    dng.updateRoomInteractions(inp); o.locked = dng.activePrompt?.label ?? '';
    host.cleared = true; dng.updateRoomInteractions(inp); o.open = dng.activePrompt?.label ?? '';
    inp.keysPressed.add('KeyE'); inp.keysHeld.add('KeyE'); dng.updateRoomInteractions(inp); inp.keysPressed.clear(); inp.keysHeld.clear();
    o.freed = [cage.freed, gs.isMinaPresent(), gs.rescuedCrew.join(',')];
    { const c = document.createElement('canvas'); c.width = 960; c.height = 540; dng.render(c.getContext('2d'), inp); }
    // nach der Rettung erscheint der Käfig nicht mehr
    dng.startRun(1); dng.startFloor(2, false, 1); o.afterRescue = capOf(dng.floor).length;
    // Spirale/Prüfung: nie
    dng.startEndlessRift(); dng.startFloor(2, false, 2); o.endless = capOf(dng.floor).length;
    // 6) Hinweis des Shop-Besitzers: erscheint einmal je Tag, bis befreit
    const gm = window.__game; const st = gm.state; st.rescuedCrew = ['ping'];
    let opened = 0; gm.crewHintShownDay = {};
    gm.withCrewHint('kael', () => { opened++; });
    o.hintBefore = opened; o.hintModal = /Mina/.test(gm.ui.modalEl.textContent || '');
    gm.ui.activeStory?.skipLater?.();
    o.hintAfterClose = opened;
    gm.withCrewHint('kael', () => { opened++; }); o.hintSameDay = opened;
    gm.withCrewHint('vex', () => { opened++; }); o.hintRescued = opened;
    st.rescuedCrew = [];
    return o;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.base, [1000, 1000, 1000, 1000]);
  assert.deepStrictEqual(r.disc, [900, 900, 900, 1000], 'Rabatt nur im eigenen Laden');
  assert.strictEqual(r.again, false);
  assert.strictEqual(r.nyxExtra, 1, 'Mitternacht: +1 Angebot');
  assert.ok(r.nyxPrice[1] < r.nyxPrice[0], 'Mitternacht: günstigere Preise');
  assert.strictEqual(r.legacy, 'mina,ping,pip', 'Alt-Save Kapitel 3 behält Mina/Pip/Ping');
  assert.deepStrictEqual(r.cap, { '1-1': '', '1-2': 'mina,combat', '1-3': '', '2-2': 'pip,combat', '3-2': 'ping,combat', '4-2': 'midnight,combat' });
  assert.ok(r.seeded, 'Layout unverändert');
  assert.ok(/verriegelt/.test(r.locked), r.locked);
  assert.ok(/befreien/.test(r.open), r.open);
  assert.deepStrictEqual(r.freed, [true, true, 'mina']);
  assert.strictEqual(r.afterRescue, 0);
  assert.strictEqual(r.endless, 0);
  assert.strictEqual(r.hintBefore, 0, 'Hinweis zuerst, Laden erst danach');
  assert.ok(r.hintModal, 'Hinweis nennt Mina');
  assert.strictEqual(r.hintAfterClose, 1);
  assert.strictEqual(r.hintSameDay, 2);
  assert.strictEqual(r.hintRescued, 3);
  console.log('P7 CREW-RETTUNG OK');
};
