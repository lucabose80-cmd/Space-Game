// Misst im Rig-Koordinatensystem (Ursprung = e.x,e.y): Faust-Unterkante/-Mitte je Pose, Schulter, Linse. Nur Diagnose.
const { chromium } = require('playwright');
const { ping, startVite } = require('../tests/harness.cjs');
(async () => {
  const port = 5199; const up = await ping(`http://127.0.0.1:${port}/`); const server = up ? null : await startVite(port);
  const b = await chromium.launch(); const page = await b.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/?bosslab=1`);
    await page.waitForFunction(() => window.__game && document.getElementById('boss-lab'));
    await page.waitForFunction(async () => !!(await import('/src/assets/artLoader.ts')).getHDArt().rigs.boss_leviathan, null, { timeout: 30000 });
    const out = await page.evaluate(async () => {
      const { getHDArt } = await import('/src/assets/artLoader.ts');
      const { drawRig } = await import('/src/engine/rig.ts');
      const { RIGS } = await import('/src/data/rigs.ts');
      const art = getHDArt(); const R = RIGS.boss_leviathan; const imgs = art.rigs.boss_leviathan;
      const measure = (pose) => {
        const cv = document.createElement('canvas'); cv.width = 800; cv.height = 800; const c = cv.getContext('2d');
        c.translate(200, 200); // Ursprung bei (200,200) logisch-px; Faktor 1
        drawRig(c, R, imgs, 0, 0, pose, {});
        const d = c.getImageData(0, 0, 800, 800).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let y = 0; y < 800; y++) for (let x = 0; x < 800; x++) if (d[(y * 800 + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        return { l: x0 - 200, r: x1 - 200, t: y0 - 200, b: y1 - 200 };
      };
      const hidden = { hidden: true }; const r = {};
      const base = { carriage: hidden, torso: { dx: 0, dy: 0, rot: 0, variant: 0 }, head: { dx: 0, dy: 0, rot: 0 } };
      r.torso = measure({ ...base, head: hidden, armL: hidden, armR: hidden });
      r.head = measure({ ...base, armL: hidden, armR: hidden, torso: hidden });
      for (const [n, v, extra] of [['idle', 0, {}], ['raise', 1, {}], ['slam', 2, { dy: 2 }]]) {
        r['armL_' + n] = measure({ ...base, torso: hidden, head: hidden, armR: hidden, armL: { rot: 0, variant: v, ...extra } });
        r['armR_' + n] = measure({ ...base, torso: hidden, head: hidden, armL: hidden, armR: { rot: 0, variant: v, ...extra } });
      }
      {
        const cv = document.createElement('canvas'); cv.width = 800; cv.height = 800; const c = cv.getContext('2d'); c.translate(200, 200);
        drawRig(c, R, imgs, 0, 0, { ...base, head: hidden, armL: hidden, armR: hidden }, {});
        const d = c.getImageData(0, 0, 800, 800).data; let sx = 0, sy = 0, n = 0;
        for (let y = 0; y < 800; y++) for (let x = 0; x < 800; x++) { const i = (y * 800 + x) * 4; if (d[i + 3] > 200 && d[i] < 90 && d[i + 1] > 170 && d[i + 2] > 170) { sx += x; sy += y; n++; } }
        r.lens = { x: sx / n - 200, y: sy / n - 200, n };
      }
      return r;
    });
    console.log(JSON.stringify(out, null, 1));
  } finally { await b.close(); if (server) server.stop(); }
})();
