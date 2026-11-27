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
    return {
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
};
