module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { sound } = await import('/src/engine/audio.ts');
    const g = window.__game;
    document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;
    const out = {};
    // --- Spies (kein echter Ton nötig)
    const calls = { voice: [], noise: 0, sting: 0 };
    const origVoice = sound['playMusicVoice'], origNoise = sound['playMusicNoise'], origSting = sound.playPhaseShiftSting;
    sound['playMusicVoice'] = (f, d, t, v) => calls.voice.push({ f, t, v });
    sound['playMusicNoise'] = () => { calls.noise++; };
    sound.playPhaseShiftSting = () => { calls.sting++; };
    const fakeCtx = { state: 'running' };
    const realCtx = sound['ctx'];
    sound['ctx'] = fakeCtx; sound.setMuted(false); sound.setMusicMuted(false);
    const ticks = (n) => { for (let i = 0; i < n; i++) sound['tickMusic'](); };
    const reset = () => { calls.voice.length = 0; calls.noise = 0; sound['musicStep'] = 0; };
    // --- Boss-Track normal vs. intensiv
    sound.setMusicTrack('boss'); sound.setMusicIntensity(0); reset(); ticks(16); out.normal = [calls.voice.length, calls.noise];
    sound.setMusicIntensity(1); reset(); ticks(16); out.intense = [calls.voice.length, calls.noise];
    out.octave = calls.voice.filter((v) => v.t === 'square' && v.v < 0.022).length; // Oktav-Dopplungen (0.45 × leadVol)
    // --- Intensität wirkt nur bei Track 'boss'
    sound.setMusicTrack('dungeon'); reset(); ticks(16); out.nonBossNoise = calls.noise; out.nonBossVoices = calls.voice.length;
    sound.setMusicTrack('boss');
    // --- Jukebox-Override auf boss zählt auch (aktiver Track)
    sound.setJukeboxTrack('boss'); sound.setMusicTrack('shop_day'); reset(); ticks(16); out.jukeboxBossNoise = calls.noise; sound.setJukeboxTrack(null); sound.setMusicTrack('boss');
    // --- Musik aus -> keine Hi-Hats (Spy greift VOR der Guard; deshalb echte Funktion prüfen)
    sound['playMusicNoise'] = origNoise; sound['noiseBuffer'] = {};
    let created = 0; sound['ctx'] = { state: 'running', currentTime: 0, createBufferSource: () => { created++; throw new Error('should not run'); } };
    sound.setMusicMuted(true); try { origNoise.call(sound, 0.03, 7000, 0.02); out.mutedSafe = created === 0; } catch (e) { out.mutedSafe = String(e); }
    sound.setMusicMuted(false); sound.setMuted(true); try { origNoise.call(sound, 0.03, 7000, 0.02); out.sfxMutedSafe = created === 0; } catch (e) { out.sfxMutedSafe = String(e); }
    sound.setMuted(false);
    sound['playMusicNoise'] = () => { calls.noise++; }; sound['ctx'] = fakeCtx;
    sound.setMusicMuted(true); reset(); ticks(16); out.mutedTicks = [calls.voice.length, calls.noise]; sound.setMusicMuted(false);
    // --- Intervall: nur bei Änderung, Faktor 0.82
    const delays = []; const origSI = window.setInterval; window.setInterval = (fn, ms, ...a) => { delays.push(ms); return origSI(fn, ms, ...a); };
    sound.setMusicIntensity(0); sound.setMusicTrack('boss'); delays.length = 0;
    sound.setMusicIntensity(1); sound.setMusicIntensity(1); const d1 = [...delays]; delays.length = 0;
    sound.setMusicIntensity(0); const d0 = [...delays];
    window.setInterval = origSI; out.intervals = [d1, d0];
    // Takt läuft weiter (musicStep wird nicht zurückgesetzt)
    sound['musicStep'] = 5; sound.setMusicIntensity(1); out.stepKept = sound['musicStep'] === 5; sound.setMusicIntensity(0);
    // --- isBossPhase2Active + echtes syncMusic im Spiel
    const dng = await g.dungeonReady; const boss = { id: 1, kind: 'boss_leviathan', hp: 100, maxHp: 100, x: 0, y: 0, radius: 10, bossPhase2: false };
    const minion = { id: 2, kind: 'drone', hp: 10, maxHp: 10, x: 0, y: 0, radius: 6, bossPhase2: true };
    dng.enemies = [minion]; out.minionNot = dng.isBossPhase2Active() === false;
    dng.enemies = [boss]; out.phase1 = dng.isBossPhase2Active() === false;
    const savedRoom = dng.currentRoom; dng.currentRoom = { type: 'boss' }; g.activeScene = 'dungeon'; calls.sting = 0; g.lastBossPhase2 = false;
    g.syncMusic(); g.syncMusic(); out.stingBefore = calls.sting; out.intBefore = sound.getMusicIntensity();
    boss.bossPhase2 = true; g.syncMusic(); g.syncMusic(); g.syncMusic(); out.stingAfter = calls.sting; out.intAfter = sound.getMusicIntensity(); out.activeIsBoss = sound.getActiveMusicTrack();
    dng.enemies = []; g.syncMusic(); out.intDead = sound.getMusicIntensity(); // Boss tot → zurück
    boss.bossPhase2 = true; dng.enemies = [boss]; g.syncMusic(); out.sting2 = calls.sting; // erneuter Wechsel → 2. Sting
    g.activeScene = 'hub'; g.syncMusic(); out.intHub = sound.getMusicIntensity(); out.lastReset = g.lastBossPhase2;
    dng.enemies = []; dng.currentRoom = savedRoom;
    // --- Ohne AudioContext keine Exception
    sound.playPhaseShiftSting = origSting; sound['ctx'] = null;
    try { sound.playPhaseShiftSting(); sound['tickMusic'](); out.noCtx = true; } catch (e) { out.noCtx = String(e); }
    sound['playMusicVoice'] = origVoice; sound['playMusicNoise'] = origNoise; sound['ctx'] = realCtx; sound.setMusicIntensity(0);
    return out;
  });
  console.log(JSON.stringify(r));
  const ok = r.normal.join() === '32,0' && r.intense.join() === '50,8' && r.octave === 16 && r.nonBossNoise === 0 && r.jukeboxBossNoise === 8 &&
    r.mutedSafe === true && r.sfxMutedSafe === true && r.mutedTicks.join() === '0,0' &&
    r.intervals[0].length === 1 && r.intervals[0][0] === Math.round(155 * 0.82) && r.intervals[1].length === 1 && r.intervals[1][0] === 155 && r.stepKept &&
    r.minionNot && r.phase1 && r.stingBefore === 0 && r.intBefore === 0 && r.stingAfter === 1 && r.intAfter === 1 && r.activeIsBoss === 'boss' && r.intDead === 0 && r.sting2 === 2 && r.intHub === 0 && r.lastReset === false && r.noCtx === true;
  if (!ok) throw new Error('M10 Phase 6 assert failed');
  console.log('M10 PHASE6 OK');
};
