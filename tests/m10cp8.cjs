module.exports = async ({ page }) => {
  const assert = require('node:assert'); const fs = require('node:fs'); const path = require('node:path');
  const r = await page.evaluate(async () => {
    const bal = await import('/src/data/balance.ts');
    const up = await import('/src/data/upgrades.ts');
    const eco = await import('/src/systems/economy.ts');
    const items = await import('/src/data/items.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { DungeonScene } = await import('/src/scenes/DungeonScene.ts');
    const out = {};
    const zero = { blade: 0, spear: 0, fists: 0, discus: 0, blaster: 0, hammer: 0, suit: 0, stimpack: 0, bioRegen: 0, shopTier: 0, shopAura: 0, shopScanner: 0, shopAssistant: 0, modCrit: 0, modThruster: 0, modLuck: 0 };
    const W = ['blade', 'spear', 'fists', 'discus', 'blaster', 'hammer'];
    const stat = (w, lvl) => up.getPlayerCombatStats({ ...zero, [w]: lvl });
    const dmg = (w, lvl) => stat(w, lvl)[`${w}Damage`];
    const dps = (w, lvl) => dmg(w, lvl) / (w === 'blaster' ? stat(w, lvl).blasterCooldown : bal.WEAPON_AVG_COOLDOWN[w]);
    const avgDps = (lvl) => W.reduce((a, w) => a + dps(w, lvl), 0) / W.length;
    const avgDmg = (lvl) => W.reduce((a, w) => a + dmg(w, lvl), 0) / W.length;
    // 1) Abgeflachte frühe Schadensstufen
    out.blade = [0, 1, 2, 3, 4, 5].map((l) => dmg('blade', l));
    out.hammer = [0, 1, 2, 3, 4].map((l) => dmg('hammer', l));
    // 2) Boss-TTK
    out.ttk = {};
    for (const [k, hp] of Object.entries(bal.BOSS_HP)) { const ex = bal.BOSS_EXPECTED[k]; out.ttk[k] = { hp, level: ex.level, band: ex.band, ttk: +(hp / avgDps(ex.level)).toFixed(1) }; }
    // 3) Standard-Gegner: Treffer bis zum Tod (erwartete Ausrüstung je Sektor/Ebene)
    const gs = new GameState(); const dng = new DungeonScene(gs, { onReturnToHub() {}, onToast() {}, onHudDirty() {} }); dng.startRun(1);
    const levelFor = { '1-1': 1, '1-2': 2, '1-3': 3, '2-1': 4, '2-2': 4, '2-3': 5, '3-1': 6, '3-2': 6, '3-3': 6, '4-1': 7, '4-2': 7, '4-3': 7 };
    const kindsBy = { 1: ['slime', 'drone', 'turret', 'shield_drone', 'phase_stalker'], 2: ['crystal_crawler', 'prism_drone', 'shard_sniper', 'void_crawler'], 3: ['slag_beetle', 'solar_drone', 'magma_mortar', 'ember_stalker', 'forge_golem'], 4: ['astral_scarab', 'chrono_eye', 'star_lancer', 'void_wraith', 'monolith_guard'] };
    out.hits = {};
    for (const sec of [1, 2, 3, 4]) for (const fl of [1, 2, 3]) {
      dng.currentFloor = fl; const hits = [];
      for (const k of kindsBy[sec]) { dng.enemies.length = 0; dng.spawnEnemy(k, 200, 130); const e = dng.enemies[0]; hits.push(Math.ceil(e.maxHp / avgDmg(levelFor[`${sec}-${fl}`]))); }
      out.hits[`${sec}-${fl}`] = hits;
    }
    // 4) Ökonomie-Bericht
    const ref = ['scrap_coil', 'plasma_cell', 'star_compass', 'mk4_heart', 'amethyst_core', 'solar_core', 'celestial_matrix', 'archon_crown'].filter((id) => items.ITEMS.some((i) => i.id === id));
    const fresh = new GameState();
    out.economy = { sell: ref.map((id) => { const d = items.getItemDef(id); return { id, rarity: d.rarity, base: d.baseValue, fair: eco.getEffectiveFairPrice(id, fresh.codex[id]) }; }), tiers: {} };
    for (const t of up.UPGRADE_TRACKS.filter((t) => t.weaponId === 'blade')) out.economy.tiers[t.key] = t.tiers.slice(0, 5).map((x) => ({ level: x.level, cr: x.creditCost, mats: x.materials.map((m) => `${m.itemId}×${m.qty}`) }));
    const bs = []; for (let i = 0; i < 20; i++) bs.push(...new GameState().generateBounties().map((b) => b.rewardCredits));
    out.economy.bounty = { min: Math.min(...bs), max: Math.max(...bs), avg: Math.round(bs.reduce((a, b) => a + b, 0) / bs.length) };
    // 5) Preisfaktor
    const d = items.getItemDef('scrap_coil'); const c = fresh.codex.scrap_coil; out.priceRatio = eco.getEffectiveFairPrice('scrap_coil', c) / d.baseValue;
    // 6) Stufe-2-Material (E6b) & Label
    const bt = up.UPGRADE_TRACKS.find((t) => t.key === 'blade'); out.t1 = [bt.tiers[0].materials, bt.tiers[1].materials.map((m) => m.itemId), bt.tiers[0].statLabel];
    // 7) Fortschritts-Sperren
    const g = new GameState(); g.credits = 99999; for (const id of ['scrap_coil', 'alien_prism', 'drone_core', 'reactor_shard', 'star_compass', 'mk4_heart', 'aegis_plate', 'leviathan_core']) g.inventory.chest[0] = { itemId: id, qty: 99 };
    g.upgrades.blade = 2; g.deepestFloor = 1; out.lock3 = g.getWeaponTierLock('blade'); out.afford3 = g.canAffordUpgrade('blade');
    g.deepestFloor = 2; out.lock3b = g.getWeaponTierLock('blade');
    g.upgrades.blade = 3; out.lock4 = g.getWeaponTierLock('blade'); g.sector1Cleared = true; out.lock4b = g.getWeaponTierLock('blade');
    // 8) Altspielstand: Preise einmalig skalieren
    const old = new GameState(); old.codex.scrap_coil.maxFairPrice = 100; old.codex.scrap_coil.lastSetPrice = 100; old.pedestals[0].itemId = 'scrap_coil'; old.pedestals[0].qty = 1; old.pedestals[0].price = 100;
    const json = JSON.parse(old.exportSaveJson()); delete json.priceScaleV2; localStorage.setItem('starlighter_save_v2', JSON.stringify(json));
    const l1 = new GameState(); l1.load(); out.migrated = [l1.codex.scrap_coil.maxFairPrice, l1.codex.scrap_coil.lastSetPrice, l1.pedestals[0].price, l1.priceScaleV2];
    l1.save(); const l2 = new GameState(); l2.load(); out.notTwice = [l2.codex.scrap_coil.maxFairPrice, l2.pedestals[0].price];
    localStorage.removeItem('starlighter_save_v2');
    return out;
  });
  const dir = path.join(__dirname, 'out'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ttk.json'), JSON.stringify({ ttk: r.ttk, hits: r.hits }, null, 1));
  fs.writeFileSync(path.join(dir, 'economy.json'), JSON.stringify(r.economy, null, 1)); // Bericht, bricht nie ab
  console.log(JSON.stringify({ blade: r.blade, hammer: r.hammer, ttk: Object.fromEntries(Object.entries(r.ttk).map(([k, v]) => [k, v.ttk])), hits: r.hits, bounty: r.economy.bounty, ratio: r.priceRatio, t1: r.t1, locks: [r.lock3, r.afford3, r.lock3b, r.lock4, r.lock4b], migrated: r.migrated, notTwice: r.notTwice }));
  assert.deepStrictEqual(r.blade.slice(0, 5), [20, 24, 28, 32, 70]); assert.strictEqual(r.hammer[3], Math.round(34 * 1.6));
  for (const [k, v] of Object.entries(r.ttk)) assert.ok(v.ttk >= v.band[0] && v.ttk <= v.band[1], `${k}: TTK ${v.ttk}s außerhalb ${v.band}`);
  for (const [k, hits] of Object.entries(r.hits)) for (const h of hits) assert.ok(h >= 1 && h <= 5, `Standard-Gegner ${k}: ${h} Treffer`);
  assert.ok(r.priceRatio >= 0.55 && r.priceRatio <= 0.75, 'Preisfaktor ' + r.priceRatio);
  assert.ok(r.t1[0][0].qty === 3 && r.t1[1].includes('reactor_shard') && /24 → 28|20 → 24/.test(r.t1[2]), JSON.stringify(r.t1));
  assert.ok(r.lock3 && !r.afford3 && r.lock3b === null && r.lock4 && r.lock4b === null, 'Sperren');
  assert.deepStrictEqual(r.migrated, [65, 65, 65, true]); assert.deepStrictEqual(r.notTwice, [65, 65]);
  console.log('M10C PHASE8 OK');
};
