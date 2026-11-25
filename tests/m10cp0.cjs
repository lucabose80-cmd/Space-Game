module.exports = async ({ page }) => {
  const out = await page.evaluate(async () => {
    const b = await import('/src/data/balance.ts');
    return {
      sell: b.SELL_PRICE_MULT, bounty: b.BOUNTY_REWARD_MULT, steps: [...b.EARLY_TIER_DAMAGE_STEPS],
      hp: b.RIFT_SCALING.hpFactor(4, 3), dmg: b.RIFT_SCALING.damageFactor(1, 1), waves: [b.RIFT_SCALING.waves(1), b.RIFT_SCALING.waves(3)],
    };
  });
  const assert = require('node:assert');
  assert.strictEqual(out.sell, 0.65);
  assert.deepStrictEqual(out.steps, [1.0, 1.2, 1.4, 1.6]);
  assert.ok(Math.abs(out.hp - 3.15) < 1e-9);
  assert.ok(Math.abs(out.dmg - 1.3) < 1e-9);
  assert.deepStrictEqual(out.waves, [2, 3]);
  const { execFileSync } = require('node:child_process');
  const txt = execFileSync('node', [require('node:path').join(__dirname, '..', 'scripts', 'check-sprites.mjs')], { encoding: 'utf8' });
  assert.ok(/(\d+) Sprite\(s\) fehlen/.test(txt) && txt.includes("boss_scrap_collector.png") && txt.includes("prop_hub_crystal_lantern.png"), txt);
  console.log('M10C PHASE0 OK');
};
