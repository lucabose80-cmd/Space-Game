// M12 Phase D — Leviathan-Arena-Kampf (bosses/leviathanArena.ts).
// Auftritt (Kamera + Banner, Eingabe gesperrt, kein Schaden) · Panzer vs. Schwachstellen (Arme/Ventile/Linse) ·
// Phase I→II (65 % oder beide Arme zerstört; Platten brechen nach ≥ 0,8 s Vorwarnung) · II→III (30 %, Linse dauerhaft offen) ·
// kritisch < 15 % · alle Gefahren mit Vorwarnung ≥ 0,4 s · Glut-Wellen mit Lücke · deterministische Zugfolge ·
// Sieg schließt den Abgrund · Wochen-Prüfungs-Gate · kompletter Bot-Kampf ohne Fehler.
module.exports = async ({ page, PORT }) => {
  const assert = require('node:assert');
  await page.goto(`http://127.0.0.1:${PORT}/?arena`);
  await page.waitForFunction(() => document.styleSheets.length > 0);
  const r = await page.evaluate(async () => {
    const { preloadHDArt } = await import('/src/assets/artLoader.ts'); await preloadHDArt();
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const W = await import('/src/systems/weeklyTrial.ts');
    const LA = await import('/src/dungeon/bosses/leviathanArena.ts');
    const B = await import('/src/data/balance.ts');
    const mkInput = (mv) => { const t = { locked: false }; t.getMoveVector = () => (t.locked ? { x: 0, y: 0 } : mv); t.isMouseActive = () => false; t.getMousePos = () => ({ x: 0, y: 0 }); return new Proxy(t, { get: (o, k) => (k in o ? o[k] : () => false), set: (o, k, v) => ((o[k] = v), true) }); };
    const idle = mkInput({ x: 0, y: 0 });
    const mk = (cleared = false) => {
      const g = new GameState(); g.saveLocked = true; g.sector1Cleared = cleared;
      const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
      d.startRun(1); d.startFloor(3, false, 1);
      const room = d.floor.rooms.get(d.floor.bossKey);
      room.doors = { north: false, south: true, east: false, west: false };
      d.enterRoom(d.floor.bossKey, 'south');
      const boss = d.enemies.find((e) => e.kind === 'boss_leviathan');
      // Telegraph-Protokoll
      const zones = [];
      const add = d.bossFx.add.bind(d.bossFx);
      d.bossFx.add = (z) => { zones.push({ ...z, at: d.time }); add(z); };
      return { g, d, boss, zones };
    };
    const step = (d, sec, inp = idle) => { for (let i = 0; i < Math.round(sec * 60); i++) { d.invulnTimer = 9999; d.update(1 / 60, inp); } };
    const hitAt = (d, e, x, y, amt = 50) => { d.getClosestEnemyHitPoint(e, x, y); d.damageEnemy(e, amt, 0, 1, 0, true, false); };
    const out = {};

    // ---------- HP & Auftritt ----------
    {
      const { d, boss } = mk(false);
      out.hp = [boss.maxHp, Math.round(B.BOSS_HP.boss_leviathan * 1.35)];
      out.arena = !!boss.levArena && boss.levArena.state === 'intro';
      step(d, 0.1);
      out.intro = [d.camera.inputLocked, !!d.arenaBanner, d.arenaBanner?.title];
      const h0 = boss.hp; hitAt(d, boss, boss.x, boss.y + 19, 200); out.introNoDmg = boss.hp === h0;
      // Spieler kann sich während des Auftritts nicht bewegen
      const px = d.playerX; step(d, 1.0, mkInput({ x: 1, y: 0 })); out.introLocked = Math.round(d.playerX - px);
      step(d, 1.6); out.introEnd = [boss.levArena.state !== 'intro', d.camera.inputLocked];
      const r2 = mk(true); step(r2.d, 0.1); const t0 = r2.d.time; let n = 0; while (r2.d.camera.inputLocked && n++ < 200) step(r2.d, 1 / 60);
      out.introRepeat = Math.round((r2.d.time - t0 + 0.1) * 10) / 10;
    }

    // ---------- Panzer, Arme, Phasen, Ventile, Linse ----------
    {
      const { d, boss, zones } = mk(true);
      step(d, 1.2);
      const L = boss.levArena;
      // Panzer: Körper treffen → kein Schaden
      let h0 = boss.hp; hitAt(d, boss, boss.x, boss.y - 10); out.armor = [boss.hp === h0, d.floats.some((f) => f.text === 'GEPANZERT')];
      // Linse in Phase I zu → kein Schaden
      h0 = boss.hp; hitAt(d, boss, boss.x, boss.y + 19); out.lensClosed = boss.hp === h0;
      // Ventil in Phase I → Panzer
      const v0 = L.vents[0]; h0 = boss.hp; hitAt(d, boss, v0.x + 10, v0.y); out.ventP1 = [boss.hp === h0, v0.hp === v0.maxHp];
      out.vents = L.vents.length;
      // Arm nicht am Boden → Panzer; am Boden → Schaden an Arm + Pool
      const arm = boss.levArms[0];
      arm.state = 'idle'; h0 = boss.hp; hitAt(d, boss, arm.x, arm.y); out.armAir = boss.hp === h0;
      arm.state = 'grounded'; arm.timer = 5; h0 = boss.hp; const a0 = L.armHp[0]; hitAt(d, boss, arm.x, arm.y, 100);
      out.armHit = [Math.round(h0 - boss.hp), Math.round(a0 - L.armHp[0])];
      // Arm zerstören
      arm.state = 'grounded'; arm.timer = 5; hitAt(d, boss, arm.x, arm.y, L.armHp[0] + 1);
      out.armDead = [arm.dead === true, LA.arenaHitPoints(boss).some((p) => p.id === 'arm0')];
      // Überschuss-Schaden an einem Teil fließt nicht in den Pool (nur Teil-HP)
      const arm1b = boss.levArms[1]; arm1b.state = 'grounded'; arm1b.timer = 5; L.armHp[1] = 40; h0 = boss.hp;
      hitAt(d, boss, arm1b.x, arm1b.y, 9999); out.armCap = [Math.round(h0 - boss.hp), arm1b.dead === true];
      // Phase II bei 65 %
      boss.hp = boss.maxHp * 0.64; step(d, 0.1);
      out.p2 = [L.phase, L.state, boss.bossPhase2];
      const plateZone = zones.find((z) => z.onFire);
      out.plateWarn = plateZone?.delay;
      const chasm0 = d.currentRoom.chasms.length; step(d, 1.4);
      out.plates = [chasm0, d.currentRoom.chasms.length, L.platesBroken];
      // Ventil zerstören → Linse offen 3 s
      const v = L.vents[1]; const hv = boss.hp; hitAt(d, boss, v.x + (v.x < d.bounds.cx ? 10 : -10), v.y, 99999);
      out.ventCap = Math.round(hv - boss.hp) === v.maxHp;
      out.vent = [v.broken, Math.round(L.lensOpen * 10) / 10];
      out.aimPts = LA.arenaAimPoints(boss).map((p) => p.idx).sort();
      h0 = boss.hp; hitAt(d, boss, boss.x, boss.y + 19, 100); out.lensHit = Math.round(h0 - boss.hp);
      step(d, 3.2); out.lensClosedAgain = LA.lensIsOpen(L);
      // Phase III bei 30 %
      boss.hp = boss.maxHp * 0.29; step(d, 0.1);
      out.p3 = [L.phase, LA.lensIsOpen(L)];
      step(d, 2.6);
      h0 = boss.hp; hitAt(d, boss, boss.x, boss.y + 19, 100); out.lensP3 = Math.round(h0 - boss.hp);
      boss.hp = boss.maxHp * 0.14; step(d, 0.1); out.critical = L.critical;
      // ein paar Züge in Phase III laufen lassen (Glut-Wellen, Puls, Griff)
      step(d, 14);
      // Telegraphe: alle schadenden Zonen ≥ 0,4 s, Arena-Änderung ≥ 0,8 s
      const dmg = zones.filter((z) => (z.burst || z.dps) && !z.onFire);
      out.minDelay = Math.min(...dmg.map((z) => z.delay));
      out.debrisMin = Math.min(9, ...d.debrisDrops.map((x) => x.maxTimer));
      out.moves = [...new Set(zones.map((z) => z.color))].length;
      // Glut-Wellen: jedes Band hat eine Lücke
      const glow = zones.filter((z) => z.color === '#fb923c' && z.shape === 'rect' && z.burst === 16);
      const rows = {};
      for (const z of glow) { const k = Math.round(z.y) + '@' + z.at.toFixed(2); (rows[k] ??= []).push(z); }
      const rb = d.bounds;
      out.glowBands = Object.keys(rows).length;
      out.glowGaps = Object.values(rows).every((zs) => zs.reduce((s, z) => s + z.w, 0) <= rb.r - rb.l - 60);
      // Sieg: Abgrund schließt sich, Banner
      boss.hp = 0; d.onEnemyKilled(boss);
      out.win = [d.currentRoom.chasms.length, d.arenaBanner?.title, L.state];
    }

    // ---------- Deterministische Zugfolge ----------
    {
      const seq = () => { const { d, zones } = mk(true); step(d, 20); return JSON.stringify(zones.map((z) => [z.shape, Math.round(z.x), Math.round(z.y), z.delay])); };
      const a = seq(); const b = seq();
      out.determ = [a === b, a.length > 50];
    }

    // ---------- Wochen-Prüfung ----------
    out.trial = [W.trialHasArena('2026-W48'), W.trialHasArena('2099-W01'), W.TRIAL_ARENA_FROM_WEEK, B.ENDBOSS_ARENA_LIVE];

    // ---------- Bot-Kampf: schlägt nur offene Schwachstellen ----------
    {
      const { d, boss } = mk(true);
      let t = 0; let err = null;
      try {
        while (boss.hp > 0 && t < 900) {
          step(d, 0.25); t += 0.25;
          const pts = LA.arenaHitPoints(boss).filter((p) => p.weak);
          if (pts.length && boss.hp > 0) { const p = pts[0]; hitAt(d, boss, p.x, p.y, 120); if (boss.hp <= 0) d.onEnemyKilled(boss); }
        }
      } catch (x) { err = String(x && x.stack || x); }
      out.bot = { t, dead: boss.hp <= 0, err, phase: boss.levArena.phase };
    }
    return out;
  });
  console.log(JSON.stringify(r));
  assert.deepStrictEqual(r.hp[0], r.hp[1], 'Arena-HP = Leviathan × 1,35');
  assert.ok(r.arena, 'Arena-Kampf aktiv');
  assert.deepStrictEqual(r.intro, [true, true, 'A.E.G.I.S. LEVIATHAN'], 'Auftritt: Kamera + Banner');
  assert.ok(r.introNoDmg, 'kein Schaden während des Auftritts');
  assert.strictEqual(r.introLocked, 0, 'Eingabe während des Auftritts gesperrt');
  assert.deepStrictEqual(r.introEnd, [true, false], 'Auftritt endet nach 2,5 s');
  assert.ok(r.introRepeat <= 0.9, 'Wiederholung: kurzer Auftritt (0,8 s): ' + r.introRepeat);
  assert.deepStrictEqual(r.armor, [true, true], 'Körper: GEPANZERT, kein Schaden');
  assert.ok(r.lensClosed, 'Linse in Phase I zu');
  assert.deepStrictEqual(r.ventP1, [true, true], 'Ventile erst ab Phase II');
  assert.strictEqual(r.vents, 4, '4 Kühlventile');
  assert.ok(r.armAir, 'Arm in der Luft: gepanzert');
  assert.ok(r.armHit[0] >= 100 && r.armHit[1] >= 100, 'Arm am Boden: Schaden an Arm und Pool: ' + r.armHit);
  assert.deepStrictEqual(r.armDead, [true, false], 'Arm zerstört, kein Trefferpunkt mehr');
  assert.deepStrictEqual(r.armCap, [40, true], 'Teil-Schaden gedeckelt auf Teil-HP');
  assert.deepStrictEqual(r.p2, [2, 'transition', true], 'Phase II bei 65 %');
  assert.ok(r.plateWarn >= 0.8, 'Platten: Vorwarnung ≥ 0,8 s');
  assert.deepStrictEqual(r.plates, [0, 4, true], 'Platten brechen → 4 kleine Gruben');
  assert.deepStrictEqual(r.vent, [true, 3], 'Ventil zerstört → Linse 3 s offen');
  assert.ok(r.ventCap, 'Ventil: Überschuss-Schaden gedeckelt');
  assert.deepStrictEqual(r.aimPts, [2, 4, 5, 6], 'Ziel-Hilfe: intakte Ventile + offene Linse');
  assert.ok(r.lensHit >= 125, 'Linse: ×1,25 Schaden: ' + r.lensHit);
  assert.strictEqual(r.lensClosedAgain, false, 'Linse schließt nach 3 s');
  assert.deepStrictEqual(r.p3, [3, true], 'Phase III bei 30 %, Linse dauerhaft offen');
  assert.ok(r.lensP3 >= 125, 'Linse in Phase III angreifbar');
  assert.ok(r.critical, 'kritisch < 15 %');
  assert.ok(r.minDelay >= 0.4, 'alle Gefahren mit Vorwarnung ≥ 0,4 s: ' + r.minDelay);
  assert.ok(r.debrisMin >= 0.4, 'Trümmer mit Vorwarnung ≥ 0,4 s');
  assert.ok(r.glowBands >= 6 && r.glowGaps, 'Glut-Wellen mit Lücke: ' + r.glowBands);
  assert.deepStrictEqual(r.win, [0, 'A.E.G.I.S. ABGESCHALTET', 'dead'], 'Sieg: Abgrund schließt sich, Banner');
  assert.deepStrictEqual(r.determ, [true, true], 'Zugfolge deterministisch');
  assert.deepStrictEqual(r.trial, [false, true, '2026-W49', true], 'Wochen-Prüfung: Arena erst ab 2026-W49 (laufende Woche unverändert)');
  assert.ok(!r.bot.err, 'Bot-Kampf ohne Fehler: ' + r.bot.err);
  assert.ok(r.bot.dead, 'Bot besiegt den Leviathan über die Schwachstellen: ' + JSON.stringify(r.bot));
  console.log('M12 LEVIATHAN-ARENA OK');
};
