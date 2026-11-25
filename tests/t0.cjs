module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const rng = await import('/src/systems/seededRng.ts');
    const gen = await import('/src/world/dungeonGen.ts');
    const out = {};
    out.w1 = rng.getIsoWeekId(new Date('2026-01-01T12:00:00Z'));
    out.w2 = rng.getIsoWeekId(new Date('2027-01-01T12:00:00Z'));
    out.w3 = rng.getIsoWeekId(new Date('2026-11-25T12:00:00Z'));
    out.wend = new Date(rng.getWeekEndUtc(new Date('2026-11-25T12:00:00Z'))).toISOString();
    const orig = Math.random;
    const sig = (f) => JSON.stringify([...f.rooms.entries()].map(([k, r]) => [k, r.type, (r.enemies||r.spawns||[]).length]));
    const a = rng.withSeededRandom('x', () => gen.generateSectorFloor(2, 1));
    const b = rng.withSeededRandom('x', () => gen.generateSectorFloor(2, 1));
    const c = gen.generateSectorFloor(2, 1), d = gen.generateSectorFloor(2, 1);
    out.same = sig(a) === sig(b);
    out.rawSame = JSON.stringify(a.rooms.get(a.startKey)) === JSON.stringify(b.rooms.get(b.startKey));
    out.randDiffer = sig(c) !== sig(d) || JSON.stringify([...c.rooms.keys()]) !== JSON.stringify([...d.rooms.keys()]);
    out.restored = Math.random === orig;
    try { rng.withSeededRandom('y', () => { throw new Error('boom'); }); } catch {}
    out.restoredAfterThrow = Math.random === orig;
    // save roundtrip
    const { GameState } = await import('/src/systems/gameState.ts');
    const gs = new GameState();
    gs.weeklyTrial = { weekId: '2026-W48', sector: 2, attempts: 3, completed: true, bestTimeSec: 400, bestFloorReached: 3, bestRoomsCleared: 12, bestScore: 400, badge: 'gold', uploaded: false };
    gs.trialBadgeHistory = { '2026-W48': 'gold' };
    gs.ghostGreeting = 'Hallo <b>Welt</b>';
    const json = gs.exportSaveJson();
    const gs2 = new GameState();
    out.imp = gs2.importSaveJson(json).ok;
    out.rt = JSON.stringify(gs2.weeklyTrial) === JSON.stringify(gs.weeklyTrial) && gs2.trialBadgeHistory['2026-W48'] === 'gold';
    out.greet = gs2.ghostGreeting;
    // v9 save without new fields
    const v9 = JSON.parse(json); delete v9.weeklyTrial; delete v9.trialBadgeHistory; delete v9.ghostGreeting; v9.version = 9;
    const gs3 = new GameState();
    out.v9 = gs3.importSaveJson(JSON.stringify(v9)).ok && gs3.weeklyTrial === null && gs3.ghostGreeting === '';
    out.ver = JSON.parse(gs3.exportSaveJson()).version;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.w1 === '2026-W01' && r.w2 === '2026-W53' && r.w3 === '2026-W48' && r.same && r.randDiffer && r.restored && r.restoredAfterThrow && r.imp && r.rt && r.v9 && r.ver === 11;
  if (!ok) throw new Error('assert failed');
  console.log('PHASE0 OK');
};
