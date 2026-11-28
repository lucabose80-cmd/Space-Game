module.exports = async ({ page, scratch }) => {
  const sleep = (ms) => page.waitForTimeout(ms);
  await page.evaluate(async () => {
    const g = window.__game;
    document.getElementById('title-overlay')?.classList.add('hidden');
    g.ui.titleVisible = false;
    g.state.resetSave();
    g.activeScene = 'hub'; g.ui.currentScene = 'hub';
    g.hubScene.onEnter('shop');
    g.ui.renderHud();
    const dev = await import('/src/systems/deviceSettings.ts');
    window.__dev = dev;
    dev.saveDeviceSettings({ textSpeed: 'instant' });
  });
  const res = {};
  // ---- A: Kael (Antwort B setzt knows_juno, danach öffnet die Schmiede)
  res.A = await page.evaluate(() => {
    const g = window.__game, ui = g.ui; const o = {};
    g.state.rescuedCrew = ['mina', 'pip', 'ping', 'midnight']; g.state.markCutsceneSeen('tut_spring_hint'); // P7: sonst kämen zuerst Crew-Hinweis & Heilquellen-Tutorial
    o.pendingBefore = g.state.getPendingScene('kael')?.id;
    g.hubScene.callbacks.onOpenForge();
    o.storyOpen = !!document.querySelector('.m10-story'); o.title = document.querySelector('.m10-story-title')?.textContent;
    const c = ui.activeStory; o.n1 = c.getState().nodeId;
    c.advance(); c.advance(); o.n3 = [c.getState().nodeId, c.getState().choices, c.getState().awaitingChoice];
    c.choose(1);
    o.flag = g.state.story.flags.includes('knows_juno'); o.trustKael = g.state.story.trust.kael;
    o.afterChoose = c.getState().nodeId;
    c.advance(); // b1 -> b2
    c.advance(); // b2 -> end
    o.finished = c.getState().finished; o.storyGone = !document.querySelector('.m10-story'); o.modalOpen = ui.modalOpen;
    o.forgeOpen = /SCHMIEDE|Schmiede|EXO/i.test(document.querySelector('.modal-title')?.textContent ?? '');
    o.seen = g.state.story.seenScenes.includes('kael_c0'); o.pendingAfter = g.state.getPendingScene('kael')?.id ?? null;
    ui.closeModal();
    return o;
  });
  // ---- B: Lyra „Später“
  res.B = await page.evaluate(() => {
    const g = window.__game, ui = g.ui; const o = {};
    g.hubScene.callbacks.onOpenMedBay();
    const later = document.querySelector('#m10-later'); o.laterText = later.textContent; o.laterVisible = getComputedStyle(later).visibility;
    later.click();
    o.storyGone = !document.querySelector('.m10-story'); o.medbayOpen = ui.modalOpen;
    o.skipped = g.state.isSceneSkipped('lyra_c0'); o.seen = g.state.story.seenScenes.includes('lyra_c0');
    o.pending = g.state.getPendingScene('lyra')?.id;
    ui.closeModal();
    return o;
  });
  // ---- C: Nyx ESC (kein Laden)
  res.C = await page.evaluate(() => {
    const g = window.__game, ui = g.ui; const o = {};
    g.hubScene.callbacks.onOpenBlackMarket();
    o.open = ui.modalOpen; ui.closeModal();
    o.closed = !ui.modalOpen; o.skipped = g.state.isSceneSkipped('nyx_c0'); o.noListener = ui.activeStory?.getState().finished ?? true;
    return o;
  });
  // ---- D: Tastatur (E darf NICHT in die Welt durchrutschen), 1-3 wählen
  res.D = await page.evaluate(async () => {
    const g = window.__game, ui = g.ui; const o = {};
    let worldKeys = 0; const spy = (e) => { if (e.code === 'KeyE') worldKeys++; };
    window.addEventListener('keydown', spy);
    g.hubScene.callbacks.onOpenTechLab();
    const c = ui.activeStory;
    const key = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    key('KeyE'); o.afterE = c.getState().nodeId;
    o.choices = c.getState().choices;
    key('Digit1'); o.trustVex = g.state.story.trust.vex; // a: +2
    key('Enter'); key('Space'); key('Enter');
    o.finished = c.getState().finished;
    o.worldKeysDuring = worldKeys;
    ui.closeModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true, cancelable: true }));
    o.worldKeysAfter = worldKeys; window.removeEventListener('keydown', spy);
    o.seen = g.state.story.seenScenes.includes('vex_c0');
    return o;
  });
  // ---- E: Schreibmaschine (normal)
  res.E = await page.evaluate(async () => {
    const g = window.__game, ui = g.ui; const o = {};
    window.__dev.saveDeviceSettings({ textSpeed: 'normal' });
    const scene = (await import('/src/systems/storyEngine.ts')).getSceneById('kael_c1');
    const c = ui.openStoryScene(scene, { replay: true });
    o.typing0 = c.getState().typing; o.len0 = document.querySelector('#m10-text').textContent.length;
    window.__c = c; window.__full = c.getState().text.length;
    return o;
  });
  await sleep(350);
  res.E2 = await page.evaluate(() => {
    const c = window.__c; const o = {};
    o.partial = document.querySelector('#m10-text').textContent.length; o.full = window.__full; o.stillTyping = c.getState().typing;
    c.advance(); o.afterAdvance = document.querySelector('#m10-text').textContent.length; o.typingAfter = c.getState().typing;
    window.__ui_close = true; window.__game.ui.closeModal();
    window.__dev.saveDeviceSettings({ textSpeed: 'instant' });
    return o;
  });
  // ---- F: Kapitelwechsel + Variante + Replay ohne Wirkung
  res.F = await page.evaluate(() => {
    const g = window.__game, ui = g.ui; const o = {};
    g.state.sector1Cleared = true; o.newChapter = g.state.refreshStoryChapter(); o.title = g.state.getStoryChapterTitle();
    const sc = g.state.getPendingScene('kael'); o.pending = sc.id;
    g.hubScene.callbacks.onOpenForge();
    const c = ui.activeStory; c.advance(); // n1 -> n2 (variant)
    o.variant = c.getState().text.startsWith('Das ist Junos Zeichen');
    c.skipLater();
    // Chronik-Replay
    const trustBefore = JSON.stringify(g.state.story.trust), flagsBefore = JSON.stringify(g.state.story.flags), logBefore = g.state.story.choiceLog.length;
    ui.openInventoryModal(true, 'logbook');
    o.chronicle = !!document.querySelector('.m10-chronicle'); o.replayBtns = document.querySelectorAll('[data-story-replay]').length;
    document.querySelector('[data-story-replay="kael_c0"]').click();
    const rc = ui.activeStory; rc.advance(); rc.advance();
    rc.choose(0); rc.advance();
    o.replayEffects = [JSON.stringify(g.state.story.trust) !== trustBefore, JSON.stringify(g.state.story.flags) !== flagsBefore, g.state.story.choiceLog.length !== logBefore];
    // after replay finishes -> back in logbook
    for (let i = 0; i < 6 && !rc.getState().finished; i++) rc.advance();
    o.backToLogbook = !!document.querySelector('.m10-chronicle');
    ui.closeModal();
    return o;
  });
  // ---- G: Omega-Fest
  res.G = await page.evaluate(() => {
    const g = window.__game, ui = g.ui; const o = {};
    g.state.sector2Cleared = g.state.sector3Cleared = g.state.sector4Cleared = g.state.omegaCleared = true; g.state.refreshStoryChapter();
    o.chapter = g.state.story.chapter;
    let calls = 0; const orig = g.hubScene.callbacks.onFestivalDue; g.hubScene.callbacks.onFestivalDue = () => { calls++; orig(); };
    g.hubScene.onEnter('shop');
    const input = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : () => false) });
    g.activeScene = 'hub';
    for (let i = 0; i < 70; i++) g.hubScene.update(0.016, input); // 1.1 s
    o.calls = calls; o.festivalOpen = !!document.querySelector('.m10-story'); o.title = document.querySelector('.m10-story-title')?.textContent;
    const c = ui.activeStory; o.laterLabel = document.querySelector('#m10-later').textContent;
    c.advance(); o.speakerNode = c.getState().nodeId; // n1 -> speech_x
    o.speaker = document.querySelector('#m10-speaker').textContent;
    c.skipLater();
    o.seenFlag = g.state.story.flags.includes('festival_seen');
    o.closed = !ui.modalOpen;
    g.hubScene.onEnter('shop'); for (let i = 0; i < 70; i++) g.hubScene.update(0.016, input);
    o.callsAfterSecond = calls;
    return o;
  });
  // ---- H: Boni
  res.H = await page.evaluate(async () => {
    window.__game.state.rescuedCrew = []; // P7: Mitternacht würde ein Zusatzangebot erzeugen
    const g = window.__game, ui = g.ui; const o = {};
    const { UPGRADE_TRACKS } = await import('/src/data/upgrades.ts');
    const tr = UPGRADE_TRACKS.find((t) => t.shop === 'forge' && t.weaponId === 'blade');
    const base = tr.tiers[0].creditCost;
    o.noPerk = [g.state.getForgeCreditCost(base, 'forge'), g.state.getForgeCreditCost(base, 'medbay')];
    g.state.story.trust.kael = 7;
    o.perk = [g.state.getForgeCreditCost(base, 'forge'), g.state.getForgeCreditCost(base, 'medbay'), Math.round(base * 0.95)];
    g.state.credits = base; g.state.upgrades.blade = 0;
    o.affordableDiscount = [g.state.credits >= base, g.state.canAffordUpgrade('blade')]; // materials may block
    ui.openForgeModal(); o.priceShown = document.querySelector('.modal-body').innerText.includes(`${Math.round(base * 0.95)} Cr`);
    ui.closeModal();
    // lyra
    const stim0 = g.state.getStats().maxStimCharges; g.state.story.trust.lyra = 7; const stim1 = g.state.getStats().maxStimCharges;
    g.state.activeTrial = { weekId: '2026-W48', sector: 1, mutator: 'armored', endsAtUtc: 0 }; const stimTrial = g.state.getStats().maxStimCharges; g.state.story.trust.lyra = 2; const stimTrialNoPerk = g.state.getStats().maxStimCharges; g.state.story.trust.lyra = 7; g.state.activeTrial = null;
    o.stim = [stim0, stim1, stimTrial, stimTrialNoPerk];
    // nyx
    g.state.story.trust.nyx = 2; const n0 = g.state.generateNyxStock().length; g.state.story.trust.nyx = 7; const n1 = g.state.generateNyxStock().length; o.nyx = [n0, n1];
    // achievements
    g.state.story.trust.vex = 7; g.state.checkAchievements(false); o.heart = g.state.unlockedAchievements.includes('heart_of_solaris');
    g.state.story.seenScenes.push('kael_c5', 'lyra_c5', 'nyx_c5', 'vex_c5'); g.state.checkAchievements(false); o.chron = g.state.unlockedAchievements.includes('chronicler');
    // vex scanner on minimap
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const dng = new DungeonScene(g.state, { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    o.scanner = true;
    return o;
  });
  console.log(JSON.stringify(res, null, 1));
  const R = res;
  const ok = R.A.pendingBefore === 'kael_c0' && R.A.storyOpen && /Prolog/.test(R.A.title) && R.A.n1 === 'n1' && R.A.n3.join() === 'n3,3,true' && R.A.flag && R.A.trustKael === 2 && R.A.afterChoose === 'b1' &&
    R.A.finished && R.A.storyGone && R.A.modalOpen && R.A.seen && R.A.pendingAfter === null &&
    /Später/.test(R.B.laterText) && R.B.storyGone && R.B.medbayOpen && R.B.skipped && !R.B.seen && R.B.pending === 'lyra_c0' &&
    R.C.open && R.C.closed && R.C.skipped &&
    R.D.afterE === 'n2' && R.D.choices === 2 && R.D.trustVex === 4 && R.D.finished && R.D.worldKeysDuring === 0 && R.D.worldKeysAfter === 1 && R.D.seen &&
    R.E.typing0 && R.E.len0 < 5 && R.E2.partial > 3 && R.E2.partial < R.E2.full && R.E2.afterAdvance === R.E2.full && !R.E2.typingAfter &&
    R.F.newChapter === 1 && R.F.pending === 'kael_c1' && R.F.variant && R.F.chronicle && R.F.replayBtns >= 1 && R.F.replayEffects.every((x) => x === false) && R.F.backToLogbook &&
    R.G.chapter === 5 && R.G.calls === 1 && R.G.festivalOpen && /Überspringen/.test(R.G.laterLabel) && R.G.seenFlag && R.G.closed && R.G.callsAfterSecond === 1 &&
    true;
  const okH = R.H.perk[0] === R.H.perk[2] && R.H.perk[1] === R.H.noPerk[1] && R.H.priceShown && R.H.stim[1] === R.H.stim[0] + 1 && R.H.stim[2] === R.H.stim[3] && R.H.nyx[1] === R.H.nyx[0] + 1 && R.H.heart && R.H.chron;
  if (!ok || !okH) throw new Error('M10 Phase 2 assert failed');
  console.log('M10 PHASE2 OK');
};
