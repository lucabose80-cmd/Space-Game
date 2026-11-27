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
};
