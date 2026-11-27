// Usage: node harness.cjs <testfile.cjs>   (testfile exports async (ctx)=>{})
// Exportiert zudem startVite() und runTestInBrowser(), damit tests/run.cjs einen
// gemeinsamen Vite-Server + einen Chromium-Prozess mit isolierten BrowserContexts nutzt.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.TEST_PORT) || 4197;
const SCRATCH = path.join(__dirname, 'out');
const IGNORED_CONSOLE_RE = /favicon|firestore|googleapis|net::ERR|Failed to load resource/;

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function startVite(port = PORT) {
  const viteBin = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  const useNodeBin = fs.existsSync(viteBin);
  const cmd = useNodeBin ? process.execPath : 'npx';
  const args = useNodeBin
    ? [viteBin, '--port', String(port), '--host', '127.0.0.1', '--strictPort']
    : ['vite', '--port', String(port), '--host', '127.0.0.1', '--strictPort'];

  const vite = spawn(cmd, args, { cwd: REPO, stdio: 'pipe' });
  let stderr = '';
  vite.stderr.on('data', (d) => { stderr += String(d); });

  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    if (vite.exitCode !== null) break;
    ready = await ping(url);
    if (!ready) await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    vite.kill();
    throw new Error(`Vite-Dev-Server auf ${url} nicht gestartet${stderr ? ':\n' + stderr.slice(0, 600) : ''}`);
  }

  return {
    vite,
    stop() {
      if (vite.exitCode === null) vite.kill('SIGTERM');
    },
  };
}

async function runTestInBrowser(browser, testFile, opts = {}) {
  const port = opts.port || PORT;
  const scratch = opts.scratch || SCRATCH;
  const logStore = opts.logStore || null;
  fs.mkdirSync(scratch, { recursive: true });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const logs = [];
  let failure = null;

  const exec = async () => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED_CONSOLE_RE.test(m.text())) {
        errors.push('CONSOLE ' + m.text());
      }
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.styleSheets.length > 0);
    await page.evaluate(async () => {
      const { preloadHDArt } = await import('/src/assets/artLoader.ts');
      await preloadHDArt();
    });
    const test = require(path.resolve(testFile));
    await test({ page, browser, scratch, PORT: port });
  };

  try {
    if (logStore) await logStore.run(logs, exec);
    else await exec();
  } catch (e) {
    failure = e;
  } finally {
    await context.close().catch(() => {});
  }

  return { ok: !failure && errors.length === 0, logs, errors, failure };
}

module.exports = { PORT, SCRATCH, startVite, runTestInBrowser };

if (require.main === module) {
  (async () => {
    const server = await startVite(PORT);
    const browser = await chromium.launch();
    let code = 0;
    try {
      const res = await runTestInBrowser(browser, process.argv[2], { port: PORT, scratch: SCRATCH });
      if (res.failure) { console.error('TEST FAILED:', res.failure); code = 1; }
      if (res.errors.length) { console.error('RUNTIME ERRORS:\n' + res.errors.join('\n')); code = 1; }
    } finally {
      await browser.close().catch(() => {});
      server.stop();
    }
    process.exit(code);
  })();
}
