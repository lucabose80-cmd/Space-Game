const fs = require('fs');
module.exports = async ({ page, scratch }) => {
  const ref = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'fixtures', 'aim_reference.json'), 'utf8'));
  const r = await page.evaluate(async (ref) => {
    const g = window.__game;
    document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const dev = await import('/src/systems/deviceSettings.ts');
    const out = {};
    localStorage.removeItem(dev.DEVICE_SETTINGS_KEY); dev.resetDeviceSettingsCacheForTest();
    const gs = new GameState();
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(1); dng.enemies.length = 0;
    let mv = { x: 0, y: 0 };
    const input = { isMouseActive: () => false, getMousePos: () => ({ x: 0, y: 0 }), getMoveVector: () => mv };
    dng.playerX = 240; dng.playerY = 140; dng.facing = 'right';
    const mkE = (x, y, extra = {}) => ({ id: dng.nextEnemyId++, kind: 'drone', x, y, hp: 20, maxHp: 20, radius: 8, ...extra });
    const cases = { none: [], one_right: [[300, 140]], two_near_far: [[280, 150], [200, 100]], behind_closer: [[220, 140], [330, 140]], five: [[260, 90], [300, 200], [180, 180], [350, 120], [230, 60]] };
    const run = () => { const o = {}; for (const [k, list] of Object.entries(cases)) { dng.enemies.length = 0; for (const [x, y] of list) dng.enemies.push(mkE(x, y)); for (const p of dng.currentRoom.pods) p.broken = true; o[k] = dng.getAimAngle(input); } return o; };
    // --- Standard = Referenz
    out.defaultMode = dev.getDeviceSettings().aimAssist;
    const std = run(); out.stdSame = Object.keys(ref).every((k) => std[k] === ref[k]); out.std = std;
    // --- Aus: Laufrichtung / Blickrichtung, kein Auto-Ziel (auch nicht auf Pods)
    dev.saveDeviceSettings({ aimAssist: 'off' });
    dng.enemies.length = 0; dng.enemies.push(mkE(300, 140));
    out.offMove = []; for (const m of [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: 0 }]) { mv = m; out.offMove.push(+dng.getAimAngle(input).toFixed(4)); }
    mv = { x: 0, y: 0 }; dng.facing = 'up'; out.offFacing = +dng.getAimAngle(input).toFixed(4); dng.facing = 'right';
    const pod = dng.currentRoom.pods[0]; pod.broken = false; pod.x = 250; pod.y = 150; dng.enemies.length = 0; out.offPod = dng.getAimAngle(input); pod.broken = true;
    out.offTarget = [dng.aimTargetId, dng.getAimTarget()];
    // --- Smart
    dev.saveDeviceSettings({ aimAssist: 'smart' });
    dng.enemies.length = 0; for (const [x, y] of cases.behind_closer) dng.enemies.push(mkE(x, y));
    mv = { x: 0, y: 0 }; dng.aimTargetId = null;
    const smartA = dng.getAimAngle(input); out.smartAhead = +smartA.toFixed(3); out.smartTarget = dng.getAimTarget() && [dng.getAimTarget().x, dng.getAimTarget().y];
    // Haftung: Ziel A (330,140) bleibt trotz knapp besserem B
    dng.enemies.length = 0; const a = mkE(300, 140), b = mkE(300, 110); dng.enemies.push(a, b); dng.aimTargetId = a.id; dng.getAimAngle(input); out.stickyKeep = dng.aimTargetId === a.id;
    // B deutlich besser (A weit weg & hinter dem Spieler) -> Wechsel
    a.x = 170; a.y = 140; b.x = 270; b.y = 140; dng.aimTargetId = a.id; dng.getAimAngle(input); out.stickySwitch = dng.aimTargetId === b.id;
    // Blickkegel bevorzugt Gegner in Laufrichtung vs näher dahinter
    dng.enemies.length = 0; const behind = mkE(225, 140), ahead = mkE(300, 140); dng.enemies.push(behind, ahead); dng.aimTargetId = null; mv = { x: 1, y: 0 }; dng.getAimAngle(input); out.preferAhead = dng.aimTargetId === ahead.id;
    // Gegner mit wenig HP wird bei sonst gleichen Bedingungen bevorzugt
    dng.enemies.length = 0; const hi = mkE(300, 120), lo = mkE(300, 160, { hp: 3 }); dng.enemies.push(hi, lo); dng.aimTargetId = null; mv = { x: 1, y: 0 }; dng.getAimAngle(input); out.lowHp = dng.aimTargetId === lo.id;
    // Ziel stirbt -> Wechsel; keine Gegner -> null
    dng.enemies = dng.enemies.filter((e) => e !== lo); dng.getAimAngle(input); out.afterDeath = dng.aimTargetId === hi.id;
    dng.enemies.length = 0; dng.getAimAngle(input); out.noTarget = [dng.aimTargetId, dng.getAimTarget()];
    // Maus hat weiter Vorrang
    const mouse = { ...input, isMouseActive: () => true, getMousePos: () => ({ x: 240, y: 40 }) }; dng.enemies.push(mkE(330, 140)); out.mouse = +dng.getAimAngle(mouse).toFixed(3);
    // Raumwechsel setzt Ziel zurück
    dng.aimTargetId = 77; dng.enterRoom(dng.currentRoom.key, null); out.enterRoomReset = dng.aimTargetId === null;
    // --- Persistenz
    dev.saveDeviceSettings({ touchScale: 1.15, aimAssist: 'smart', textSpeed: 'fast' });
    dev.resetDeviceSettingsCacheForTest(); const re = dev.loadDeviceSettings(); out.persisted = [re.touchScale, re.aimAssist, re.textSpeed];
    out.inSave = /touchScale|aimAssist|textSpeed/.test(g.state.exportSaveJson());
    // --- Effektiv-Skalierung (rein)
    out.eff = [dev.effectiveTouchScale(1.3, true), dev.effectiveTouchScale(1.3, false), dev.effectiveTouchScale(0.85, true)];
    dev.saveDeviceSettings({ touchScale: 1, aimAssist: 'standard', textSpeed: 'normal' });
    return out;
  }, ref);
  console.log(JSON.stringify(r));
  // ---- Touch-Layout: Hoch- & Querformat bei allen Größen
  const layout = {};
  for (const vp of [{ w: 390, h: 844, n: 'portrait' }, { w: 844, h: 390, n: 'landscape' }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.evaluate(() => { const g = window.__game; document.body.classList.add('touch-device'); g.touch['enabled'] = false; g.touch['enableTouch'](); g.ui.titleVisible = false; g.ui.modalOpen = false; g.touch.setState('dungeon', false, false, 'blade', true); });
    for (const sc of [0.85, 1, 1.15, 1.3]) {
      const m = await page.evaluate(async (sc) => {
        const dev = await import('/src/systems/deviceSettings.ts'); dev.saveDeviceSettings({ touchScale: sc });
        const rect = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const L = document.querySelector('.touch-left'), R = document.querySelector('.touch-right'), deck = document.getElementById('touch-deck');
        const l = rect(L), rr = rect(R);
        const inter = !(l.r <= rr.l || rr.r <= l.l || l.b <= rr.t || rr.b <= l.t);
        const joy = rect(document.getElementById('joy-base'));
        return { eff: getComputedStyle(document.documentElement).getPropertyValue('--touch-scale').trim(), overlap: inter, outside: l.l < -0.5 || rr.r > window.innerWidth + 0.5 || l.b > window.innerHeight + 0.5 || rr.b > window.innerHeight + 0.5 || l.t < -0.5 || rr.t < -0.5, stacked: deck.classList.contains('touch-stacked'), joyW: Math.round(joy.w), joyMax: window.__game.touch['joyMaxRadius'], docOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
      }, sc);
      layout[`${vp.n}_${sc}`] = m;
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${scratch}/m10_touch_${vp.n}_${Math.round(sc * 100)}.png` });
    }
  }
  console.log(JSON.stringify(layout));
  // ---- Hilfe-Tab UI
  await page.setViewportSize({ width: 1280, height: 720 });
  const ui = await page.evaluate(async () => {
    const g = window.__game; document.body.classList.remove('touch-device'); g.activeScene = 'hub'; g.ui.currentScene = 'hub';
    const dev = await import('/src/systems/deviceSettings.ts'); dev.saveDeviceSettings({ touchScale: 1, aimAssist: 'standard', textSpeed: 'normal' });
    g.ui.openInventoryModal(true, 'help');
    const o = { box: !!document.querySelector('[data-dev-scale]'), scaleBtns: document.querySelectorAll('[data-dev-scale]').length, aimBtns: document.querySelectorAll('[data-dev-aim]').length, textBtns: document.querySelectorAll('[data-dev-text]').length };
    document.querySelector('[data-dev-aim="smart"]').click(); o.aim = dev.getDeviceSettings().aimAssist; o.aimActiveBtn = document.querySelector('[data-dev-aim="smart"]').className.includes('btn-primary');
    document.querySelector('[data-dev-text="instant"]').click(); o.text = dev.getDeviceSettings().textSpeed;
    document.querySelector('[data-dev-scale="1.3"]').click(); o.scale = dev.getDeviceSettings().touchScale; o.cssVar = getComputedStyle(document.documentElement).getPropertyValue('--touch-scale').trim();
    o.noTouchHint = /nicht aktiv/.test(document.querySelector('.modal-body').innerText); o.capNote = /max\. 115 %/.test(document.querySelector('.modal-body').innerText);
    return o;
  });
  console.log(JSON.stringify(ui));
  await page.screenshot({ path: `${scratch}/m10_settings_desktop.png` });
  await page.evaluate(async () => { const dev = await import('/src/systems/deviceSettings.ts'); dev.saveDeviceSettings({ touchScale: 1, aimAssist: 'standard', textSpeed: 'normal' }); window.__game.ui.closeModal(); });
  const refOk = r.stdSame && r.defaultMode === 'standard';
  const okAim = refOk && r.offMove.join() === '1.5708,3.1416,0' && r.offFacing === -1.5708 && r.offPod === 0 && r.offTarget[0] === null && r.offTarget[1] === null &&
    r.smartAhead === 0 && r.smartTarget.join() === '330,140' && r.stickyKeep && r.stickySwitch && r.preferAhead && r.lowHp && r.afterDeath && r.noTarget[0] === null && r.noTarget[1] === null && r.mouse === -1.571 && r.enterRoomReset &&
    r.persisted.join() === '1.15,smart,fast' && r.inSave === false && r.eff.join() === '1.15,1.3,0.85';
  let okLayout = true;
  for (const [k, v] of Object.entries(layout)) {
    const sc = Number(k.split('_')[1]); const land = k.startsWith('landscape');
    const wantEff = land ? Math.min(sc, 1.15) : sc;
    if (v.overlap || v.outside || v.docOverflowX || Number(v.eff) !== wantEff) { okLayout = false; console.log('layout problem', k, JSON.stringify(v)); }
    if (Math.abs(v.joyW - Math.round(118 * wantEff)) > 2 || Math.abs(v.joyMax - 38 * wantEff) > 0.1) { okLayout = false; console.log('size problem', k, JSON.stringify(v)); }
  }
  const okUi = ui.box && ui.scaleBtns === 4 && ui.aimBtns === 3 && ui.textBtns === 3 && ui.aim === 'smart' && ui.aimActiveBtn && ui.text === 'instant' && ui.scale === 1.3 && ui.cssVar === '1.15' && ui.noTouchHint && ui.capNote;
  if (!okAim || !okLayout || !okUi) throw new Error(`M10 Phase 7 assert failed aim=${okAim} layout=${okLayout} ui=${okUi}`);
  console.log('M10 PHASE7 OK');
};
