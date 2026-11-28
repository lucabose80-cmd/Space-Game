// Diagnose: Leviathan-Arena im Spiel rendern. node scripts/lev-shots.cjs [phase=1] [zug:sekunden ...]
//  z. B. node scripts/lev-shots.cjs 2 hammer:1.0 hammer:1.6 beam:1.4 steam:1.2 glow:1.5 whip:1.0 debris:1.3 → tests/out/lev_<phase>_<zug>_<sek>.png
const { chromium } = require('playwright');
const fs = require('fs');
const { ping, startVite } = require('../tests/harness.cjs');
const phase = Number(process.argv[2] || 1);
const shots = process.argv.slice(3).map((s) => { const [m, t] = s.split(':'); return [m, Number(t || 1)]; });
(async () => {
  const port = 5199; const up = await ping(`http://127.0.0.1:${port}/`); const server = up ? null : await startVite(port);
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.styleSheets.length > 0);
    await page.evaluate(async () => { const { preloadHDArt } = await import('/src/assets/artLoader.ts'); await preloadHDArt(); });
    for (const [mv, t] of shots) {
      const data = await page.evaluate(async ([mv, t, phase]) => {
        const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
        const { GameState } = await import('/src/systems/gameState.ts');
        const { InputManager } = await import('/src/engine/input.ts');
        const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
        const state = new GameState(); state.saveLocked = true;
        const dng = new DungeonScene(state, { onReturnToHub() {}, onToast() {}, onHudDirty() {} });
        dng.startRun(1); dng.startFloor(3, false, 1); dng.enterRoom(dng.floor.bossKey, 'south');
        const boss = dng.enemies.find((e) => e.kind === 'boss_leviathan'); const L = boss.levArena;
        const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
        const input = new InputManager(canvas);
        L.state = 'idle'; L.timer = 99; dng.roomFade = 0; dng.invulnTimer = 99;
        if (phase >= 2) { boss.hp = Math.round(boss.maxHp * (phase === 2 ? 0.55 : 0.2)); for (let i = 0; i < 60; i++) dng.update(0.05, input); }
        dng.playerX = dng.bounds.cx + (window.__px ?? 0); dng.playerY = dng.bounds.t + 110;
        L.state = 'idle'; L.timer = 99;
        const startMove = (await import('/src/dungeon/bosses/leviathanArena.ts')).startMoveForTest;
        if (!startMove) return null;
        if (mv === 'wreck') { boss.levArms[0].state = 'grounded'; boss.levArms[0].x = boss.x - 37; boss.levArms[0].y = boss.y + 48; L.armHp[0] = 1; dng.getClosestEnemyHitPoint(boss, boss.levArms[0].x, boss.levArms[0].y); dng.damageEnemy(boss, 999, 0, 1, 0, true, false); } else startMove(dng, boss, mv);
        for (let i = 0; i < Math.round(t / 0.02); i++) { dng.invulnTimer = 99; dng.update(0.02, input); }
        dng.camera.snap(dng.cameraTarget);
        dng.render(ctx, input);
        return canvas.toDataURL('image/png');
      }, [mv, t, phase]);
      if (!data) { console.log('startMoveForTest fehlt'); break; }
      const f = `tests/out/lev_p${phase}_${mv}_${t}.png`; fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64')); console.log('→', f);
    }
  } finally { await b.close(); if (server) server.stop(); }
})();
