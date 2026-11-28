// P7/P7b: Crew gefangen in eigener Käfig-Kammer (Ebene II), Befreiungs-Szene, Heilquellen vor Bossen,
// Shop-Effekte, Hinweise & Tutorial der Besitzer, Alt-Save-Migration, keine zu frühen Crew-Sprites in Feiern
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
    const rng = await import('/src/systems/seededRng.ts');
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
    // 2) Alt-Save-Migration
    const payload = s.buildSavePayload(); delete payload.rescuedCrew; payload.story.chapter = 3; payload.story.seenScenes = [];
    localStorage.setItem('starlighter_save_v2', JSON.stringify(payload));
    s.rescuedCrew = []; s.load();
    o.legacy = [...s.rescuedCrew].sort().join(',');
    // 3) Sonderräume: Käfig-Kammer (Ebene II) + Heilquelle vor JEDEM Boss
    const gs = new GameState(); const toasts = [];
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast: (m) => toasts.push(m), onHudDirty() {} });
    const capOf = (f) => [...f.rooms.values()].filter((x) => x.captive);
    o.cap = {}; o.spring = {}; o.beacons = {}; o.stripped = true; o.bgKeys = true;
    const art = (await import('/src/assets/artLoader.ts')).getHDArt();
    for (const sec of [1, 2, 3, 4]) for (const fl of [1, 2, 3]) {
      dng.startRun(sec); dng.startFloor(fl, false, sec);
      const rooms = [...dng.floor.rooms.values()];
      o.cap[`${sec}-${fl}`] = capOf(dng.floor).map((x) => [x.captive.crew, x.special]).join(',');
      const boss = dng.floor.rooms.get(dng.floor.bossKey);
      const sp = rooms.filter((x) => x.special === 'spring');
      const adj = sp.every((x) => Math.abs(x.gx - boss.gx) + Math.abs(x.gy - boss.gy) === 1);
      o.spring[`${sec}-${fl}`] = [sp.length, adj];
      o.beacons[`${sec}-${fl}`] = rooms.filter((x) => x.extractBeacon).length;
      for (const x of rooms.filter((q) => q.special)) {
        if (x.spawns.length || x.obstacles.length || x.chasms.length || x.pods.length || x.chest) o.stripped = false;
        if (!art.roomBgs[`${x.special}_s${sec}`]) o.bgKeys = false;
      }
    }
    // 4) Layout & globale Zufallsfolge unverändert (seeded Floor identisch, keine Sonderräume im Generator selbst)
    const sig = (f) => JSON.stringify([...f.rooms.values()].map((x) => [x.key, x.spawns.length, x.obstacles.length]));
    const a = rng.withSeededRandom('p7:a', () => gen.generateSectorFloor(1, 2));
    const b = rng.withSeededRandom('p7:a', () => gen.generateSectorFloor(1, 2));
    o.seeded = sig(a) === sig(b) && capOf(a).length === 0 && [...a.rooms.values()].every((x) => !x.special);
    // 5) Käfig: verriegelt bis Raum-Clear, E startet die Befreiungs-Szene, danach frei & gespeichert
    dng.startRun(1); dng.startFloor(2, false, 1);
    const host = capOf(dng.floor)[0]; const cage = host.captive;
    dng.enterRoom(host.key, null); dng.enemies.length = 0; host.cleared = false;
    const inp = new InputManager(document.getElementById('game-canvas'));
    const tap = (code) => { inp.keysPressed.add(code); inp.keysHeld.add(code); };
    const rel = () => { inp.keysPressed.clear(); inp.keysHeld.clear(); };
    dng.playerX = cage.x; dng.playerY = cage.y + 10;
    dng.updateRoomInteractions(inp); o.locked = dng.activePrompt?.label ?? '';
    host.cleared = true; dng.updateRoomInteractions(inp); o.open = dng.activePrompt?.label ?? '';
    tap('KeyE'); dng.updateRoomInteractions(inp); rel();
    o.cine = !!dng.rescueCine && !cage.freed;
    o.frozenPos = [dng.playerX, dng.playerY];
    let frames = 0;
    while (dng.rescueCine && frames < 3000) { frames++; if (frames % 90 === 0) tap('KeyE'); dng.update(1 / 60, inp); rel(); }
    o.cineEnded = [!dng.rescueCine, cage.freed, gs.isMinaPresent(), gs.rescuedCrew.join(',')];
    { const c = document.createElement('canvas'); c.width = 960; c.height = 540; dng.render(c.getContext('2d'), inp); }
    dng.startRun(1); dng.startFloor(2, false, 1); o.afterRescue = capOf(dng.floor).length;
    dng.startEndlessRift(); dng.startFloor(2, false, 2);
    o.endless = capOf(dng.floor).length + [...dng.floor.rooms.values()].filter((x) => x.special).length;
    // 6) Heilquelle: heilt allmählich, aber nur einen Teil (45 % der max. HP), nicht in der Prüfung
    dng.startRun(2); dng.startFloor(1, false, 2);
    const spr = [...dng.floor.rooms.values()].find((x) => x.special === 'spring');
    dng.enterRoom(spr.key, null);
    const max = gs.getStats().maxHp; gs.hp = 1;
    dng.playerX = spr.spring.x; dng.playerY = spr.spring.y;
    const hp0 = gs.hp;
    for (let i = 0; i < 60; i++) dng.update(1 / 60, inp);
    o.springOneSec = gs.hp - hp0;
    for (let i = 0; i < 60 * 30; i++) dng.update(1 / 60, inp);
    o.springTotal = [gs.hp - hp0, Math.round(max * 0.45), max, spr.spring.used];
    dng.isWeeklyTrial = true; gs.hp = 1; spr.spring.used = 0;
    for (let i = 0; i < 120; i++) dng.update(1 / 60, inp);
    o.trialNoHeal = gs.hp === 1; dng.isWeeklyTrial = false;
    // 7) Hinweise & Tutorial der Besitzer
    const gm = window.__game; const st = gm.state; st.rescuedCrew = ['ping']; st.seenCutscenes = [];
    const modal = () => gm.ui.modalEl.textContent || '';
    let opened = 0; gm.crewHintShownDay = {};
    gm.withCrewHint('kael', () => { opened++; });
    o.hintBefore = opened; o.hintModal = /Mina/.test(modal());
    gm.ui.activeStory?.skipLater?.();
    o.hintAfterClose = opened;
    gm.withCrewHint('kael', () => { opened++; }); o.hintSameDay = opened;
    gm.withCrewHint('vex', () => { opened++; }); o.hintRescued = opened;
    // Lyra: zuerst Tutorial Heilquellen, dann Pip-Hinweis, dann Med-Bay
    o.lyraTut1 = /Heilquellen|Heilquelle/.test((gm.withCrewHint('lyra', () => { opened++; }), modal()));
    gm.ui.activeStory?.skipLater?.(); o.lyraHint = /Pip/.test(modal());
    gm.ui.activeStory?.skipLater?.(); o.lyraOpened = opened;
    gm.withCrewHint('lyra', () => { opened++; }); // zweiter Besuch am selben Tag: kein Tutorial mehr
    o.lyraNoRepeat = !/Heilquelle/.test(modal());
    // 8) Keine zu frühen Crew-Sprites in Feiern: nur befreite Crew erscheint
    st.rescuedCrew = [];
    const crewOf = (id) => { gm.playHubCutscene(id); const c = { ...gm.hubCutscene.crew }; gm.hubCutscene.dispose(); gm.hubCutscene = null; gm.hubCutsceneOnDone = null; gm.setHudVisible(true); return c; };
    o.celeb0 = ['celebration_s1', 'celebration_s2', 'celebration_s3', 'celebration_s4'].map((id) => Object.values(crewOf(id)).some(Boolean));
    st.rescuedCrew = ['mina'];
    o.celeb1 = [crewOf('celebration_s1').mina, crewOf('celebration_s1').pip];
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
  const wantCap = { '1-2': 'mina,cell', '2-2': 'pip,cell', '3-2': 'ping,cell', '4-2': 'midnight,cell' };
  for (const sec of [1, 2, 3, 4]) for (const fl of [1, 2, 3]) {
    assert.strictEqual(r.cap[`${sec}-${fl}`], wantCap[`${sec}-${fl}`] ?? '', `Käfig-Kammer S${sec}F${fl}`);
    assert.deepStrictEqual(r.spring[`${sec}-${fl}`], [1, true], `genau eine Heilquelle direkt vor dem Boss S${sec}F${fl}`);
    assert.strictEqual(r.beacons[`${sec}-${fl}`], fl === 1 ? 0 : 1, `Notfall-Bake bleibt erhalten S${sec}F${fl}`);
  }
  assert.ok(r.stripped, 'Sonderräume ohne Gegner/Hindernisse/Truhe');
  assert.ok(r.bgKeys, 'Sonderraum-Hintergründe geladen');
  assert.ok(r.seeded, 'Layout unverändert');
  assert.ok(/verriegelt/.test(r.locked), r.locked);
  assert.ok(/befreien/.test(r.open), r.open);
  assert.ok(r.cine, 'E startet die Befreiungs-Szene');
  assert.deepStrictEqual(r.cineEnded, [true, true, true, 'mina']);
  assert.strictEqual(r.afterRescue, 0);
  assert.strictEqual(r.endless, 0, 'Spirale ohne Sonderräume');
  assert.ok(r.springOneSec >= 1, 'Quelle heilt allmählich: ' + r.springOneSec);
  assert.ok(r.springTotal[0] <= r.springTotal[1] + 1 && r.springTotal[0] >= r.springTotal[1] - 1 && r.springTotal[0] < r.springTotal[2], 'Quelle heilt nur einen Teil: ' + JSON.stringify(r.springTotal));
  assert.ok(r.trialNoHeal, 'Prüfung ohne Quelle');
  assert.strictEqual(r.hintBefore, 0, 'Hinweis zuerst, Laden erst danach');
  assert.ok(r.hintModal, 'Hinweis nennt Mina');
  assert.strictEqual(r.hintAfterClose, 1);
  assert.strictEqual(r.hintSameDay, 2);
  assert.strictEqual(r.hintRescued, 3);
  assert.ok(r.lyraTut1 && r.lyraHint && r.lyraOpened === 4 && r.lyraNoRepeat, JSON.stringify([r.lyraTut1, r.lyraHint, r.lyraOpened, r.lyraNoRepeat]));
  assert.deepStrictEqual(r.celeb0, [false, false, false, false], 'keine Crew-Sprites vor der Rettung');
  assert.deepStrictEqual(r.celeb1, [true, false], 'nur befreite Crew in Feiern');
  console.log('P7 CREW-RETTUNG OK');
};
