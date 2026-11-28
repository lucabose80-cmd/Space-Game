// M12 — Leviathan-Politur: Posen je Zug/Phasenwechsel (D2/D7), Beschädigungsstufen (D12), Wrack-Stumpf (A13), Doppelschlag, Effekt-Sprites, Gruben.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  await page.waitForFunction(async () => !!(await import('/src/assets/artLoader.ts')).getHDArt().rigs.boss_leviathan, null, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { getBossPose } = await import('/src/dungeon/anim/bossAnims.ts');
    const { LEVIATHAN_ARENA } = await import('/src/data/arenas/leviathan.ts');
    const art = getHDArt();
    const imgs = art.rigs.boss_leviathan;
    const mk = (extra = {}) => ({ id: 1, kind: 'boss_leviathan', vx: 0, vy: 0, flashTimer: 0, hp: 100, maxHp: 100, x: 300, y: 0, bossPhase2: false, ...extra });
    const arms = (st = 'idle', dead = false) => [0, 1].map((i) => ({ state: st, dead, side: i === 0 ? -1 : 1, timer: 1 }));
    const L = (o) => ({ state: 'idle', phase: 1, critical: false, move: null, moveIdx: 0, armHp: [1, 1], armMax: 1, ...o });
    let t = 0;
    const run = (e, n = 40) => { let p; for (let i = 0; i < n; i++) { t += 0.02; p = getBossPose('boss_leviathan', e, t, 300, 100); } return p; };
    const out = {};
    out.sprites = ['armWind', 'armStrike', 'armStump', 'armDead', 'headDead', 'torsoD1', 'torsoD2', 'torsoP2D1', 'torsoP2D2'].filter((k) => !imgs?.parts?.[k]);
    out.fx = ['arenaLeviathanFxBeamHead', 'arenaLeviathanFxBeamBody', 'arenaLeviathanFxBeamImpact', 'arenaLeviathanFxShock', 'arenaLeviathanFxCracks', 'arenaLeviathanFxCrackLine'].filter((k) => !art[k]);
    // Beschädigungsstufen nach HP
    const tv = (phase, hp) => run(mk({ hp, levArena: L({ phase }), levArms: arms() })).torso.variant;
    out.stages = [tv(1, 95), tv(1, 82), tv(1, 70), tv(2, 60), tv(2, 46), tv(2, 35), tv(3, 20)];
    // Zug-/Phasenwechsel-Posen unterscheiden sich von Ruhe
    const idle = run(mk({ levArena: L({}), levArms: arms() })).armL;
    const moves = {};
    for (const mv of ['debris', 'pulse', 'grab', 'steam', 'glow', 'beam']) {
      moves[mv] = run(mk({ levArena: L({ state: 'move', move: mv, moveIdx: 5 + mv.length }), levArms: arms() }), 30).armL;
    }
    out.moveDiff = Object.fromEntries(Object.entries(moves).map(([k, p]) => [k, Math.abs((p.rot ?? 0) - (idle.rot ?? 0)) + Math.abs((p.dx ?? 0) - (idle.dx ?? 0)) + (p.variant !== idle.variant ? 5 : 0)]));
    const tr = run(mk({ levArena: L({ state: 'transition', phase: 2 }), levArms: arms('returning') }), 30);
    out.trans = [tr.armL.variant, tr.head.rot < -0.05];
    // Ruhe: Fäuste nicht gegeneinander (Arme gespreizt)
    out.idleSpread = [idle.rot, run(mk({ levArena: L({}), levArms: arms() })).armR.rot];
    // Wrack-Stumpf
    const dead = run(mk({ levArena: L({}), levArms: [{ state: 'idle', dead: true, side: -1, timer: 0 }, { state: 'idle', dead: false, side: 1, timer: 0 }] }));
    out.stump = [dead.armL.variant, !!dead.armL.hidden, dead.armR.variant === 0 || dead.armR.variant === 3 || dead.armR.variant === 4];
    // Gruben: 4 getrennte Blöcke
    const rows = LEVIATHAN_ARENA.tiles;
    let blocks = 0; const seen = new Set();
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== 'p' || seen.has(x + ',' + y)) continue;
      blocks++; const st = [[x, y]];
      while (st.length) { const [cx, cy] = st.pop(); const k = cx + ',' + cy; if (seen.has(k) || rows[cy]?.[cx] !== 'p') continue; seen.add(k); st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
    }
    out.blocks = blocks;
    return out;
  });
  // Treffer-Reaktion auf Panzer & Wrack-Arm (echte Arena)
  const w = await page.evaluate(async () => {
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    const { getBossPose } = await import('/src/dungeon/anim/bossAnims.ts');
    const g = new GameState(); g.saveLocked = true; g.sector1Cleared = true;
    const d = new DungeonScene(g, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    d.startRun(1); d.startFloor(3, false, 1); d.enterRoom(d.floor.bossKey, 'south');
    const boss = d.enemies.find((e) => e.kind === 'boss_leviathan'); const L = boss.levArena;
    const input = new InputManager(document.getElementById('game-canvas'));
    L.state = 'idle'; L.timer = 99; d.roomFade = 0; d.invulnTimer = 99;
    const out = {};
    const hitAt = (x, y, amt) => { d.getClosestEnemyHitPoint(boss, x, y); d.damageEnemy(boss, amt, 0, 1, 0, true, false); };
    const base = getBossPose('boss_leviathan', boss, d.time, d.playerX, d.playerY).torso.dy;
    hitAt(boss.x, boss.y - 10, 20); // Panzer
    out.armorKick = L.hitKick;
    d.update(0.02, input);
    out.armorPose = getBossPose('boss_leviathan', boss, d.time + 0.02, d.playerX, d.playerY).torso.dy - base;
    // Arm zerstören
    const arm = boss.levArms[0]; arm.state = 'grounded'; arm.x = boss.x - 37; arm.y = boss.y + 48; L.armHp[0] = 1;
    hitAt(arm.x, arm.y, 500);
    out.armKick = L.armKick[0];
    out.dead = arm.dead;
    out.wrecks = (d.currentRoom.levWrecks || []).length;
    for (let i = 0; i < 90; i++) { d.invulnTimer = 99; d.update(1 / 60, input); }
    const wr = d.currentRoom.levWrecks[0];
    out.landed = Math.abs(wr.x - (boss.x - 78)) < 4 && wr.y > boss.y + 40;
    return out;
  });
  assert.ok(w.armorKick > 0.4, 'Panzer-Treffer löst Rückstoß aus');
  assert.ok(Math.abs(w.armorPose) > 0.3, 'Rückstoß verschiebt den Torso sichtbar: ' + w.armorPose);
  assert.ok(w.dead && w.wrecks === 1 && w.landed, 'abgerissener Arm bleibt als Wrack liegen ' + JSON.stringify(w));
  assert.deepStrictEqual(r.sprites, [], 'Rig-Teile geladen: ' + r.sprites.join(','));
  assert.deepStrictEqual(r.fx, [], 'FX-Sprites geladen: ' + r.fx.join(','));
  assert.deepStrictEqual(r.stages, [0, 4, 5, 1, 6, 7, 2], 'Beschädigungsstufen nach HP: ' + JSON.stringify(r.stages));
  for (const [k, v] of Object.entries(r.moveDiff)) assert.ok(v > 1, `Zug ${k}: eigene Arm-Pose (Diff ${v})`);
  assert.ok(r.trans[0] === 1 || r.trans[0] === 6, 'Phasenwechsel: Arme aufgerissen ' + r.trans[0]);
  assert.ok(r.trans[1], 'Phasenwechsel: Kopf legt sich zurück (Brüllen)');
  assert.ok(r.idleSpread[0] > 0.2 && r.idleSpread[1] < -0.2, 'Ruhe: Arme gespreizt ' + JSON.stringify(r.idleSpread));
  assert.deepStrictEqual(r.stump.slice(0, 2), [8, false], 'zerstörter Arm bleibt als Stumpf sichtbar');
  assert.ok(r.stump[2], 'verbliebener Arm intakt');
  assert.strictEqual(r.blocks, 4, 'Phase-II-Abgrund: 4 kleine Gruben');
  console.log('M12 LEVIATHAN POLITUR OK');
};
