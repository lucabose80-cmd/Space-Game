// M12 Phase B — Kamera (`src/dungeon/camera.ts`) + Renderer-Translation + Rand-Pfeile.
// 1) Standardraum: Kamera bleibt exakt (0, 0), egal wo der Spieler steht.
// 2) Arena (688 × 352): Totzone, weiche Glättung, Klemme an den Arena-Rändern, snap beim Raumwechsel,
//    focus() mit Eingabesperre (max. 2,5 s), Maus-Zielen rechnet Bildschirm → Welt.
// 3) Rand-Pfeile für Gefahrenzonen außerhalb des Bildes; Screenshots Standardraum vs. Arena.
module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { DungeonCamera, CAMERA_FOCUS_MAX_SEC } = await import('/src/dungeon/camera.ts');
    const { offscreenMarkers } = await import('/src/dungeon/edgeIndicators.ts');
    // Eingabe-Attrappe, die `locked` wie der echte InputManager respektiert
    const mkInput = (mv, mouse) => {
      const t = { locked: false };
      t.getMoveVector = () => (t.locked ? { x: 0, y: 0 } : mv);
      t.isMouseActive = () => !!mouse;
      t.getMousePos = () => mouse ?? { x: 0, y: 0 };
      return new Proxy(t, { get: (o, k) => (k in o ? o[k] : () => false), set: (o, k, v) => ((o[k] = v), true) });
    };
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
      d.rebuildNav(); d.invulnTimer = 9999;
      return { g, d, room };
    };
    const out = {};
    const step = (d, n, inp = idle) => { for (let i = 0; i < n; i++) d.update(1 / 60, inp); };

    // ---------- 1) Standardraum ----------
    {
      const { d } = mk(null);
      const pos = [];
      for (const [x, y] of [[80, 60], [400, 210], [240, 134]]) { d.playerX = x; d.playerY = y; step(d, 30); pos.push([d.camera.x, d.camera.y]); }
      d.camera.focus(400, 200, 2); step(d, 30); pos.push([d.camera.x, d.camera.y, d.camera.inputLocked]);
      out.std = pos;
      const m = d.camera.toWorld(123, 45); out.stdToWorld = [m.x, m.y];
    }

    // ---------- 2) Arena ----------
    const big = { l: 68, r: 68 + 688, t: 46, b: 46 + 352 };
    out.range = DungeonCamera.range(big);
    out.rangeSmall = DungeonCamera.range({ l: 100, r: 300, t: 60, b: 160 });
    {
      const { d, room } = mk(big);
      // snap beim Betreten (von Süden → unten mittig)
      d.enterRoom(room.key, 'south');
      out.snapSouth = [d.camera.x, d.camera.y, d.playerX, d.playerY];
      // Totzone: kleine Bewegung → Kamera bleibt stehen
      d.playerX = 412; d.playerY = 222; d.camera.snap(d.cameraTarget);
      const c0 = [d.camera.x, d.camera.y];
      d.playerX += 15; d.playerY += 9; step(d, 20);
      out.deadzone = [c0, [d.camera.x, d.camera.y]];
      // große Bewegung → folgt weich (nicht sofort, aber nach 1 s fast vollständig)
      d.playerX = 600; step(d, 1);
      const after1 = d.camera.x - c0[0];
      step(d, 60);
      out.follow = [Math.round(after1 * 100) / 100, Math.round(d.camera.x * 100) / 100, Math.round((600 - 20 - 240) * 100) / 100];
      // Klemme an den Rändern (Spieler in der Ecke)
      d.playerX = big.r - 7; d.playerY = big.b - 7; step(d, 120);
      out.clampMax = [Math.round(d.camera.x * 1000) / 1000, Math.round(d.camera.y * 1000) / 1000];
      d.playerX = big.l + 7; d.playerY = big.t + 7; step(d, 120);
      out.clampMin = [Math.round(d.camera.x * 1000) / 1000, Math.round(d.camera.y * 1000) / 1000];
      // Raster auf HD-Pixel
      d.camera.x = 10.3; d.camera.y = 7.76; out.rendered = [d.camera.renderX(), d.camera.renderY()];
      d.camera.snap(d.cameraTarget);

      // Maus-Zielen: Bildschirm → Welt
      d.playerX = 600; d.playerY = 300; d.camera.snap(d.cameraTarget);
      const cam = [d.camera.renderX(), d.camera.renderY()];
      const ps = d.camera.toScreen(d.playerX, d.playerY);
      const mouseScreen = { x: ps.x + 50, y: ps.y }; // 50 px rechts vom Spieler auf dem Bildschirm
      const ang = d.getAimAngle(mkInput({ x: 0, y: 0 }, mouseScreen));
      out.aim = [cam, Math.round(ang * 1000) / 1000];

      // focus(): Kamera fährt hin, Spieler-Eingabe gesperrt, max. 2,5 s
      d.playerX = 150; d.playerY = 330; d.camera.snap(d.cameraTarget);
      d.camera.focus(700, 80, 99);
      const right = mkInput({ x: 1, y: 0 });
      const px0 = d.playerX;
      step(d, 60, right);
      out.focusMid = [d.camera.inputLocked, Math.round(d.playerX - px0), Math.round(d.camera.x), Math.round(d.camera.y), right.locked];
      step(d, Math.ceil(CAMERA_FOCUS_MAX_SEC * 60) - 60 + 2, right);
      const px1 = d.playerX;
      step(d, 30, right);
      out.focusEnd = [d.camera.inputLocked, Math.round(d.playerX - px1) > 10];

      // Rand-Pfeile
      d.camera.snap(d.cameraTarget);
      const cx = d.camera.renderX(); const cy = d.camera.renderY();
      const zones = [
        { shape: 'circle', x: cx + 240, y: cy + 135, r: 20, delay: 1, life: 1, color: '#f00' }, // im Bild
        { shape: 'circle', x: cx + 480 + 120, y: cy + 135, r: 20, delay: 1, life: 1, color: '#0f0' }, // rechts außerhalb
        { shape: 'rect', x: cx + 240, y: cy - 80, w: 40, h: 20, delay: 1, life: 1, color: '#00f' }, // oben außerhalb
        { shape: 'line', x: cx - 200, y: cy + 50, x2: cx - 120, y2: cy + 60, width: 10, delay: 1, life: 1, color: '#ff0' }, // links außerhalb
      ];
      out.markers = offscreenMarkers(zones, cx, cy, 480, 270).map((m) => [m.color, Math.round(m.x), Math.round(m.y)]);
    }
    return out;
  });
  console.log(JSON.stringify(r));
  // 1) Standardraum
  assert.ok(r.std.every((p) => p[0] === 0 && p[1] === 0), 'Standardraum: Kamera immer (0, 0): ' + JSON.stringify(r.std));
  assert.strictEqual(r.std[3][2], false, 'Standardraum: focus() sperrt nichts');
  assert.deepStrictEqual(r.stdToWorld, [123, 45], 'Standardraum: Bildschirm = Welt');
  // 2) Arena
  assert.deepStrictEqual(r.range, { minX: 0, maxX: 344, minY: 0, maxY: 176 }, 'Kamera-Bereich der 2×2-Arena');
  assert.deepStrictEqual(r.rangeSmall, { minX: -40, maxX: -40, minY: -24, maxY: -24 }, 'kleiner Raum: mittig');
  assert.deepStrictEqual(r.snapSouth.slice(2), [412, 398 - 18], 'Eintritt Süd');
  assert.ok(r.snapSouth[1] === 176 && Math.abs(r.snapSouth[0] - 172) < 0.01, 'snap: Kamera sofort am Spieler (unten mittig): ' + r.snapSouth);
  assert.deepStrictEqual(r.deadzone[0], r.deadzone[1], 'Totzone: kleine Bewegung bewegt die Kamera nicht');
  assert.ok(r.follow[0] > 1 && r.follow[0] < 60, 'Glättung: nach 1 Frame nur ein Teil des Wegs: ' + r.follow);
  assert.ok(Math.abs(r.follow[1] - r.follow[2]) < 1, 'folgt bis zur Totzonen-Kante: ' + r.follow);
  assert.deepStrictEqual(r.clampMax, [344, 176], 'Klemme unten rechts');
  assert.deepStrictEqual(r.clampMin, [0, 0], 'Klemme oben links');
  assert.deepStrictEqual(r.rendered, [10.5, 8], 'Kamera auf HD-Pixel gerastert');
  assert.ok(r.aim[0][0] > 0 && r.aim[0][1] > 0, 'Kamera verschoben für Zielprüfung');
  assert.strictEqual(r.aim[1], 0, 'Maus 50 px rechts vom Spieler (Bildschirm) → Winkel 0 (Welt)');
  assert.ok(r.focusMid[0] && r.focusMid[1] === 0, 'focus: Eingabe gesperrt, Spieler steht: ' + r.focusMid);
  assert.ok(r.focusMid[2] > 250 && r.focusMid[3] < 20, 'focus: Kamera fährt zum Ziel: ' + r.focusMid);
  assert.strictEqual(r.focusMid[4], false, 'Eingabe-Sperre wird nach dem Frame zurückgesetzt');
  assert.deepStrictEqual(r.focusEnd, [false, true], 'focus endet nach max. 2,5 s, Spieler läuft wieder');
  assert.deepStrictEqual(r.markers.map((m) => m[0]), ['#0f0', '#00f', '#ff0'], 'Pfeile nur für Zonen außerhalb');
  const [g, b, y] = r.markers;
  assert.ok(g[1] >= 460 && g[1] <= 480, 'Pfeil rechts am Rand: ' + g);
  assert.ok(b[2] >= 0 && b[2] <= 20, 'Pfeil oben am Rand: ' + b);
  assert.ok(y[1] >= 0 && y[1] <= 20, 'Pfeil links am Rand: ' + y);

  // 3) Screenshots: Standardraum & Arena (Kamera mittig-rechts, Zone außerhalb rechts → Pfeil)
  const shots = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    const res = {};
    for (const arena of [false, true]) {
      const g = new GameState(); g.saveLocked = true;
      const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
      d.startRun(1);
      const room = d.currentRoom;
      room.spawns = [];
      if (arena) {
        room.bounds = { l: 68, r: 756, t: 46, b: 398 };
        room.doors = { north: true, south: true, east: false, west: false };
        d.rebuildNav();
        d.playerX = 560; d.playerY = 300; d.camera.snap(d.cameraTarget);
        d.spawnEnemy('slime', 500, 260);
        d.bossFx.add({ shape: 'circle', x: 740, y: 120, r: 24, delay: 5, life: 1, color: '#ef4444' });
        d.bossFx.add({ shape: 'circle', x: 420, y: 260, r: 20, delay: 5, life: 1, color: '#fbbf24' });
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
      d.roomFade = 0; d.time = 1; d.render(ctx, new InputManager(canvas));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      res[arena ? 'arena' : 'std'] = { cam: [d.camera.x, d.camera.y], url: canvas.toDataURL('image/png') };
    }
    return res;
  });
  console.log(JSON.stringify({ std: shots.std.cam, arena: shots.arena.cam }));
  assert.deepStrictEqual(shots.std.cam, [0, 0]);
  assert.ok(shots.arena.cam[0] > 100 && shots.arena.cam[1] > 50, 'Arena-Screenshot mit verschobener Kamera');
  const fs = require('node:fs');
  fs.writeFileSync(`${scratch}/m12p2_std.png`, Buffer.from(shots.std.url.split(',')[1], 'base64'));
  fs.writeFileSync(`${scratch}/m12p2_arena.png`, Buffer.from(shots.arena.url.split(',')[1], 'base64'));
  console.log('M12 KAMERA OK');
};
