// Usage: node harness.cjs <testfile.cjs>   (testfile exports async (ctx)=>{})
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const REPO = path.resolve(__dirname, '..');
const PORT = 4197;
(async () => {
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { cwd: REPO, stdio: 'pipe' });
  let ready = false;
  vite.stdout.on('data', (d) => { if (String(d).includes('Local')) ready = true; });
  for (let i = 0; i < 100 && !ready; i++) await new Promise((r) => setTimeout(r, 100));
  const browser = await chromium.launch();
  const errors = [];
  let code = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|firestore|googleapis|net::ERR|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForFunction(() => document.styleSheets.length > 0);
    await page.evaluate(async () => { const { preloadHDArt } = await import('/src/assets/artLoader.ts'); await preloadHDArt(); });
    const test = require(path.resolve(process.argv[2]));
    const scratch = path.join(__dirname, 'out'); require('node:fs').mkdirSync(scratch, { recursive: true });
    await test({ page, browser, scratch, PORT });
  } catch (e) { console.error('TEST FAILED:', e); code = 1; }
  if (errors.length) { console.error('RUNTIME ERRORS:\n' + errors.join('\n')); code = 1; }
  await browser.close(); vite.kill();
  process.exit(code);
})();
