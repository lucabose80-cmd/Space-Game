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
    // Treffer-Zucken: Flanke von flashTimer dreht das Gehäuse kurz; Beschädigung (HP < 33 %) lässt es absacken
    const hit = e({ id: 8 }); const h0 = anim.getBossPose('turret', hit, 5, 50, 0).housing.rot;
    hit.flashTimer = 0.1; let hMax = 0; for (let i = 0; i < 6; i++) hMax = Math.max(hMax, Math.abs(anim.getBossPose('turret', hit, 5.02 + i * 0.016, 50, 0).housing.rot - h0));
    const sound = e({ id: 9 }), hurt = e({ id: 9, hp: 2 });
    let sagA = 0, sagB = 0; for (let i = 0; i < 40; i++) { sagA += anim.getBossPose('turret', sound, 9 + i * 0.05, 50, 0).housing.dy; sagB += anim.getBossPose('turret', hurt, 9 + i * 0.05, 50, 0).housing.dy; }
    return {
      flinch: hMax, sagDelta: (sagB - sagA) / 40,
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
  assert.ok(r.flinch > 0.03, 'Treffer: Gehäuse zuckt: ' + r.flinch);
  assert.ok(r.sagDelta > 0.5, 'Beschädigt: Gehäuse sackt ab: ' + r.sagDelta);
};
