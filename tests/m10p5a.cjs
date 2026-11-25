module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const gs = new GameState();
    const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(2);
    const out = {};
    const setup = () => { dng.enemies.length = 0; dng.projectiles.length = 0; dng.currentRoom.pods.forEach((p) => (p.broken = true)); dng.currentRoom.obstacles = []; dng.currentRoom.chasms = []; dng.currentRoom.prisms = [{ id: 0, x: 240, y: 140, r: 7 }, { id: 1, x: 340, y: 90, r: 7 }]; dng.mechanics.resetForRoom(); dng.playerX = 100; dng.playerY = 200; dng.invulnTimer = 99; };
    const proj = (o) => ({ x: 200, y: 140, vx: 120, vy: 0, fromPlayer: false, damage: 10, color: '#fb7185', radius: 3, life: 3, ...o });
    const stepN = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { dng.mechanics.update(dt); dng.updateProjectiles(dt); } };
    // --- Reflect (Gegner-Projektil)
    setup(); const ep = proj({}); dng.projectiles.push(ep); stepN(40);
    out.reflect = { alive: dng.projectiles.includes(ep), fromPlayer: ep.fromPlayer, damage: ep.damage, vx: Math.round(ep.vx), color: ep.color, splitGen: ep.splitGen };
    // --- Split (Spieler-Projektil) mit 2 Gegnern
    setup();
    const mkE = (x, y) => ({ id: dng.nextEnemyId++, kind: 'drone', x, y, hp: 50, maxHp: 50, radius: 8 });
    dng.enemies.push(mkE(300, 200), mkE(260, 60));
    const pp = proj({ fromPlayer: true, damage: 40, color: '#38e8d4' }); dng.projectiles.push(pp); stepN(22);
    const splits = dng.projectiles.filter((p) => p.splitGen === 1 && p.fromPlayer);
    out.split = { originalGone: !dng.projectiles.includes(pp), n: splits.length, dmg: splits.map((p) => p.damage), color: splits[0]?.color };
    const ang = (p) => Math.atan2(p.vy, p.vx); const toE = (e) => Math.atan2(e.y - 140, e.x - 240);
    out.splitAim = dng.enemies.map((e) => splits.some((p) => Math.abs(ang(p) - toE(e)) < 0.12));
    // --- Cooldown: zweites Spieler-Projektil direkt danach wird gespiegelt statt geteilt
    dng.projectiles = dng.projectiles.filter((p) => p.splitGen !== 1); const pp2 = proj({ x: 226, fromPlayer: true, damage: 40 }); dng.projectiles.push(pp2); stepN(8);
    out.cooldown = { stillAlive: dng.projectiles.includes(pp2), reflectedLeft: pp2.vx < 0 };
    stepN(40); // >0.35 s verstrichen
    dng.projectiles.length = 0; const pp3 = proj({ fromPlayer: true, damage: 40 }); dng.projectiles.push(pp3); stepN(40);
    out.afterCd = !dng.projectiles.includes(pp3) && dng.projectiles.filter((p) => p.splitGen === 1).length === 3;
    // --- keine Ketten-Teilung: Splitter an Prisma 2 reflektiert
    setup(); dng.enemies.push(mkE(300, 200));
    const spl = proj({ x: 300, y: 90, vx: 100, vy: 0, fromPlayer: true, damage: 20, splitGen: 1 }); dng.projectiles.push(spl); stepN(40);
    out.noChain = { alive: dng.projectiles.includes(spl), n: dng.projectiles.length, vx: Math.round(spl.vx) };
    // --- Wand frisst Prisma-Projektile NICHT
    setup(); const wp = proj({ x: 215, y: 140, vx: 60 }); dng.projectiles.push(wp); stepN(30);
    out.notWall = dng.projectiles.includes(wp);
    // --- Nahkampf
    setup(); dng.mechanics.onMeleeHit(240, 140, 20); const burst1 = dng.projectiles.length;
    dng.mechanics.onMeleeHit(240, 140, 20); const burst2 = dng.projectiles.length;
    dng.projectiles.length = 0; stepN(60 * 2.7); dng.projectiles.length = 0; dng.mechanics.onMeleeHit(240, 140, 20); const burst3 = dng.projectiles.length;
    out.melee = [burst1, burst2, burst3, dng.projectiles[0]?.damage];
    // --- solide
    setup(); out.solid = [dng.collidesRoomObstacle(240, 140, 5), dng.collidesRoomObstacle(240, 140, 5, false), dng.collidesRoomObstacle(100, 100, 5)];
    dng.playerX = 200; dng.playerY = 140; for (let i = 0; i < 60; i++) dng.moveEntityWithCollisions(1.5, 0);
    out.playerBlockedX = Math.round(dng.playerX);
    // --- Disc (collidesRoomObstacle) & real floor
    let found = null;
    const gen = await import('/src/world/dungeonGen.ts');
    for (let i = 0; i < 40 && !found; i++) { dng.startRun(2); for (const room of dng.floor.rooms.values()) if (room.prisms) { found = room; break; } }
    out.realRoom = !!found;
    if (found) {
      dng.enterRoom(found.key, null); dng.roomFade = 0; dng.playerX = 100; dng.playerY = 130;
      try { for (let i = 0; i < 300; i++) dng.update(1 / 60, new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) })); out.updateOk = true; } catch (e) { out.updateOk = String(e); }
      const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
      const { InputManager } = await import('/src/engine/input.ts'); const inp = new InputManager(canvas);
      dng.roomFade = 0; dng.mechanics.prismFlash.set(found.prisms[0].id, 0.2);
      dng.render(ctx, inp); out.prismCount = found.prisms.length;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/m10_5a_prisms.png` });
  const ok = r.reflect.alive && r.reflect.fromPlayer && r.reflect.damage === 15 && r.reflect.vx < 0 && r.reflect.color === '#e879f9' &&
    r.split.originalGone && r.split.n === 3 && r.split.dmg.every((d) => d === 22) && r.splitAim.every(Boolean) &&
    r.cooldown.stillAlive && r.cooldown.reflectedLeft && r.afterCd && r.noChain.alive && r.noChain.vx < 0 && r.notWall &&
    r.melee[0] === 6 && r.melee[1] === 6 && r.melee[2] === 6 && r.melee[3] === 12 &&
    r.solid[0] === true && r.solid[1] === false && r.solid[2] === false && r.playerBlockedX < 240 - 7 && r.realRoom && r.updateOk === true;
  if (!ok) throw new Error('M10 Phase 5a assert failed');
  console.log('M10 PHASE5a OK');
};
