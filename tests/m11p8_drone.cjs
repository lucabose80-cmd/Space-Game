// M11 — Drohnen-Rig (drone): Visier kneift in der Vorwarnung, Lade-Linse glüht, Flammen wachsen mit dem Tempo, Blick zum Spieler mit Totzone.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 3, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, subBurst: 0, burstDelay: 0, kind: 'drone', hp: 10, maxHp: 10 }, x);
    const p0 = anim.getBossPose('drone', e({}), 1, 50, 0);
    const p1 = anim.getBossPose('drone', e({ id: 4, telegraphTimer: 0.2 }), 1, 50, 0);
    const slow = anim.getBossPose('drone', e({ id: 5 }), 1, 50, 0);
    const fast = anim.getBossPose('drone', e({ id: 5, vx: 140 }), 1, 50, 0);
    const wreck = await import('/src/dungeon/anim/rigs/drone.ts');
    // G6 Treffer: Zucken, danach wieder ruhig
    const hitE = e({ id: 8 }); anim.getBossPose('drone', hitE, 2, 50, 0);
    hitE.flashTimer = 0.1; const hit = anim.getBossPose('drone', hitE, 2.02, 50, 0);
    hitE.flashTimer = 0; for (let t = 2.04; t < 2.5; t += 0.02) anim.getBossPose('drone', hitE, t, 50, 0);
    const calm = anim.getBossPose('drone', hitE, 2.52, 50, 0);
    // G4 Erholung: letzter Bolzen (subBurst 1 → 0) → Linse glimmt nach, Visier bleibt zugekniffen
    const recE = e({ id: 9, subBurst: 1 }); anim.getBossPose('drone', recE, 3, 50, 0);
    recE.subBurst = 0; anim.getBossPose('drone', recE, 3.02, 50, 0);
    let rec; for (let t = 3.04; t <= 3.2; t += 0.02) rec = anim.getBossPose('drone', recE, t, 50, 0);
    let rec2; for (let t = 3.22; t <= 3.8; t += 0.02) rec2 = anim.getBossPose('drone', recE, t, 50, 0);
    // G7 Tod
    const dw = wreck.droneDeathPose(0.25, 1);
    return {
      hitDx: hit.body.dx, calmDx: calm.body.dx, rec: [rec.visor.variant, rec.lens.hidden, rec2.visor.variant, rec2.lens.hidden],
      death: [dw.nacelleL.dx, dw.body.alpha, dw.lens.hidden, wreck.DRONE_DEATH_TIME],
      loaded: !!getHDArt().rigs.drone,
      visor: [p0.visor.variant, p1.visor.variant], lensHidden: [p0.lens.hidden, p1.lens.hidden],
      flame: [slow.flameL.sy, fast.flameL.sy],
      facing: (() => { const d = e({ id: 20 }); return [anim.getRigFacing('drone', d, 50), anim.getRigFacing('drone', d, 103), anim.getRigFacing('drone', d, 150)]; })(),
    };
  });
  assert.ok(r.loaded, 'Drohnen-Rig geladen');
  assert.deepStrictEqual(r.visor, [0, 1], 'Visier kneift in der Vorwarnung');
  assert.deepStrictEqual(r.lensHidden, [true, false], 'Lade-Linse nur in der Vorwarnung');
  assert.ok(r.flame[1] > r.flame[0], 'Flammen wachsen mit dem Tempo: ' + JSON.stringify(r.flame));
  assert.deepStrictEqual(r.facing, [-1, -1, 1], 'Blick zum Spieler mit Totzone');
  assert.ok(r.hitDx < -0.2 && Math.abs(r.calmDx) < 0.3, 'Treffer-Zucken, danach wieder ruhig: ' + JSON.stringify([r.hitDx, r.calmDx]));
  assert.deepStrictEqual(r.rec, [1, false, 0, true], 'Erholung: Visier zu + Linse glimmt, später wieder normal');
  assert.ok(r.death[0] < -5 && r.death[1] < 1 && r.death[1] > 0 && r.death[3] === 0.5, 'Tod: Gondel fliegt ab, Rumpf blendet aus: ' + JSON.stringify(r.death));
};
