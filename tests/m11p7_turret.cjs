// M11 — Geschütz-Rig (turret): Pose je Zustand (Vorwarnung fährt das Rohr aus, Rückstoß, Ketten stehen im Stand).
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 3, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, kind: 'turret', hp: 10, maxHp: 10 }, x);
    const idle = e({});
    const p0 = anim.getBossPose('turret', idle, 1, 50, 0);
    const tele = e({ id: 4, telegraphTimer: 0.2 });
    const p1 = anim.getBossPose('turret', tele, 1, 50, 0);
    const moving = e({ id: 5, vx: 70 });
    let tv = new Set(); for (let i = 0; i < 80; i++) tv.add(anim.getBossPose('turret', moving, 2 + i * 0.016, 50, 0).treadL.variant);
    const still = e({ id: 6 }); let sv = new Set(); for (let i = 0; i < 80; i++) sv.add(anim.getBossPose('turret', still, 2 + i * 0.016, 50, 0).treadL.variant);
    return {
      loaded: !!getHDArt().rigs.turret,
      idleBarrel: p0.barrel.variant, teleBarrel: p1.barrel.variant, muzzleHidden: [p0.muzzle.hidden, p1.muzzle.hidden],
      facing: [anim.getRigFacing('turret', e({ x: 100 }), 50), anim.getRigFacing('turret', e({ x: 100 }), 150)],
      treadsMoving: tv.size > 1, treadsStill: sv.size === 1,
    };
  });
  assert.ok(r.loaded, 'Geschütz-Rig geladen (alle Teile + Ketten vorhanden)');
  assert.strictEqual(r.idleBarrel, 0, 'Ruhe: Rohr eingefahren'); assert.strictEqual(r.teleBarrel, 1, 'Vorwarnung: Rohr ausgefahren');
  assert.deepStrictEqual(r.muzzleHidden, [true, false], 'Mündungsring nur in der Vorwarnung');
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');
  assert.ok(r.treadsMoving && r.treadsStill, 'Ketten rollen beim Fahren und stehen im Stand: ' + JSON.stringify(r));
};
