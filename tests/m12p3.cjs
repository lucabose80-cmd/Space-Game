// M12 Phase C — Arena-Daten (Reaktorhalle des Leviathan) & Anhängen an den Bossraum.
// 1) Kachelplan gültig (43 × 22), alle begehbaren Kacheln vom Eingang aus erreichbar, Hindernis-Rechtecke decken genau die festen Kacheln.
// 2) Seed-Layout: `generateSectorFloor` + `attachArenas` verbraucht kein Math.random; alle Räume außer dem Bossraum bit-identisch.
// 3) Gate: ohne `?arena` (und ENDBOSS_ARENA_LIVE = false) kein Arena-Raum; Wochen-Prüfung nie.
// 4) Mit `?arena`: Bossraum = Arena (Grenzen, Boss am Anker), Kampf läuft, Eintritt/Kamera passen, Nordtür bekommt Durchgang. Screenshot.
module.exports = async ({ page, scratch, PORT }) => {
  const assert = require('node:assert');
  const fs = require('node:fs');
  const r = await page.evaluate(async () => {
    const A = await import('/src/data/arenas/index.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const { withSeededRandom } = await import('/src/systems/seededRng.ts');
    const def = A.ARENAS.boss_leviathan;
    const out = {};
    // ---------- 1) Kachelplan ----------
    const cols = def.size.w / A.ARENA_TILE;
    const rows = def.size.h / A.ARENA_TILE;
    out.grid = [cols, rows, def.tiles.length, def.tiles.every((t) => t.length === cols), def.tiles.every((t) => /^[.pW#Vv]+$/.test(t))];
    const solid = (c, r) => "W#Vv".includes(def.tiles[r][c]);
    // Erreichbarkeit (4er-Nachbarschaft) vom Süd-Eingang
    const seen = new Set(); const q = [[Math.floor(cols / 2), rows - 1]]; seen.add(q[0].join());
    while (q.length) { const [c, rr] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dx, nr = rr + dy; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || solid(nc, nr) || seen.has(nc + ',' + nr)) continue; seen.add(nc + ',' + nr); q.push([nc, nr]); } }
    let free = 0; for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) if (!solid(c, rr)) free++;
    out.reach = [seen.size, free];
    // Hindernisse decken genau die festen Kacheln (Fläche), liegen in der Spielfläche
    const obs = A.arenaObstacles(def, 0, 0);
    let solidArea = 0; for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) if (solid(c, rr)) solidArea += 256;
    out.obs = [obs.length, obs.reduce((s, o) => s + o.w * o.h, 0), solidArea, obs.every((o) => o.x >= 0 && o.y >= 0 && o.x + o.w <= def.size.w && o.y + o.h <= def.size.h)];
    out.obsKinds = [...new Set(obs.map((o) => o.kind))].sort();

    // ---------- 2) Seed-Layout ----------
    const seed = 'm12p3-seed';
    let callsA = 0, callsB = 0;
    const count = (fn, inc) => { const orig = Math.random; Math.random = () => { inc(); return orig(); }; try { return fn(); } finally { Math.random = orig; } };
    const fA = withSeededRandom(seed, () => count(() => gen.generateSectorFloor(1, 3), () => callsA++));
    const fB = withSeededRandom(seed, () => count(() => { const f = gen.generateSectorFloor(1, 3); A.attachArenas(f); return f; }, () => callsB++));
    out.calls = [callsA, callsB];
    const ser = (room) => JSON.stringify(room);
    const diff = [...fA.rooms.keys()].filter((k) => ser(fA.rooms.get(k)) !== ser(fB.rooms.get(k)));
    out.diffKeys = diff; out.bossKey = fA.bossKey;
    const boss = fB.rooms.get(fB.bossKey);
    out.boss = { bounds: boss.bounds, arenaKind: boss.arenaKind, spawns: boss.spawns, pods: boss.pods.length, chasms: boss.chasms.length, chest: boss.chest };
    // andere Sektoren / Ebenen bleiben unberührt
    const others = [[1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 3]].map(([s, fl]) => { const f = withSeededRandom('x' + s + fl, () => gen.generateSectorFloor(s, fl)); return A.attachArenas(f); });
    out.others = others;
    // Nordtür → Durchgang im Sockel
    const north = withSeededRandom(seed, () => gen.generateSectorFloor(1, 3));
    const nb = north.rooms.get(north.bossKey); nb.doors = { ...nb.doors, north: true };
    A.applyArena(nb, def);
    const midX = nb.bounds.l + Math.floor(cols / 2) * 16 + 8;
    out.northGap = nb.obstacles.some((o) => midX > o.x && midX < o.x + o.w && nb.bounds.t + 8 > o.y && nb.bounds.t + 8 < o.y + o.h);
    out.enabledDefault = A.arenaEnabled();
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.grid, [43, 22, 22, true, true], 'Kachelplan 43 × 22, gültige Zeichen');
  assert.strictEqual(r.reach[0], r.reach[1], 'alle begehbaren Kacheln erreichbar');
  assert.strictEqual(r.obs[1], r.obs[2], 'Hindernisse decken genau die festen Kacheln');
  assert.ok(r.obs[3] && r.obs[0] <= 24, 'wenige Rechtecke, alle in der Spielfläche: ' + r.obs[0]);
  assert.deepStrictEqual(r.obsKinds, ['bulkhead_wall', 'conduit', 'pillar']);
  assert.strictEqual(r.calls[0], r.calls[1], 'attachArenas verbraucht kein Math.random');
  assert.deepStrictEqual(r.diffKeys, [r.bossKey], 'nur der Bossraum ändert sich');
  assert.deepStrictEqual(r.boss.bounds, { l: 68, r: 756, t: 46, b: 398 });
  assert.strictEqual(r.boss.arenaKind, 'boss_leviathan');
  assert.deepStrictEqual(r.boss.spawns, [{ kind: 'boss_leviathan', x: 68 + 344, y: 46 + 30 }]);
  assert.deepStrictEqual([r.boss.pods, r.boss.chasms, r.boss.chest], [0, 0, null]);
  assert.deepStrictEqual(r.others, [false, false, false, false, false, false], 'nur S1 Ebene III bekommt (vorerst) eine Arena');
  assert.strictEqual(r.northGap, false, 'Nordtür: Durchgang im Boss-Sockel');
  assert.strictEqual(r.enabledDefault, false, 'ohne ?arena aus (ENDBOSS_ARENA_LIVE = false)');

  // ---------- 3/4) Spiel: Gate & Arena-Kampf ----------
  const run = async (url) => {
    await page.goto(url);
    await page.waitForFunction(() => document.styleSheets.length > 0);
    return page.evaluate(async () => {
      const { preloadHDArt } = await import('/src/assets/artLoader.ts'); await preloadHDArt();
      const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
      const { GameState } = await import('/src/systems/gameState.ts');
      const { InputManager } = await import('/src/engine/input.ts');
      const idle = new Proxy({}, { get: (t, k) => (k === 'getMoveVector' ? () => ({ x: 0, y: 0 }) : k === 'isMouseActive' ? () => false : k === 'getMousePos' ? () => ({ x: 0, y: 0 }) : () => false) });
      const g = new GameState(); g.saveLocked = true;
      const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
      d.startRun(1); d.startFloor(3, false, 1);
      const bossRoom = d.floor.rooms.get(d.floor.bossKey);
      const res = { arena: !!bossRoom.bounds };
      if (!bossRoom.bounds) return res;
      const side = bossRoom.doors.south ? 'south' : bossRoom.doors.east ? 'east' : bossRoom.doors.west ? 'west' : 'north';
      d.enterRoom(d.floor.bossKey, side);
      res.side = side;
      res.player = [Math.round(d.playerX), Math.round(d.playerY)];
      res.cam = [d.camera.x, d.camera.y];
      const boss = d.enemies.find((e) => e.kind === 'boss_leviathan');
      res.boss = boss ? [Math.round(boss.x), Math.round(boss.y)] : null;
      d.invulnTimer = 9999;
      let err = null;
      try { for (let i = 0; i < 600; i++) { d.invulnTimer = 9999; d.update(1 / 60, idle); } } catch (e) { err = String(e); }
      res.err = err;
      const rb = d.bounds;
      res.inside = d.enemies.every((e) => e.x >= rb.l && e.x <= rb.r && e.y >= rb.t - 40 && e.y <= rb.b);
      res.playerFree = !d.collidesRoomObstacle(d.playerX, d.playerY, 6);
      // Screenshot: Spieler unten mittig, Kamera nach oben gefahren (Boss-Wand sichtbar)
      d.playerX = rb.cx; d.playerY = rb.t + 120; d.camera.snap(d.cameraTarget);
      const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
      d.roomFade = 0; d.render(ctx, new InputManager(canvas)); ctx.setTransform(1, 0, 0, 1, 0, 0);
      res.url = canvas.toDataURL('image/png');
      d.playerX = rb.cx; d.playerY = rb.b - 30; d.camera.snap(d.cameraTarget);
      ctx.setTransform(2, 0, 0, 2, 0, 0); d.render(ctx, new InputManager(canvas)); ctx.setTransform(1, 0, 0, 1, 0, 0);
      res.url2 = canvas.toDataURL('image/png');
      return res;
    });
  };
  const off = await run(`http://127.0.0.1:${PORT}/`);
  assert.strictEqual(off.arena, false, 'Gate: ohne ?arena Standard-Bossraum');
  const on = await run(`http://127.0.0.1:${PORT}/?arena`);
  console.log(JSON.stringify({ ...on, url: undefined, url2: undefined }));
  assert.strictEqual(on.arena, true, 'mit ?arena: Arena-Bossraum');
  assert.deepStrictEqual(on.boss, [412, 76], 'Leviathan am Anker');
  assert.ok(!on.err, 'Arena-Kampf ohne Fehler: ' + on.err);
  assert.ok(on.inside, 'alle Gegner in der Arena');
  assert.ok(on.playerFree, 'Spieler steht nicht in einem Hindernis');
  if (on.side === 'south') assert.deepStrictEqual(on.player, [412, 398 - 18], 'Eintritt Süd');
  fs.writeFileSync(`${scratch}/m12p3_arena_north.png`, Buffer.from(on.url.split(',')[1], 'base64'));
  fs.writeFileSync(`${scratch}/m12p3_arena_south.png`, Buffer.from(on.url2.split(',')[1], 'base64'));
  console.log('M12 ARENA-DATEN OK');
};
