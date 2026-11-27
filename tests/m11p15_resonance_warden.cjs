// M11 — Resonanz-Wächter-Rig (resonance_warden): Schweben + Orbit-Kristalle, Schildplatte öffnet sich, Vorwarnung (geladenes Auge), 6-Wege-Puls, Erholung, Treffer-Zucken, Tod-Trümmer, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 61, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, shieldDownTimer: 0, kind: 'resonance_warden', hp: 10, maxHp: 10 }, x);
    const run = (en, n = 40, t0 = 1) => { let pz; for (let i = 0; i < n; i++) pz = anim.getBossPose('resonance_warden', en, t0 + i * 0.016, 150, 0); return pz; };
    const idle = run(e({}));
    const orbitXs = new Set();
    const orb = e({ id: 62 });
    for (let i = 0; i < 60; i++) orbitXs.add(Math.round((anim.getBossPose('resonance_warden', orb, 2 + i * 0.02, 150, 0).crysL.dx ?? 0)));
    const tele = run(e({ id: 63, telegraphTimer: 0.35 }));
    const pulse = e({ id: 64, telegraphTimer: 0.35 });
    run(pulse, 25, 4); pulse.telegraphTimer = 0;
    let pulsePose; for (let i = 1; i <= 3; i++) pulsePose = anim.getBossPose('resonance_warden', pulse, 4.4 + i * 0.02, 150, 0);
    let recPose; for (let i = 1; i <= 25; i++) recPose = anim.getBossPose('resonance_warden', pulse, 4.46 + i * 0.016, 150, 0);
    const hit = e({ id: 65 }); run(hit, 25, 6); hit.flashTimer = 0.1;
    let hitRot = 0;
    for (let i = 0; i < 4; i++) { const p = anim.getBossPose('resonance_warden', hit, 6.45 + i * 0.016, 150, 0); if (Math.abs(p.torso.rot ?? 0) > Math.abs(hitRot)) hitRot = p.torso.rot ?? 0; }
    hit.flashTimer = 0; let afterHit;
    for (let i = 1; i <= 20; i++) afterHit = anim.getBossPose('resonance_warden', hit, 6.55 + i * 0.016, 150, 0);
    return {
      loaded: !!getHDArt().rigs.resonance_warden,
      orbitCount: orbitXs.size,
      idleEyeVar: idle.eye.variant ?? 0, teleEyeVar: tele.eye.variant ?? 0,
      idleShieldDx: idle.shield.dx ?? 0, teleShieldDx: tele.shield.dx ?? 0,
      pulseSx: pulsePose.torso.sx ?? 1, recSx: recPose.torso.sx ?? 1,
      hitRot, afterHitRot: afterHit.torso.rot ?? 0,
      facing: [anim.getRigFacing('resonance_warden', e({ x: 100 }), 50), anim.getRigFacing('resonance_warden', e({ x: 100 }), 150)],
    };
  });
  assert.ok(r.loaded, 'Resonanz-Wächter-Rig geladen (6 Teile)');
  assert.ok(r.orbitCount > 8, 'Orbit-Kristalle kreisen: ' + r.orbitCount);
  assert.strictEqual(r.idleEyeVar, 0, 'Ruhe: normales Auge');
  assert.strictEqual(r.teleEyeVar, 1, 'Vorwarnung: geladenes Auge (eyeGlow)');
  assert.ok(r.teleShieldDx < r.idleShieldDx - 3, 'Schildplatte klappt bei Angriff weg: ' + JSON.stringify(r));
  assert.ok(r.pulseSx > r.recSx + 0.03, 'Puls-Ausdehnung + Erholung');
  assert.ok(Math.abs(r.hitRot) > 0.05 && Math.abs(r.afterHitRot) < 0.05, 'Treffer-Zucken kurz & klingt ab');
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler');

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
    const snap = () => { dng.enemies.length = 0; dng.playerX = 340; dng.playerY = 140; dng.invulnTimer = 999; dng.spawnEnemy('resonance_warden', 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.time = 2; dng.roomFade = 0; dng.render(ctx, input); return hash(); };
    const art = getHDArt();
    const withRig = snap(); const idleShot = crop();
    const keep = art.rigs.resonance_warden; art.rigs.resonance_warden = null; const without = snap(); art.rigs.resonance_warden = keep;
    dng.enemies.length = 0; dng.spawnEnemy('resonance_warden', 250, 130); const en = dng.enemies[0]; en.telegraphTimer = 0.3; dng.time = 3; dng.roomFade = 0; dng.render(ctx, input);
    const teleShot = crop();
    en.hp = 0; dng.onEnemyKilled(en); dng.time = 3.016; dng.render(ctx, input); dng.time = 3.25; dng.render(ctx, input);
    const debris = hash();
    dng.time = 5; dng.render(ctx, input); const after = hash();
    return { withRig, without, debris, after, idleShot, teleShot };
  });
  const fs = require('node:fs'); const path = require('node:path');
  fs.writeFileSync(path.join(__dirname, 'out', 'resonance_warden_idle.png'), Buffer.from(g.idleShot.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'out', 'resonance_warden_tele.png'), Buffer.from(g.teleShot.split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig ≠ Fallback');
  assert.notStrictEqual(g.debris, g.after, 'Tod-Trümmer sichtbar & verschwinden');
  console.log('M11 RESONANCE-WARDEN OK');
};
