module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const wt = await import('/src/systems/weeklyTrial.ts');
    const gs = new GameState();
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(4);
    const out = {};
    const idle = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
    const setup = () => { dng.enemies.length = 0; dng.projectiles.length = 0; const rr = dng.currentRoom; rr.obstacles = []; rr.chasms = []; rr.hazards = []; rr.prisms = rr.flameJets = rr.magnetPlates = undefined;
      rr.teleporters = [{ id: 0, pairId: 0, x: 120, y: 90, colorIdx: 0 }, { id: 1, pairId: 0, x: 360, y: 190, colorIdx: 0 }, { id: 2, pairId: 1, x: 120, y: 190, colorIdx: 1 }, { id: 3, pairId: 1, x: 360, y: 90, colorIdx: 1 }];
      dng.mechanics.resetForRoom(); dng.playerX = 120; dng.playerY = 90; dng.dashTimer = 0; dng.invulnTimer = 0; };
    const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) dng.mechanics.update(dt); };
    // --- Verweildauer
    setup(); step(10); out.before = [Math.round(dng.playerX), Math.round(dng.playerY)]; // 0.167 s -> noch nicht
    step(8); out.after = [Math.round(dng.playerX), Math.round(dng.playerY)];             // 0.30 s -> teleportiert zu Pad 1
    out.invuln = dng.invulnTimer >= 0.3;
    // --- kein Ping-Pong: auf B stehen bleiben -> bleibt für >1.2 s
    step(60 * 2); out.stay = [Math.round(dng.playerX), Math.round(dng.playerY)];
    // --- Wegtreten (armed) -> nach Sperre zurück auf B: Teleport zu A
    dng.playerX = 300; dng.playerY = 190; step(5); // nicht auf Pad, armed
    dng.playerX = 360; dng.playerY = 190; step(20); out.back = [Math.round(dng.playerX), Math.round(dng.playerY)];
    // --- zweites Paar ist unabhängig (Pad 2 -> Pad 3)
    setup(); dng.playerX = 120; dng.playerY = 190; step(20); out.pair2 = [Math.round(dng.playerX), Math.round(dng.playerY)];
    // --- sofortiger Rückweg innerhalb 1.2 s (Sperre): erst wegtreten, dann auf A (gesperrt) -> kein Teleport
    setup(); step(20); // -> B
    dng.playerX = 300; dng.playerY = 150; step(3); dng.playerX = 120; dng.playerY = 90; step(30); // A ist gesperrt (<1.2 s seit Teleport)
    out.lockedBack = [Math.round(dng.playerX), Math.round(dng.playerY)];
    // --- Dash löst nichts aus
    setup(); dng.dashTimer = 1; step(30); out.dash = [Math.round(dng.playerX), Math.round(dng.playerY)];
    // --- Gegner teleportieren nicht
    setup(); dng.playerX = 240; dng.playerY = 140; const e = { id: 99, kind: 'drone', x: 120, y: 90, hp: 50, maxHp: 50, radius: 8, vx: 0, vy: 0, anim: 0, flashTimer: 0 }; dng.enemies.push(e); step(60); out.enemy = [e.x, e.y];
    // --- Zyklen: Teleport-Ladung für Renderer
    setup(); step(8); out.charge = +dng.mechanics.getPadCharge(dng.currentRoom.teleporters[0]).toFixed(2);
    // --- Prüfungs-Gate
    out.gate = wt.TRIAL_MECHANICS_FROM_WEEK; out.gateFn = [wt.trialHasMechanics('2026-W48'), wt.trialHasMechanics('2026-W49'), wt.trialHasMechanics('2027-W01')];
    const count = (f) => [...f.rooms.values()].filter((rr) => rr.prisms || rr.flameJets || rr.magnetPlates || rr.teleporters).length;
    const sig = (f) => JSON.stringify([...f.rooms.entries()]);
    const mk = (weekId, sector) => { const gs2 = new GameState(); gs2.sector1Cleared = true; const d = new DungeonScene(gs2, { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); d.startWeeklyTrial({ weekId, sector, mutator: 'armored', endsAtUtc: 0 }); const f1 = sig(d.floor); const c1 = count(d.floor); d.startFloor(2, false, sector); const c2 = count(d.floor); d.startFloor(3, false, sector); const c3 = count(d.floor); return { f1, counts: [c1, c2, c3] }; };
    const old = mk('2026-W48', 4), neu1 = mk('2026-W49', 4), neu2 = mk('2026-W49', 4);
    out.trialOld = old.counts; out.trialNew = neu1.counts; out.trialIdentical = neu1.f1 === neu2.f1;
    // Layout der Prüfung (ohne Mechanik-Felder) ist vor/nach dem Gate identisch (gleicher Seed-Anteil)
    const strip = (s) => JSON.stringify(JSON.parse(s).map(([k, r]) => { const c = { ...r }; delete c.prisms; delete c.flameJets; delete c.magnetPlates; delete c.teleporters; return [k, c]; }));
    out.layoutSameAcrossGate = strip(old.f1) === strip(neu1.f1) || 'weekId differs seed';
    // --- Zero-Credits / Prüfungs-Invarianten bleiben
    const gs3 = new GameState(); gs3.sector1Cleared = true; gs3.credits = 500; gs3.inventory.cargo[0] = { itemId: 'scrap_coil', qty: 3 };
    const d3 = new DungeonScene(gs3, { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); d3.startWeeklyTrial({ weekId: '2026-W49', sector: 4, mutator: 'armored', endsAtUtc: 0 }); d3.triggerDefeat();
    out.trialInv = [gs3.credits, gs3.inventory.cargo[0]?.qty];
    // --- echter S4-Raum + Screenshot
    let room = null;
    for (let i = 0; i < 60 && !room; i++) { dng.startRun(4); for (const rr of dng.floor.rooms.values()) if (rr.teleporters && rr.teleporters.length >= 4) { room = rr; break; } if (!room) for (const rr of dng.floor.rooms.values()) if (rr.teleporters) { room = rr; break; } }
    out.realRoom = !!room;
    if (room) { dng.enterRoom(room.key, null); dng.roomFade = 0; dng.enemies.length = 0; dng.playerX = 100; dng.playerY = 60; dng.invulnTimer = 999; try { for (let i = 0; i < 240; i++) dng.update(1 / 60, idle); out.updateOk = true; } catch (e2) { out.updateOk = String(e2); }
      window.__dng = dng; window.__room = room; }
    return out;
  });
  console.log(JSON.stringify(r));
  await page.evaluate(async () => {
    const dng = window.__dng, room = window.__room; if (!dng) return;
    const { InputManager } = await import('/src/engine/input.ts');
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const p = room.teleporters[0]; dng.playerX = p.x; dng.playerY = p.y; dng.mechanics['padDwellId'] = p.id; dng.mechanics['padDwell'] = 0.14; dng.mechanics['padLock'].set(room.teleporters[1].id, 0.9);
    dng.roomFade = 0; dng.render(ctx, new InputManager(canvas));
  });
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/m10_5c_pads.png` });
  const ok = r.before.join() === '120,90' && r.after.join() === '360,190' && r.invuln && r.stay.join() === '360,190' && r.back.join() === '120,90' && r.pair2.join() === '360,90' &&
    r.lockedBack.join() === '120,90' && r.dash.join() === '120,90' && r.enemy.join() === '120,90' && r.charge > 0.5 && r.gate === '2026-W49' && r.gateFn.join() === 'false,true,true' &&
    r.trialOld.every((c) => c === 0) && r.trialNew.some((c) => c > 0) && r.trialIdentical && r.trialInv.join() === '500,3' && r.realRoom && r.updateOk === true;
  if (!ok) throw new Error('M10 Phase 5c assert failed');
  console.log('M10 PHASE5c OK');
};
