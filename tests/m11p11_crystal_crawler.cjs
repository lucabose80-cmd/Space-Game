// M11 — Kristall-Krabbler-Rig (crystal_crawler): Krabbeln (Beine aus Strecke), Vorwarnung, Vorschnellen, Erholung, Treffer-Zucken, Tod-Splitter, Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 7, x: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, chargeActive: 0, kind: 'crystal_crawler', hp: 10, maxHp: 10 }, x);
    const run = (en, n = 40, t0 = 1) => { let pz; for (let i = 0; i < n; i++) pz = anim.getBossPose('crystal_crawler', en, t0 + i * 0.016, 50, 0); return pz; };
    const idle = run(e({}));
    const tele = run(e({ id: 8, telegraphTimer: 0.2 }));
    const charge = run(e({ id: 9, chargeActive: 0.2 }));
    const legSet = (en) => { const s = new Set(); for (let i = 0; i < 80; i++) s.add(Math.round((anim.getBossPose('crystal_crawler', en, 2 + i * 0.016, 50, 0).legA1.rot ?? 0) * 10)); return s.size; };
    const walker = e({ id: 10, vx: 52 });
    // Dreifuß-Takt: Gegenbeine schwingen gegenläufig
    const w2 = e({ id: 12, vx: 52 });
    const ser = { legA1: [], legB1: [], legC1: [] };
    for (let i = 0; i < 120; i++) {
      const pz = anim.getBossPose('crystal_crawler', w2, 3 + i * 0.016, 50, 0);
      for (const k of Object.keys(ser)) ser[k].push(pz[k].rot ?? 0);
    }
    const cov = (x, y) => { const mx = x.reduce((p, c) => p + c, 0) / x.length, my = y.reduce((p, c) => p + c, 0) / y.length; return x.reduce((p, c, i) => p + (c - mx) * (y[i] - my), 0); };
    const opposite = cov(ser.legA1, ser.legB1) < 0 && cov(ser.legA1, ser.legC1) > 0;
    const lt = (id) => run(e({ id }), 1);
    // Erholung: nach dem Vorschnellen federt der Körper zurück (Rückfederung ≠ Ruhe)
    const rec = e({ id: 13, chargeActive: 0.2 });
    run(rec, 30, 5); rec.chargeActive = 0;
    const recPose = anim.getBossPose('crystal_crawler', rec, 5.6, 50, 0);
    const calmPose = run(e({ id: 14 }));
    // Treffer-Zucken: kurz (≤ 0,15 s) und danach wieder Ruhe
    const hit = e({ id: 15 });
    run(hit, 30, 6);
    hit.flashTimer = 0.1;
    let hitPose = { torso: { rot: 0 } };
    for (let i = 0; i < 4; i++) { const hp = anim.getBossPose('crystal_crawler', hit, 6.5 + i * 0.016, 50, 0); if (Math.abs(hp.torso.rot) > Math.abs(hitPose.torso.rot)) hitPose = hp; }
    hit.flashTimer = 0;
    let hp2; for (let i = 1; i <= 20; i++) hp2 = anim.getBossPose('crystal_crawler', hit, 6.6 + i * 0.016, 50, 0);
    return {
      loaded: !!getHDArt().rigs.crystal_crawler,
      idleCrystalSy: idle.crystal.sy, teleCrystalSy: tele.crystal.sy,
      idleTorsoDy: idle.torso.dy, teleTorsoDy: tele.torso.dy,
      chargeLean: charge.torso.rot, idleLean: idle.torso.rot, chargeLegs: charge.legA1.rot, idleLegs: idle.legA1.rot,
      facing: [anim.getRigFacing('crystal_crawler', e({ x: 100 }), 50), anim.getRigFacing('crystal_crawler', e({ x: 100 }), 150)],
      legsWalk: legSet(walker), legsStill: legSet(e({ id: 11 })), opposite, lt: !!lt(20),
      recLean: recPose.torso.rot, calmLean: calmPose.torso.rot,
      hitRot: hitPose.torso.rot, calmRot: idle.torso.rot, afterHit: hp2.torso.rot,
    };
  });
  assert.ok(r.loaded, 'Kristall-Krabbler-Rig geladen (alle 6 Teile vorhanden)');
  assert.ok(r.teleCrystalSy > r.idleCrystalSy + 0.3, 'Vorwarnung: Kristall wächst/glüht');
  assert.ok(r.teleTorsoDy > r.idleTorsoDy + 1, 'Vorwarnung: Körper duckt sich');
  assert.ok(r.chargeLean > r.idleLean + 0.15, 'Vorschnellen: Körper nach vorn gestreckt');
  assert.ok(Math.abs(r.chargeLegs - r.idleLegs) > 0.3, 'Vorschnellen: Beine anders gestellt');
  assert.ok(Math.abs(r.recLean - r.calmLean) > 0.03, 'Erholung: Rückfederung nach dem Vorschnellen');
  assert.ok(Math.abs(r.hitRot - r.calmRot) > 0.05 && Math.abs(r.afterHit - r.calmRot) < 0.05, 'Treffer: kurzes Zucken, danach wieder ruhig ' + JSON.stringify(r));
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler (Rig gespiegelt)');
  assert.ok(r.legsWalk > 3 && r.legsStill === 1, 'Beine krabbeln beim Gehen, stehen im Stand: ' + JSON.stringify(r));
  assert.ok(r.opposite, 'Beinpaare im Wechseltakt');

  // Integration im echten Renderer: Rig ≠ Fallback (G2), Tod-Splitter nach dem Kill (G7)
  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(ctx.getImageData(380, 180, 220, 200).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const snap = () => { dng.enemies.length = 0; dng.bossFx.clear(); dng.playerX = 120; dng.playerY = 190; dng.invulnTimer = 999; dng.spawnEnemy('crystal_crawler', 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.time = 2; dng.roomFade = 0; dng.render(ctx, input); return hash(); };
    const art = getHDArt();
    const withRig = snap(); const keep = art.rigs.crystal_crawler; art.rigs.crystal_crawler = null; const without = snap(); art.rigs.crystal_crawler = keep;
    // Tod: Gegner rendern (merkt Position), töten, danach Splitter sichtbar und später wieder weg
    dng.enemies.length = 0; dng.spawnEnemy('crystal_crawler', 250, 130); const en = dng.enemies[0]; dng.time = 3; dng.roomFade = 0;
    dng.render(ctx, input);
    const before = hash();
    en.hp = 0; dng.onEnemyKilled(en);
    const alive = dng.enemies.length;
    dng.time = 3.016; dng.render(ctx, input);
    dng.time = 3.35; dng.render(ctx, input); const debris = hash();
    const crop = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 400; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(canvas, 400, 180, 240, 200, 0, 0, 480, 400); return c.toDataURL('image/png'); };
    const shot = crop();
    // Vorwarnung (Glühen) und Vorschnellen (Funkenspur) als Prüfbilder
    dng.enemies.length = 0; dng.spawnEnemy('crystal_crawler', 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.enemies[0].telegraphTimer = 0.2; dng.time = 6; dng.roomFade = 0; dng.render(ctx, input);
    const teleShot = crop();
    dng.enemies[0].telegraphTimer = 0; dng.enemies[0].chargeActive = 0.2; dng.time = 6.05; dng.currentRoom.riftSector = 2; dng.render(ctx, input);
    const chargeShot = crop();
    const chargeS2 = hash();
    dng.currentRoom.riftSector = 1; dng.render(ctx, input);
    const chargeS1 = hash();
    dng.currentRoom.riftSector = undefined;
    const groundLoaded = [1, 2, 3, 4, 5].every((s) => !!art.rigs.crystal_crawler?.parts?.[`fxDustS${s}`]) && !!art.rigs.crystal_crawler?.parts?.fxRemnant;
    dng.time = 5; dng.render(ctx, input); const after = hash();
    return { withRig, without, before, debris, after, shot, teleShot, chargeShot, alive, groundLoaded, chargeS1, chargeS2 };
  });
  require('node:fs').writeFileSync(require('node:path').join(__dirname, 'out', 'crystal_crawler_death.png'), Buffer.from(g.shot.split(',')[1], 'base64'));
  for (const k of ['teleShot', 'chargeShot']) require('node:fs').writeFileSync(require('node:path').join(__dirname, 'out', `crystal_crawler_${k}.png`), Buffer.from(g[k].split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig und Fallback-Sprite werden unterschiedlich gezeichnet (Rückfall läuft ohne Fehler)');
  assert.strictEqual(g.alive, 0);
  assert.notStrictEqual(g.debris, g.after, 'Tod: Kristall-Splitter fliegen ab und sind später weg');
  assert.ok(g.groundLoaded, 'G10: Biom-Staubspuren S1–S5 und Todes-Rückstand geladen');
  assert.notStrictEqual(g.chargeS1, g.chargeS2, 'G10: Vorschnell-Staubspur wechselt nach Raum-Biom (S1 ≠ S2)');
};
