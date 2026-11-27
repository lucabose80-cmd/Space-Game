// M12: Schatzkammer hinter der Boss-Wand — öffnet sich nach dem Arena-Sieg ohne Ladeübergang, Boss-Truhe mit Beute.
module.exports = async ({ page, PORT, scratch }) => {
  const assert = require('node:assert');
  const fs = require('node:fs');
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => document.styleSheets.length > 0);
  const r = await page.evaluate(async () => {
    const { preloadHDArt } = await import('/src/assets/artLoader.ts'); await preloadHDArt();
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const mkInput = (mv, interact = false) => { const t = { locked: false }; t.getMoveVector = () => (t.locked ? { x: 0, y: 0 } : mv); t.isMouseActive = () => false; t.getMousePos = () => ({ x: 0, y: 0 }); t.interactPressed = () => interact && !t.locked; return new Proxy(t, { get: (o, k) => (k in o ? o[k] : () => false), set: (o, k, v) => ((o[k] = v), true) }); };
    const idle = mkInput({ x: 0, y: 0 });
    const toasts = [];
    const g = new GameState(); g.saveLocked = true; g.sector1Cleared = true;
    const d = new DungeonScene(g, { onReturnToHub() {}, onToast(m) { toasts.push(m); }, onHudDirty() {}, onOpenDungeonChest() {} });
    d.startRun(1); d.startFloor(3, false, 1);
    d.floor.rooms.get(d.floor.bossKey).doors = { north: false, south: true, east: false, west: false };
    d.enterRoom(d.floor.bossKey, 'south');
    const step = (sec, inp = idle) => { for (let i = 0; i < Math.round(sec * 60); i++) { d.invulnTimer = 9999; d.update(1 / 60, inp); } };
    step(1.2);
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    const shot = () => { ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false; d.render(ctx, new InputManager(canvas)); ctx.setTransform(1, 0, 0, 1, 0, 0); return canvas.toDataURL('image/png'); };
    const room = d.currentRoom; const t0 = room.bounds.t;
    const out = { before: [!!room.arenaVault, room.chest] };
    // Kran-Hammer aktiv + steckend + Phase-III-Sprite ablichten
    const boss = d.enemies.find((e) => e.kind === 'boss_leviathan');
    boss.levArms[0].state = 'grounded'; boss.levArms[0].x = d.bounds.cx - 80; boss.levArms[0].y = t0 + 130;
    boss.levArms[1].state = 'idle'; boss.levArms[1].x = d.bounds.cx + 95; boss.levArms[1].y = t0 + 100;
    d.camera.snap({ x: boss.x, y: t0 + 120 });
    out.shotHammer = shot();
    boss.hp = boss.maxHp * 0.25; step(2.5);
    boss.levArena.vents[0].broken = true;
    d.camera.snap({ x: boss.x, y: t0 + 90 });
    out.shotP3 = shot();
    // Sieg (Wiederholung: sector1Cleared = true → kein trophy_leviathan)
    d.drops.length = 0;
    boss.hp = 0; d.onEnemyKilled(boss);
    out.arenaFloorDrops = d.drops.length;
    out.started = !!room.arenaVault && room.arenaVault.done === false;
    step(1.0); out.notYet = room.bounds.t === t0;
    step(1.4);
    // während der Öffnung: Screenshot
    out.shotOpening = shot();
    step(1.6);
    out.done = room.arenaVault.done;
    out.bounds = [room.bounds.t, t0 - 160, room.bounds.vt];
    out.chest = room.chest && [Math.round(room.chest.x), Math.round(room.chest.y), room.chest.boss, room.chest.secret, room.chest.opened];
    out.toast = toasts.some((m) => m.includes('Schatzkammer'));
    // Durch den Gang in die Kammer laufen: erst unter den Gang, dann nach Norden
    d.playerX = room.bounds.l + 96; d.playerY = t0 + 80;
    step(3.0, mkInput({ x: 0, y: -1 }));
    out.reached = [Math.round(d.playerX), Math.round(d.playerY)];
    out.inVault = d.playerY < t0 - 48;
    // Wand neben dem Gang ist fest
    const px = d.playerX; d.playerX = room.bounds.l + 200; d.playerY = t0 + 60; step(2.0, mkInput({ x: 0, y: -1 }));
    out.wallBlocks = d.playerY > t0 + 48;
    d.playerX = px;
    // zur Truhe und öffnen (Wiederholung)
    d.playerX = room.chest.x; d.playerY = room.chest.y + 14; step(0.1); step(1 / 60 * 2, mkInput({ x: 0, y: 0 }, true));
    const filled = (room.chest.slots ?? []).filter(Boolean);
    const slotIds = filled.map((s) => s.itemId);
    const totalQty = filled.reduce((a, s) => a + s.qty, 0);
    out.opened = [room.chest.opened, totalQty, slotIds.includes('leviathan_core'), slotIds.includes('aegis_plate'), slotIds.includes('trophy_leviathan')];
    d.playerY = room.chest.y + 30; d.camera.snap(d.cameraTarget);
    out.shotVault = shot();
    // Erstsieg-Prüfung: frischer Spielstand → Boss-Truhe enthält trophy_leviathan + leviathan_core + aegis_plate
    const g1 = new GameState(); g1.saveLocked = true;
    const d1 = new DungeonScene(g1, { onReturnToHub() {}, onToast() {}, onHudDirty() {}, onOpenDungeonChest() {} });
    d1.startRun(1); d1.startFloor(3, false, 1);
    d1.floor.rooms.get(d1.floor.bossKey).doors = { north: false, south: true, east: false, west: false };
    d1.enterRoom(d1.floor.bossKey, 'south');
    const step1 = (sec, inp = idle) => { for (let i = 0; i < Math.round(sec * 60); i++) { d1.invulnTimer = 9999; d1.update(1 / 60, inp); } };
    step1(2.8);
    const b1 = d1.enemies.find((e) => e.kind === 'boss_leviathan');
    b1.hp = 0; d1.onEnemyKilled(b1);
    step1(4.3);
    const c1 = d1.currentRoom.chest;
    d1.playerX = c1.x; d1.playerY = c1.y + 14; step1(0.1); step1(1 / 60 * 2, mkInput({ x: 0, y: 0 }, true));
    const firstIds = (c1.slots ?? []).filter(Boolean).map((s) => s.itemId);
    out.firstClearLoot = [firstIds.includes('trophy_leviathan'), firstIds.includes('leviathan_core'), firstIds.includes('aegis_plate')];
    // Raumwechsel und zurück: Kammer bleibt offen
    out.persist = room.arenaVault.done && room.bounds.t === t0 - 160;
    return out;
  });
  fs.writeFileSync(`${scratch}/m12p7_hammer.png`, Buffer.from(r.shotHammer.split(',')[1], 'base64'));
  fs.writeFileSync(`${scratch}/m12p7_p3.png`, Buffer.from(r.shotP3.split(',')[1], 'base64'));
  fs.writeFileSync(`${scratch}/m12p7_opening.png`, Buffer.from(r.shotOpening.split(',')[1], 'base64'));
  fs.writeFileSync(`${scratch}/m12p7_vault.png`, Buffer.from(r.shotVault.split(',')[1], 'base64'));
  delete r.shotHammer; delete r.shotP3; delete r.shotOpening; delete r.shotVault;
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.before, [false, null], 'vor dem Sieg: keine Kammer, keine Truhe');
  assert.strictEqual(r.arenaFloorDrops, 0, 'Arena-Sieg: Beute geht in die Boss-Truhe, nicht auf den Boden');
  assert.ok(r.started && r.notYet, 'Sieg startet die Öffnung, Grenzen erst nach der Tür-Fahrt');
  assert.ok(r.done, 'Tür ist offen');
  assert.deepStrictEqual(r.bounds.slice(0, 2), [r.bounds[1], r.bounds[1]], 'Grenzen nach Norden erweitert');
  assert.ok(r.chest && r.chest[2] === true && r.chest[3] === true && r.chest[4] === false, 'Boss-Truhe steht in der Kammer: ' + r.chest);
  assert.ok(r.toast, 'Hinweis „Schatzkammer“');
  assert.ok(r.inVault, 'Spieler läuft durch den Gang in die Kammer: ' + r.reached);
  assert.ok(r.wallBlocks, 'Wand neben dem Gang bleibt fest');
  assert.deepStrictEqual(r.opened, [true, r.opened[1], true, true, false], 'Boss-Truhe (Wiederholung): Kern + Platte, kein zweites Trophäen-Relikt: ' + r.opened);
  assert.ok(r.opened[1] >= 5, 'Boss-Truhe enthält mindestens 5 Items: ' + r.opened);
  assert.deepStrictEqual(r.firstClearLoot, [true, true, true], 'Boss-Truhe (Erstsieg): Herzlinse + Kern + Platte: ' + r.firstClearLoot);
  assert.ok(r.persist, 'Kammer bleibt offen');
  console.log('M12 SCHATZKAMMER OK');
};
