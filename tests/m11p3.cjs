// M11 — abgelöste Teile (detached.ts: Phase-2-Verwandlung genau einmal, Bogenflug, Aufprall, Ausblenden).
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const det = await import('/src/dungeon/anim/detached.ts');
    const rigs = await import('/src/data/rigs.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const out = {};
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
  assert.deepStrictEqual([r.detached.n, r.detached.sides, r.detached.z0], [2, [-1, 1], true], JSON.stringify(r.detached));
  assert.ok(r.fly.rose && r.fly.notBelow, 'Bogenflug ' + JSON.stringify(r.fly));
  assert.strictEqual(r.gone, 0, 'Teile verschwinden nach ~1,7 s');
  assert.strictEqual(r.krall, 1, 'Krall löst den Panzer ab');
  console.log('M11 PHASE3 OK');
};
