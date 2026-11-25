module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const rm = await import('/src/dungeon/roomMechanics.ts');
    const gs = new GameState();
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(3);
    const out = {};
    const idle = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
    const setup = () => { dng.enemies.length = 0; dng.projectiles.length = 0; const rr = dng.currentRoom; rr.pods.forEach((p) => (p.broken = true)); rr.obstacles = []; rr.chasms = []; rr.hazards = []; rr.prisms = undefined; rr.flameJets = [{ x: 240, y: 140, axis: 'h', length: 120, phase: 0 }]; rr.magnetPlates = undefined; dng.mechanics.resetForRoom(); dng.mechanicsClock = 0; dng.playerX = 240; dng.playerY = 140; dng.invulnTimer = 0; dng.dashTimer = 0; dng.lanceChargeTimer = 0; gs.hp = gs.getStats().maxHp; dng.finished = false; };
    const mkE = (x, y, kind = 'drone', hp = 200) => ({ id: dng.nextEnemyId++, kind, x, y, hp, maxHp: hp, radius: 8, vx: 0, vy: 0, anim: 0, flashTimer: 0 });
    // Zyklus-Funktionen
    out.states = [0, 1.9, 2.01, 2.79, 2.81, 3.59, 3.61].map((c) => rm.jetState(c, 0));
    out.platesActive = [0, 1.59, 1.61, 4.99, 5.01].map((c) => rm.plateActive(c, 0));
    // --- Düse: Warnung schadet nicht, aktiv = 16
    setup(); dng.mechanicsClock = 2.4; const hp0 = gs.hp; dng.mechanics.update(0.016); out.warnDmg = hp0 - gs.hp;
    dng.mechanicsClock = 3.0; dng.mechanics.update(0.016); out.activeDmg = hp0 - gs.hp;
    // --- Dash/Lanze sicher
    setup(); dng.mechanicsClock = 3.0; dng.dashTimer = 0.1; const hpD = gs.hp; dng.mechanics.update(0.016); out.dashDmg = hpD - gs.hp;
    setup(); dng.mechanicsClock = 3.0; dng.lanceChargeTimer = 0.2; const hpL = gs.hp; dng.mechanics.update(0.016); out.lanceDmg = hpL - gs.hp;
    // --- abseits der Düse kein Schaden
    setup(); dng.mechanicsClock = 3.0; dng.playerY = 170; const hpA = gs.hp; dng.mechanics.update(0.016); out.awayDmg = hpA - gs.hp;
    // --- phase-versetzte Düse (phase) -> andere Aktivzeit
    setup(); dng.currentRoom.flameJets[0].phase = 1.0; dng.mechanicsClock = 1.5; out.phaseState = [dng.mechanics.getJetState(dng.currentRoom.flameJets[0])];
    // --- Gegner: Normal vs Boss (30 dps vs 7.5 dps) über 1 s aktiver Phase
    setup(); const en = mkE(240, 140, 'drone', 200); const boss = mkE(200, 140, 'boss_leviathan', 2000); dng.enemies.push(en, boss);
    dng.mechanicsClock = 2.85;
    for (let i = 0; i < 60; i++) { dng.mechanicsClock = 2.85; dng.mechanics.applyToEnemy(en, 1 / 60); dng.mechanics.applyToEnemy(boss, 1 / 60); dng.mechanics.update(1 / 60); }
    out.enemyDmg = [200 - en.hp, 2000 - boss.hp];
    // --- Gegner außerhalb der Linie nimmt keinen Schaden
    setup(); const far = mkE(240, 200); dng.enemies.push(far); for (let i = 0; i < 60; i++) { dng.mechanicsClock = 2.9; dng.mechanics.applyToEnemy(far, 1 / 60); dng.mechanics.update(1 / 60); } out.farDmg = 200 - far.hp;
    // --- Magnetplatten
    const plateSetup = (pol) => { setup(); dng.currentRoom.flameJets = undefined; dng.currentRoom.magnetPlates = [{ x: 240, y: 140, r: 22, polarity: pol, phase: 0 }]; };
    plateSetup('pull'); dng.playerX = 240 + 40; dng.playerY = 140; dng.mechanicsClock = 0.1; const px0 = dng.playerX; for (let i = 0; i < 30; i++) { dng.mechanicsClock = 0.1; dng.mechanics.update(1 / 60); } out.pullPlayer = Math.round(px0 - dng.playerX);
    plateSetup('push'); dng.playerX = 240 + 30; dng.playerY = 140; dng.mechanicsClock = 0.1; const px1 = dng.playerX; for (let i = 0; i < 30; i++) { dng.mechanicsClock = 0.1; dng.mechanics.update(1 / 60); } out.pushPlayer = Math.round(dng.playerX - px1);
    plateSetup('pull'); dng.playerX = 280; dng.mechanicsClock = 2.0; const px2 = dng.playerX; for (let i = 0; i < 30; i++) { dng.mechanicsClock = 2.0; dng.mechanics.update(1 / 60); } out.restPlayer = Math.round(px2 - dng.playerX);
    plateSetup('pull'); dng.playerX = 280; dng.dashTimer = 1; dng.mechanicsClock = 0.1; for (let i = 0; i < 30; i++) { dng.mechanicsClock = 0.1; dng.mechanics.update(1 / 60); } out.dashPlayer = Math.round(280 - dng.playerX);
    // Enemy pulled, Boss + Turret not
    plateSetup('pull'); const e1 = mkE(290, 140), b1 = mkE(290, 150, 'boss_leviathan', 999), t1 = mkE(290, 130, 'turret'); dng.enemies.push(e1, b1, t1);
    for (let i = 0; i < 30; i++) { dng.mechanicsClock = 0.1; for (const e of dng.enemies) dng.mechanics.applyToEnemy(e, 1 / 60); }
    out.enemyPull = [Math.round(290 - e1.x), Math.round(290 - b1.x), Math.round(290 - t1.x)];
    // Plate pulls into chasm? -> disabled
    plateSetup('pull'); dng.currentRoom.chasms = [{ x: 200, y: 120, w: 36, h: 40 }]; dng.playerX = 270; dng.playerY = 140; dng.mechanicsClock = 0.1; const pxc = dng.playerX; for (let i = 0; i < 60; i++) { dng.mechanicsClock = 0.1; dng.mechanics.update(1 / 60); }
    out.chasmSafe = !dng.getChasmAt(dng.playerX, dng.playerY, 0) && dng.playerX > 236;
    // Projectile bending (pull) vs none (push)
    const bend = (pol) => { plateSetup(pol); const p = { x: 300, y: 120, vx: -100, vy: 0, fromPlayer: false, damage: 1, color: '#fff', radius: 2, life: 5 }; dng.projectiles.push(p); for (let i = 0; i < 40; i++) { dng.mechanicsClock = 0.1; dng.mechanics.update(1 / 60); p.x += p.vx / 60; p.y += p.vy / 60; } return Math.round(Math.atan2(p.vy, p.vx) * 1000) / 1000; };
    out.bend = [bend('pull'), bend('push')];
    // --- Zyklen sind raumlokal: nach enterRoom Uhr 0
    dng.mechanicsClock = 4.4; dng.enterRoom(dng.currentRoom.key, null); out.clockReset = dng.mechanicsClock;
    // --- echtes S3-Layout laufen lassen + Screenshot (Warnung & aktiv)
    let room = null; const gen = await import('/src/world/dungeonGen.ts');
    for (let i = 0; i < 60 && !room; i++) { dng.startRun(3); for (const rr of dng.floor.rooms.values()) if (rr.flameJets && rr.magnetPlates) { room = rr; break; } }
    out.realRoom = !!room;
    if (room) {
      dng.enterRoom(room.key, null); dng.roomFade = 0; dng.enemies.length = 0; dng.playerX = 100; dng.playerY = 60; dng.invulnTimer = 999;
      try { for (let i = 0; i < 600; i++) dng.update(1 / 60, idle); out.updateOk = true; } catch (e) { out.updateOk = String(e); }
      window.__room = room; window.__dng = dng;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  // Screenshots: Warnung / aktiv
  for (const [name, clock] of [['warn', 2.4], ['active', 3.1]]) {
    await page.evaluate(async (clock) => {
      const dng = window.__dng; const room = window.__room; if (!dng) return;
      const { InputManager } = await import('/src/engine/input.ts');
      const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
      const j = room.flameJets[0]; const m = room.magnetPlates[0];
      j.phase = clock - dng.mechanicsClock; m.phase = (clock === 2.4 ? 4.6 : 0.1) - dng.mechanicsClock; // Platte: Warnung vor Aktivierung / aktiv
      dng.roomFade = 0; dng.render(ctx, new InputManager(canvas));
    }, clock);
    await page.locator('#game-canvas').screenshot({ path: `${scratch}/m10_5b_${name}.png` });
  }
  const ok = r.states.join() === 'safe,safe,warn,warn,active,active,safe' && r.platesActive.join() === 'true,true,false,false,true' &&
    r.warnDmg === 0 && r.activeDmg === 16 && r.dashDmg === 0 && r.lanceDmg === 0 && r.awayDmg === 0 && r.phaseState[0] === 'warn' &&
    r.enemyDmg[0] >= 20 && r.enemyDmg[0] <= 31 && r.enemyDmg[1] >= 4 && r.enemyDmg[1] <= 9 && r.farDmg === 0 &&
    r.pullPlayer >= 1 && r.pushPlayer >= 1 && r.restPlayer === 0 && r.dashPlayer === 0 &&
    r.enemyPull[0] >= 1 && r.enemyPull[1] === 0 && r.enemyPull[2] === 0 && r.chasmSafe && Math.abs(r.bend[0]) > 3.1416 - 0.5 && r.bend[0] !== r.bend[1] && Math.abs(r.bend[1]) === 3.142 && r.clockReset === 0 && r.realRoom && r.updateOk === true;
  if (!ok) throw new Error('M10 Phase 5b assert failed');
  console.log('M10 PHASE5b OK');
};
