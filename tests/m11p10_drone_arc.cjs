// M11 — Bogen-Drohnen-Rig (drone_arc): Spulen neigen sich/Funken knistern in der Vorwarnung, Entladung mit Rückstoß, Treffer-Zucken, Wrack beim Tod, Blick mit Totzone.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const wreck = await import('/src/dungeon/anim/rigs/drone_arc.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 3, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, subBurst: 0, burstDelay: 0, kind: 'drone_arc', hp: 10, maxHp: 10 }, x);
    const idle = anim.getBossPose('drone_arc', e({}), 1, 50, 0);
    const tele = anim.getBossPose('drone_arc', e({ id: 4, telegraphTimer: 0.05 }), 1, 50, 0);
    // Entladung: Vorwarnung → Ende
    const d = e({ id: 6, telegraphTimer: 0.2 });
    anim.getBossPose('drone_arc', d, 1.0, 50, 0);
    d.telegraphTimer = 0;
    let fire = anim.getBossPose('drone_arc', d, 1.02, 50, 0);
    const fireDx = fire.body.dx;
    let later = anim.getBossPose('drone_arc', d, 1.08, 50, 0);
    for (let t = 1.1; t < 1.6; t += 0.05) later = anim.getBossPose('drone_arc', d, t, 50, 0);
    const hitE = e({ id: 7 });
    anim.getBossPose('drone_arc', hitE, 2, 50, 0);
    hitE.flashTimer = 0.1;
    const hit = anim.getBossPose('drone_arc', hitE, 2.02, 50, 0);
    const dw = wreck.arcDeathPose(0.25, 1);
    return {
      loaded: !!getHDArt().rigs.drone_arc,
      coil: [idle.coilL.rot, tele.coilL.rot],
      big: [idle.sparkL.hidden, tele.sparkL.hidden, fire.sparkL.hidden],
      fireDx, idleDx: idle.body.dx, laterHidden: later.sparkL.hidden,
      hitDx: hit.body.dx,
      death: [dw.coilL.dx, dw.body.alpha, dw.body.variant],
      visorV: [idle.visor.variant, tele.visor.variant, fire.visor.variant],
      facing: (() => { const f = e({ id: 20 }); return [anim.getRigFacing('drone_arc', f, 50), anim.getRigFacing('drone_arc', f, 103), anim.getRigFacing('drone_arc', f, 150)]; })(),
    };
  });
  assert.ok(r.loaded, 'Bogen-Drohnen-Rig geladen');
  assert.ok(r.coil[1] > r.coil[0] + 0.1, 'Spule neigt sich in der Vorwarnung nach innen: ' + JSON.stringify(r.coil));
  assert.strictEqual(r.big[0], true, 'Kein großer Bogen im Ruhezustand');
  assert.strictEqual(r.big[2], false, 'Großer Blitz bei der Entladung');
  assert.ok(r.fireDx < r.idleDx - 1, 'Rückstoß bei der Entladung: ' + r.fireDx);
  assert.strictEqual(r.laterHidden, true, 'Blitz klingt in der Erholung ab');
  assert.ok(r.hitDx < r.idleDx, 'Treffer-Zucken');
  assert.ok(r.death[0] < 0 && r.death[1] < 1, 'Wrack: Spule fliegt ab, Rumpf blendet aus');
  assert.deepStrictEqual(r.visorV, [0, 1, 2], 'Visier: offen / halb zu beim Aufladen / Funkenblitz bei Entladung');
  assert.strictEqual(r.death[2], 1, 'Wrack-Rumpf beim Tod');
  assert.deepStrictEqual(r.facing, [-1, -1, 1], 'Blick zum Spieler mit Totzone');
};
