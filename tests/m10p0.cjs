module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const eng = await import('/src/systems/storyEngine.ts');
    const ch = await import('/src/data/story/storyChapters.ts');
    const sc = await import('/src/data/story/storyScenes.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const dev = await import('/src/systems/deviceSettings.ts');
    const out = {};
    // v10 save with S3 cleared and no story field
    const g = new GameState(); g.sector1Cleared = g.sector2Cleared = g.sector3Cleared = true;
    const v10 = JSON.parse(g.exportSaveJson()); v10.version = 10; delete v10.story;
    const g2 = new GameState(); out.imp = g2.importSaveJson(JSON.stringify(v10)).ok;
    out.chapter = g2.story.chapter; out.trust = { ...g2.story.trust }; out.ver = JSON.parse(g2.exportSaveJson()).version;
    // roundtrip
    g2.story.seenScenes.push('kael_c0'); g2.story.flags.push('knows_juno'); g2.story.trust.kael = 7;
    const g3 = new GameState(); g3.importSaveJson(g2.exportSaveJson());
    out.rt = g3.story.seenScenes.includes('kael_c0') && g3.story.flags.includes('knows_juno') && g3.story.trust.kael === 7;
    // garbage story is sanitised
    const bad = JSON.parse(g2.exportSaveJson()); bad.story = { chapter: 99, trust: { kael: 99, lyra: -5, nyx: 'x' }, flags: ['nope', 'knows_juno'], seenScenes: ['zzz', 'kael_c0'], choiceLog: new Array(200).fill({ sceneId: 'kael_c0', choiceId: 'a', ts: 1 }) };
    const g4 = new GameState(); g4.importSaveJson(JSON.stringify(bad));
    out.sanit = [g4.story.chapter, g4.story.trust.kael, g4.story.trust.lyra, g4.story.trust.nyx, g4.story.flags.join(), g4.story.seenScenes.join(), g4.story.choiceLog.length];
    // NG+ keeps chapter
    const n = new GameState(); n.sector1Cleared = n.sector2Cleared = n.sector3Cleared = n.sector4Cleared = n.omegaCleared = true; n.refreshStoryChapter(false);
    out.before = n.story.chapter; n.startNewGamePlus(); out.afterNg = [n.story.chapter, n.sector1Cleared];
    // pending scene (oldest unseen)
    const mk = (chapter, seen = []) => ({ ...ch.createEmptyStory(), chapter, seenScenes: seen });
    const fake = [
      { id: 'kael_c0', npc: 'kael', chapter: 0, title: '', start: 'a', nodes: {} },
      { id: 'kael_c1', npc: 'kael', chapter: 1, title: '', start: 'a', nodes: {} },
      { id: 'kael_c2', npc: 'kael', chapter: 2, title: '', start: 'a', nodes: {} },
    ];
    out.pending = [eng.getPendingScene(mk(2), 'kael', fake)?.id, eng.getPendingScene(mk(2, ['kael_c0']), 'kael', fake)?.id, eng.getPendingScene(mk(0, ['kael_c0']), 'kael', fake)?.id ?? null, eng.getPendingScene(mk(2), 'vex', fake)?.id ?? null];
    // applyChoice clamp + perk
    const p = mk(0); p.trust.kael = 6;
    const res = eng.applyChoice(p, 'kael_c0', { id: 'a', label: 'x', tone: 'warm', trust: { kael: 9 }, chronicle: 'c', next: 'end' }, 1);
    out.clamp = [p.trust.kael, res.newPerks, p.choiceLog.length];
    p.trust.lyra = 0; eng.applyChoice(p, 'x', { id: 'b', label: 'x', tone: 'warm', trust: { lyra: -1 }, chronicle: 'c', next: 'end' }, 2); out.clampLow = p.trust.lyra;
    // nyx_redeemed 4 combos
    const combos = [['nyx_confronted', 5, true], ['nyx_confronted', 4, false], ['nyx_covered', 7, true], ['nyx_covered', 6, false]];
    out.redeemed = combos.map(([flag, trust, want]) => { const q = mk(4); q.trust.nyx = trust; q.flags.push(flag); eng.recomputeDerivedFlags(q); return eng.hasFlag(q, 'nyx_redeemed') === want; });
    // redeemed removed again if trust fell
    const q2 = mk(4); q2.flags.push('nyx_confronted', 'nyx_redeemed'); q2.trust.nyx = 3; eng.recomputeDerivedFlags(q2); out.unset = !eng.hasFlag(q2, 'nyx_redeemed');
    // festival speaker
    const f = mk(5); f.trust = { kael: 4, lyra: 6, nyx: 6, vex: 2 }; out.speaker = [eng.pickFestivalSpeaker(f), eng.resolveNext('@speaker', f), eng.resolveNext('n2', f)];
    // validator
    out.valid = eng.validateStoryScenes(sc.STORY_SCENES);
    const broken = JSON.parse(JSON.stringify(sc.STORY_SCENES[0]));
    broken.nodes.a1.next = 'nirgendwo'; broken.nodes.c1.text = 'x'.repeat(200);
    out.invalid = eng.validateStoryScenes([broken]);
    out.complete = eng.validateStoryScenes(sc.STORY_SCENES, { requireComplete: true }).length > 0;
    out.fmt = eng.formatStoryText('Hi {captain}!', 'Luca');
    // chapter compute
    out.compute = [ch.computeStoryChapter({ sector1Cleared: false, sector2Cleared: false, sector3Cleared: false, sector4Cleared: false, omegaCleared: false, ngPlusLevel: 0 }), ch.computeStoryChapter({ sector1Cleared: true, sector2Cleared: true, sector3Cleared: true, sector4Cleared: true, omegaCleared: true, ngPlusLevel: 1 })];
    // chatter pool
    out.chatter = [ch.getChatterPool(0, []).length, ch.getChatterPool(2, ['vex_shared_signal']).some((l) => l.flag === 'vex_shared_signal'), ch.getChatterPool(2, []).some((l) => l.flag)];
    out.chatterMax = Math.max(...ch.CHATTER_LINES.map((l) => l.text.length));
    // device settings
    localStorage.setItem(dev.DEVICE_SETTINGS_KEY, '{kaputt'); dev.resetDeviceSettingsCacheForTest();
    out.devBroken = JSON.stringify(dev.loadDeviceSettings()) === JSON.stringify(dev.DEFAULT_DEVICE_SETTINGS);
    localStorage.setItem(dev.DEVICE_SETTINGS_KEY, JSON.stringify({ touchScale: 7, aimAssist: 'smart', textSpeed: 'fast' }));
    out.devPartial = dev.loadDeviceSettings();
    dev.resetDeviceSettingsCacheForTest();
    let notified = 0; const off = dev.onDeviceSettingsChange(() => notified++);
    dev.saveDeviceSettings({ touchScale: 1.3 }); off(); dev.saveDeviceSettings({ aimAssist: 'off' });
    out.devSave = [dev.getDeviceSettings().touchScale, dev.getDeviceSettings().aimAssist, notified, 'touchScale' in JSON.parse(new GameState().exportSaveJson())];
    localStorage.removeItem(dev.DEVICE_SETTINGS_KEY); dev.resetDeviceSettingsCacheForTest();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.imp && r.chapter === 3 && r.trust.kael === 2 && r.ver === 11 && r.rt &&
    r.sanit.join('|') === '6|10|0|2|knows_juno|kael_c0|80' &&
    r.before === 5 && r.afterNg[0] === 6 && r.afterNg[1] === false &&
    r.pending.join() === 'kael_c0,kael_c1,,' && r.clamp[0] === 10 && r.clamp[1].join() === 'kael' && r.clampLow === 0 &&
    r.redeemed.every(Boolean) && r.unset && r.speaker.join() === 'lyra,speech_lyra,n2' &&
    r.valid.length === 0 && r.invalid.length >= 2 && r.complete === false && r.fmt === 'Hi Luca!' && r.compute.join() === '0,6' &&
    r.chatter[1] === true && r.chatter[2] === false && r.chatterMax <= 68 &&
    r.devBroken && r.devPartial.touchScale === 1 && r.devPartial.aimAssist === 'smart' && r.devPartial.textSpeed === 'fast' &&
    r.devSave[0] === 1.3 && r.devSave[1] === 'off' && r.devSave[2] === 1 && r.devSave[3] === false;
  if (!ok) throw new Error('M10 Phase 0 assert failed');
  console.log('M10 PHASE0 OK');
};
