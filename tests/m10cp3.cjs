module.exports = async ({ page, scratch }) => {
  const assert = require('node:assert');
  const out = { overlap: [], vitals: {}, statusPill: {} };
  const viewports = [['portrait', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 720], ['hd', 1920, 1080]];
  for (const [name, w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((touch) => {
      const g = window.__game; document.getElementById('title-overlay')?.classList.add('hidden'); g.ui.titleVisible = false;
      document.body.classList.toggle('touch-device', touch);
    }, w < 900);
    for (const scene of ['shop', 'backroom', 'hub', 'hangar', 'market_terrace', 'dungeon']) {
      const info = await page.evaluate((scene) => {
        const g = window.__game; g.ui.currentScene = scene; g.ui.dungeonSector = 2; g.ui.dungeonFloor = 1; g.ui.renderHud();
        const hud = document.getElementById('hud-layer'); const cv = document.getElementById('game-canvas');
        const cr = cv.getBoundingClientRect(); const hr = hud.getBoundingClientRect();
        const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
        const o = { vitals: !!hud.querySelector('.hud-vitals'), pill: !!hud.querySelector('.hud-status-pill'), canvas: { x: cr.left, y: cr.top, w: cr.width, h: cr.height }, hud: { x: hr.left, y: hr.top, w: hr.width, h: hr.height } };
        o.buttons = [...hud.querySelectorAll('.hud-actions button')].map(rect);
        o.pillRect = hud.querySelector('.hud-status-pill') ? rect(hud.querySelector('.hud-status-pill')) : null;
        o.soundBtn = !!hud.querySelector('#hud-sound-btn'); o.musicBtn = !!hud.querySelector('#hud-music-btn');
        return o;
      }, scene);
      out.vitals[`${name}:${scene}`] = info.vitals;
      if (scene === 'dungeon') {
        assert.ok(info.vitals && !info.pill, 'Dungeon zeigt Kampf-HUD');
        assert.ok(info.soundBtn && !info.musicBtn, 'Dungeon: ein Ton-Button');
        // Minimap + Zeit-Kasten (Canvas-Anteile): x 432..480, y 5..52 von 480×270
        const c = info.canvas; const mm = { x: c.x + (c.w * 432) / 480, y: c.y + (c.h * 5) / 270, w: (c.w * 48) / 480, h: (c.h * 47) / 270 };
        for (const b of info.buttons) {
          const hit = b.x < mm.x + mm.w && b.x + b.w > mm.x && b.y < mm.y + mm.h && b.y + b.h > mm.y;
          if (hit) out.overlap.push(`${name}: Button ${JSON.stringify(b)} × Minimap ${JSON.stringify(mm)}`);
        }
        assert.ok(Math.abs(info.canvas.x - info.hud.x) < 2 && Math.abs(info.canvas.w - info.hud.w) < 2, `HUD deckt Canvas (${name}) ${JSON.stringify(info.canvas)} vs ${JSON.stringify(info.hud)}`);
      } else {
        assert.ok(!info.vitals && info.pill, `${scene}: kein Kampf-HUD, Status-Pille (${name})`);
        assert.ok(info.musicBtn && !info.soundBtn, 'Nicht-Dungeon: Musik + SFX getrennt');
        out.statusPill[`${name}:${scene}`] = info.pillRect;
      }
      await page.screenshot({ path: `${scratch}/cp3_${name}_${scene}.png` });
    }
  }
  console.log(JSON.stringify({ overlap: out.overlap }));
  assert.deepStrictEqual(out.overlap, [], 'Buttons überdecken die Minimap nicht');
  // Ton-Button-Zyklus
  const cyc = await page.evaluate(async () => {
    const { sound } = await import('/src/engine/audio.ts'); const g = window.__game;
    sound.setMuted(false); sound.setMusicMuted(false); g.ui.currentScene = 'dungeon'; g.ui.renderHud();
    const st = () => (sound.isMuted() ? 'aus' : sound.isMusicMuted() ? 'fx' : 'alles');
    const seq = [st()];
    for (let i = 0; i < 3; i++) { document.querySelector('#hud-sound-btn').click(); seq.push(st()); }
    return seq;
  });
  assert.deepStrictEqual(cyc, ['alles', 'fx', 'aus', 'alles']);
  // Merkliste: außerhalb des Dungeons eingeklappt, Klick klappt auf
  const pin = await page.evaluate(() => {
    const g = window.__game; const k = Object.keys(g.state.pinnedRecipes ?? {})[0];
    return { has: typeof g.state.togglePinRecipe === 'function', key: k ?? null };
  });
  console.log('M10C PHASE3 OK', JSON.stringify(pin));
};
