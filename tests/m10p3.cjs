module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { HubScene } = await import('/src/scenes/HubScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { getHDArt, M10_OPTIONAL_SPRITES } = await import('/src/assets/artLoader.ts');
    const ch = await import('/src/data/story/storyChapters.ts');
    const gs = new GameState();
    const cb = { onEnterShop() {}, onOpenForge() {}, onOpenMedBay() {}, onOpenTechLab() {}, onOpenBlackMarket() {}, onOpenGuildBoard() {}, onEnterMarketTerrace() {}, onEnterDungeon() {}, onToast() {} };
    const hub = new HubScene(gs, cb);
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const idle = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : () => false) });
    const moving = (x, y) => new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x, y }) : () => false) });
    const out = {};
    out.artKeys = Object.keys(M10_OPTIONAL_SPRITES).length;
    out.artValid = Object.keys(M10_OPTIONAL_SPRITES).every((k) => {
      const v = getHDArt()[k];
      return v === null || (v instanceof HTMLCanvasElement && v.width > 0);
    });
    // --- Passanten-Plan je Kapitel (max 6)
    out.counts = [];
    for (let c = 0; c <= 6; c++) { gs.story.chapter = c; hub.onEnter('shop'); out.counts.push(hub.getStrollerKinds().length); }
    // --- alle Flags + Kapitel 6: Render ohne Exception mit Fallback UND mit (echten/fake) Sprites
    gs.story.chapter = 6; gs.ngPlusLevel = 1; gs.story.flags = ['kael_memorial', 'kael_forward', 'lyra_clinic', 'nyx_redeemed', 'vex_spiral', 'vex_stays'];
    hub.onEnter('shop');
    const art = getHDArt(); const saved = {}; for (const k of Object.keys(M10_OPTIONAL_SPRITES)) { saved[k] = art[k]; art[k] = null; }
    try { for (let i = 0; i < 20; i++) { hub.update(0.05, idle); hub.render(ctx); } out.fallbackRender = true; } catch (e) { out.fallbackRender = String(e); }
    const fake = document.createElement('canvas'); fake.width = 96; fake.height = 96; fake.getContext('2d').fillStyle = '#f0f'; fake.getContext('2d').fillRect(8, 8, 80, 80);
    for (const k of Object.keys(M10_OPTIONAL_SPRITES)) art[k] = saved[k] || fake;
    try { for (let i = 0; i < 10; i++) { hub.update(0.05, idle); hub.render(ctx); } out.spriteRender = true; } catch (e) { out.spriteRender = String(e); }
    for (const k of Object.keys(saved)) art[k] = saved[k];
    // --- Obelisk: solide
    gs.story.chapter = 4; gs.story.flags = []; hub.onEnter('shop');
    hub.playerX = 240; hub.playerY = 200;
    for (let i = 0; i < 200; i++) hub.update(0.02, moving(0, -1));
    out.obeliskBlock = [Math.round(hub.playerY), hub.getEvolution().getColliders()[0]];
    // --- Passanten laufen nicht durch den Obelisk (lange Simulation)
    gs.story.chapter = 6; hub.onEnter('shop'); hub.playerX = 90; hub.playerY = 140;
    let minD = 999; const col = hub.getEvolution().getColliders()[0];
    for (let i = 0; i < 6000; i++) { hub.update(0.05, idle); for (const s of hub.strollers) minD = Math.min(minD, Math.hypot(s.x - col.x, s.y - col.y)); }
    out.minStrollerDist = Math.round(minD * 10) / 10; out.colR = col.r;
    // --- Sprechblasen
    gs.story.chapter = 2; gs.story.flags = ['vex_shared_signal']; hub.onEnter('shop'); hub.playerX = 90; hub.playerY = 140; hub.activePrompt = null;
    out.chatterTriggered = hub.triggerChatter(true); const t1 = hub.chatter?.text ?? '';
    out.chatterLen = t1.length; out.chatterLines = hub['wrapChatter'](t1).map((l) => l.length);
    hub.render(ctx);
    // pool filter
    const texts = new Set(); for (let i = 0; i < 400; i++) { hub.chatter = null; hub.triggerChatter(true); if (hub.chatter) texts.add(hub.chatter.text); }
    const allFacts = [...new Set(ch.CHATTER_LINES.map((l) => l.needs).filter(Boolean))];
    out.poolOk = [...texts].every((t) => ch.getChatterPool(2, ['vex_shared_signal'], allFacts).some((l) => l.text === t)) && ch.CHATTER_LINES.every((l) => l.text.length <= 68);
    out.hasFlagLine = texts.has('Vex sagt, das Echo sind Koordinaten!');
    out.noWrongChapter = ![...texts].some((t) => ch.CHATTER_LINES.find((l) => l.text === t && l.minChapter > 2));
    hub.chatter = null; hub.activePrompt = { label: 'x', x: 0, y: 0 }; out.blockedByPrompt = hub.triggerChatter() === false;
    hub.activePrompt = null; for (const s of hub.strollers) { s.x = hub.playerX + 10; s.y = hub.playerY; } out.blockedByProximity = hub.triggerChatter() === false;
    hub.update(0.05, idle);
    // --- Feuerwerk
    gs.story.chapter = 5; hub.onEnter('shop'); const evo = hub.getEvolution(); evo.debugFirework();
    for (let i = 0; i < 10; i++) hub.render(ctx);
    out.sparks = evo.getSparkCount();
    for (let i = 0; i < 60; i++) hub.render(ctx);
    out.sparksLater = evo.getSparkCount();
    // --- Chapter 0 hat nichts
    gs.story.chapter = 0; gs.story.flags = []; out.ch0 = evo.getActiveElementIds().length;
    gs.story.chapter = 6; gs.story.flags = ['kael_memorial', 'vex_spiral']; out.ch6ids = evo.getActiveElementIds();
    return out;
  });
  console.log(JSON.stringify(r));
  const ok = r.artKeys === 12 && r.artValid && r.counts.join() === '2,2,3,4,5,6,6' && r.fallbackRender === true && r.spriteRender === true &&
    r.obeliskBlock[0] > r.obeliskBlock[1].y + r.obeliskBlock[1].r - 1 && r.minStrollerDist >= r.colR - 0.5 &&
    r.chatterTriggered && r.chatterLen <= 68 && r.chatterLines.every((n) => n <= 34) && r.chatterLines.length <= 2 && r.poolOk && r.hasFlagLine && r.noWrongChapter && r.blockedByPrompt && r.blockedByProximity &&
    r.sparks > 10 && r.sparksLater < r.sparks && r.ch0 === 0 && r.ch6ids.includes('kael_memorial') && r.ch6ids.includes('vex_beacon') && !r.ch6ids.includes('vex_classboard');
  if (!ok) throw new Error('M10 Phase 3 assert failed');
  console.log('M10 PHASE3 OK');
};
