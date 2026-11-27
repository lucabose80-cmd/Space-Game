// M11 Phase 1 — Rig-Engine, prozedurale Bewegung, Einbindung der Pilot-Bosse
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const rig = await import('/src/engine/rig.ts');
    const mot = await import('/src/dungeon/anim/motion.ts');
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const rigs = await import('/src/data/rigs.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const out = {};
    const mk = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); return c; };
    const imgs = { parts: { body: mk(20, 20, '#ff0000'), arm: mk(6, 20, '#00ff00'), eye: mk(4, 4, '#0000ff') }, flash: { body: mk(20, 20, '#ffffff'), arm: mk(6, 20, '#ffffff'), eye: mk(4, 4, '#ffffff') } };
    const def = { id: 't', parts: [
      { id: 'body', pivot: [0.5, 0.5], offset: [0, -20], z: 0 },
      { id: 'armR', image: 'arm', parent: 'body', attach: [1, 0.5], pivot: [0.5, 0], z: 1 },        // Gelenk rechts-mitte, Arm hängt nach unten
      { id: 'armL', image: 'arm', flipX: true, parent: 'body', attach: [0, 0.5], pivot: [0.5, 0], z: -1 },
      { id: 'eye', parent: 'armR', attach: [0.5, 1], pivot: [0.5, 0.5], z: 5 },
    ] };
    // Position des Gelenks von armR: Körper-Mitte (0,-20) + (+10, 0) = (10,-20)
    const p0 = rig.partWorldPos(def, imgs, {}, 'armR'); out.armJoint = [Math.round(p0.x), Math.round(p0.y), +p0.rot.toFixed(2)];
    // Drehung +90° um das Gelenk → der Arm zeigt nach links; die Augen (unten am Arm) wandern nach links vom Gelenk
    const p1 = rig.partWorldPos(def, imgs, { armR: { rot: Math.PI / 2 } }, 'eye'); out.eyeRot = [Math.round(p1.x), Math.round(p1.y)];
    const p2 = rig.partWorldPos(def, imgs, {}, 'eye'); out.eyeIdle = [Math.round(p2.x), Math.round(p2.y)];   // 10, -20 + 20 = 0
    const p3 = rig.partWorldPos(def, imgs, { body: { dy: -5 } }, 'armR'); out.bodyDy = Math.round(p3.y);           // folgt dem Elternteil
    const p4 = rig.partWorldPos(def, imgs, {}, 'armR', 100, 50, { flipX: true }); out.mirrored = [Math.round(p4.x), Math.round(p4.y)]; // Figur gespiegelt: Gelenk links
    // Zeichnen: Pixelprüfung auf Offscreen-Canvas
    const cv = document.createElement('canvas'); cv.width = 100; cv.height = 80; const g = cv.getContext('2d');
    rig.drawRig(g, def, imgs, 50, 60, {});
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
    out.pixBody = px(50, 40); out.pixArmR = px(60, 45); out.pixArmL = px(39, 55); out.pixArmLBehind = px(40, 45); out.pixEmpty = px(5, 5);
    // Reihenfolge: z → Auge (z 5) liegt über dem Arm
    out.pixEye = px(60, 60);
    // Pose: hidden / alpha
    g.clearRect(0, 0, 100, 80); rig.drawRig(g, def, imgs, 50, 60, { armR: { hidden: true } }); out.hiddenArm = px(60, 45);
    g.clearRect(0, 0, 100, 80); rig.drawRig(g, def, imgs, 50, 60, {}, { flash: true }); out.flash = px(50, 40);
    // blendPose
    const b = rig.blendPose({ a: { rot: 0, sx: 1 } }, { a: { rot: 1, sx: 2 }, c: { dy: 4 } }, 0.5); out.blend = [b.a.rot, b.a.sx, b.c.dy];
    // Bewegung
    const e = { id: 3, kind: 'drone', vx: 80, vy: 0, anim: 1, telegraphTimer: 0, flashTimer: 0, radius: 8 };
    const m1 = mot.enemyMotion(e, 1); out.lean = m1.rot > 0.05 && m1.rot <= 0.1;
    const m2 = mot.enemyMotion({ ...e, vx: 0, telegraphTimer: 0.3 }, 1); out.windup = [m2.sx > 1.05, m2.sy < 0.95];
    const m3 = mot.enemyMotion({ ...e, vx: 0, flashTimer: 0.1 }, 1); out.hit = [m3.sx < 0.97, m3.sy > 1.04];
    out.wants = [mot.wantsMotion({ kind: 'drone' }), mot.wantsMotion({ kind: 'slime' }), mot.wantsMotion({ kind: 'boss_breacher' }), mot.wantsMotion({ kind: 'boss' })];
    // Rigs geladen
    const art = getHDArt(); out.loaded = [!!art.rigs.krall, !!art.rigs.core_warden, Object.keys(rigs.RIG_BY_KIND).sort()];
    const idle = anim.getBossPose('krall', { id: 1, vx: 0, vy: 0 }, 1); const walk = anim.getBossPose('krall', { id: 1, vx: 60, vy: 0 }, 1);
    out.legsMove = Math.abs(walk.legFL.rot) > Math.abs(idle.legFL.rot) * 2;
    // Integration: Rig vs. Fallback im echten Renderer
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const snap = (kind) => { dng.enemies.length = 0; dng.bossFx.clear(); dng.playerX = 120; dng.playerY = 190; dng.invulnTimer = 999; dng.spawnEnemy(kind, 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.time = 2; dng.roomFade = 0; dng.render(ctx, new InputManager(canvas)); return ctx.getImageData(Math.round(250 * 2 * 2 * 0.5), 0, 1, 1) && Array.from(ctx.getImageData(430, 200, 160, 160).data).join(',').length + ':' + Array.from(ctx.getImageData(430, 200, 160, 160).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0); };
    out.rendered = {};
    for (const [kind, id] of [['boss_breacher', 'krall'], ['boss', 'core_warden']]) {
      const withRig = snap(kind); const keep = art.rigs[id]; art.rigs[id] = null; const without = snap(kind); art.rigs[id] = keep;
      out.rendered[id] = withRig !== without;
    }
    // normale Gegner mit Bewegung rendern ohne Fehler
    for (const k of ['drone', 'turret', 'slime', 'forge_golem']) { dng.enemies.length = 0; dng.spawnEnemy(k, 200, 140); dng.enemies[0].vx = 50; dng.enemies[0].telegraphTimer = 0.2; dng.render(ctx, new InputManager(canvas)); }
    out.enemiesOk = true;
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.armJoint, [10, -20, 0]); assert.deepStrictEqual(r.eyeIdle, [10, 0]);
  assert.ok(r.eyeRot[0] <= -9 && Math.abs(r.eyeRot[1] + 20) <= 1, 'Drehung um das Gelenk: ' + r.eyeRot);
  assert.strictEqual(r.bodyDy, -25, 'Kind folgt dem Elternteil'); assert.deepStrictEqual(r.mirrored, [90, 30]);
  assert.deepStrictEqual(r.pixBody, [255, 0, 0, 255]); assert.deepStrictEqual(r.pixArmR, [0, 255, 0, 255]); assert.deepStrictEqual(r.pixArmL, [0, 255, 0, 255]); assert.deepStrictEqual(r.pixArmLBehind, [255, 0, 0, 255], 'z −1: linker Arm hinter dem Körper'); assert.strictEqual(r.pixEmpty[3], 0);
  assert.deepStrictEqual(r.pixEye, [0, 0, 255, 255], 'z-Reihenfolge: Auge über dem Arm'); assert.strictEqual(r.hiddenArm[3], 0); assert.deepStrictEqual(r.flash, [255, 255, 255, 255]);
  assert.deepStrictEqual(r.blend, [0.5, 1.5, 2]);
  assert.ok(r.lean); assert.deepStrictEqual(r.windup, [true, true]); assert.deepStrictEqual(r.hit, [true, true]); assert.deepStrictEqual(r.wants, [true, false, false, false]);
  assert.deepStrictEqual(r.loaded, [true, true, ['boss', 'boss_breacher', 'drone', 'turret']]); assert.ok(r.legsMove);
  assert.ok(r.rendered.krall && r.rendered.core_warden, 'Rig verändert das Bild gegenüber dem Fallback: ' + JSON.stringify(r.rendered)); assert.ok(r.enemiesOk);
  console.log('M11 PHASE1 OK');
};
