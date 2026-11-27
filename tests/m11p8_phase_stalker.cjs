// M11 — Phasen-Jäger-Rig (phase_stalker): Posen je Zustand (Gehen, Phasen-Vorwarnung, Sturz-Angriff).
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 7, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, chargeActive: 0, kind: 'phase_stalker', hp: 10, maxHp: 10 }, x);
    const run = (en) => { let pz; for (let i = 0; i < 40; i++) pz = anim.getBossPose('phase_stalker', en, 1 + i * 0.016, 50, 0); return pz; };
    const idle = run(e({}));
    const tele = run(e({ id: 8, telegraphTimer: 0.2 }));
    const charge = run(e({ id: 9, chargeActive: 0.2 }));
    const walker = e({ id: 10, vx: 48 });
    let legs = new Set();
    for (let i = 0; i < 80; i++) legs.add(Math.round((anim.getBossPose('phase_stalker', walker, 2 + i * 0.016, 50, 0).legR.rot ?? 0) * 10));
    const still = e({ id: 11 });
    let sl = new Set();
    for (let i = 0; i < 80; i++) sl.add(Math.round((anim.getBossPose('phase_stalker', still, 2 + i * 0.016, 50, 0).legR.rot ?? 0) * 10));
    return {
      loaded: !!getHDArt().rigs.phase_stalker,
      idleArm: idle.armR.rot, teleArm: tele.armR.rot, chargeArm: charge.armR.rot,
      teleAlpha: tele.torso.alpha, idleAlpha: idle.torso.alpha,
      chargeLean: charge.torso.rot, idleLean: idle.torso.rot,
      facing: [anim.getRigFacing('phase_stalker', e({ x: 100 }), 50), anim.getRigFacing('phase_stalker', e({ x: 100 }), 150)],
      legsWalk: legs.size, legsStill: sl.size,
    };
  });
  assert.ok(r.loaded, 'Phasen-Jäger-Rig geladen (alle 6 Teile vorhanden)');
  assert.ok(r.teleArm > r.idleArm, 'Vorwarnung: Klinge nach hinten gezogen');
  assert.ok(r.chargeArm < r.idleArm, 'Sturz: Klinge schlägt nach vorn');
  assert.ok(r.chargeLean > r.idleLean + 0.2, 'Sturz: Rumpf vorgebeugt');
  assert.ok(r.teleAlpha < 1 && r.idleAlpha === 1, 'Vorwarnung: Körper flackert');
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');
  assert.ok(r.legsWalk > 3 && r.legsStill === 1, 'Beine schreiten beim Gehen, stehen im Stand: ' + JSON.stringify(r));
};
