module.exports = async ({ page, scratch }) => {
  await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { UIManager } = await import('/src/ui/UIManager.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const noop = () => {};
    const gs = new GameState(); window.__gs = gs;
    window.__ui = new UIManager(gs, { onStartNewGame: noop, onContinueGame: noop, onToggleShopOpen: noop, onSwapWeapon: noop, onModalStateChange: noop, onMuteToggle: noop, onMusicToggle: noop });
    window.__ui.titleVisible = false;
  });
  const res = {};
  // 1. Gate modal newcomer
  res.newcomer = await page.evaluate(() => {
    const ui = window.__ui, gs = window.__gs; const calls = [];
    ui.openOmegaGateModal(() => calls.push('omega'), () => calls.push('spiral'), (i) => calls.push('trial:' + i.weekId));
    const m = ui.modalEl;
    return { omegaBtn: !!m.querySelector('#btn-launch-omega-classic'), spiralBtn: !!m.querySelector('#btn-launch-endless-spiral'), trialBtn: !!m.querySelector('#btn-launch-weekly-trial'), text: m.innerText.includes('0/4 Sektor-Siegel') };
  });
  await page.screenshot({ path: `${scratch}/p4c_gate_newcomer.png` });
  // 2. veteran
  res.veteran = await page.evaluate(() => {
    const ui = window.__ui, gs = window.__gs; const calls = []; window.__calls = calls;
    ui.closeModal();
    gs.sector1Cleared = gs.sector2Cleared = gs.sector3Cleared = gs.sector4Cleared = true; gs.omegaCleared = true;
    gs.weeklyTrial = null;
    ui.openOmegaGateModal(() => calls.push('omega'), () => calls.push('spiral'), (i) => calls.push('trial:' + i.weekId + ':' + i.sector));
    const m = ui.modalEl;
    const out = { omegaBtn: !!m.querySelector('#btn-launch-omega-classic'), spiralBtn: !!m.querySelector('#btn-launch-endless-spiral'), trialBtn: !!m.querySelector('#btn-launch-weekly-trial') };
    return out;
  });
  await page.screenshot({ path: `${scratch}/p4c_gate_veteran.png` });
  res.click = await page.evaluate(() => { window.__ui.modalEl.querySelector('#btn-launch-weekly-trial').click(); return { calls: window.__calls, open: window.__ui.modalOpen }; });
  // 3. result modal from real run + upload status
  const shot = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { getCurrentWeeklyTrial } = await import('/src/systems/weeklyTrial.ts');
    const { galacticNetwork } = await import('/src/services/galacticNetwork.ts');
    const gs = window.__gs; const sums = [];
    const dng = new DungeonScene(gs, { onReturnToHub: (s) => sums.push(s), onToast: () => {}, onHudDirty: () => {} });
    const info = getCurrentWeeklyTrial();
    dng.startWeeklyTrial(info); dng.startFloor(3, false, info.sector); dng.floorBossDefeated = true; dng.runElapsedSec = 377; dng.roomsCleared = 14; dng.enemiesDefeated = 41;
    dng.triggerSafeWarp('boss_victory', false);
    const set = window.__ui.openWeeklyTrialResultModal(sums[0]);
    const up = await galacticNetwork.submitWeeklyTrial(gs);
    set('Lokal gespeichert — melde dich an der Kapitäns-Tafel an, um an der Wochen-Rangliste teilzunehmen.', 'warn');
    return { sum: { v: sums[0].victory, badge: sums[0].trialResult.badge, best: sums[0].trialResult.isNewBest }, upload: up, uploaded: gs.weeklyTrial.uploaded, status: document.getElementById('trial-upload-status').textContent };
  });
  res.result = shot;
  await page.screenshot({ path: `${scratch}/p4c_result.png` });
  // 4. trial board
  res.board = await page.evaluate(async () => {
    const ui = window.__ui, gs = window.__gs;
    const { getCurrentWeeklyTrial } = await import('/src/systems/weeklyTrial.ts');
    ui.closeModal();
    const info = getCurrentWeeklyTrial();
    const base = { weekId: info.weekId, sector: info.sector, floorReached: 3, roomsCleared: 15, weapon: 'spear', suitTheme: 'solar', updatedAt: Date.now() };
    ui.guildTrialCache = [
      { ...base, uid: 'a', captainName: 'Nova <b>X</b>', completed: true, timeSec: 301, score: 301, badge: 'gold', attempts: 4 },
      { ...base, uid: 'b', captainName: 'Rix', completed: true, timeSec: 640, score: 640, badge: 'silver', attempts: 1, weapon: 'hammer', suitTheme: 'elder' },
      { ...base, uid: 'c', captainName: 'Zora', completed: false, timeSec: 10800, floorReached: 2, score: 998000, badge: null, attempts: 9 },
      { ...base, uid: 'old', weekId: '2020-W01', captainName: 'OldWeek', completed: true, timeSec: 10, score: 10, badge: 'gold', attempts: 1 },
    ];
    ui.openGuildBoardModal('trial');
    const m = ui.modalEl;
    return { rows: [...m.querySelectorAll('strong')].map((x) => x.textContent), oldWeekHidden: !m.innerText.includes('OldWeek'), me: m.innerText.includes('DU'), xss: !m.querySelector('.modal-body b') };
  });
  await page.screenshot({ path: `${scratch}/p4c_board.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__ui.closeModal());
  await page.evaluate(() => window.__ui.openOmegaGateModal(() => {}, () => {}, () => {}));
  await page.screenshot({ path: `${scratch}/p4c_gate_mobile.png` });
  await page.setViewportSize({ width: 1280, height: 720 });
  // 5. hangar gate always interactable
  res.hangar = await page.evaluate(async () => {
    const { HangarScene } = await import('/src/scenes/HangarScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const gs = new GameState(); let launched = 0;
    const cb = { onReturnToHub() {}, onLaunchSector1() {}, onLaunchSector2() {}, onLaunchSector3() {}, onLaunchSector4() {}, onToast() {}, onLaunchOmegaGate: () => launched++ };
    const hs = new HangarScene(gs, cb);
    hs.onEnter('dungeon', 5);
    hs.entryCooldown = 0;
    const input = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'interactPressed' ? () => true : () => false) });
    hs.update(0.016, input);
    return { launched, prompt: hs.activePrompt?.label, keys: [gs.sector1Cleared, gs.sector4Cleared] };
  });
  console.log(JSON.stringify(res, null, 1));
  const ok = !res.newcomer.omegaBtn && !res.newcomer.spiralBtn && !res.newcomer.trialBtn && res.newcomer.text &&
    res.veteran.omegaBtn && res.veteran.spiralBtn && res.veteran.trialBtn && res.click.calls[0].startsWith('trial:') && !res.click.open &&
    res.result.sum.v && res.result.sum.badge === 'gold' && res.result.upload.ok === false && res.result.uploaded === false && res.result.upload.reason !== 'ok' &&
    res.board.oldWeekHidden && res.board.me && res.board.xss && res.hangar.launched === 1 && /Ziel wählen/.test(res.hangar.prompt);
  if (!ok) throw new Error('P4c assert failed');
  console.log('PHASE4c OK');
};
