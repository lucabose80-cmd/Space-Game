module.exports = async ({ page, scratch }) => {
  const r = await page.evaluate(async () => {
    const h = requestAnimationFrame(() => {}); for (let i = 1; i <= h + 20; i++) cancelAnimationFrame(i);
    document.getElementById('title-overlay')?.classList.add('hidden');
    const { ShopScene } = await import('/src/scenes/ShopScene.ts');
    const { GameState } = await import('/src/systems/gameState.ts');
    const { galacticNetwork } = await import('/src/services/galacticNetwork.ts');
    const gs = new GameState();
    const cb = new Proxy({}, { get: () => () => {} });
    const toasts = [];
    cb.onToast = (m) => toasts.push(m);
    const shop = new ShopScene(gs, cb);
    shop.onEnter('default');
    gs.pedestals[0].itemId = 'scrap_coil'; gs.pedestals[0].qty = 5; gs.pedestals[0].price = 40;
    const out = {};
    // offline: no ghosts
    galacticNetwork.setGhostPoolForTest(null);
    shop.spawnCustomer = shop.spawnCustomer.bind(shop);
    const orig = Math.random;
    shop.customers = [];
    Math.random = () => 0.9; // no thief/patron/vip/ghost
    shop.spawnCustomer(true);
    Math.random = orig;
    out.offlineGhosts = shop.customers.filter((c) => c.ghost).length;
    shop.customers = [];
    // with pool
    galacticNetwork.setGhostPoolForTest([
      { uid: 'g1', name: 'Kapitän Nova', suitTheme: 'solar', greeting: 'Schöne Podeste!', ngPlusLevel: 1 },
      { uid: 'g2', name: 'Ein sehr langer Name hier', suitTheme: 'elder', greeting: 'Hi', ngPlusLevel: 0 },
    ]);
    Math.random = () => 0.9;
    shop.spawnCustomer(true);
    Math.random = orig;
    const gc = shop.customers.find((c) => c.ghost);
    out.ghostSpawned = !!gc;
    out.toast = toasts.at(-1);
    // second ghost same time blocked
    Math.random = () => 0.9; shop.spawnCustomer(true); Math.random = orig;
    out.onlyOneGhost = shop.customers.filter((c) => c.ghost).length === 1;
    // checkout comparison
    gc.carriedItemId = 'scrap_coil'; gc.carriedPrice = 100; gc.state = 'waiting_checkout';
    const c0 = gs.credits;
    shop.checkoutCustomer(gc, false);
    const ghostGain = gs.credits - c0;
    out.haggleEligible = shop.isHaggleEligible({ ...gc, carriedItemId: 'scrap_coil' });
    shop.customers = [];
    Math.random = () => 0.9; shop.spawnCustomer(false); Math.random = orig;
    const nc = shop.customers[0];
    out.normalHasGhost = !!nc.ghost;
    nc.carriedItemId = 'scrap_coil'; nc.carriedPrice = 100; nc.state = 'waiting_checkout';
    const c1 = gs.credits;
    shop.checkoutCustomer(nc, false);
    const normalGain = gs.credits - c1;
    out.ghostGain = ghostGain; out.normalGain = normalGain;
    // shift uniqueness: exclude g1 now → only g2 can appear
    const p = galacticNetwork.pickGhostCaptain(null, new Set(['g1']));
    out.excl = p?.uid;
    // render
    shop.customers = [];
    Math.random = () => 0.9; shop.spawnCustomer(true); Math.random = orig;
    const g = shop.customers[0];
    g.x = 330; g.y = 168; g.state = 'browsing'; g.stateTimer = 99;
    const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    shop.render(ctx);
    out.ghostName = g.ghost?.name;
    return out;
  });
  console.log(JSON.stringify(r));
  await page.locator('#game-canvas').screenshot({ path: `${scratch}/p3_shop.png` });
  const ok = r.offlineGhosts === 0 && r.ghostSpawned && r.onlyOneGhost && !r.haggleEligible && !r.normalHasGhost && r.normalGain === 100 && r.ghostGain === 110;
  if (!ok) throw new Error('P3 assert failed');
  console.log('PHASE3 OK');
};
