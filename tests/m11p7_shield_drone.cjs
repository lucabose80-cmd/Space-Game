// M11 — Schild-Drohne (shield_drone): Schildbogen folgt dem Zielwinkel, klappt im Angriff ein, überhitzt orange; Rig spiegelt mit dem Zielwinkel.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    for (let i = 0; i < 100 && !getHDArt().rigs.shield_drone; i++) await new Promise((res) => setTimeout(res, 100));
    const mk = (x) => Object.assign({ id: 7, x: 100, y: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, kind: 'shield_drone', hp: 10, maxHp: 10, radius: 10, aimAngle: 0 }, x);
    const run = (e, sec) => { let p; for (let t = 0; t <= sec; t += 1 / 60) p = anim.getBossPose('shield_drone', e, 1 + t, 50, 0); return p; };
    const idle = run(mk({}), 1);
    const down = run(mk({ id: 8, telegraphTimer: 0.3, shieldDownTimer: 1 }), 0.9); // Angriff: Schild offen
    const hotE = mk({ id: 9, shieldHeat: 3.5 });
    const hot = run(hotE, 0.5);
    const over = run(mk({ id: 10, shieldDownTimer: 2.4 }), 0.8);
    const eL = mk({ id: 11, aimAngle: Math.PI });
    return {
      loaded: !!getHDArt().rigs.shield_drone,
      idle: idle.arc, down: down.arc, hotVariant: hot.arc.variant, overVariant: over.arc.variant, overHidden: over.arc.hidden,
      facing: [anim.getRigFacing('shield_drone', mk({ id: 12 }), 0), anim.getRigFacing('shield_drone', eL, 0)],
      rotDiff: run(mk({ id: 13, aimAngle: 1.0 }), 0.6).arc.rot - run(mk({ id: 14, aimAngle: 0 }), 0.6).arc.rot,
    };
  });
  assert.ok(r.loaded, 'Schild-Drohnen-Rig geladen (alle Teile vorhanden)');
  assert.ok(!r.idle.hidden && r.idle.variant === 0 && r.idle.alpha > 0.9, 'Ruhe: cyan Bogen voll sichtbar');
  assert.ok(r.down.hidden || r.down.alpha < 0.3, 'Angriff: Schildbogen klappt ein (Konter-Fenster)');
  assert.strictEqual(r.hotVariant, 1, 'Hitze ≥ 70 %: orangener Bogen');
  assert.strictEqual(r.overVariant, 1, 'Überhitzt: orangener, rissiger Bogen');
  assert.ok(!r.overHidden, 'Überhitzt: Bogen bleibt als flackernde Ruine sichtbar');
  assert.deepStrictEqual(r.facing, [1, -1], 'Rig blickt in Zielrichtung (gespiegelt bei Ziel links)');
  assert.ok(Math.abs(r.rotDiff - 1.0) < 0.05, 'Bogen dreht mit dem Zielwinkel: ' + r.rotDiff);
};
