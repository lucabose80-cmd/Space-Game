// M11 — Schild-Drohne (shield_drone): Schildbogen folgt dem Zielwinkel, klappt im Angriff ein, überhitzt orange; Rig spiegelt mit dem Zielwinkel.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    for (let i = 0; i < 100 && !getHDArt().rigs.shield_drone; i++) await new Promise((res) => setTimeout(res, 100));
    const mk = (x) => Object.assign({ id: 7, x: 100, y: 100, vx: 0, vy: 0, flashTimer: 0, telegraphTimer: 0, kind: 'shield_drone', hp: 10, maxHp: 10, radius: 10, aimAngle: 0 }, x);
    const run = (e, sec) => { let p; for (let t = 0; t <= sec; t += 1 / 60) p = anim.getBossPose('shield_drone', e, 1 + t, 50, 0); return p; };
    const idle = run(mk({}), 1);
    const down = run(mk({ id: 8, telegraphTimer: 0.3, shieldDownTimer: 1 }), 0.9); // Angriff: Schild offen
    const hotE = mk({ id: 9, shieldHeat: 3.5 });
    const hot = run(hotE, 0.5);
    const over = run(mk({ id: 10, shieldDownTimer: 2.4 }), 0.8);
    const eL = mk({ id: 11, aimAngle: Math.PI });
    const sd = await import('/src/dungeon/anim/rigs/shield_drone.ts');
    // G6 Treffer-Zucken (kurz) · G4 Erholung · G7 Tod
    const hitE = mk({ id: 15 }); run(hitE, 0.3); hitE.flashTimer = 0.1; const hitP = run(hitE, 0.03, 1.5); hitE.flashTimer = 0; const calmP = run(hitE, 0.5, 2);
    const recE = mk({ id: 16, shieldDownTimer: 0.9 }); recE.telegraphTimer = 0.1; run(recE, 0.05); recE.telegraphTimer = 0; const recP = run(recE, 0.3, 1.2);
    const d0 = sd.shieldDroneDeathPose(0, 1), d1 = sd.shieldDroneDeathPose(0.3, 1), d2 = sd.shieldDroneDeathPose(0.6, 1);
    return {
      loaded: !!getHDArt().rigs.shield_drone,
      idle: idle.arc, down: down.arc, hotVariant: hot.arc.variant, overVariant: over.arc.variant, overHidden: over.arc.hidden,
      facing: [anim.getRigFacing('shield_drone', mk({ id: 12 }), 0), anim.getRigFacing('shield_drone', eL, 0)],
      hit: Math.abs(hitP.hull.rot - calmP.hull.rot), calm: Math.abs(calmP.hull.rot),
      recoverDy: recP.hull.dy - idle.hull.dy, recoverVisor: recP.visor.alpha,
      death: [d0.hull.alpha, d1.nacelleL.dx, d2.hull.alpha, d2.arc.alpha, d1.hull.dy > d0.hull.dy],
      rotDiff: run(mk({ id: 13, aimAngle: 1.0 }), 0.6).arc.rot - run(mk({ id: 14, aimAngle: 0 }), 0.6).arc.rot,
    };
  });
  assert.ok(r.loaded, 'Schild-Drohnen-Rig geladen (alle Teile vorhanden)');
  assert.ok(!r.idle.hidden && r.idle.variant === 0 && r.idle.alpha > 0.9, 'Ruhe: cyan Bogen voll sichtbar');
  assert.ok(r.down.hidden || r.down.alpha < 0.3, 'Angriff: Schildbogen klappt ein (Konter-Fenster)');
  assert.strictEqual(r.hotVariant, 1, 'Hitze ≥ 70 %: orangener Bogen');
  assert.strictEqual(r.overVariant, 2, 'Überhitzt: rissiger Bogen');
  assert.ok(!r.overHidden, 'Überhitzt: Bogen bleibt als flackernde Ruine sichtbar');
  assert.deepStrictEqual(r.facing, [1, -1], 'Rig blickt in Zielrichtung (gespiegelt bei Ziel links)');
  assert.ok(r.hit > 0.02 && r.calm < 0.05, 'Treffer: Rumpf zuckt kurz, danach wieder ruhig: ' + JSON.stringify([r.hit, r.calm]));
  assert.ok(r.recoverVisor < 1, 'Erholung: Visier dimmt nach der Salve');
  assert.ok(r.death[0] === 1 && r.death[1] < -3 && r.death[2] < 0.5 && r.death[3] === 0 && r.death[4], 'Tod: Düsen reißen ab, Rumpf sackt & blendet aus, Bogen zerspringt: ' + JSON.stringify(r.death));
  assert.ok(Math.abs(r.rotDiff - 1.0) < 0.05, 'Bogen dreht mit dem Zielwinkel: ' + r.rotDiff);
};

// Integration im echten Renderer: Rig ≠ Fallback (G2), Tod (G7), Prüfbilder (G9)
module.exports = ((prev) => async (ctx) => {
  await prev(ctx);
  const { page } = ctx;
  const assert = require('node:assert');
  const g = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    const room = dng.currentRoom; room.pods.forEach((p) => (p.broken = true)); room.chasms = []; room.obstacles = []; room.spawns = [];
    const canvas = document.getElementById('game-canvas'); const c2 = canvas.getContext('2d'); c2.setTransform(2, 0, 0, 2, 0, 0); c2.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(c2.getImageData(380, 180, 260, 220).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => { const c = document.createElement('canvas'); c.width = 520; c.height = 440; const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(canvas, 380, 180, 260, 220, 0, 0, 520, 440); return c.toDataURL('image/png'); };
    const place = (id) => { dng.enemies.length = 0; dng.bossFx.clear(); dng.playerX = 120; dng.playerY = 190; dng.invulnTimer = 999; dng.spawnEnemy('shield_drone', 250, 130); const en = dng.enemies[0]; en.hp = en.maxHp = 1e6; en.id = id; en.aimAngle = Math.PI; return en; };
    const art = getHDArt();
    const frame = (t) => { dng.time = t; dng.roomFade = 0; dng.render(c2, input); };
    const en = place(5); frame(3); const withRig = hash(); const shotIdle = crop();
    const keep = art.rigs.shield_drone; art.rigs.shield_drone = null; frame(3.02); const without = hash(); art.rigs.shield_drone = keep;
    en.shieldDownTimer = 1; en.telegraphTimer = 0.2; for (let i = 0; i < 20; i++) frame(4 + i * 0.016); const shotAttack = crop();
    en.telegraphTimer = 0; en.shieldDownTimer = 0; en.shieldHeat = 0; for (let i = 0; i < 90; i++) frame(5 + i * 0.016);
    const en2 = place(6); frame(6); en2.hp = 0; dng.onEnemyKilled(en2); frame(6.016); frame(6.25); const shotDeath = crop(); const debris = hash(); frame(7.2); const gone = hash();
    return { withRig, without, debris, gone, shotIdle, shotAttack, shotDeath };
  });
  const fs = require('node:fs'), path = require('node:path');
  for (const k of ['shotIdle', 'shotAttack', 'shotDeath']) fs.writeFileSync(path.join(__dirname, 'out', `shield_drone_${k}.png`), Buffer.from(g[k].split(',')[1], 'base64'));
  assert.notStrictEqual(g.withRig, g.without, 'Rig und Fallback-Sprite werden unterschiedlich gezeichnet (Rückfall läuft ohne Fehler)');
  assert.notStrictEqual(g.debris, g.gone, 'Tod: Teile fliegen ab und sind später weg');
})(module.exports);
