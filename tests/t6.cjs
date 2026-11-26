// C6.3: Firebase-SDK wird nach dem Start nachgeladen (eigener Chunk), Service-API bleibt gleich.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const { firebaseService: f } = await import('/src/services/firebaseService.ts');
    await f['ready'];
    return {
      configured: f.isConfigured(),
      sdkLoaded: !!f['sdk'] && typeof f['sdk'].initializeApp === 'function',
      hasAuth: !!f['auth'] && !!f['db'],
      status: f.syncStatus,
      user: f.currentUser,
    };
  });
  assert.ok(r.configured && r.sdkLoaded && r.hasAuth, JSON.stringify(r));
  assert.strictEqual(r.user, null);
  console.log('T6 FIREBASE LAZY OK');
};
