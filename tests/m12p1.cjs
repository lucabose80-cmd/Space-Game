// M12 Phase A — Raumgrenzen pro Raum (`DungeonRoom.bounds`, `scene.bounds`).
// 1) Standardraum: Grenzen = exakt die alten Konstanten, Nav-Raster gleich groß, Ablauf mit expliziten
//    Standard-Grenzen bit-identisch zum Ablauf ohne `bounds`.
// 2) Raum mit großen Grenzen (2×2 Bildschirme): Spieler, Gegner, Projektile, Drops, Türen, Eintritt und
//    Boss-Klemmen nutzen die neuen Grenzen — nichts verlässt die Arena, nichts klebt an den alten Rändern.
// Deterministischer Vergleichslauf im Standardraum, jeweils in frisch geladener Seite (Modul-Zustand zurückgesetzt).
async function stdTrace(page, withBounds) {
  await page.reload();
  await page.waitForFunction(() => document.styleSheets.length > 0);
  return page.evaluate(async (withBounds) => {
    const { preloadHDArt } = await import('/src/assets/artLoader.ts');
    await preloadHDArt();
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const mkInput = (mv) => new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => mv : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
    const idle = mkInput({ x: 0, y: 0 });
    let seed = 12345;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const g = new GameState(); g.saveLocked = true;
    const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    d.startRun(1);
    const room = d.currentRoom;
    room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = []; room.hazards = [];
    room.doors = { north: false, south: false, east: false, west: false };
    if (withBounds) room.bounds = { l: gen.ROOM_LEFT, r: gen.ROOM_RIGHT, t: gen.ROOM_TOP, b: gen.ROOM_BOTTOM };
    d.enemies.length = 0; d.projectiles.length = 0;
    d.rebuildNav();
    d.invulnTimer = 9999;
    d.playerX = 120; d.playerY = 190;
    d.spawnEnemy('slime', 380, 70); d.spawnEnemy('drone', 360, 200); d.spawnEnemy('boss_forge_warden', 300, 110);
    const moves = [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }];
    const trace = [];
    for (let i = 0; i < 480; i++) {
      d.update(1 / 60, i % 60 < 40 ? mkInput(moves[((i / 60) | 0) % 4]) : idle);
      if (i % 30 === 0) trace.push([d.playerX, d.playerY, ...d.enemies.flatMap((e) => [e.x, e.y, e.hp]), d.projectiles.length].map((v) => Math.round(v * 1000)));
    }
    return JSON.stringify(trace);
  }, withBounds);
}

