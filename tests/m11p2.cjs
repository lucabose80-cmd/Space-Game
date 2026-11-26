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
    for (const [id, prefix] of [['core_warden', 'armR_'], ['core_warden', 'armL_'], ['core_warden', 'head_'], ['core_warden', 'torso_'], ['krall', 'clawR_']]) {
      const sizes = names(id, prefix).map((n) => art.rigs[id]?.parts[n] ? art.rigs[id].parts[n].width + 'x' + art.rigs[id].parts[n].height : null);
      out.sets[prefix] = { n: sizes.length, same: new Set(sizes).size === 1 && sizes[0] !== null };
    }
    const e = (x) => Object.assign({ id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss', bossPhase2: false }, x);
    const cw = (x) => anim.getBossPose('core_warden', e(x), 1);
    out.idle = [cw({}).armL.variant, cw({}).torso.variant, cw({}).plateL.hidden];
    out.p2 = [cw({ bossPhase2: true }).torso.variant, cw({ bossPhase2: true }).head.variant];
    out.dash = [cw({ bossState: 'charge_dash' }).armR.variant, cw({ bossState: 'charge_dash' }).torso.variant];
    out.laser = cw({ bossState: 'laser_windup' }).armL.variant;
    out.stomp = cw({ bossState: 'slam_impact' }).armL.variant;
    out.plateP2 = cw({ bossPhase2: true }).plateL.hidden;
    out.krallPlate = [anim.getBossPose('krall', e({ kind: 'boss_breacher' }), 1).plate.hidden === true, anim.getBossPose('krall', e({ kind: 'boss_breacher', bossPhase2: true }), 1).plate.hidden === true];
    out.krall = ['idle', 'windup', 'active'].map((s) => anim.getBossPose('krall', e({ kind: 'boss_breacher', bossSub: s, bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 1 }), 1).claw.variant);
    // K1: weiche Übergänge — derselbe Boss wechselt Zustand: Drehung springt nicht, Bildwechsel bekommt Impuls, der abklingt
    const boss = e({ id: 9 });
    const g = (t) => anim.getBossPose('core_warden', boss, t);
    g(1); g(1.016);
    boss.bossState = 'charge_windup'; boss.bossStateMax = 0.64; boss.bossStateTimer = 0.64;
    const f1 = g(1.032);
    out.smooth = { variant: f1.armL.variant, impulse: f1.armL.sx > 1.02 && f1.armL.sy < 0.99, rotStep: Math.abs(f1.armL.rot - g(1.032).armL.rot) };
    let tt = 1.032; let late;
    for (let i = 0; i < 12; i++) { tt += 0.016; boss.bossStateTimer = Math.max(0, boss.bossStateTimer - 0.016); late = g(tt); }
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
      jumpStretch: fresh({ bossState: 'slam_jump', bossStateMax: 0.4, bossStateTimer: 0.05 }).torso.sy > 1.02,
      impact: fresh({ bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.4 }).torso.sy < 0.92,
      spring: fresh({ bossState: 'slam_impact', bossStateMax: 0.42, bossStateTimer: 0.3 }).armL.rot !== 0,
      stunKick: fresh({ bossState: 'stunned', bossStateMax: 0.6, bossStateTimer: 0.55, chargeDirX: 1 }).torso.dx < -0.5,
      walk: Math.abs(fresh({ vx: 60 }).armL.rot - idleP.armL.rot) > 0.001 && fresh({ vx: 60 }).torso.dy < 0 && fresh({ vx: 60 }).torso.rot > 0,
      hit: fresh({ flashTimer: 0.1 }).head.variant === 3 && fresh({ flashTimer: 0.1 }).torso.dx !== 0,
      hitNotInDash: fresh({ bossState: 'charge_dash', flashTimer: 0.1 }).head.variant === 2,
    };
    // K6: Faust-Bild für kreisende Fäuste geladen
    out.fistLoaded = !!art.rigs.core_warden?.parts.fist;
    // K5 verworfen: Platten bleiben im Laser unsichtbar
    out.laserPlates = fresh({ bossState: 'laser_sweep' }).plateL.hidden === true;
    return out;
  });
  assert.deepStrictEqual([r.v0, r.v1, r.vClamp], [10, 30, 30], 'variant tauscht das Bild: ' + JSON.stringify(r));
  assert.deepStrictEqual(r.blend, [0, 3], 'blendPose: variant');
  for (const [k, v] of Object.entries(r.sets)) assert.ok(v.n === 6 && v.same, `Pose-Set ${k}: 6 gleich große Bilder ` + JSON.stringify(v));
  assert.deepStrictEqual(r.idle, [0, 0, true]);
  assert.deepStrictEqual(r.p2, [4, 4]);
  assert.deepStrictEqual(r.dash, [2, 3]);
  assert.strictEqual(r.laser, 3);
  assert.strictEqual(r.stomp, 5);
  assert.strictEqual(r.plateP2, true);
  assert.deepStrictEqual(r.krallPlate, [false, true], 'Krall-Rückenpanzer sichtbar, ab Phase 2 weg');
  assert.deepStrictEqual(r.krall, [0, 1, 2]);
  assert.strictEqual(r.smooth.variant, 1, 'Ausholen-Pose gewählt'); assert.ok(r.smooth.impulse, 'Stauch-Impuls beim Bildwechsel'); assert.ok(r.smooth.decayed, 'Impuls klingt ab, Drehung läuft: ' + JSON.stringify(r.smooth));
  assert.ok(r.maxRotStep < 0.2, 'Drehung springt nie > 0,2 rad pro Frame: ' + r.maxRotStep);
  for (const [k, v] of Object.entries(r.fxDiffer)) assert.ok(v, 'Pose-Effekt ' + k + ': ' + JSON.stringify(r.fxDiffer));
  assert.ok(r.fistLoaded, 'Faust-Bild geladen'); assert.ok(r.laserPlates, 'Platten im Laser unsichtbar');
  console.log('M11 PHASE2 OK');
};
