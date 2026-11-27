// M11 — Phasen-Jäger-Rig (phase_stalker): Posen je Zustand (Gehen, Phasen-Vorwarnung, Sturz, Treffer, Tod), Arm-Pose-Set + Effekte, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const ps = await import('/src/dungeon/anim/rigs/phase_stalker.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 7, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, chargeActive: 0, kind: 'phase_stalker', hp: 10, maxHp: 10 }, x);
    const run = (en, n = 40, t0 = 1) => { let pz; for (let i = 0; i < n; i++) pz = anim.getBossPose('phase_stalker', en, t0 + i * 0.016, 50, 0); return pz; };
    const idle = run(e({}));
    const tele = run(e({ id: 8, telegraphTimer: 0.1 }));
    const charge = run(e({ id: 9, chargeActive: 0.2 }));
    const charge2 = run(e({ id: 12, chargeActive: 0.06 }));
    const walker = e({ id: 10, vx: 48 });
    const legs = new Set();
    for (let i = 0; i < 80; i++) legs.add(Math.round((anim.getBossPose('phase_stalker', walker, 2 + i * 0.016, 50, 0).legR.rot ?? 0) * 10));
    const still = e({ id: 11 });
    const sl = new Set();
    for (let i = 0; i < 80; i++) sl.add(Math.round((anim.getBossPose('phase_stalker', still, 2 + i * 0.016, 50, 0).legR.rot ?? 0) * 10));
    // Treffer-Zucken: kurz, danach wieder ruhig
    const hitE = e({ id: 13 });
    run(hitE, 5);
    hitE.flashTimer = 0.1;
    const hitPose = run(hitE, 3, 1.1);
    hitE.flashTimer = 0;
    const calmPose = run(hitE, 30, 1.2);
    // Tod
    const d0 = ps.stalkerDeathPose(0, 1), d1 = ps.stalkerDeathPose(0.3, 1), d2 = ps.stalkerDeathPose(0.6, 1);
    const rigs = getHDArt().rigs.phase_stalker;
    return {
      loaded: !!rigs, hasSet: !!(rigs && rigs.parts.armR_5 && rigs.parts.fxSlashL && rigs.parts.fxRift),
      armVars: [idle.armR.variant, tele.armR.variant, charge.armR.variant, charge2.armR.variant, hitPose.armR.variant],
      slash: [charge.slashL.hidden, charge2.slashS.hidden, idle.slashL.hidden],
      rift: [idle.rift.hidden, tele.rift.hidden], lean: [idle.torso.rot, charge.torso.rot],
      teleAlpha: tele.torso.alpha, idleAlpha: idle.torso.alpha,
      hitTorso: Math.abs(hitPose.torso.rot - calmPose.torso.rot), calmDx: Math.abs(calmPose.torso.dx),
      facing: [anim.getRigFacing('phase_stalker', e({ x: 100 }), 50), anim.getRigFacing('phase_stalker', e({ x: 100 }), 150)],
      legsWalk: legs.size, legsStill: sl.size,
      death: [d0.head.dy, d1.head.dy, d2.torso.alpha, d1.shards.hidden, d2.shards.hidden, d0.torso.alpha],
    };
  });
  assert.ok(r.loaded && r.hasSet, 'Phasen-Jäger-Rig geladen (Teile + Arm-Posen + Effekte)');
  assert.strictEqual(r.armVars[0], 0, 'Pirschen: Arm hängend'); assert.strictEqual(r.armVars[1], 1, 'Vorwarnung: Arm ausgeholt');
  assert.strictEqual(r.armVars[2], 2, 'Sturz: Schlag nach vorn'); assert.strictEqual(r.armVars[3], 3, 'Sturz spät: Schlag diagonal'); assert.strictEqual(r.armVars[4], 4, 'Treffer: Block-Pose');
  assert.deepStrictEqual(r.slash, [false, false, true], 'Schlagbogen nur im Sturz');
  assert.deepStrictEqual(r.rift, [true, false], 'Phasen-Riss nur gegen Ende der Vorwarnung');
  assert.ok(r.lean[1] > r.lean[0] + 0.2, 'Sturz: Rumpf vorgebeugt');
  assert.ok(r.teleAlpha < 1 && r.idleAlpha === 1, 'Vorwarnung: Körper flackert');
  assert.ok(r.hitTorso > 0.05 && r.calmDx < 0.3, 'Treffer-Zucken, danach wieder ruhig: ' + JSON.stringify(r));
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');
  assert.ok(r.legsWalk > 3 && r.legsStill === 1, 'Beine schreiten beim Gehen, stehen im Stand: ' + JSON.stringify(r));
  assert.ok(r.death[1] < r.death[0] && r.death[2] < 0.5 && r.death[5] === 1, 'Tod: Kopf fliegt ab, Rumpf blendet aus');
  assert.ok(r.death[3] === false && r.death[4] === true, 'Tod: Energiesplitter sichtbar, später weg');

  // Integration im echten Renderer: Rig ≠ Fallback (G2), Nachbild beim Phasen-Sprung, Tod (G7), Prüfbilder (G9)
  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(ctx.getImageData(380, 180, 260, 220).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => { const c = document.createElement('canvas'); c.width = 520; c.height = 440; const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(canvas, 380, 180, 260, 220, 0, 0, 520, 440); return c.toDataURL('image/png'); };
    const place = (id) => { dng.enemies.length = 0; dng.bossFx.clear(); dng.playerX = 120; dng.playerY = 190; dng.invulnTimer = 999; dng.spawnEnemy('phase_stalker', 250, 130); const en = dng.enemies[0]; en.hp = en.maxHp = 1e6; en.id = id; return en; };
    const art = getHDArt();
    const frame = (t) => { dng.time = t; dng.roomFade = 0; dng.render(ctx, input); };
    const en = place(5); frame(3); const withRig = hash(); const shotIdle = crop();
    const keep = art.rigs.phase_stalker; art.rigs.phase_stalker = null; frame(3.02); const without = hash(); art.rigs.phase_stalker = keep;
    en.telegraphTimer = 0.1; for (let i = 0; i < 20; i++) frame(4 + i * 0.016); const shotTele = crop();
    // Phasen-Sprung: Position wechselt, Nachbild bleibt am Absprungpunkt
    en.telegraphTimer = 0; en.chargeActive = 0.2; en.x = 300; en.y = 150; frame(4.4); const shotJump = crop(); const withGhost = hash();
    frame(4.9); const noGhost = hash();
    // Tod
    const en2 = place(6); frame(6); en2.hp = 0; dng.onEnemyKilled(en2); frame(6.016); frame(6.25); const shotDeath = crop(); const debris = hash(); frame(7.2); const gone = hash();
    return { withRig, without, withGhost, noGhost, debris, gone, shotIdle, shotTele, shotJump, shotDeath };
  });
  const fs = require('node:fs'), path = require('node:path');
  for (const k of ['shotIdle', 'shotTele', 'shotJump', 'shotDeath']) fs.writeFileSync(path.join(__dirname, 'out', `phase_stalker_${k}.png`), Buffer.from(g[k].split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig und Fallback-Sprite werden unterschiedlich gezeichnet (Rückfall läuft ohne Fehler)');
  assert.notStrictEqual(g.withGhost, g.noGhost, 'Phasen-Sprung: Nachbild am Absprungpunkt, später weg');
  assert.notStrictEqual(g.debris, g.gone, 'Tod: Teile fliegen ab und sind später weg');
};
