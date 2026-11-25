module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const gen = await import('/src/world/dungeonGen.ts');
    const rng = await import('/src/systems/seededRng.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const o = { floors: 0, perFloor: {}, bad: [] };
    const rectHit = (x, y, r, z) => x + r > z.x && x - r < z.x + z.w && y + r > z.y && y - r < z.y + z.h;
    for (const sec of [1, 2, 3, 4]) for (const fl of [1, 2, 3]) {
      let withBeacon = 0, multi = 0, n = 40;
      for (let i = 0; i < n; i++) {
        const f = gen.generateSectorFloor(sec, fl); o.floors++;
        const bs = [...f.rooms.values()].filter((r) => r.extractBeacon);
        if (bs.length === 1) withBeacon++; else if (bs.length > 1) multi++;
        for (const room of bs) {
          const b = room.extractBeacon;
          if (room.type !== 'combat' || room.isRiftChamber || room.secretParentKey) o.bad.push(`S${sec}F${fl} falscher Raumtyp ${room.type}`);
          for (const ob of room.obstacles) if (rectHit(b.x, b.y, 12, ob)) o.bad.push(`S${sec}F${fl} obstacle`);
          for (const c of room.chasms) if (rectHit(b.x, b.y, 12, c)) o.bad.push(`S${sec}F${fl} chasm`);
          for (const p of room.prisms ?? []) if (Math.hypot(b.x - p.x, b.y - p.y) < 12 + p.r) o.bad.push(`S${sec}F${fl} prism`);
          for (const t of room.teleporters ?? []) if (Math.hypot(b.x - t.x, b.y - t.y) < 12 + 9) o.bad.push(`S${sec}F${fl} tele`);
          if (room.riftPortal && Math.hypot(b.x - room.riftPortal.x, b.y - room.riftPortal.y) < 12 + 14) o.bad.push(`S${sec}F${fl} portal`);
        }
      }
      o.perFloor[`${sec}-${fl}`] = [withBeacon, multi];
    }
    // Seed-stabil: gleiche Ebene → gleiche Bake-Position (auch ohne gleichen Zufall)
    const a = rng.withSeededRandom('cp6:a', () => gen.generateSectorFloor(2, 2));
    const b = rng.withSeededRandom('cp6:a', () => gen.generateSectorFloor(2, 2));
    const pos = (f) => JSON.stringify([...f.rooms.values()].filter((r) => r.extractBeacon).map((r) => [r.key, r.extractBeacon.x, r.extractBeacon.y]));
    o.stable = pos(a) === pos(b) && pos(a) !== '[]';
    // Prüfung: keine Bake, Layout unverändert (beacon:false)
    const t1 = rng.withSeededRandom('cp6:t', () => gen.generateSectorFloor(3, 2, undefined, { beacon: false }));
    o.trialNone = [...t1.rooms.values()].every((r) => !r.extractBeacon);
    // Laufzeit: R halten tut nichts; Bake nur nach Raum-Clear nutzbar, führt zu Rückkehr
    const gs = new GameState(); const calls = [];
    const dng = new DungeonScene(gs, { onReturnToHub: (s) => calls.push(s.reason), onToast() {}, onHudDirty() {} });
    dng.startRun(1); dng.startFloor(2, false, 1);
    const f = dng.floor; const host = [...f.rooms.values()].find((r) => r.extractBeacon);
    dng.enterRoom(host.key, null); dng.enemies.length = 0; dng.currentRoom.cleared = false;
    const canvas = document.getElementById('game-canvas'); const inp = new InputManager(canvas);
    const bc = host.extractBeacon; dng.playerX = bc.x; dng.playerY = bc.y;
    const press = (code) => { inp.keysPressed.add(code); inp.keysHeld.add(code); };
    const release = () => { inp.keysPressed.clear(); inp.keysHeld.clear(); };
    dng.updateRoomInteractions(inp); o.promptUncleared = dng.activePrompt?.label ?? null;
    dng.currentRoom.cleared = true; dng.updateRoomInteractions(inp); o.promptCleared = dng.activePrompt?.label ?? null;
    // R halten 3 s → kein Rückkehr
    press('KeyR'); for (let i = 0; i < 200; i++) dng.update(1 / 60, inp); release(); o.rHeld = calls.length;
    dng.playerX = bc.x; dng.playerY = bc.y; press('KeyE'); dng.updateRoomInteractions(inp); release();
    o.afterE = [calls.length, calls[0], bc.used];
    // Screenshot der Bake im Raum
    return o;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.bad, [], 'Bake frei platziert');
  for (const sec of [1, 2, 3, 4]) {
    assert.deepStrictEqual(r.perFloor[`${sec}-1`], [0, 0], `Ebene I ohne Bake (S${sec})`);
    for (const fl of [2, 3]) assert.deepStrictEqual(r.perFloor[`${sec}-${fl}`], [40, 0], `genau eine Bake S${sec}F${fl}`);
  }
  assert.ok(r.stable && r.trialNone);
  assert.strictEqual(r.promptUncleared, null);
  assert.ok(/Notfall-Bake/.test(r.promptCleared));
  assert.strictEqual(r.rHeld, 0, 'R halten teleportiert nicht mehr');
  assert.deepStrictEqual(r.afterE, [1, 'warp', true]);
  console.log('M10C PHASE6 OK');
};
