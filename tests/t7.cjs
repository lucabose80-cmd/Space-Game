// Polish Teil 1: Hintergrund-Pause (Musik), Geräte-Einstellungen Wackeln/Vibration, Flush ohne Timer.
module.exports = async ({ page }) => {
  const assert = require('node:assert');
  const r = await page.evaluate(async () => {
    const { sound } = await import('/src/engine/audio.ts');
    const dev = await import('/src/systems/deviceSettings.ts');
    const { firebaseService: f } = await import('/src/services/firebaseService.ts');
    const out = {};
    sound.unlock();
    out.runningBefore = sound['musicTimer'] !== null;
    sound.suspendForBackground();
    out.pausedTimer = sound['musicTimer'] === null;
    sound.resumeFromBackground();
    out.resumedTimer = sound['musicTimer'] !== null;
    sound.suspendForBackground(); // aufräumen
    // flushAutoSync ohne ausstehenden Timer: kein Fehler
    f.flushAutoSync({});
    out.flushOk = true;
    // Einstellungen
    localStorage.removeItem(dev.DEVICE_SETTINGS_KEY); dev.resetDeviceSettingsCacheForTest();
    out.defShake = dev.getDeviceSettings().screenShake; out.defVibe = dev.getDeviceSettings().vibration;
    out.fFull = dev.shakeFactor();
    dev.saveDeviceSettings({ screenShake: 'low' }); out.fLow = dev.shakeFactor();
    dev.saveDeviceSettings({ screenShake: 'off' }); out.fOff = dev.shakeFactor();
    out.bad = dev.sanitizeDeviceSettings({ screenShake: 'wild', vibration: 'ja' });
    // haptic: ohne Touch-Gerät kein Aufruf, kein Fehler
    const { haptic } = await import('/src/systems/haptics.ts');
    haptic(10); out.hapticOk = true;
    localStorage.removeItem(dev.DEVICE_SETTINGS_KEY); dev.resetDeviceSettingsCacheForTest();
    return out;
  });
  assert.ok(r.pausedTimer && r.resumedTimer && r.flushOk && r.hapticOk, JSON.stringify(r));
  assert.strictEqual(r.defShake, 'full'); assert.strictEqual(r.defVibe, true);
  assert.strictEqual(r.fFull, 1); assert.strictEqual(r.fLow, 0.35); assert.strictEqual(r.fOff, 0);
  assert.strictEqual(r.bad.screenShake, 'full'); assert.strictEqual(r.bad.vibration, true);
  console.log('T7 POLISH TEIL 1 OK');
};
