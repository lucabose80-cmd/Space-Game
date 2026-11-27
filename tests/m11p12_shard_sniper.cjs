// M11 — Splitter-Scharfschütze-Rig (shard_sniper): Schweben, Zielen (Vorwarnung), Schuss-Rückstoß, Erholung, Treffer-Zucken, Tod-Trümmer, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) =>
      Object.assign(
        { id: 31, x: 100, vx: 0, vy: 0, aimAngle: 0, flashTimer: 0, telegraphTimer: 0, kind: 'shard_sniper', hp: 10, maxHp: 10 },
        x,
      );
    const run = (en, n = 40, t0 = 1) => {
      let pz;
      for (let i = 0; i < n; i++) pz = anim.getBossPose('shard_sniper', en, t0 + i * 0.016, 150, 0);
      return pz;
    };
    const idle = run(e({}));
    // Schweben über Zeit: torso.dy & legs.rot variieren weich
    const hoverYs = new Set();
    const hov = e({ id: 32, vx: 45 });
    for (let i = 0; i < 60; i++) hoverYs.add(Math.round((anim.getBossPose('shard_sniper', hov, 2 + i * 0.02, 150, 0).torso.dy ?? 0) * 10));
    // Vorwarnung (Zielen nach unten-rechts, aimAngle = 0.55)
    const aim = run(e({ id: 33, telegraphTimer: 0.4, aimAngle: 0.55 }));
    // Schuss-Rückstoß (fallende Flanke telegraphTimer > 0 → 0)
    const shot = e({ id: 34, telegraphTimer: 0.3, aimAngle: 0 });
    run(shot, 20, 4);
    shot.telegraphTimer = 0;
    let recoilPose;
    for (let i = 1; i <= 3; i++) recoilPose = anim.getBossPose('shard_sniper', shot, 4.32 + i * 0.02, 150, 0);
    // Erholung nach Rückstoß (0,32 s später)
    let recPose;
    for (let i = 1; i <= 20; i++) recPose = anim.getBossPose('shard_sniper', shot, 4.38 + i * 0.016, 150, 0);
    // Treffer-Zucken (≤ 0,14 s) und danach wieder ruhig
    const hit = e({ id: 35 });
    run(hit, 25, 6);
    hit.flashTimer = 0.1;
    let hitRot = 0;
    for (let i = 0; i < 4; i++) {
      const p = anim.getBossPose('shard_sniper', hit, 6.45 + i * 0.016, 150, 0);
      if (Math.abs(p.torso.rot ?? 0) > Math.abs(hitRot)) hitRot = p.torso.rot ?? 0;
    }
    hit.flashTimer = 0;
    let afterHit;
    for (let i = 1; i <= 20; i++) afterHit = anim.getBossPose('shard_sniper', hit, 6.55 + i * 0.016, 150, 0);
    return {
      loaded: !!getHDArt().rigs.shard_sniper,
      hoverCount: hoverYs.size,
      idleArmR: idle.armR.rot ?? 0,
      aimArmR: aim.armR.rot ?? 0,
      recoilDx: recoilPose.rifle.dx ?? 0,
      idleRifleDx: idle.rifle.dx ?? 0,
      recTorsoRot: recPose.torso.rot ?? 0,
      recoilTorsoRot: recoilPose.torso.rot ?? 0,
      hitRot,
      afterHitRot: afterHit.torso.rot ?? 0,
      facing: [anim.getRigFacing('shard_sniper', e({ x: 100 }), 50), anim.getRigFacing('shard_sniper', e({ x: 100 }), 150)],
    };
  });
  assert.ok(r.loaded, 'Splitter-Scharfschütze-Rig geladen (alle 6 Teile vorhanden)');
  assert.ok(r.hoverCount > 4, 'Schwebe-Rhythmus aktiv: ' + r.hoverCount);
  assert.ok(r.aimArmR > r.idleArmR + 0.12, 'Vorwarnung: Arm + Gewehr zielen nach aimAngle: ' + JSON.stringify(r));
  assert.ok(r.recoilDx < r.idleRifleDx - 0.5, 'Schuss-Rückstoß bewegt Gewehr zurück: ' + JSON.stringify(r));
  assert.ok(r.recTorsoRot > r.recoilTorsoRot + 0.05, 'Erholung: Körper richtet sich nach Rückstoß auf');
  assert.ok(Math.abs(r.hitRot) > 0.06 && Math.abs(r.afterHitRot) < 0.06, 'Treffer: kurzes Zucken, danach ruhig: ' + JSON.stringify(r));
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');

  // Integration im echten Renderer: Rig ≠ Fallback (G2), Tod-Trümmer (G7) + Screenshots
  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {});
    for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(2);
    const room = dng.currentRoom;
    room.pods.forEach((p) => (p.broken = true));
    room.chasms = [];
    room.obstacles = [];
    room.spawns = [];
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () =>
      Array.from(ctx.getImageData(380, 180, 220, 200).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = 400;
      const gx = c.getContext('2d');
      gx.imageSmoothingEnabled = false;
      gx.drawImage(canvas, 400, 180, 240, 200, 0, 0, 480, 400);
      return c.toDataURL('image/png');
    };
    const snap = () => {
      dng.enemies.length = 0;
      dng.bossFx.clear();
      dng.playerX = 340;
      dng.playerY = 140;
      dng.invulnTimer = 999;
      dng.spawnEnemy('shard_sniper', 250, 130);
      dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6;
      dng.time = 2;
      dng.roomFade = 0;
      dng.render(ctx, input);
      return hash();
    };
    const art = getHDArt();
    const withRig = snap();
    const idleShot = crop();
    const keep = art.rigs.shard_sniper;
    art.rigs.shard_sniper = null;
    const without = snap();
    art.rigs.shard_sniper = keep;

    // Zielen-Screenshot
    dng.enemies.length = 0;
    dng.spawnEnemy('shard_sniper', 250, 130);
    const en = dng.enemies[0];
    en.telegraphTimer = 0.22;
    en.aimAngle = 0.2;
    dng.time = 3;
    dng.roomFade = 0;
    dng.render(ctx, input);
    const aimShot = crop();

    // Tod: Trümmer sichtbar und später wieder weg
    en.hp = 0;
    dng.onEnemyKilled(en);
    dng.time = 3.016;
    dng.render(ctx, input);
    dng.time = 3.25;
    dng.render(ctx, input);
    const debris = hash();
    const deathShot = crop();
    dng.time = 5;
    dng.render(ctx, input);
    const after = hash();
    return { withRig, without, debris, after, idleShot, aimShot, deathShot };
  });
  const fs = require('node:fs');
  const path = require('node:path');
  for (const [k, f] of [
    ['idleShot', 'shard_sniper_idle.png'],
    ['aimShot', 'shard_sniper_aim.png'],
    ['deathShot', 'shard_sniper_death.png'],
  ]) {
    fs.writeFileSync(path.join(__dirname, 'out', f), Buffer.from(g[k].split(',')[1], 'base64'));
  }
  assert.notStrictEqual(g.withRig, g.without, 'Rig und Fallback-Sprite werden unterschiedlich gezeichnet');
  assert.notStrictEqual(g.debris, g.after, 'Tod: Trümmer fliegen ab und sind später weg');
  console.log('M11 SHARD-SNIPER OK');
};
