// M11 — Krall: Pose je Zug/Abschnitt (Arme, Rumpf), Phase 2, Rückenpanzer. Eigener Test, damit Krall-Arbeit nicht mit dem Kern-Wächter-Test (m11p2) kollidiert.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    await new Promise((res) => setTimeout(res, 300));
    const out = {};
    const e = (x) => Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss', bossPhase2: false, hp: 100, maxHp: 100 }, x);
    out.krallPlate = [anim.getBossPose('krall', e({ kind: 'boss_breacher' }), 1).plate.hidden === true, anim.getBossPose('krall', e({ kind: 'boss_breacher', bossPhase2: true }), 1).plate.hidden === true];
    out.krall = ['idle', 'windup', 'active'].map((s) => anim.getBossPose("krall", e({ kind: "boss_breacher", bossSub: s, bossStatusText: "GREIFARM-STOSS", bossStateTimer: 1 }), 1).clawR.variant);
    // Krall: Zug → Arme/Rumpf (clawR/clawL/torso), Phase 2, beschädigt, Gehen
    const kr = (x) => { const p = anim.getBossPose('krall', e(Object.assign({ kind: 'boss_breacher' }, x)), 1); return [p.clawR.variant, p.clawL.variant, p.torso.variant]; };
    out.kr = {
      idle: kr({}),
      stossW: kr({ bossSub: 'windup', bossStatusText: 'GREIFARM-STOSS', bossStateMax: 0.65, bossStateTimer: 0.3 }),
      stoss: kr({ bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.8 }),
      stossEnd: kr({ bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.2 }),
      magW: kr({ bossSub: 'windup', bossStatusText: 'MAGNET-ZUG', bossStateMax: 0.6, bossStateTimer: 0.3 }),
      magPull: kr({ bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8 }),
      wurfW: kr({ bossSub: 'windup', bossStatusText: 'SCHROTT-WURF', bossStateMax: 0.5, bossStateTimer: 0.2 }),
      wurf: kr({ bossSub: 'recover', bossStatusText: 'SCHROTT-WURF', bossStateTimer: 0.8 }),
      hagelW: kr({ bossSub: 'windup', bossStatusText: 'SCHROTT-HAGEL', bossStateMax: 0.5, bossStateTimer: 0.2, bossPhase2: true }),
      hagel: kr({ bossSub: 'recover', bossStatusText: 'SCHROTT-HAGEL', bossStateTimer: 1, bossPhase2: true }),
      p2: kr({ bossPhase2: true, hp: 40 }),
      p2dmg: kr({ bossPhase2: true, hp: 20 }),
    };
    const krT = (x) => anim.getBossPose('krall', e(Object.assign({ kind: 'boss_breacher' }, x)), 1).torso;
    out.krFx = { p2duck: krT({ bossPhase2: true, hp: 40, bossSub: 'windup', bossStatusText: 'GREIFARM-STOSS', bossStateMax: 0.65, bossStateTimer: 0.1 }).dy > 0.5, hit: Math.abs(krT({ flashTimer: 0.1 }).dx) > 0.1 };
    return out;
  });
  assert.deepStrictEqual(r.krallPlate, [false, true], 'Krall-Rückenpanzer sichtbar, ab Phase 2 weg');
  assert.deepStrictEqual(r.krall, [0, 1, 6]);
  const K = r.kr; // [clawR, clawL, torso]: Arme 0 hängend · 1 ausholen · 2 Stoß · 3 seitlich · 4 Block · 5 Stampfer; Rumpf 0 normal · 1 geduckt · 2 aufgerichtet · 3 gebeugt · 4 Phase 2 · 5 beschädigt
  assert.deepStrictEqual(K.idle, [0, 0, 0]);
  assert.deepStrictEqual(K.stossW, [1, 1, 1], 'Stoß-Vorwarnung: beide Arme zurück, Rumpf geduckt');
  assert.deepStrictEqual(K.stoss, [6, 3, 3], 'Stoß (Teleskop kurz zur Stoßseite), Haken seitlich, Rumpf gebeugt');
  assert.deepStrictEqual(K.stossEnd, [0, 0, 0], 'Stoß-Ende: zurück in Ruhe');
  assert.deepStrictEqual(K.magW, [1, 1, 2], 'Magnet-Vorwarnung: Rumpf aufgerichtet');
  assert.deepStrictEqual(K.magPull, [10, 10, 2], 'Magnet-Sog: Arme seitlich, Rumpf aufgerichtet');
  assert.deepStrictEqual(K.wurfW, [11, 1, 1]);
  assert.deepStrictEqual(K.wurf, [3, 0, 3], 'Wurf: rechter Arm seitlich');
  assert.deepStrictEqual(K.hagelW, [11, 11, 7], 'Hagel-Vorwarnung (Phase 2): Rahmen aufgerichtet (torsos2), Arme hoch');
  assert.deepStrictEqual(K.hagel, [5, 5, 9], 'Hagel: Arme stampfen, Rahmen gestaucht (torsos2)');
  assert.deepStrictEqual(K.p2, [12, 12, 6], 'Phase 2 (40 % HP): Skelett-Rahmen, Arme verbogen');
  assert.deepStrictEqual(K.p2dmg, [15, 12, 16], 'Phase 2 < 25 % HP: schwer beschädigter Rumpf (torsos3), Zange abgebrochen, Haken verbogen');
  // Beschädigungsstufen (D-Standard: ≥ 4 Stufen + kritisch < 15 %) und Beinposen (krall_legs_R2/L2)
  const dm = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const e = (x) => Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss_breacher', bossPhase2: false, hp: 100, maxHp: 100 }, x);
    const P = (x) => anim.getBossPose('krall', e(x), 1);
    return {
      p1: [100, 79, 64, 20].map((hp) => P({ hp }).torso.variant),
      p2: [45, 34, 24, 14].map((hp) => P({ hp, bossPhase2: true }).torso.variant),
      armsR: [100, 60, 30].map((hp) => P({ hp }).clawR.variant),
      legBrace: P({ bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8 }).legFL.variant,
      legLunge: P({ bossSub: 'recover', bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 0.8, chargeDirX: 1, chargeDirY: 0 }).legFL.variant,
      armLSog: P({ hp: 40, bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8 }).clawL.variant,
      armsOther: [50, 30, 15].map((hp) => { const q = (x) => P(Object.assign({ hp, bossSub: 'recover', bossStatusText: 'MAGNET-ZUG', bossStateTimer: 0.8 }, x)); return [q({}).clawR.variant, q({}).clawL.variant]; }),
      legTremble: P({ bossPhase2: true }).legFL.variant,
    };
  });
  assert.deepStrictEqual(dm.p1, [0, 12, 13, 14], 'Phase 1: normal · leicht < 80 · mittel < 65 · schwer < 25');
  assert.deepStrictEqual(dm.p2, [6, 15, 16, 17], 'Phase 2: Rahmen · leicht < 35 · schwer < 25 · kritisch < 15');
  assert.deepStrictEqual(dm.armsR, [0, 12, 15], 'Zange: intakt · verbogen < 65 % · Stumpf < 35 %');
  assert.strictEqual(dm.armLSog, 21, 'Haken verbogen (< 50 %) im Sog: krall_arms_L4');
  assert.deepStrictEqual(dm.armsOther, [[21, 10], [27, 21], [27, 27]], 'Sog (50/30/15 % HP): Zange verbogen (R4) → Stumpf (R5) < 35 %, Haken verbogen (L4) → Stumpf (L5) < 20 %');
  assert.deepStrictEqual([dm.legBrace, dm.legLunge, dm.legTremble], [10, 6, 11], 'Beine: Magnet-Stemmen · Ausfall · Ruhe-Zittern (Phase 2)');
  assert.ok(r.krFx.p2duck && r.krFx.hit, 'Krall: Phase-2-Haltung über Verschiebung, Treffer zittert: ' + JSON.stringify(r.krFx));
};
