module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const gen = await import('/src/world/dungeonGen.ts');
    const mg = await import('/src/dungeon/mechanicsGen.ts');
    const rm = await import('/src/dungeon/roomMechanics.ts');
    const rng = await import('/src/systems/seededRng.ts');
    const out = { floors: 0, portals: 0, viol: [], chamberMissing: 0, notCenter: 0 };
    const PR = 14; // Portal-Radius (Optik ≈ 14 px)
    const rectHit = (x, y, r, z) => x + r > z.x && x - r < z.x + z.w && y + r > z.y && y - r < z.y + z.h;
    for (const sec of [1, 2, 3, 4]) for (const fl of [1, 2, 3]) for (let i = 0; i < 25; i++) {
      const floor = gen.generateSectorFloor(sec, fl); out.floors++;
      for (const room of floor.rooms.values()) {
        const p = room.riftPortal; if (!p) continue; out.portals++;
        const tag = `S${sec}F${fl} ${room.key}`;
        if (!floor.rooms.get(p.targetKey)) out.chamberMissing++;
        if (p.x !== gen.ROOM_CENTER_X || p.y !== gen.ROOM_CENTER_Y - 6) out.notCenter++;
        for (const o of room.obstacles) if (rectHit(p.x, p.y, PR, o)) out.viol.push(`${tag} obstacle`);
        for (const c of room.chasms) if (rectHit(p.x, p.y, PR, c)) out.viol.push(`${tag} chasm`);
        for (const pr of room.prisms ?? []) if (Math.hypot(p.x - pr.x, p.y - pr.y) < PR + pr.r) out.viol.push(`${tag} prism`);
        for (const t of room.teleporters ?? []) if (Math.hypot(p.x - t.x, p.y - t.y) < PR + rm.PAD_RADIUS) out.viol.push(`${tag} tele`);
        for (const m of room.magnetPlates ?? []) if (Math.hypot(p.x - m.x, p.y - m.y) < PR + 6) out.viol.push(`${tag} plate`);
        for (const j of room.flameJets ?? []) for (const s of mg.jetSamplePoints(j)) if (Math.hypot(p.x - s.x, p.y - s.y) < PR + 4) out.viol.push(`${tag} jet`);
      }
    }
    // Prüfungs-Fairness: gleiche Seeds → Räume OHNE Portal-Host identisch, egal ob Portal-Ausschluss an/aus
    let diffNonHost = 0; let diffHost = 0;
    for (let i = 0; i < 40; i++) {
      const seed = `cp2:${i}`; const sec = [2, 3, 4][i % 3];
      const a = rng.withSeededRandom(seed, () => gen.generateSectorFloor(sec, 2, undefined, { mechanics: true, portalExclusion: false }));
      const b = rng.withSeededRandom(seed, () => gen.generateSectorFloor(sec, 2, undefined, { mechanics: true, portalExclusion: true }));
      for (const [k, ra] of a.rooms) {
        const rb = b.rooms.get(k); const same = JSON.stringify([ra.obstacles, ra.prisms, ra.flameJets, ra.magnetPlates, ra.teleporters]) === JSON.stringify([rb.obstacles, rb.prisms, rb.flameJets, rb.magnetPlates, rb.teleporters]);
        if (!same) { if (ra.riftPortal) diffHost++; else diffNonHost++; }
      }
    }
    out.diffNonHost = diffNonHost; out.diffHost = diffHost;
    // Spirale: Mitte blockiert → freier Platz in der Nähe, Mitte frei → Mitte
    const room = { obstacles: [{ x: 220, y: 110, w: 40, h: 40, kind: 'crate' }], chasms: [], hazards: [], pods: [], chest: null, doors: { north: true, south: true, west: true, east: true } };
    const spot = mg.findFreeSpotSpiral(room, gen.ROOM_CENTER_X, gen.ROOM_CENTER_Y - 6, 16);
    out.spiral = spot && !rectHit(spot.x, spot.y, 16, room.obstacles[0]);
    out.spiralDet = JSON.stringify(spot) === JSON.stringify(mg.findFreeSpotSpiral(room, gen.ROOM_CENTER_X, gen.ROOM_CENTER_Y - 6, 16));
    out.spiralCenter = JSON.stringify(mg.findFreeSpotSpiral({ ...room, obstacles: [] }, gen.ROOM_CENTER_X, gen.ROOM_CENTER_Y - 6, 16));
    return out;
  });
  console.log(JSON.stringify({ ...r, viol: r.viol.slice(0, 5) }));
  const assert = require('node:assert');
  assert.ok(r.portals > 100, 'genug Portale: ' + r.portals);
  assert.deepStrictEqual(r.viol, [], 'Portal frei');
  assert.strictEqual(r.chamberMissing, 0);
  assert.strictEqual(r.diffNonHost, 0, 'Prüfungs-Räume ohne Portal bleiben identisch');
  assert.ok(r.spiral && r.spiralDet);
  assert.ok(r.spiralCenter.includes(String(240)));
  console.log('M10C PHASE2 OK');
};
