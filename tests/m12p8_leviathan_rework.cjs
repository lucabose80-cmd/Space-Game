// M12 — Leviathan Rework Verification: 2-Segment-IK-Hydraulikarme, 5-Stufen-Fäuste, Sprite-Attacken-FX & Phase-2-Absturz-Respawn-Fix.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const fs = require('node:fs');
  const path = require('node:path');

  const r = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    await new Promise((res) => setTimeout(res, 450));
    const h = requestAnimationFrame(() => {});
    for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);

    const art = getHDArt();
    const spriteKeys = [
      'arenaLeviathanBody',
      'arenaLeviathanBodyP2',
      'arenaLeviathanBodyP3',
      'arenaLeviathanBodyDead',
      'arenaLeviathanArmSeg',
      'arenaLeviathanArmJoint',
      'arenaLeviathanHammerDmg',
      'arenaLeviathanHammerCrit',
      'arenaLeviathanHammerLaser',
      'arenaLeviathanStump',
      'arenaLeviathanBeam',
      'arenaLeviathanMuzzle',
      'arenaLeviathanWhip',
      'arenaLeviathanFlame',
      'arenaLeviathanVortex',
      'arenaLeviathanCrater',
      'arenaLeviathanIrisClosed',
      'arenaLeviathanIrisP2',
      'arenaLeviathanPoseRaise',
      'arenaLeviathanPosePlunge',
      'arenaLeviathanVentIntact',
      'arenaLeviathanVentCharge',
    ];
    const missing = spriteKeys.filter((k) => !art[k]);

    const state = new GameState();
    state.saveLocked = true;
    const dng = new DungeonScene(state, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(1);
    dng.startFloor(3, false, 1);
    dng.enterRoom(dng.floor.bossKey, 'south');
    const boss = dng.enemies.find((e) => e.kind === 'boss_leviathan');
    const L = boss.levArena;

    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);

    // Intro überspringen → Phase I Idle Screenshot
    L.state = 'idle';
    L.timer = 99;
    dng.camera.snap(boss.x, boss.y + 55);
    dng.roomFade = 0;
    dng.time = 2.0;
    dng.render(ctx, input);
    const shotP1 = canvas.toDataURL('image/png');

    // Phase II auslösen + Platten aufbrechen lassen + Chasm-Respawn-Loop-Test!
    boss.hp = Math.round(boss.maxHp * 0.5);
    dng.update(0.05, input); // startet Phase 2 Transition + Platten-Timer
    for (let i = 0; i < 40; i++) dng.update(0.05, input); // 2.0s → Platten brechen weg!
    const chasmsAfterP2 = dng.currentRoom.chasms.length;
    // Spieler + lastSafeX/Y absichtlich mitten in den ersten neuen Abgrund setzen und Absturz auslösen
    const ch0 = dng.currentRoom.chasms[0];
    dng.playerX = ch0.x + ch0.w / 2;
    dng.playerY = ch0.y + ch0.h / 2;
    dng.lastSafeX = dng.playerX;
    dng.lastSafeY = dng.playerY;
    dng.dashTimer = 0;
    dng.invulnTimer = 0;
    dng.pitFallTimer = 0;
    dng.updatePlayer(0.05, input); // löst pitFallTimer aus
    const fellOnce = dng.pitFallTimer > 0;
    for (let i = 0; i < 15; i++) dng.updatePlayer(0.05, input); // 0.75s → Respawn!
    const inChasmAfterRespawn = !!dng.getChasmAt(dng.playerX, dng.playerY + 4, -3);
    const fellAgain = dng.pitFallTimer > 0;

    // Phase II Twin-Beam Screenshot (Fäuste offen + aktiver Plasma-Strahl)
    L.state = 'idle';
    L.timer = 0.01;
    L.seq = 0; // SEQ[2][0] === 'beam'
    boss.levArms[0].dead = false;
    boss.levArms[1].dead = false;
    L.armHp[0] = Math.round(L.armMax * 0.4); // beschädigt
    L.armHp[1] = L.armMax;
    dng.update(0.05, input); // startet 'beam'
    for (let i = 0; i < 20; i++) dng.update(0.05, input); // ~1.0s → erster Laserstrahl aktiv!
    dng.camera.snap(boss.x, boss.y + 55);
    dng.render(ctx, input);
    const shotP2Beam = canvas.toDataURL('image/png');

    // Phase III Screenshot (linker Arm abgerissen → Stumpf-Sprite, rechter Arm kritisch < 25 %)
    boss.hp = Math.round(boss.maxHp * 0.22);
    L.phase = 3;
    L.state = 'idle';
    L.timer = 99;
    boss.levArms[0].dead = true;
    boss.levArms[1].dead = false;
    boss.levArms[1].state = 'idle';
    L.armHp[1] = Math.round(L.armMax * 0.18);
    dng.bossFx.clear();
    dng.camera.snap(boss.x, boss.y + 55);
    dng.render(ctx, input);
    const shotP3 = canvas.toDataURL('image/png');

    return {
      missing,
      chasmsAfterP2,
      fellOnce,
      inChasmAfterRespawn,
      fellAgain,
      shotP1,
      shotP2Beam,
      shotP3,
    };
  });

  fs.writeFileSync(path.join(__dirname, 'out', 'lev_rework_p1_idle.png'), Buffer.from(r.shotP1.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'out', 'lev_rework_p2_beam.png'), Buffer.from(r.shotP2Beam.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'out', 'lev_rework_p3_stump.png'), Buffer.from(r.shotP3.split(',')[1], 'base64'));

  assert.strictEqual(r.missing.length, 0, `Alle Leviathan-Rework-Sprites geladen (fehlend: ${r.missing.join(', ')})`);
  assert.ok(r.chasmsAfterP2 > 0, `Phase-2-Platten aufgebrochen (${r.chasmsAfterP2})`);
  assert.ok(r.fellOnce, 'Spieler im neuen Phase-2-Abgrund stürzt ab');
  assert.strictEqual(r.inChasmAfterRespawn, false, 'Respawn setzt Spieler NICHT wieder in den Abgrund');
  assert.strictEqual(r.fellAgain, false, 'Kein Endlos-Absturz-Loop nach Respawn');

  console.log('M12 LEVIATHAN REWORK OK');
};
