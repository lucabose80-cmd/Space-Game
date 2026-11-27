// M11 — Sektor-3-Gegner-Rigs (magma_mortar, slag_beetle, ember_stalker, forge_golem, solar_drone): G1–G10 + Screenshots.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const fs = require('node:fs');
  const path = require('node:path');
  const KINDS = ['magma_mortar', 'slag_beetle', 'ember_stalker', 'forge_golem', 'solar_drone'];

  const r = await page.evaluate(async (kinds) => {
    const anim = await import('/src/dungeon/anim/bossAnims.ts');
    const { getHDArt } = await import('/src/assets/artLoader.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { InputManager } = await import('/src/engine/input.ts');
    await new Promise((res) => setTimeout(res, 300));
    const h = requestAnimationFrame(() => {});
    for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);

    const art = getHDArt();
    const out = {};
    const mk = (kind, id, x = {}) =>
      Object.assign({ id, x: 100, vx: 0, vy: 0, chargeDirX: 1, flashTimer: 0, telegraphTimer: 0, chargeActive: 0, kind, hp: 10, maxHp: 10 }, x);
    const run = (kind, en, n = 40, t0 = 1) => {
      let pz;
      for (let i = 0; i < n; i++) pz = anim.getBossPose(kind, en, t0 + i * 0.016, 150, 0);
      return pz;
    };

    const dng = new DungeonScene(new GameState(), { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
    dng.startRun(3);
    const room = dng.currentRoom;
    room.pods.forEach((p) => (p.broken = true));
    room.chasms = [];
    room.obstacles = [];
    room.spawns = [];
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const input = new InputManager(canvas);
    const hash = () => Array.from(ctx.getImageData(380, 180, 220, 200).data).reduce((a, v, i) => (a + v * ((i % 97) + 1)) % 1000003, 0);
    const crop = () => {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = 400;
      const gx = c.getContext('2d');
      gx.imageSmoothingEnabled = false;
      gx.drawImage(canvas, 400, 180, 240, 200, 0, 0, 480, 400);
      return c.toDataURL('image/png');
    };

    let baseId = 70;
    for (const kind of kinds) {
      const id = baseId;
      baseId += 10;
      const loaded = !!art.rigs[kind];
      const idle = run(kind, mk(kind, id));
      const tele = run(kind, mk(kind, id + 1, { telegraphTimer: 0.3 }));
      const moveSet = new Set();
      const mover = mk(kind, id + 2, { vx: 50 });
      const movePart = kind === 'magma_mortar' ? 'legFL' : kind === 'slag_beetle' ? 'legAL' : kind === 'solar_drone' ? 'ringOut' : 'legR';
      for (let i = 0; i < 60; i++) moveSet.add(Math.round((anim.getBossPose(kind, mover, 2 + i * 0.02, 150, 0)[movePart]?.rot ?? 0) * 10));
      // Treffer-Zucken
      const hitEn = mk(kind, id + 3);
      run(kind, hitEn, 25, 5);
      hitEn.flashTimer = 0.1;
      const rootPart = kind === 'slag_beetle' ? 'body' : kind === 'solar_drone' ? 'core' : 'torso';
      let hitRot = 0;
      for (let i = 0; i < 4; i++) {
        const p = anim.getBossPose(kind, hitEn, 5.45 + i * 0.016, 150, 0);
        if (Math.abs(p[rootPart]?.rot ?? 0) > Math.abs(hitRot)) hitRot = p[rootPart]?.rot ?? 0;
      }
      hitEn.flashTimer = 0;
      let afterHit;
      for (let i = 1; i <= 20; i++) afterHit = anim.getBossPose(kind, hitEn, 5.55 + i * 0.016, 150, 0);

      // Renderer: Rig ≠ Fallback + Tod-Trümmer + Screenshot
      const snap = (teleT = 0) => {
        dng.enemies.length = 0;
        dng.playerX = 340;
        dng.playerY = 140;
        dng.invulnTimer = 999;
        dng.spawnEnemy(kind, 250, 130);
        const en = dng.enemies[0];
        en.hp = en.maxHp = 1e6;
        en.telegraphTimer = teleT;
        dng.time = 2;
        dng.roomFade = 0;
        dng.render(ctx, input);
        return hash();
      };
      const withRig = snap(0);
      const idleShot = crop();
      snap(0.28);
      const teleShot = crop();
      const keep = art.rigs[kind];
      art.rigs[kind] = null;
      const without = snap(0);
      art.rigs[kind] = keep;

      dng.enemies.length = 0;
      dng.spawnEnemy(kind, 250, 130);
      const en = dng.enemies[0];
      dng.time = 3;
      dng.roomFade = 0;
      dng.render(ctx, input);
      en.hp = 0;
      dng.onEnemyKilled(en);
      dng.time = 3.016;
      dng.render(ctx, input);
      dng.time = 3.25;
      dng.render(ctx, input);
      const debris = hash();
      dng.time = 5;
      dng.render(ctx, input);
      const after = hash();

      out[kind] = {
        loaded,
        moveCount: moveSet.size,
        idleHash: JSON.stringify(idle),
        teleHash: JSON.stringify(tele),
        hitRot,
        afterHitRot: afterHit[rootPart]?.rot ?? 0,
        withRig,
        without,
        debris,
        after,
        idleShot,
        teleShot,
      };
    }
    return out;
  }, KINDS);

  for (const kind of KINDS) {
    const k = r[kind];
    fs.writeFileSync(path.join(__dirname, 'out', `s3_${kind}_idle.png`), Buffer.from(k.idleShot.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(__dirname, 'out', `s3_${kind}_tele.png`), Buffer.from(k.teleShot.split(',')[1], 'base64'));
    assert.ok(k.loaded, `${kind}: Rig geladen`);
    assert.ok(k.moveCount > 3, `${kind}: Lauf-/Schwebe-Rhythmus aktiv (${k.moveCount})`);
    assert.notStrictEqual(k.idleHash, k.teleHash, `${kind}: Vorwarnung ≠ Ruhe`);
    assert.ok(Math.abs(k.hitRot) > 0.04 && Math.abs(k.afterHitRot) < 0.06, `${kind}: Treffer-Zucken kurz & klingt ab (${k.hitRot} → ${k.afterHitRot})`);
    assert.notStrictEqual(k.withRig, k.without, `${kind}: Rig ≠ Fallback`);
    assert.notStrictEqual(k.debris, k.after, `${kind}: Tod-Trümmer sichtbar & verschwinden`);
  }
  console.log('M11 SEKTOR-3 RIGS OK');
};
