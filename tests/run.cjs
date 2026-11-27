// Usage: node tests/run.cjs [name ...]   – ohne Argumente laufen alle Tests.
// Startet genau 1× Vite + 1× Chromium und führt Tests parallel in isolierten BrowserContexts aus
// (Worker-Anzahl per TEST_JOBS=N steuerbar, Standard: 3).
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');
const { chromium } = require('playwright');
const { PORT, SCRATCH, startVite, runTestInBrowser } = require('./harness.cjs');

const all = fs.readdirSync(__dirname)
  .filter((f) => /^(t\d|m\d+[a-z]?p).*\.cjs$/.test(f))
  .map((f) => f.replace('.cjs', ''))
  .sort();
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : all;

const defaultJobs = Math.min(3, Math.max(2, os.cpus().length));
const jobs = Math.min(names.length, Math.max(1, Number(process.env.TEST_JOBS) || defaultJobs));

const logStore = new AsyncLocalStorage();
const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);

console.log = (...args) => {
  const buf = logStore.getStore();
  if (buf) buf.push(util.format(...args));
  else origLog(...args);
};
console.error = (...args) => {
  const buf = logStore.getStore();
  if (buf) buf.push(util.format(...args));
  else origError(...args);
};
console.warn = (...args) => {
  const buf = logStore.getStore();
  if (buf) buf.push(util.format(...args));
  else origWarn(...args);
};

(async () => {
  const t0 = Date.now();
  const server = await startVite(PORT);
  const browser = await chromium.launch();
  const cleanup = async () => {
    await browser.close().catch(() => {});
    server.stop();
  };
  process.on('SIGINT', async () => { await cleanup(); process.exit(130); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });

  const results = new Array(names.length);
  let nextIdx = 0;

  async function worker(initialContext = null) {
    let ctx = initialContext;
    try {
      while (true) {
        const idx = nextIdx++;
        if (idx >= names.length) return;
        if (!ctx) ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const n = names[idx];
        const file = path.join(__dirname, n + '.cjs');
        const res = await runTestInBrowser(browser, file, { port: PORT, scratch: SCRATCH, logStore, context: ctx });
        results[idx] = { n, ...res };
        if (res.contextDirty) {
          await ctx.close().catch(() => {});
          ctx = null;
        }
      }
    } finally {
      if (ctx) await ctx.close().catch(() => {});
    }
  }

  try {
    // 1. Test allein als Vite-Warmup (kompiliert TS/Module einmalig vor und wärmt Context 0)
    let warmCtx = null;
    if (names.length > 1 && jobs > 1) {
      warmCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const first = names[0];
      nextIdx = 1;
      const res0 = await runTestInBrowser(browser, path.join(__dirname, first + '.cjs'), { port: PORT, scratch: SCRATCH, logStore, context: warmCtx });
      results[0] = { n: first, ...res0 };
      if (res0.contextDirty) {
        await warmCtx.close().catch(() => {});
        warmCtx = null;
      }
    }
    await Promise.all(Array.from({ length: jobs }, (_, wi) => worker(wi === 0 ? warmCtx : null)));

    // Zeitkritische Tests (z. B. rAF/Typewriter) bei Parallel-Last einmalig isoliert in frischem Context nachprüfen:
    // echte Fehler bleiben rot, reine Parallel-Timing-Flakes fallen sofort auf.
    if (jobs > 1) {
      for (let i = 0; i < results.length; i++) {
        if (!results[i].ok) {
          const n = results[i].n;
          const retry = await runTestInBrowser(browser, path.join(__dirname, n + '.cjs'), { port: PORT, scratch: SCRATCH, logStore });
          results[i] = { n, retried: true, ...retry };
        }
      }
    }
  } finally {
    await cleanup();
  }

  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      const last = r.logs.join('\n').trim().split('\n').pop() || '';
      origLog(`OK   ${r.n}${r.retried ? ' (solo-retry)' : ''} — ${last}`);
    } else {
      failed++;
      const details = [];
      if (r.failure) details.push('TEST FAILED: ' + (r.failure.stack || r.failure));
      if (r.errors.length) details.push('RUNTIME ERRORS:\n' + r.errors.join('\n'));
      if (!details.length && r.logs.length) details.push(r.logs.join('\n'));
      origLog(`FAIL ${r.n}\n${details.join('\n').split('\n').slice(0, 12).join('\n')}`);
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  origLog(failed ? `\n${failed} Test(s) fehlgeschlagen (${secs}s, ${jobs} Worker)` : `\nAlle ${names.length} Tests grün (${secs}s, ${jobs} Worker)`);
  process.exit(failed ? 1 : 0);
})();