module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const a = await stdTrace(page, false);
  const a2 = await stdTrace(page, false);
  const b = await stdTrace(page, true);
  assert.strictEqual(a, a2, 'Vergleichslauf ist reproduzierbar');
  assert.ok(a.length > 100, 'Vergleichslauf hat Daten');
  assert.strictEqual(b, a, 'Standardraum: Ablauf mit expliziten Standard-Grenzen identisch');
  await page.reload();
  await page.waitForFunction(() => document.styleSheets.length > 0);
  const r = await page.evaluate(async () => {
    const { preloadHDArt } = await import('/src/assets/artLoader.ts');
    await preloadHDArt();
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const eng = await import('/src/dungeon/bosses/bossEngine.ts');
    const mkInput = (mv) => new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => mv : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
    const idle = mkInput({ x: 0, y: 0 });
    const mk = (bounds) => {
      const g = new GameState(); g.saveLocked = true;
      const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
      d.startRun(1);
      const room = d.currentRoom;
      room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = []; room.hazards = [];
      room.doors = { north: false, south: false, east: false, west: false };
      if (bounds) room.bounds = bounds;
      d.enemies.length = 0; d.projectiles.length = 0;
      d.rebuildNav();
      d.invulnTimer = 9999;
      return { g, d, room };
    };
    const out = {};

    // ---------- 1) Standardraum ----------
    const D = gen.DEFAULT_ROOM_BOUNDS;
    out.defaults = [D.l, D.r, D.t, D.b, D.cx, D.cy];
    out.consts = [gen.ROOM_LEFT, gen.ROOM_RIGHT, gen.ROOM_TOP, gen.ROOM_BOTTOM, gen.ROOM_CENTER_X, gen.ROOM_CENTER_Y];
    out.bossRoomStd = [eng.ROOM.L, eng.ROOM.R, eng.ROOM.T, eng.ROOM.B, eng.ROOM.CX, eng.ROOM.CY];
    {
      const { d } = mk(null);
      out.stdSame = d.bounds === D;
      out.stdNav = [d.nav.cols, d.nav.rows];
      out.stdRay = d.rayLimit(360);
    }

    // ---------- 2) Großer Raum (688 × 352 logisch) ----------
    const big = { l: 68, r: 68 + 688, t: 46, b: 46 + 352 };
    {
      const { d, room } = mk(big);
      const rb = d.bounds;
      out.bigBounds = [rb.l, rb.r, rb.t, rb.b, rb.cx, rb.cy];
      out.bigCached = d.bounds === rb;
      out.bigNav = [d.nav.cols, d.nav.rows];
      out.bigRay = d.rayLimit(360) > 700;
      // Spieler läuft nach rechts unten — kommt über die alten Grenzen hinaus, aber nie aus der Arena
      d.playerX = 200; d.playerY = 150;
      const right = mkInput({ x: 1, y: 0 });
      for (let i = 0; i < 900; i++) d.update(1 / 60, right);
      out.playerRight = Math.round(d.playerX);
      const down = mkInput({ x: 0, y: 1 });
      for (let i = 0; i < 600; i++) d.update(1 / 60, down);
      out.playerDown = Math.round(d.playerY);
      const upLeft = mkInput({ x: -0.7071, y: -0.7071 });
      for (let i = 0; i < 1500; i++) d.update(1 / 60, upLeft);
      out.playerUpLeft = [Math.round(d.playerX), Math.round(d.playerY)];
      // direkte Klemme
      d.playerX = rb.r - 7; d.moveEntityWithCollisions(50, 0); out.clampR = d.playerX;
      d.playerY = rb.b - 7; d.moveEntityWithCollisions(0, 50); out.clampB = d.playerY;

      // Gegner weit im Südosten jagt den Spieler im Nordwesten (Nav-Raster deckt die ganze Arena ab)
      d.enemies.length = 0; d.projectiles.length = 0;
      d.playerX = 120; d.playerY = 80;
      d.spawnEnemy('slime', 700, 360);
      const e = d.enemies[0];
      const dist0 = Math.hypot(e.x - d.playerX, e.y - d.playerY);
      out.flowFar = !!d.nav.flowDir(e.x, e.y);
      for (let i = 0; i < 240; i++) d.update(1 / 60, idle);
      out.enemyCloser = Math.hypot(e.x - d.playerX, e.y - d.playerY) < dist0 - 40;
      out.enemyInside = e.x >= rb.l && e.x <= rb.r && e.y >= rb.t && e.y <= rb.b;
      // Gegner, der nach außen geschoben wird, klemmt an der Arena-Grenze (nicht an ROOM_RIGHT)
      d.playerX = 680; d.playerY = 380;
      e.x = rb.r - 12; e.y = 300; e.vx = 600; e.vy = 0; e.knockbackX = 0; e.knockbackY = 0;
      for (let i = 0; i < 20; i++) d.update(1 / 60, idle);
      out.enemyClampR = e.x <= rb.r && e.x > gen.ROOM_RIGHT;

      // Projektile: innerhalb der Arena (jenseits der alten Grenzen) leben weiter, außerhalb werden entfernt
      d.enemies.length = 0;
      d.projectiles.length = 0;
      d.projectiles.push({ x: 600, y: 300, vx: 0, vy: 0, fromPlayer: false, damage: 1, color: '#fff', radius: 3, life: 5 });
      d.projectiles.push({ x: rb.r + 4, y: 300, vx: 0, vy: 0, fromPlayer: false, damage: 1, color: '#fff', radius: 3, life: 5 });
      d.playerX = 120; d.playerY = 80;
      d.updateProjectiles(1 / 60);
      out.projectiles = d.projectiles.map((p) => Math.round(p.x));

      // Drops klemmen an der Arena
      d.drops.length = 0;
      d.drops.push({ x: 700, y: 380, vx: 900, vy: 900, itemId: 'scrap_metal', age: 0 });
      d.updateDrops(0.1);
      out.drop = [Math.round(d.drops[0]?.x), Math.round(d.drops[0]?.y)];

      // Türen: Südtür erst am Arena-Südrand, nicht am alten ROOM_BOTTOM
      const calls = [];
      const origEnter = d.enterRoom.bind(d);
      d.enterRoom = (k, side) => calls.push([k, side]);
      room.doors = { north: false, south: true, east: true, west: false };
      d.playerX = rb.cx; d.playerY = gen.ROOM_BOTTOM; d.checkDoorTransition();
      out.doorOldEdge = calls.length;
      d.playerX = rb.cx; d.playerY = rb.b - 6; d.checkDoorTransition();
      d.playerX = rb.r - 6; d.playerY = rb.cy; d.checkDoorTransition();
      out.doorCalls = calls.map((c) => c[1]);
      d.enterRoom = origEnter;

      // Eintritt: von Süden betreten → am Arena-Südrand, mittig
      d.enterRoom(d.currentRoom.key, 'south');
      out.entrySouth = [d.playerX, d.playerY];
      d.enterRoom(d.currentRoom.key, 'east');
      out.entryEast = [d.playerX, d.playerY];

      // Boss-Engine: Klemmen & BossCtx.room
      const br = eng.bossRoom(d.bounds);
      out.bossRoom = [br.L, br.R, br.T, br.B, br.CX, br.CY];
      out.bossRoomCached = eng.bossRoom(d.bounds) === br;
      const c1 = eng.clampToRoom(2000, 2000, 18, br);
      const c0 = eng.clampToRoom(2000, 2000, 18);
      out.clampBoss = [c1.x, c1.y, c0.x, c0.y];
      // Boss-Kampf in der Arena läuft ohne Fehler, Boss bleibt drin
      d.enemies.length = 0; d.projectiles.length = 0;
      d.playerX = 600; d.playerY = 330;
      d.spawnEnemy('boss_forge_warden', 500, 200);
      const boss = d.enemies[0];
      let err = null;
      try { for (let i = 0; i < 900; i++) d.update(1 / 60, idle); } catch (x) { err = String(x); }
      out.bossErr = err;
      out.bossInside = boss.x >= rb.l && boss.x <= rb.r && boss.y >= rb.t && boss.y <= rb.b;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  // 1) Standardraum
  assert.deepStrictEqual(r.defaults, r.consts, 'DEFAULT_ROOM_BOUNDS = alte Konstanten');
  assert.deepStrictEqual(r.bossRoomStd, r.consts, 'Boss-ROOM = alte Konstanten');
  assert.ok(r.stdSame, 'Standardraum: scene.bounds ist DEFAULT_ROOM_BOUNDS');
  assert.deepStrictEqual(r.stdNav, [43, 22], 'Standardraum: Nav-Raster unverändert 43×22');
  assert.strictEqual(r.stdRay, 360, 'Standardraum: Strahl-Reichweite unverändert');
  // 2) Großer Raum
  assert.deepStrictEqual(r.bigBounds, [68, 756, 46, 398, 412, 222]);
  assert.ok(r.bigCached, 'bounds gecacht');
  assert.deepStrictEqual(r.bigNav, [86, 44], 'Nav-Raster deckt die Arena ab');
  assert.ok(r.bigRay, 'Strahl reicht durch die Arena');
  assert.ok(r.playerRight > 412 + 100 && r.playerRight <= 756 - 6, 'Spieler läuft über die alte Ostgrenze, bleibt in der Arena: ' + r.playerRight);
  assert.ok(r.playerDown > 222 + 60 && r.playerDown <= 398 - 6, 'Spieler läuft über die alte Südgrenze, bleibt in der Arena: ' + r.playerDown);
  assert.ok(r.playerUpLeft[0] >= 68 + 6 && r.playerUpLeft[1] >= 46 + 6 && r.playerUpLeft[0] < 120 && r.playerUpLeft[1] < 100, 'Spieler bleibt an Nordwest-Grenze: ' + r.playerUpLeft);
  assert.strictEqual(r.clampR, 756 - 6, 'Klemme Ost');
  assert.strictEqual(r.clampB, 398 - 6, 'Klemme Süd');
  assert.ok(r.flowFar, 'Fluss-Feld auch weit außerhalb des alten Rasters');
  assert.ok(r.enemyCloser, 'Gegner kommt näher');
  assert.ok(r.enemyInside, 'Gegner bleibt in der Arena');
  assert.ok(r.enemyClampR, 'Gegner klemmt an der Arena-Ostgrenze');
  assert.deepStrictEqual(r.projectiles, [600], 'Projektil in der Arena lebt, außerhalb wird entfernt');
  assert.ok(r.drop[0] <= 756 - 8 && r.drop[0] > 412 && r.drop[1] <= 398 - 8 && r.drop[1] > 222, 'Drop klemmt an der Arena: ' + r.drop);
  assert.strictEqual(r.doorOldEdge, 0, 'keine Tür am alten Südrand');
  assert.deepStrictEqual(r.doorCalls, ['north', 'west'], 'Tür Süd/Ost an den Arena-Rändern');
  assert.deepStrictEqual(r.entrySouth, [412, 398 - 18], 'Eintritt Süd');
  assert.deepStrictEqual(r.entryEast, [756 - 18, 222], 'Eintritt Ost');
  assert.deepStrictEqual(r.bossRoom, [68, 756, 46, 398, 412, 222]);
  assert.ok(r.bossRoomCached, 'bossRoom gecacht');
  assert.deepStrictEqual(r.clampBoss, [756 - 18, 398 - 18, 412 - 18, 222 - 18], 'clampToRoom: Arena vs. Standard');
  assert.ok(!r.bossErr, 'Boss-Kampf in der Arena ohne Fehler: ' + r.bossErr);
  assert.ok(r.bossInside, 'Boss bleibt in der Arena');
  console.log('M12 RAUMGRENZEN OK');
};
