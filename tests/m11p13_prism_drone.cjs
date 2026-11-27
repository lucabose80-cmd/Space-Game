// M11 — Prisma-Drohne-Rig (prism_drone): Schweben + Orbit-Splitter, Vorwarnung (Hälften öffnen + Kern glüht), Schuss-Impuls, Erholung, Treffer-Zucken, Tod-Trümmer, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 41, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, kind: 'prism_drone', hp: 10, maxHp: 10 }, x);
    const run = (en, n = 40, t0 = 1) => { let pz; for (let i = 0; i < n; i++) pz = anim.getBossPose('prism_drone', en, t0 + i * 0.016, 150, 0); return pz; };
    const idle = run(e({}));
    const orbitXs = new Set();
    const orb = e({ id: 42 });
    for (let i = 0; i < 60; i++) orbitXs.add(Math.round((anim.getBossPose('prism_drone', orb, 2 + i * 0.02, 150, 0).shardA.dx ?? 0)));
    const tele = run(e({ id: 43, telegraphTimer: 0.3 }));
    const fire = e({ id: 44, telegraphTimer: 0.3 });
    run(fire, 25, 4); fire.telegraphTimer = 0;
    let firePose; for (let i = 1; i <= 3; i++) firePose = anim.getBossPose('prism_drone', fire, 4.4 + i * 0.02, 150, 0);
    let recPose; for (let i = 1; i <= 20; i++) recPose = anim.getBossPose('prism_drone', fire, 4.46 + i * 0.016, 150, 0);
    const hit = e({ id: 45 }); run(hit, 25, 6); hit.flashTimer = 0.1;
    let hitRot = 0;
    for (let i = 0; i < 4; i++) { const p = anim.getBossPose('prism_drone', hit, 6.45 + i * 0.016, 150, 0); if (Math.abs(p.band.rot ?? 0) > Math.abs(hitRot)) hitRot = p.band.rot ?? 0; }
    hit.flashTimer = 0; let afterHit;
    for (let i = 1; i <= 20; i++) afterHit = anim.getBossPose('prism_drone', hit, 6.55 + i * 0.016, 150, 0);
    return {
      loaded: !!getHDArt().rigs.prism_drone,
      orbitCount: orbitXs.size,
      idleTopDy: idle.top.dy ?? 0, teleTopDy: tele.top.dy ?? 0,
      idleCoreSx: idle.core.sx ?? 0, teleCoreSx: tele.core.sx ?? 0,
      fireCoreSx: firePose.core.sx ?? 0, recTopDy: recPose.top.dy ?? 0,
      hitRot, afterHitRot: afterHit.band.rot ?? 0,
    };
  });
  assert.ok(r.loaded, 'Prisma-Drohne-Rig geladen (6 Teile)');
  assert.ok(r.orbitCount > 8, 'Orbit-Splitter kreisen: ' + r.orbitCount);
  assert.ok(r.teleTopDy < r.idleTopDy - 2.5, 'Vorwarnung: obere Prisma-Hälfte hebt sich: ' + JSON.stringify(r));
  assert.ok(r.teleCoreSx > r.idleCoreSx + 0.5, 'Vorwarnung: offener Kern blüht auf');
  assert.ok(r.recTopDy > r.teleTopDy + 2, 'Erholung: Hälften schließen sich wieder');
  assert.ok(Math.abs(r.hitRot) > 0.06 && Math.abs(r.afterHitRot) < 0.06, 'Treffer-Zucken kurz & klingt ab');

  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(2);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(ctx.getImageData(380, 180, 220, 200).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 400; const gx = c.getContext('2d'); gx.imageSmoothingEnabled = false; gx.drawImage(canvas, 400, 180, 240, 200, 0, 0, 480, 400); return c.toDataURL('image/png'); };
    const snap = () => { dng.enemies.length = 0; dng.playerX = 120; dng.playerY = 190; dng.invulnTimer = 999; dng.spawnEnemy('prism_drone', 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.time = 2; dng.roomFade = 0; dng.render(ctx, input); return hash(); };
    const art = getHDArt();
    const withRig = snap(); const idleShot = crop();
    const keep = art.rigs.prism_drone; art.rigs.prism_drone = null; const without = snap(); art.rigs.prism_drone = keep;
    dng.enemies.length = 0; dng.spawnEnemy('prism_drone', 250, 130); const en = dng.enemies[0]; en.telegraphTimer = 0.25; dng.time = 3; dng.roomFade = 0; dng.render(ctx, input);
    const teleShot = crop();
    en.hp = 0; dng.onEnemyKilled(en); dng.time = 3.016; dng.render(ctx, input); dng.time = 3.25; dng.render(ctx, input);
    const debris = hash();
    dng.time = 5; dng.render(ctx, input); const after = hash();
    return { withRig, without, debris, after, idleShot, teleShot };
  });
  const fs = require('node:fs'); const path = require('node:path');
  fs.writeFileSync(path.join(__dirname, 'out', 'prism_drone_idle.png'), Buffer.from(g.idleShot.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'out', 'prism_drone_tele.png'), Buffer.from(g.teleShot.split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig ≠ Fallback');
  assert.notStrictEqual(g.debris, g.after, 'Tod-Trümmer sichtbar & verschwinden');
  console.log('M11 PRISM-DRONE OK');
};
