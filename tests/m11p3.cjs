// M11 Phase 2 — Beine (legs.ts: Füße ortsfest in der Stützphase, Tempo → Schritte, Beingruppen wechseln sich ab)
// und abgelöste Teile (detached.ts: Phase-2-Verwandlung genau einmal, Bogenflug, Aufprall, Ausblenden).
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const legs = await import('/src/dungeon/anim/legs.ts');
    const det = await import('/src/dungeon/anim/detached.ts');
    const rigs = await import('/src/data/rigs.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const out = {};
    const mk = (kind) => ({ id: 3, kind, x: 100, y: 100, vx: 0, vy: 0, telegraphTimer: 0, flashTimer: 0 });
    // Welche Kinds haben Beine
    out.has = ['turret', 'magma_mortar', 'shard_sniper', 'slime', 'boss'].map((k) => legs.hasLegs(mk(k)));
    // Stillstand: Füße bewegen sich nie
    let e = mk('turret'); let t = 0; legs.updateLegs(e, t);
    let moved = 0; let f0 = legs.updateLegs(e, 0.01).map((f) => [f.x, f.y]);
    for (let i = 0; i < 60; i++) { t += 0.016; const f = legs.updateLegs(e, t); f.forEach((ft, k) => { moved += Math.abs(ft.x - f0[k][0]) + Math.abs(ft.y - f0[k][1]); }); }
    out.idleMoved = moved;
    // Gehen: Körper läuft 40 px/s nach rechts → Füße schreiten, in der Stützphase ortsfest, Gruppen nie komplett gleichzeitig
    e = mk('magma_mortar'); t = 0; legs.updateLegs(e, t);
    let dbg = null; let steps = 0; let planted = 0; let drift = 0; let allSteppingMax = 0; let maxLag = 0; let prev = legs.updateLegs(e, 0.001).map((f) => ({ x: f.x, y: f.y, s: f.stepping }));
    for (let i = 0; i < 180; i++) {
      t += 0.016; e.vx = 40; e.x += 40 * 0.016;
      const f = legs.updateLegs(e, t);
      let n = 0;
      f.forEach((ft, k) => { if (ft.stepping) n++; if (!prev[k].s && !ft.stepping) { planted++; drift = Math.max(drift, Math.hypot(ft.x - prev[k].x, ft.y - prev[k].y)); } if (!prev[k].s && ft.stepping) steps++; maxLag = Math.max(maxLag, Math.abs(ft.x - e.x)); });
      allSteppingMax = Math.max(allSteppingMax, n); if (n >= 5 && !dbg) dbg = { i, n, f: f.map((q) => [Math.round(q.x - e.x), q.stepping]) };
      prev = f.map((ft) => ({ x: ft.x, y: ft.y, s: ft.stepping }));
    }
    out.dbg = dbg; out.walk = { steps, planted: planted > 100, drift, allSteppingMax, lagOk: maxLag < 40, legCount: prev.length };
    // schneller → mehr Schritte
    const count = (vx) => { const q = mk('turret'); let tt = 0; legs.updateLegs(q, tt); let s = 0; let pv = legs.updateLegs(q, 0.001).map((f) => f.stepping); for (let i = 0; i < 120; i++) { tt += 0.016; q.vx = vx; q.x += vx * 0.016; const f = legs.updateLegs(q, tt); f.forEach((ft, k) => { if (!pv[k] && ft.stepping) s++; }); pv = f.map((ft) => ft.stepping); } return s; };
    out.faster = [count(30), count(90)];
    // Knie-IK: Länge Hüfte–Knie–Fuß bleibt erhalten
    const [kx, ky] = legs.kneePos(0, 0, 10, 8, 7, 8, 1); out.knee = [+Math.hypot(kx, ky).toFixed(2), +Math.hypot(10 - kx, 8 - ky).toFixed(2), ky < 4];

    // Abgelöste Teile
    await new Promise((res) => setTimeout(res, 300));
    const art = getHDArt(); const list = [];
    const pose = anim.getBossPose('core_warden', { id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss', bossPhase2: false }, 0);
    const n = det.spawnPhase2Parts(list, rigs.RIGS.core_warden, art.rigs.core_warden, pose, 0, 7, 200, 100);
    out.detached = { n, sides: list.map((d) => Math.sign(d.vx)), z0: list.every((d) => d.z > 0) };
    let maxZ = 0; let minZ = 9;
    for (let i = 0; i < 40; i++) { det.updateDetached(list, 0.016); list.forEach((d) => { maxZ = Math.max(maxZ, d.z); minZ = Math.min(minZ, d.z); }); }
    out.fly = { rose: maxZ > 5, notBelow: minZ >= 0 };
    for (let i = 0; i < 200; i++) det.updateDetached(list, 0.016);
    out.gone = list.length;
    const kl = []; out.krall = det.spawnPhase2Parts(kl, rigs.RIGS.krall, art.rigs.krall, anim.getBossPose('krall', { id: 1, vx: 0, vy: 0, flashTimer: 0, kind: 'boss_breacher' }, 0), 0, 7, 100, 100);
    return out;
  });
  assert.deepStrictEqual(r.has, [true, true, true, false, false], 'Beine nur für Geschütz/Mörser/Scharfschütze: ' + JSON.stringify(r));
  assert.strictEqual(r.idleMoved, 0, 'Stillstand: Füße ortsfest');
  assert.ok(r.walk.steps >= 6 && r.walk.planted && r.walk.drift === 0 && r.walk.allSteppingMax < r.walk.legCount && r.walk.lagOk, 'Gehen: ' + JSON.stringify(r.walk) + JSON.stringify(r.dbg));
  assert.ok(r.faster[1] > r.faster[0] && r.faster[0] > 0, 'schneller → mehr Schritte ' + JSON.stringify(r.faster));
  assert.deepStrictEqual([r.knee[0], r.knee[2]], [7, true], 'IK Oberschenkel 7, Knie oben: ' + JSON.stringify(r.knee));
  assert.ok(Math.abs(r.knee[1] - 8) < 0.02, 'IK Unterschenkel 8');
  assert.deepStrictEqual([r.detached.n, r.detached.sides, r.detached.z0], [2, [-1, 1], true], JSON.stringify(r.detached));
  assert.ok(r.fly.rose && r.fly.notBelow, 'Bogenflug ' + JSON.stringify(r.fly));
  assert.strictEqual(r.gone, 0, 'Teile verschwinden nach ~1,7 s');
  assert.strictEqual(r.krall, 1, 'Krall löst den Panzer ab');
  console.log('M11 PHASE3 OK');
};
