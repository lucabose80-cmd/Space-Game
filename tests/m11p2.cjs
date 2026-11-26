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
    out.roar = cw({ bossPhase2: true, bossState: 'phase2_roar', bossStateTimer: 0.5, bossStateMax: 1.1 }).plateL;
    out.roarEnd = cw({ bossPhase2: true, bossState: 'phase2_roar', bossStateTimer: 0, bossStateMax: 1.1 }).plateL.hidden;
    out.krall = ['idle', 'windup', 'active'].map((s) => anim.getBossPose('krall', e({ kind: 'boss_breacher', bossSub: s, bossStatusText: 'GREIFARM-STOSS', bossStateTimer: 1 }), 1).claw.variant);
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
  assert.ok(r.roar.alpha > 0 && Math.abs(r.roar.dx) > 5 && !r.roar.hidden, 'Brustplatten fliegen während der Verwandlung');
  assert.strictEqual(r.roarEnd, true);
  assert.deepStrictEqual(r.krall, [0, 1, 2]);
  console.log('M11 PHASE2 OK');
};
