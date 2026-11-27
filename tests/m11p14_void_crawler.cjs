// M11 — Leere-Krabbler-Rig (void_crawler): Dreifuß-Krabbeln, Vorwarnung (Ducken + Ranke), Dash, Erholung, Treffer-Zucken, Tod-Trümmer, Biom-Staub (G10), Rückfall.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    await new Promise((res) => setTimeout(res, 300));
    const e = (x) => Object.assign({ id: 51, x: 100, vx: 0, vy: 0, chargeDirX: 1, flashTimer: 0, telegraphTimer: 0, chargeActive: 0, kind: 'void_crawler', hp: 10, maxHp: 10 }, x);
    const run = (en, n = 40, t0 = 1) => { let pz; for (let i = 0; i < n; i++) pz = anim.getBossPose('void_crawler', en, t0 + i * 0.016, 150, 0); return pz; };
    const idle = run(e({}));
    const tele = run(e({ id: 52, telegraphTimer: 0.2 }));
    const charge = run(e({ id: 53, chargeActive: 0.2 }));
    const legSet = (en) => { const s = new Set(); for (let i = 0; i < 80; i++) s.add(Math.round((anim.getBossPose('void_crawler', en, 2 + i * 0.016, 150, 0).legA1.rot ?? 0) * 10)); return s.size; };
    const rec = e({ id: 56, chargeActive: 0.2 }); run(rec, 30, 5); rec.chargeActive = 0;
    const recPose = anim.getBossPose('void_crawler', rec, 5.6, 150, 0);
    const hit = e({ id: 57 }); run(hit, 25, 6); hit.flashTimer = 0.1;
    let hitRot = 0;
    for (let i = 0; i < 4; i++) { const p = anim.getBossPose('void_crawler', hit, 6.45 + i * 0.016, 150, 0); if (Math.abs(p.torso.rot ?? 0) > Math.abs(hitRot)) hitRot = p.torso.rot ?? 0; }
    hit.flashTimer = 0; let afterHit;
    for (let i = 1; i <= 20; i++) afterHit = anim.getBossPose('void_crawler', hit, 6.55 + i * 0.016, 150, 0);
    return {
      loaded: !!getHDArt().rigs.void_crawler,
      idleDy: idle.torso.dy ?? 0, teleDy: tele.torso.dy ?? 0,
      idleTendril: idle.tendril.rot ?? 0, chargeTendril: charge.tendril.rot ?? 0,
      chargeLean: charge.torso.rot ?? 0, idleLean: idle.torso.rot ?? 0,
      recLean: recPose.torso.rot ?? 0,
      legsWalk: legSet(e({ id: 54, vx: 55 })), legsStill: legSet(e({ id: 55 })),
      hitRot, afterHitRot: afterHit.torso.rot ?? 0,
      facing: [anim.getRigFacing('void_crawler', e({ x: 100 }), 50), anim.getRigFacing('void_crawler', e({ x: 100 }), 150)],
    };
  });
  assert.ok(r.loaded, 'Leere-Krabbler-Rig geladen (6 Teile)');
  assert.ok(r.teleDy > r.idleDy + 1, 'Vorwarnung: Körper duckt sich');
  assert.ok(r.chargeLean > r.idleLean + 0.15, 'Dash: Körper gestreckt nach vorn');
  assert.ok(r.chargeTendril > r.idleTendril + 0.2, 'Dash: Energie-Ranke peitscht zurück');
  assert.ok(r.legsWalk > 3 && r.legsStill === 1, 'Beine krabbeln im Lauf, stehen im Stand');
  assert.ok(Math.abs(r.recLean - r.idleLean) > 0.03, 'Erholung nach dem Dash');
  assert.ok(Math.abs(r.hitRot) > 0.05 && Math.abs(r.afterHitRot) < 0.05, 'Treffer-Zucken kurz & klingt ab');
  assert.deepStrictEqual(r.facing, [-1, 1], 'Blick zum Spieler');

  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(2);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(ctx.getImageData(380, 180, 220, 200).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 400; const gx = c.getContext('2d'); gx.imageSmoothingEnabled = false; gx.drawImage(canvas, 400, 180, 240, 200, 0, 0, 480, 400); return c.toDataURL('image/png'); };
    const snap = () => { dng.enemies.length = 0; dng.playerX = 340; dng.playerY = 140; dng.invulnTimer = 999; dng.spawnEnemy('void_crawler', 250, 130); dng.enemies[0].hp = dng.enemies[0].maxHp = 1e6; dng.time = 2; dng.roomFade = 0; dng.render(ctx, input); return hash(); };
    const art = getHDArt();
    const withRig = snap(); const idleShot = crop();
    const keep = art.rigs.void_crawler; art.rigs.void_crawler = null; const without = snap(); art.rigs.void_crawler = keep;
    dng.enemies.length = 0; dng.spawnEnemy('void_crawler', 250, 130); const en = dng.enemies[0]; en.chargeActive = 0.2; dng.time = 3; dng.roomFade = 0;
    dng.currentRoom.riftSector = 2; dng.render(ctx, input); const s2 = hash();
    dng.currentRoom.riftSector = 1; dng.render(ctx, input); const s1 = hash();
    dng.currentRoom.riftSector = undefined;
    en.hp = 0; dng.onEnemyKilled(en); dng.time = 3.016; dng.render(ctx, input); dng.time = 3.25; dng.render(ctx, input);
    const debris = hash();
    dng.time = 5; dng.render(ctx, input); const after = hash();
    return { withRig, without, s1, s2, debris, after, idleShot };
  });
  const fs = require('node:fs'); const path = require('node:path');
  fs.writeFileSync(path.join(__dirname, 'out', 'void_crawler_idle.png'), Buffer.from(g.idleShot.split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig ≠ Fallback');
  assert.notStrictEqual(g.s1, g.s2, 'G10: Dash-Staubspur wechselt nach Raum-Biom');
  assert.notStrictEqual(g.debris, g.after, 'Tod-Trümmer sichtbar & verschwinden');
  console.log('M11 VOID-CRAWLER OK');
};
