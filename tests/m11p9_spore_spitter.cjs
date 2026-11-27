// M11 — Sporenspucker-Rig (spore_spitter): Atmen, Vorwarnung (Aufblähen, Kapseln nacheinander), Ausstoß mit Rückstoß, Eingraben, Treffer-Zucken, Tod, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const rigs = await import('/src/data/rigs.ts');
    const sp = await import('/src/dungeon/anim/rigs/spore_spitter.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 3, x: 100, y: 80, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, scurryTimer: 0, kind: 'spore_spitter', hp: 10, maxHp: 10 }, x);
    const P = (en, t, dx = 50, dy = 0) => anim.getBossPose('spore_spitter', en, t, dx, dy);
    // Atmen im Stand: Körper-Skalierung schwankt über die Zeit
    const idle = e({}); let sMin = 9, sMax = 0; for (let i = 0; i < 200; i++) { const b = P(idle, 1 + i * 0.016).body; sMin = Math.min(sMin, b.sy); sMax = Math.max(sMax, b.sy); }
    // Vorwarnung: Aufblähen wächst, Kapseln öffnen nacheinander, Spore erscheint
    const t0 = e({ id: 4, telegraphTimer: 0.5 }); const early = P(t0, 1);
    const tele = (id, rest) => P(e({ id, telegraphTimer: rest }), 2);
    const mid = tele(5, 0.3), late = tele(6, 0.03);
    // Ausstoß: Vorwarnung endet → Rückstoß (Körper gestaucht, nach hinten), danach Erholung
    const sh = e({ id: 7, telegraphTimer: 0.2 }); let t = 3; P(sh, t); sh.telegraphTimer = 0; t += 0.03; const kick = P(sh, t); let tail; for (let i = 0; i < 30; i++) { t += 0.02; tail = P(sh, t); }
    // Eingraben beim Umsetzen: weicher Übergang (variant erst nach einigen Bildern), danach wieder auftauchen
    const sc = e({ id: 8, scurryTimer: 0.7 }); t = 5; const vs = []; for (let i = 0; i < 20; i++) { t += 0.016; vs.push(P(sc, t).body.variant); }
    sc.scurryTimer = 0; for (let i = 0; i < 30; i++) { t += 0.016; vs.push(P(sc, t).body.variant); }
    // Treffer-Zucken: Flanke von flashTimer, klingt in ≤ 0,15 s ab und stört die Vorwarnung nicht (Kapseln bleiben offen)
    const hit = e({ id: 9 }); const h0 = P(hit, 8).body.sy; hit.flashTimer = 0.1; const h1 = P(hit, 8.016).body.sy; for (let i = 0; i < 12; i++) P(hit, 8.03 + i * 0.016); const h2 = P(hit, 8.4).body.sy;
    const ht = e({ id: 10, telegraphTimer: 0.1 }); P(ht, 8); ht.flashTimer = 0.1; const hp = P(ht, 8.016);
    // Tod: Ghost entsteht nur bei hp ≤ 0, Pose löst die Teile vom Körper
    sp.clearSpitterGhosts();
    const dead = e({ id: 11, hp: 0 }), gone = e({ id: 12, hp: 5 });
    sp.updateSpitterGhosts([dead, gone], 10, 50); const g = sp.updateSpitterGhosts([], 10.016, 50);
    const d0 = sp.spitterDeathPose(g[0], 0.02), d1 = sp.spitterDeathPose(g[0], 0.3);
    const after = sp.updateSpitterGhosts([], 11, 50).length;
    return {
      loaded: !!getHDArt().rigs.spore_spitter, kind: rigs.RIG_BY_KIND.spore_spitter, sMin, sMax,
      eyeVariants: [early.podL.variant, mid.podL.variant, mid.podR.variant, late.podR.variant],
      swell: [early.body.sy, mid.body.sy, late.body.sy], sporeHidden: [early.spore.hidden, late.spore.hidden],
      kick: [kick.body.sy, kick.body.dx, kick.spore.hidden, tail.body.sy, tail.spore.hidden],
      burrow: vs, hit: [h0, h1, h2], hitTele: hp.podL.variant,
      ghosts: g.length, ghostId: g.length && Math.round(g[0].x), after, death: [d0.podL.dx, d1.podL.dx, d1.eye.dy, d1.body.sy],
      facing: [anim.getRigFacing('spore_spitter', e({ id: 20 }), 50), anim.getRigFacing('spore_spitter', e({ id: 21 }), 150)],
    };
  });
  const j = JSON.stringify(r);
  assert.ok(r.loaded, 'Sporenspucker-Rig geladen (Fallback sonst: altes Sprite)');
  assert.strictEqual(r.kind, 'spore_spitter');
  assert.ok(r.sMax - r.sMin > 0.03, 'Atmen im Stand: ' + j);
  assert.deepStrictEqual(r.eyeVariants, [0, 1, 0, 1], 'Kapseln öffnen nacheinander (links vor rechts): ' + j);
  assert.ok(r.swell[2] > r.swell[1] && r.swell[1] > r.swell[0] - 0.001, 'Aufblähen wächst: ' + j);
  assert.deepStrictEqual(r.sporeHidden, [true, false], 'Spore erst gegen Ende der Vorwarnung');
  assert.ok(r.kick[0] < 0.97 && r.kick[1] < -0.5 && r.kick[2] === false, 'Ausstoß: Körper gestaucht + Rückstoß + Spore fliegt: ' + j);
  assert.ok(r.kick[3] > r.kick[0] && r.kick[4] === true, 'Erholung: Körper federt zurück, Spore weg: ' + j);
  assert.ok(r.burrow[0] === 0 && r.burrow.includes(1), 'Eingraben nicht schlagartig, aber vorhanden: ' + j);
  assert.strictEqual(r.burrow[r.burrow.length - 1], 0, 'Auftauchen nach dem Umsetzen');
  assert.ok(r.hit[1] < r.hit[0] - 0.02 && Math.abs(r.hit[2] - r.hit[0]) < 0.07, 'Treffer: kurzes Zucken, danach wieder normal: ' + j);
  assert.strictEqual(r.hitTele, 1, 'Treffer stört die Angriffspose nicht (Kapsel bleibt offen)');
  assert.strictEqual(r.ghosts, 1, 'nur der getötete Spucker (hp ≤ 0) hinterlässt eine Todes-Animation: ' + j);
  assert.strictEqual(r.after, 0, 'Todes-Animation endet');
  assert.ok(Math.abs(r.death[1]) > Math.abs(r.death[0]) && r.death[3] < 0.6, 'Tod: Kapseln fliegen weg, Körper sackt zusammen: ' + j);
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');
};
