module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const gen = await import('/src/world/dungeonGen.ts');
    const mg = await import('/src/dungeon/mechanicsGen.ts');
    const rng = await import('/src/systems/seededRng.ts');
    const out = {};
    const orig = Math.random;
    const N = 200;
    const stats = {}; const viol = []; let teleportOdd = 0, padDistBad = 0, ineligibleHit = 0;
    const eligible = (r) => r.type === 'combat' && !r.isRiftChamber && !r.secretParentKey;
    const circleRect = (x, y, r, z) => x + r > z.x && x - r < z.x + z.w && y + r > z.y && y - r < z.y + z.h;
    const corridors = (room) => { const z = []; const L = gen.ROOM_LEFT, R = gen.ROOM_RIGHT, T = gen.ROOM_TOP, B = gen.ROOM_BOTTOM, cx = gen.ROOM_CENTER_X, cy = gen.ROOM_CENTER_Y;
      if (room.doors.north) z.push({ x: cx - 20, y: T, w: 40, h: 46 }); if (room.doors.south) z.push({ x: cx - 20, y: B - 46, w: 40, h: 46 }); if (room.doors.west) z.push({ x: L, y: cy - 20, w: 46, h: 40 }); if (room.doors.east) z.push({ x: R - 46, y: cy - 20, w: 46, h: 40 }); return z; };
    const checkSpot = (room, x, y, r, what) => {
      if (x - r < gen.ROOM_LEFT || x + r > gen.ROOM_RIGHT || y - r < gen.ROOM_TOP || y + r > gen.ROOM_BOTTOM) viol.push(`${what} outside`);
      if (gen.hitsAnyRect(room.obstacles, x, y, r)) viol.push(`${what} obstacle`);
      if (gen.hitsAnyRect(room.chasms, x, y, r)) viol.push(`${what} chasm`);
      if (Math.hypot(x - gen.ROOM_CENTER_X, y - gen.ROOM_CENTER_Y) < r + 22 - 0.01) viol.push(`${what} center`);
      for (const z of corridors(room)) if (circleRect(x, y, r, z)) viol.push(`${what} door`);
      for (const sp of room.spawns) if (Math.hypot(x - sp.x, y - sp.y) < 26) viol.push(`${what} spawn`);
    };
    for (const sec of [1, 2, 3, 4, 5]) for (const fl of [1, 2, 3]) {
      let elig = 0, hasPrism = 0, hasJet = 0, hasPlate = 0, hasTele = 0, anyMech = 0;
      const n = sec === 1 || sec === 5 ? 40 : N;
      for (let i = 0; i < n; i++) {
        const f = rng.withSeededRandom(`dist:${sec}:${fl}:${i}`, () => gen.generateSectorFloor(sec, fl));
        for (const room of f.rooms.values()) {
          const has = room.prisms || room.flameJets || room.magnetPlates || room.teleporters;
          if (has && !eligible(room)) ineligibleHit++;
          if (has) anyMech++;
          if (!eligible(room)) continue;
          elig++;
          if (room.prisms) { hasPrism++; for (const p of room.prisms) checkSpot(room, p.x, p.y, p.r, 'prism'); }
          if (room.flameJets) { hasJet++; for (const j of room.flameJets) for (const s of mg.jetSamplePoints(j)) checkSpot(room, s.x, s.y, 3, 'jet'); }
          if (room.magnetPlates) { hasPlate++; for (const m of room.magnetPlates) checkSpot(room, m.x, m.y, mg.PLATE_PLACE_RADIUS, 'plate'); }
          if (room.teleporters) {
            hasTele++;
            const byPair = {}; for (const t of room.teleporters) { (byPair[t.pairId] ??= []).push(t); checkSpot(room, t.x, t.y, 9, 'pad'); }
            for (const pr of Object.values(byPair)) { if (pr.length !== 2) teleportOdd++; else { if (Math.hypot(pr[0].x - pr[1].x, pr[0].y - pr[1].y) < 140) padDistBad++; if (pr[0].colorIdx !== pr[1].colorIdx) teleportOdd++; } }
          }
        }
      }
      stats[`${sec}-${fl}`] = { elig, prism: +(hasPrism / elig).toFixed(2), jet: +(hasJet / elig).toFixed(2), plate: +(hasPlate / elig).toFixed(2), tele: +(hasTele / elig).toFixed(2), anyMech };
    }
    out.stats = stats; out.viol = [...new Set(viol)].slice(0, 8); out.violCount = viol.length; out.teleportOdd = teleportOdd; out.padDistBad = padDistBad; out.ineligibleHit = ineligibleHit;
    // (d) S1/Omega ohne Mechaniken
    out.noMechS1S5 = ['1-1', '1-2', '1-3', '5-1', '5-2', '5-3'].every((k) => stats[k].anyMech === 0);
    // (e) Determinismus inkl. Mechaniken
    const sig = (f) => JSON.stringify([...f.rooms.entries()]);
    out.det = [2, 3, 4].map((sec) => [1, 2, 3].every((fl) => sig(rng.withSeededRandom(`x${sec}${fl}`, () => gen.generateSectorFloor(sec, fl))) === sig(rng.withSeededRandom(`x${sec}${fl}`, () => gen.generateSectorFloor(sec, fl)))));
    // seeded floors contain mechanics at all
    const probe = rng.withSeededRandom('probe-mech', () => gen.generateSectorFloor(3, 3));
    out.probeHasMech = [...probe.rooms.values()].some((r) => r.flameJets || r.magnetPlates);
    // (f) Layout-Folge unberührt: mit/ohne mechanics identisch (ohne die neuen Felder)
    const strip = (f) => JSON.stringify([...f.rooms.entries()].map(([k, r]) => { const c = { ...r }; delete c.prisms; delete c.flameJets; delete c.magnetPlates; delete c.teleporters; delete c.extractBeacon; return [k, c]; }));
    out.layoutSame = [2, 3, 4].every((sec) => [1, 2, 3].every((fl) => {
      const a = rng.withSeededRandom(`layout${sec}${fl}`, () => gen.generateSectorFloor(sec, fl, undefined, { mechanics: true }));
      const b = rng.withSeededRandom(`layout${sec}${fl}`, () => gen.generateSectorFloor(sec, fl, undefined, { mechanics: false }));
      const bHas = [...b.rooms.values()].some((r) => r.prisms || r.flameJets || r.magnetPlates || r.teleporters);
      return strip(a) === strip(b) && !bHas;
    }));
    // Random-Folge: Zustand von Math.random nach dem Generator ist mit/ohne Mechanik identisch (Stichprobe der Folge)
    const seqAfter = (mech) => { let s; rng.withSeededRandom('seq', () => { gen.generateSectorFloor(3, 2, undefined, { mechanics: mech }); s = Math.random(); }); return s; };
    out.seqSame = seqAfter(true) === seqAfter(false);
    out.randomRestored = Math.random === orig;
    // Alt-Hash (M9) bleibt mit gestrippten Mechanik-Feldern identisch
    const parts = [];
    for (const sec of [1, 2, 3, 4, 5]) for (const fl of [1, 2, 3]) parts.push(strip(rng.withSeededRandom(`probe:${sec}:${fl}`, () => gen.generateSectorFloor(sec, fl))).replace(/^\[\[/, '[[').toString());
    // der alte Hash wurde über JSON.stringify([...rooms.entries()]) ohne Strip gebildet; Räume ohne Mechanik-Felder sind identisch → vergleiche Teilmenge S1/S5
    const parts15 = [];
    for (const sec of [1, 2, 3, 4, 5]) for (const fl of [1, 2, 3]) { const f = rng.withSeededRandom(`probe:${sec}:${fl}`, () => gen.generateSectorFloor(sec, fl)); parts15.push(JSON.stringify([...f.rooms.entries()].map(([k, r]) => { const c = { ...r }; delete c.prisms; delete c.flameJets; delete c.magnetPlates; delete c.teleporters; delete c.extractBeacon; return [k, c]; }).map(([k, c]) => [k, c]))); }
    // Rekonstruktion: Schlüsselreihenfolge der Room-Objekte ist durch delete unverändert → gleicher String wie früher
    const s2 = parts15.join('|'); let hash = 2166136261; for (let i = 0; i < s2.length; i++) { hash ^= s2.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
    out.oldHash = hash;
    // M10-C: Wochen-Prüfung löscht Portale & Rift-Kammern → relevanter Hash OHNE riftPortal/Rift-Kammern (Referenz vom Stand vor M10-C)
    const partsT = [];
    for (const sec of [1, 2, 3, 4, 5]) for (const fl of [1, 2, 3]) { const f = rng.withSeededRandom(`probe:${sec}:${fl}`, () => gen.generateSectorFloor(sec, fl)); partsT.push(JSON.stringify([...f.rooms.entries()].filter(([, r]) => !r.isRiftChamber).map(([k, r]) => { const c = { ...r }; delete c.prisms; delete c.flameJets; delete c.magnetPlates; delete c.teleporters; delete c.extractBeacon; delete c.riftPortal; return [k, c]; }))); }
    const sT = partsT.join('|'); let hashT = 2166136261; for (let i = 0; i < sT.length; i++) { hashT ^= sT.charCodeAt(i); hashT = Math.imul(hashT, 16777619) >>> 0; }
    out.trialHash = hashT;
    // Spirale bekommt Mechaniken (visualSector 2-4)
    let spiral = 0; for (let d = 1; d <= 12; d++) { const f = gen.generateEndlessRiftFloor(d); if ([...f.rooms.values()].some((r) => r.prisms || r.flameJets || r.magnetPlates || r.teleporters)) spiral++; }
    out.spiral = spiral;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const near = (a, b, tol = 0.1) => Math.abs(a - b) <= tol;
  const T = { 2: [0.55, 0.7, 0.85], 3: [0.4, 0.6, 0.75], 4: [0.5, 0.7, 0.85] }; const P = [0.25, 0.45, 0.6];
  let okDist = true;
  for (const sec of [2, 3, 4]) for (let fl = 1; fl <= 3; fl++) { const s = r.stats[`${sec}-${fl}`]; const key = sec === 2 ? 'prism' : sec === 3 ? 'jet' : 'tele'; if (!near(s[key], T[sec][fl - 1])) { okDist = false; console.log('dist miss', sec, fl, key, s[key], T[sec][fl - 1]); } if (sec === 3 && !near(s.plate, P[fl - 1])) { okDist = false; console.log('plate miss', fl, s.plate); } }
  const ok = okDist && r.violCount === 0 && r.teleportOdd === 0 && r.padDistBad === 0 && r.ineligibleHit === 0 && r.noMechS1S5 && r.det.every(Boolean) && r.probeHasMech && r.layoutSame && r.seqSame && r.randomRestored && r.trialHash === 2433387701 && r.spiral >= 8;
  if (!ok) throw new Error('M10 Phase 4 assert failed');
  console.log('M10 PHASE4 OK');
};
