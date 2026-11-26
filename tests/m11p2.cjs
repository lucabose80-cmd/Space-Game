// M11 v2 — Pose-Sets: PartPose.variant tauscht das Bild, Import (limb/swap) liefert gleich große Posen mit Gelenk in der Bildmitte,
// Kern-Wächter/Krall wählen Posen nach Boss-Zustand.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const rig = await import('/src/engine/rig.ts');
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const rigs = await import('/src/data/rigs.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const out = {};
    const mk = (w, h, c) => { const e = document.createElement('canvas'); e.width = w; e.height = h; e.getContext('2d').fillStyle = c; e.getContext('2d').fillRect(0, 0, w, h); return e; };
    const imgs = { parts: { a: mk(10, 10, '#f00'), b: mk(30, 30, '#0f0') }, flash: {} };
    const def = { id: 't', parts: [{ id: 'p', image: 'a', variants: ['a', 'b'], pivot: [0.5, 0.5], z: 0 }] };
    out.v0 = rig.layoutRig(def, imgs, {})[0].w; out.v1 = rig.layoutRig(def, imgs, { p: { variant: 1 } })[0].w; out.vClamp = rig.layoutRig(def, imgs, { p: { variant: 9 } })[0].w;
    out.blend = [rig.blendPose({ p: { variant: 0 } }, { p: { variant: 3 } }, 0.2).p.variant, rig.blendPose({ p: { variant: 0 } }, { p: { variant: 3 } }, 0.8).p.variant];
    // Import: alle Varianten eines Sets gleich groß; Bilder geladen
    await new Promise((res) => setTimeout(res, 300));
    const art = getHDArt();
    const names = (id, prefix) => rigs.rigImageNames(id).filter((n) => n.startsWith(prefix));
    out.sets = {};
    const group = (id, ns) => { const sizes = ns.map((n) => (art.rigs[id]?.parts[n] ? art.rigs[id].parts[n].width + 'x' + art.rigs[id].parts[n].height : null)); return { n: sizes.length, same: new Set(sizes).size === 1 && sizes[0] !== null }; };
    const rng = (pre, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${pre}_${a + i}`);
    for (const [key, id, ns] of [['armR 1-6', 'core_warden', rng('armR', 1, 6)], ['armR 7-12', 'core_warden', rng('armR', 7, 12)], ['armL 1-6', 'core_warden', rng('armL', 1, 6)], ['armL 7-12', 'core_warden', rng('armL', 7, 12)], ['head 1-6', 'core_warden', rng('head', 1, 6)], ['head 7-12', 'core_warden', rng('head', 7, 12)], ['torso 1-6', 'core_warden', rng('torso', 1, 6)], ['torso 7-12', 'core_warden', rng('torso', 7, 12)], ['nofist', 'core_warden', ['armR_nf', 'armL_nf']], ['fists', 'core_warden', ['fist_front', 'fist_charged', 'fist_angled', 'fist_trail']], ['clawR', 'krall', rng('clawR', 1, 6)], ['clawL', 'krall', rng('clawL', 1, 6)], ['krall torso', 'krall', rng('torso', 1, 6)]]) out.sets[key] = group(id, ns);
    const e = (x) => Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss', bossPhase2: false, hp: 100, maxHp: 100 }, x);
    const cw = (x) => anim.getBossPose('core_warden', e(x), 1);
    out.idle = [cw({}).armL.variant, cw({}).torso.variant, cw({}).plateL.hidden];
    out.p2 = [cw({ bossPhase2: true }).torso.variant, cw({ bossPhase2: true }).head.variant];
    out.dash = [cw({ bossState: 'charge_dash' }).armR.variant, cw({ bossState: 'charge_dash' }).torso.variant];
    out.laser = cw({ bossState: 'laser_windup' }).armL.variant;
    out.stomp = cw({ bossState: 'slam_impact' }).armL.variant;
    out.plateP2 = cw({ bossPhase2: true }).plateL.hidden;
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
    // K1: weiche Übergänge — derselbe Boss wechselt Zustand: Drehung springt nicht, Bildwechsel bekommt Impuls, der abklingt
    const boss = e({ id: 9 });
    const g = (t) => anim.getBossPose('core_warden', boss, t);
    g(1); g(1.016);
    boss.bossState = 'charge_windup'; boss.bossStateMax = 0.64; boss.bossStateTimer = 0.64;
    const f1 = g(1.032);
    out.smooth = { variant: f1.armL.variant, later: null, impulse: f1.armL.sx > 1.02 && f1.armL.sy < 0.99, rotStep: Math.abs(f1.armL.rot - g(1.032).armL.rot) };
    let tt = 1.032; let late;
    for (let i = 0; i < 12; i++) { tt += 0.016; boss.bossStateTimer = Math.max(0, boss.bossStateTimer - 0.016); late = g(tt); }
    out.smooth.later = late.armL.variant;
    out.smooth.decayed = Math.abs(late.armL.sx - 1) < 0.02 && late.armL.rot > 0.02; // Impuls weg, Ausholen-Drehung läuft
    // größter Frame-zu-Frame-Sprung der Drehung über einen kompletten Zustandswechsel-Ablauf
    const b2 = e({ id: 10 }); let prev = anim.getBossPose('core_warden', b2, 5); let maxStep = 0; let t2 = 5;
    for (const st of ['charge_windup', 'charge_dash', 'slam_jump', 'slam_air', 'slam_impact', 'laser_windup', 'laser_sweep', 'pylon_barrage', 'stunned', 'stalk']) {
      b2.bossState = st; b2.bossStateMax = 0.5; b2.bossStateTimer = 0.5;
      for (let i = 0; i < 30; i++) { t2 += 0.016; b2.bossStateTimer = Math.max(0, 0.5 - i * 0.016); const cur = anim.getBossPose('core_warden', b2, t2); for (const id of ['armL', 'armR', 'head', 'torso']) maxStep = Math.max(maxStep, Math.abs((cur[id].rot ?? 0) - (prev[id].rot ?? 0))); prev = cur; }
    }
    out.maxRotStep = +maxStep.toFixed(3);
    // K2–K4: Anlauf/Nachfedern/Laufen/Treffer unterscheiden sich von der Ruhe-Pose (frische Bosse, ungeglättet)
    const fresh = (x) => anim.getBossPose('core_warden', e(x), 3);
    const idleP = fresh({});
    const sig = (p) => JSON.stringify([p.torso.dy, p.torso.sy, p.torso.sx, p.torso.dx, p.torso.rot, p.armL.rot, p.armR.rot, p.head.rot, p.head.variant]).replace(/\.\d{4,}/g, '');
    out.fxDiffer = {
      windup: sig(fresh({ bossState: 'charge_windup', bossStateMax: 0.64, bossStateTimer: 0.1 })) !== sig(idleP),
      jumpSquash: fresh({ bossState: 'slam_jump', bossStateMax: 0.4, bossStateTimer: 0.3 }).torso.sy < 0.98,
      jumpStretch: fresh({ bossState: 'slam_jump', bossStateMax: 0.4, bossStateTimer: 0.05 }).torso.variant === 8, // gestreckter Rumpf (S3)
      impact: fresh({ bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.4 }).torso.sy < 0.985,
      spring: fresh({ bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.3 }).armL.rot !== 0,
      stunKick: fresh({ bossState: 'stunned', bossStateMax: 0.6, bossStateTimer: 0.55, chargeDirX: 1 }).torso.dx < -0.5,
      walk: Math.abs(fresh({ vx: 60 }).armL.rot - idleP.armL.rot) > 0.001 && fresh({ vx: 60 }).torso.dy < 0 && fresh({ vx: 60 }).torso.rot > 0,
      hit: fresh({ flashTimer: 0.1 }).head.variant === 3 && fresh({ flashTimer: 0.1 }).torso.dx !== 0,
      hitNotInDash: fresh({ bossState: 'charge_dash', flashTimer: 0.1 }).head.variant === 2,
    };
    // S2–S5: neue Varianten je Zustand
    const idx = (x, look) => { const p = anim.getBossPose('core_warden', e(x), 3, look ?? 0); return { a: p.armL.variant, h: p.head.variant, t: p.torso.variant }; };
    out.s = {
      p2idle: idx({ bossPhase2: true }),
      p2pylon: idx({ bossPhase2: true, bossState: 'pylon_barrage' }),
      p1pylonHit: idx({ bossState: 'pylon_barrage', flashTimer: 0.1 }),
      laserW1: idx({ bossState: 'laser_windup', bossStateMax: 0.76, bossStateTimer: 0.7 }),
      laserW2: idx({ bossState: 'laser_windup', bossStateMax: 0.76, bossStateTimer: 0.1 }),
      sweep: idx({ bossState: 'laser_sweep' }),
      p2sweep: idx({ bossPhase2: true, bossState: 'laser_sweep' }),
      air: idx({ bossState: 'slam_air', bossStateMax: 0.5, bossStateTimer: 0.2 }),
      land: idx({ bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.4 }),
      lookL: idx({}, -80), lookR: idx({}, 80),
      wrecked: idx({ hp: 10 }),
      p2dead: idx({ bossPhase2: true, hp: 20 }),
      roarP2: idx({ bossPhase2: true, bossState: 'phase2_roar', bossStateMax: 1.1, bossStateTimer: 0.5 }),
    };
    // Blinzeln: deterministisch, kurz (≈ 0,12 s alle 4,3 s)
    let blinks = 0; for (let i = 0; i < 500; i++) if (anim.getBossPose('core_warden', e({ id: 1 }), i * 0.02).head.variant === 11) blinks++;
    out.blinks = blinks; // 10 s → ~2 Blinzler à ~6 Frames
    // Zwischen-Pose Schlag: ausholen → Schlag zur Kamera zeigt „kurz vor Treffer“ (7), danach 2; Rückkehr zeigt „zurückfedernd“ (8)
    const bb = e({ id: 11 }); const gg = (t) => anim.getBossPose('core_warden', bb, t).armR.variant;
    bb.bossState = 'charge_windup'; gg(10); gg(10.2); bb.bossState = 'charge_dash'; const v1 = gg(10.3); const v2 = gg(10.5); bb.bossState = 'stalk'; const v3 = gg(10.6); const v4 = gg(10.8);
    out.between = [v1, v2, v3, v4];
    // K6: Faust-Bild für kreisende Fäuste geladen
    out.fistLoaded = ['fist_front', 'fist_charged', 'fist_angled', 'fist_trail', 'armR_nf', 'armL_nf'].every((n) => !!art.rigs.core_warden?.parts[n]);
    // K5 verworfen: Platten bleiben im Laser unsichtbar
    out.laserPlates = fresh({ bossState: 'laser_sweep' }).plateL.hidden === true;
    return out;
  });
  assert.deepStrictEqual([r.v0, r.v1, r.vClamp], [10, 30, 30], 'variant tauscht das Bild: ' + JSON.stringify(r));
  assert.deepStrictEqual(r.blend, [0, 3], 'blendPose: variant');
  for (const [k, v] of Object.entries(r.sets)) assert.ok(v.n >= 2 && v.same, `Pose-Set ${k}: gleich große Bilder ` + JSON.stringify(v));
  assert.deepStrictEqual(r.idle, [0, 0, true]);
  assert.deepStrictEqual(r.p2, [4, 4]);
  assert.deepStrictEqual(r.dash, [2, 3]);
  assert.strictEqual(r.laser, 9); // Laser-Ladung (S2)
  assert.strictEqual(r.stomp, 5);
  assert.strictEqual(r.plateP2, true);
  assert.deepStrictEqual(r.krallPlate, [false, true], 'Krall-Rückenpanzer sichtbar, ab Phase 2 weg');
  assert.deepStrictEqual(r.krall, [0, 1, 2]);
  const K = r.kr; // [clawR, clawL, torso]: Arme 0 hängend · 1 ausholen · 2 Stoß · 3 seitlich · 4 Block · 5 Stampfer; Rumpf 0 normal · 1 geduckt · 2 aufgerichtet · 3 gebeugt · 4 Phase 2 · 5 beschädigt
  assert.deepStrictEqual(K.idle, [0, 0, 0]);
  assert.deepStrictEqual(K.stossW, [1, 1, 1], 'Stoß-Vorwarnung: beide Arme zurück, Rumpf geduckt');
  assert.deepStrictEqual(K.stoss, [2, 3, 3], 'Stoß: Zange zur Kamera, Haken seitlich, Rumpf gebeugt');
  assert.deepStrictEqual(K.stossEnd, [0, 0, 0], 'Stoß-Ende: zurück in Ruhe');
  assert.deepStrictEqual(K.magW, [1, 1, 2], 'Magnet-Vorwarnung: Rumpf aufgerichtet');
  assert.deepStrictEqual(K.magPull, [3, 3, 2], 'Magnet-Sog: Arme seitlich, Rumpf aufgerichtet');
  assert.deepStrictEqual(K.wurfW, [1, 1, 1]);
  assert.deepStrictEqual(K.wurf, [3, 0, 3], 'Wurf: rechter Arm seitlich');
  assert.deepStrictEqual(K.hagelW, [1, 1, 4], 'Hagel-Vorwarnung (Phase 2): Skelett-Rumpf, Arme hoch');
  assert.deepStrictEqual(K.hagel, [5, 5, 4], 'Hagel: Arme stampfen');
  assert.deepStrictEqual(K.p2, [0, 0, 4], 'Phase 2: Skelett-Rahmen');
  assert.deepStrictEqual(K.p2dmg, [0, 0, 5], 'Phase 2 < 25 % HP: beschädigter Rumpf');
  assert.ok(r.krFx.p2duck && r.krFx.hit, 'Krall: Phase-2-Haltung über Verschiebung, Treffer zittert: ' + JSON.stringify(r.krFx));
  assert.strictEqual(r.smooth.variant, 6, 'S2: erst Zwischen-Pose „halb ausgeholt“'); assert.strictEqual(r.smooth.later, 1, 'danach Ausholen-Pose'); assert.ok(r.smooth.impulse, 'Stauch-Impuls beim Bildwechsel'); assert.ok(r.smooth.decayed, 'Impuls klingt ab, Drehung läuft: ' + JSON.stringify(r.smooth));
  assert.ok(r.maxRotStep < 0.2, 'Drehung springt nie > 0,2 rad pro Frame: ' + r.maxRotStep);
  for (const [k, v] of Object.entries(r.fxDiffer)) assert.ok(v, 'Pose-Effekt ' + k + ': ' + JSON.stringify(r.fxDiffer));
  const S = r.s;
  assert.deepStrictEqual([S.p2idle.a, S.p2idle.t, S.p2idle.h], [12, 4, 4], 'P2 Ruhe: Arme ohne Faust (die Fäuste kreisen), Rumpf offen, Phase-2-Kopf');
  assert.deepStrictEqual([S.p2pylon.a, S.p2pylon.h], [12, 9], 'P2 Pylonen: Arme ohne Faust, brüllender P2-Kopf');
  assert.strictEqual(S.p1pylonHit.a, 10, 'Block-Treffer');
  assert.deepStrictEqual([S.laserW1.t, S.laserW2.t, S.laserW1.a], [7, 6, 9], 'Laser: Brust halb offen → offen, Arme laden');
  assert.deepStrictEqual([S.sweep.t, S.sweep.h, S.sweep.a, S.p2sweep.t], [6, 6, 3, 10], 'Laser-Strahl: Brust offen, Visier feuert, Phase 2 eigener Rumpf');
  assert.deepStrictEqual([S.air.t, S.land.t], [8, 9], 'Sprung gestreckt, Landung gestaucht');
  assert.deepStrictEqual([S.lookL.h, S.lookR.h], [7, 8], 'Blick links/rechts');
  assert.strictEqual(S.wrecked.h, 10, '< 15 % HP: stark beschädigter Kopf'); assert.strictEqual(S.p2dead.t, 11, 'Phase 2 < 25 % HP: beschädigter Rumpf'); assert.strictEqual(S.roarP2.h, 9);
  assert.ok(r.blinks >= 6 && r.blinks <= 20, 'Blinzeln: ' + r.blinks);
  assert.deepStrictEqual(r.between, [7, 2, 8, 0], 'Zwischen-Posen Schlag/Rückfeder: ' + JSON.stringify(r.between));
  assert.ok(r.fistLoaded, 'Faust-Bild geladen'); assert.ok(r.laserPlates, 'Platten im Laser unsichtbar');
  console.log('M11 PHASE2 OK');
};
