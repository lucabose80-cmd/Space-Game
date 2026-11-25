import { ITEMS } from '../data/items';
import type { CompanionId, WeaponId } from '../types';
import { flipCanvasHorizontal, makeFlashSilhouette } from './pixelArt';

export interface HDArtAssets {
  loaded: boolean;
  shopBg: HTMLImageElement | null;
  shopBgT2: HTMLImageElement | null;
  shopBgT3: HTMLImageElement | null;
  backroomBg: HTMLImageElement | null;
  hubBg: HTMLImageElement | null;
  hangarBg: HTMLImageElement | null;
  dungeonBg: HTMLImageElement | null;
  dungeonBgS2: HTMLImageElement | null;
  dungeonBgS3: HTMLImageElement | null;
  dungeonBgS4: HTMLImageElement | null;

  heroDown: HTMLCanvasElement | null;
  heroUp: HTMLCanvasElement | null;
  heroRight: HTMLCanvasElement | null;
  heroLeft: HTMLCanvasElement | null;
  heroFlash: HTMLCanvasElement | null;

  customers: HTMLCanvasElement[];
  custThief: HTMLCanvasElement | null;
  npcKael: HTMLCanvasElement | null;
  npcLyra: HTMLCanvasElement | null;
  npcVex: HTMLCanvasElement | null;
  npcNyx: HTMLCanvasElement | null;
  npcWanderer: HTMLCanvasElement | null;

  weapons: Record<WeaponId, HTMLCanvasElement | null>;
  weaponUrls: Record<WeaponId, string>;
  companions: Record<CompanionId, HTMLCanvasElement | null>;
  companionUrls: Record<CompanionId, string>;
  botClerk: HTMLCanvasElement | null;
  shipCorvette: HTMLCanvasElement | null;
  shipCrystal: HTMLCanvasElement | null;
  shipSolar: HTMLCanvasElement | null;
  shipMonolith: HTMLCanvasElement | null;

  pedestal: HTMLCanvasElement | null;
  propSaleBox: HTMLCanvasElement | null;
  propSleepPod: HTMLCanvasElement | null;
  propBackroomDoor: HTMLCanvasElement | null;
  propTechKiosk: HTMLCanvasElement | null;
  propNyxStall: HTMLCanvasElement | null;
  propJukebox: HTMLCanvasElement | null;
  propBotDock: HTMLCanvasElement | null;
  propTrophyS1: HTMLCanvasElement | null;
  podIntact: HTMLCanvasElement | null;
  chestClosed: HTMLCanvasElement | null;
  chestOpen: HTMLCanvasElement | null;

  slime: HTMLCanvasElement | null;
  slimeFlash: HTMLCanvasElement | null;
  drone: HTMLCanvasElement | null;
  droneFlash: HTMLCanvasElement | null;
  droneArc: HTMLCanvasElement | null;
  droneArcFlash: HTMLCanvasElement | null;
  slimeMagma: HTMLCanvasElement | null;
  slimeMagmaFlash: HTMLCanvasElement | null;
  phaseStalker: HTMLCanvasElement | null;
  phaseStalkerFlash: HTMLCanvasElement | null;
  shieldDrone: HTMLCanvasElement | null;
  shieldDroneFlash: HTMLCanvasElement | null;
  sporeSpitter: HTMLCanvasElement | null;
  sporeSpitterFlash: HTMLCanvasElement | null;
  turret0: HTMLCanvasElement | null;
  turret1: HTMLCanvasElement | null;
  turretFlash: HTMLCanvasElement | null;
  bossBreacher: HTMLCanvasElement | null;
  bossBreacherFlash: HTMLCanvasElement | null;
  boss: HTMLCanvasElement | null;
  bossFlash: HTMLCanvasElement | null;
  // Sector 2 Crystal Nebula Enemies & Prisma-Archon Boss
  crystalCrawler: HTMLCanvasElement | null;
  crystalCrawlerFlash: HTMLCanvasElement | null;
  prismDrone: HTMLCanvasElement | null;
  prismDroneFlash: HTMLCanvasElement | null;
  shardSniper: HTMLCanvasElement | null;
  shardSniperFlash: HTMLCanvasElement | null;
  voidCrawler: HTMLCanvasElement | null;
  voidCrawlerFlash: HTMLCanvasElement | null;
  resonanceWarden: HTMLCanvasElement | null;
  resonanceWardenFlash: HTMLCanvasElement | null;
  bossPrismaArchon: HTMLCanvasElement | null;
  bossPrismaArchonFlash: HTMLCanvasElement | null;
  // Sector 3 Solar Foundry Enemies & Vulkan-Titan Boss
  slagBeetle: HTMLCanvasElement | null;
  slagBeetleFlash: HTMLCanvasElement | null;
  solarDrone: HTMLCanvasElement | null;
  solarDroneFlash: HTMLCanvasElement | null;
  magmaMortar: HTMLCanvasElement | null;
  magmaMortarFlash: HTMLCanvasElement | null;
  emberStalker: HTMLCanvasElement | null;
  emberStalkerFlash: HTMLCanvasElement | null;
  forgeGolem: HTMLCanvasElement | null;
  forgeGolemFlash: HTMLCanvasElement | null;
  bossVulkanTitan: HTMLCanvasElement | null;
  bossVulkanTitanFlash: HTMLCanvasElement | null;
  // Sector 4 Elder Monolith Enemies & Star-Archon Final Boss
  astralScarab: HTMLCanvasElement | null;
  astralScarabFlash: HTMLCanvasElement | null;
  chronoEye: HTMLCanvasElement | null;
  chronoEyeFlash: HTMLCanvasElement | null;
  starLancer: HTMLCanvasElement | null;
  starLancerFlash: HTMLCanvasElement | null;
  voidWraith: HTMLCanvasElement | null;
  voidWraithFlash: HTMLCanvasElement | null;
  monolithGuard: HTMLCanvasElement | null;
  monolithGuardFlash: HTMLCanvasElement | null;
  bossStarArchon: HTMLCanvasElement | null;
  bossStarArchonFlash: HTMLCanvasElement | null;

  items: Record<string, HTMLCanvasElement>;
  itemUrls: Record<string, string>;
}

const art: HDArtAssets = {
  loaded: false,
  shopBg: null,
  shopBgT2: null,
  shopBgT3: null,
  backroomBg: null,
  hubBg: null,
  hangarBg: null,
  dungeonBg: null,
  dungeonBgS2: null,
  dungeonBgS3: null,
  dungeonBgS4: null,
  heroDown: null,
  heroUp: null,
  heroRight: null,
  heroLeft: null,
  heroFlash: null,
  customers: [],
  custThief: null,
  npcKael: null,
  npcLyra: null,
  npcVex: null,
  npcNyx: null,
  npcWanderer: null,
  weapons: {
    blade: null,
    blaster: null,
    hammer: null,
    spear: null,
    fists: null,
    discus: null,
  },
  weaponUrls: {
    blade: '/art/sprites/weapon_blade.png',
    blaster: '/art/sprites/weapon_blaster.png',
    hammer: '/art/sprites/weapon_hammer.png',
    spear: '/art/sprites/weapon_spear.png',
    fists: '/art/sprites/weapon_fists.png',
    discus: '/art/sprites/weapon_discus.png',
  },
  companions: {
    puck: null,
    spark: null,
    luma: null,
    halo: null,
  },
  companionUrls: {
    puck: '/art/sprites/bot_puck.png',
    spark: '/art/sprites/bot_spark.png',
    luma: '/art/sprites/bot_luma.png',
    halo: '/art/sprites/bot_halo.png',
  },
  botClerk: null,
  shipCorvette: null,
  shipCrystal: null,
  shipSolar: null,
  shipMonolith: null,
  pedestal: null,
  propSaleBox: null,
  propSleepPod: null,
  propBackroomDoor: null,
  propTechKiosk: null,
  propNyxStall: null,
  propJukebox: null,
  propBotDock: null,
  propTrophyS1: null,
  podIntact: null,
  chestClosed: null,
  chestOpen: null,
  slime: null,
  slimeFlash: null,
  drone: null,
  droneFlash: null,
  droneArc: null,
  droneArcFlash: null,
  slimeMagma: null,
  slimeMagmaFlash: null,
  phaseStalker: null,
  phaseStalkerFlash: null,
  shieldDrone: null,
  shieldDroneFlash: null,
  sporeSpitter: null,
  sporeSpitterFlash: null,
  turret0: null,
  turret1: null,
  turretFlash: null,
  bossBreacher: null,
  bossBreacherFlash: null,
  boss: null,
  bossFlash: null,
  crystalCrawler: null,
  crystalCrawlerFlash: null,
  prismDrone: null,
  prismDroneFlash: null,
  shardSniper: null,
  shardSniperFlash: null,
  voidCrawler: null,
  voidCrawlerFlash: null,
  resonanceWarden: null,
  resonanceWardenFlash: null,
  bossPrismaArchon: null,
  bossPrismaArchonFlash: null,
  slagBeetle: null,
  slagBeetleFlash: null,
  solarDrone: null,
  solarDroneFlash: null,
  magmaMortar: null,
  magmaMortarFlash: null,
  emberStalker: null,
  emberStalkerFlash: null,
  forgeGolem: null,
  forgeGolemFlash: null,
  bossVulkanTitan: null,
  bossVulkanTitanFlash: null,
  astralScarab: null,
  astralScarabFlash: null,
  chronoEye: null,
  chronoEyeFlash: null,
  starLancer: null,
  starLancerFlash: null,
  voidWraith: null,
  voidWraithFlash: null,
  monolithGuard: null,
  monolithGuardFlash: null,
  bossStarArchon: null,
  bossStarArchonFlash: null,
  items: {},
  itemUrls: Object.fromEntries(ITEMS.map((i) => [i.id, `/art/sprites/item_${i.id}.png`])),
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function imgToCanvas(img: HTMLImageElement | null): HTMLCanvasElement | null {
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return c;
}

export function getHDArt(): HDArtAssets {
  return art;
}

export async function preloadHDArt(): Promise<HDArtAssets> {
  if (art.loaded) return art;

  const [
    shopBg,
    shopBgT2,
    shopBgT3,
    backroomBg,
    hubBg,
    hangarBg,
    dungeonBg,
    dungeonBgS2,
    heroDownImg,
    heroUpImg,
    heroRightImg,
    custHornedImg,
    custAstroImg,
    custGreenImg,
    custThiefImg,
    npcKaelImg,
    npcLyraImg,
    npcVexImg,
    npcNyxImg,
    npcWandererImg,
    weaponBladeImg,
    weaponBlasterImg,
    weaponHammerImg,
    weaponSpearImg,
    weaponFistsImg,
    weaponDiscusImg,
    botPuckImg,
    botSparkImg,
    botLumaImg,
    botHaloImg,
    botClerkImg,
    shipCorvetteImg,
    shipCrystalImg,
    pedestalImg,
    saleBoxImg,
    sleepPodImg,
    backroomDoorImg,
    techKioskImg,
    nyxStallImg,
    jukeboxImg,
    botDockImg,
    trophyS1Img,
    podImg,
    chestClosedImg,
    chestOpenImg,
    slimeImg,
    droneImg,
    droneArcImg,
    slimeMagmaImg,
    phaseStalkerImg,
    shieldDroneImg,
    sporeSpitterImg,
    turret0Img,
    turret1Img,
    bossBreacherImg,
    bossImg,
    crystalCrawlerImg,
    prismDroneImg,
    shardSniperImg,
    voidCrawlerImg,
    resonanceWardenImg,
    bossPrismaArchonImg,
    dungeonBgS3,
    dungeonBgS4,
    shipSolarImg,
    shipMonolithImg,
    slagBeetleImg,
    solarDroneImg,
    magmaMortarImg,
    emberStalkerImg,
    forgeGolemImg,
    bossVulkanTitanImg,
    astralScarabImg,
    chronoEyeImg,
    starLancerImg,
    voidWraithImg,
    monolithGuardImg,
    bossStarArchonImg,
    ...itemImgs
  ] = await Promise.all([
    loadImage('/art/shop_bg.png'),
    loadImage('/art/shop_bg_t2.png'),
    loadImage('/art/shop_bg_t3.png'),
    loadImage('/art/backroom_bg.png'),
    loadImage('/art/hub_bg.png'),
    loadImage('/art/hangar_bg.png'),
    loadImage('/art/dungeon_bg.png'),
    loadImage('/art/dungeon_bg_s2.png'),
    loadImage('/art/sprites/hero_down.png'),
    loadImage('/art/sprites/hero_up.png'),
    loadImage('/art/sprites/hero_right.png'),
    loadImage('/art/sprites/cust_horned.png'),
    loadImage('/art/sprites/cust_astro.png'),
    loadImage('/art/sprites/cust_green.png'),
    loadImage('/art/sprites/cust_thief.png'),
    loadImage('/art/sprites/npc_kael.png'),
    loadImage('/art/sprites/npc_lyra.png'),
    loadImage('/art/sprites/npc_vex.png'),
    loadImage('/art/sprites/npc_nyx.png'),
    loadImage('/art/sprites/npc_wanderer.png'),
    loadImage('/art/sprites/weapon_blade.png'),
    loadImage('/art/sprites/weapon_blaster.png'),
    loadImage('/art/sprites/weapon_hammer.png'),
    loadImage('/art/sprites/weapon_spear.png'),
    loadImage('/art/sprites/weapon_fists.png'),
    loadImage('/art/sprites/weapon_discus.png'),
    loadImage('/art/sprites/bot_puck.png'),
    loadImage('/art/sprites/bot_spark.png'),
    loadImage('/art/sprites/bot_luma.png'),
    loadImage('/art/sprites/bot_halo.png'),
    loadImage('/art/sprites/bot_clerk.png'),
    loadImage('/art/sprites/ship_corvette.png'),
    loadImage('/art/sprites/ship_crystal.png'),
    loadImage('/art/sprites/pedestal.png'),
    loadImage('/art/sprites/prop_salebox.png'),
    loadImage('/art/sprites/prop_sleep_pod.png'),
    loadImage('/art/sprites/prop_backroom_door.png'),
    loadImage('/art/sprites/prop_tech_kiosk.png'),
    loadImage('/art/sprites/prop_nyx_stall.png'),
    loadImage('/art/sprites/prop_jukebox.png'),
    loadImage('/art/sprites/prop_bot_dock.png'),
    loadImage('/art/sprites/prop_trophy_s1.png'),
    loadImage('/art/sprites/pod_intact.png'),
    loadImage('/art/sprites/chest_closed.png'),
    loadImage('/art/sprites/chest_open.png'),
    loadImage('/art/sprites/slime.png'),
    loadImage('/art/sprites/drone.png'),
    loadImage('/art/sprites/enemy_drone_arc.png'),
    loadImage('/art/sprites/enemy_slime_magma.png'),
    loadImage('/art/sprites/enemy_phase_stalker.png'),
    loadImage('/art/sprites/enemy_shield_drone.png'),
    loadImage('/art/sprites/enemy_spore_spitter.png'),
    loadImage('/art/sprites/turret_0.png'),
    loadImage('/art/sprites/turret_1.png'),
    loadImage('/art/sprites/boss_breacher.png'),
    loadImage('/art/sprites/boss.png'),
    loadImage('/art/sprites/enemy_crystal_crawler.png'),
    loadImage('/art/sprites/enemy_prism_drone.png'),
    loadImage('/art/sprites/enemy_shard_sniper.png'),
    loadImage('/art/sprites/enemy_void_crawler.png'),
    loadImage('/art/sprites/enemy_resonance_warden.png'),
    loadImage('/art/sprites/boss_prisma_archon.png'),
    loadImage('/art/dungeon_bg_s3.png'),
    loadImage('/art/dungeon_bg_s4.png'),
    loadImage('/art/sprites/ship_solar.png'),
    loadImage('/art/sprites/ship_monolith.png'),
    loadImage('/art/sprites/enemy_slag_beetle.png'),
    loadImage('/art/sprites/enemy_solar_drone.png'),
    loadImage('/art/sprites/enemy_magma_mortar.png'),
    loadImage('/art/sprites/enemy_ember_stalker.png'),
    loadImage('/art/sprites/enemy_forge_golem.png'),
    loadImage('/art/sprites/boss_vulkan_titan.png'),
    loadImage('/art/sprites/enemy_astral_scarab.png'),
    loadImage('/art/sprites/enemy_chrono_eye.png'),
    loadImage('/art/sprites/enemy_star_lancer.png'),
    loadImage('/art/sprites/enemy_void_wraith.png'),
    loadImage('/art/sprites/enemy_monolith_guard.png'),
    loadImage('/art/sprites/boss_star_archon.png'),
    ...ITEMS.map((item) => loadImage(`/art/sprites/item_${item.id}.png`)),
  ]);

  art.shopBg = shopBg;
  art.shopBgT2 = shopBgT2;
  art.shopBgT3 = shopBgT3;
  art.backroomBg = backroomBg;
  art.hubBg = hubBg;
  art.hangarBg = hangarBg;
  art.dungeonBg = dungeonBg;
  art.dungeonBgS2 = dungeonBgS2;
  art.dungeonBgS3 = dungeonBgS3;
  art.dungeonBgS4 = dungeonBgS4;

  art.heroDown = imgToCanvas(heroDownImg);
  art.heroUp = imgToCanvas(heroUpImg);
  art.heroRight = imgToCanvas(heroRightImg);
  art.heroLeft = art.heroRight ? flipCanvasHorizontal(art.heroRight) : null;
  art.heroFlash = art.heroDown ? makeFlashSilhouette(art.heroDown, '#ffffff') : null;

  art.customers = [custAstroImg, custHornedImg, custGreenImg]
    .map(imgToCanvas)
    .filter((c): c is HTMLCanvasElement => c !== null);
  art.custThief = imgToCanvas(custThiefImg);

  art.npcKael = imgToCanvas(npcKaelImg);
  art.npcLyra = imgToCanvas(npcLyraImg);
  art.npcVex = imgToCanvas(npcVexImg);
  art.npcNyx = imgToCanvas(npcNyxImg);
  art.npcWanderer = imgToCanvas(npcWandererImg);

  art.weapons.blade = imgToCanvas(weaponBladeImg);
  art.weapons.blaster = imgToCanvas(weaponBlasterImg);
  art.weapons.hammer = imgToCanvas(weaponHammerImg);
  art.weapons.spear = imgToCanvas(weaponSpearImg);
  art.weapons.fists = imgToCanvas(weaponFistsImg);
  art.weapons.discus = imgToCanvas(weaponDiscusImg);

  art.companions.puck = imgToCanvas(botPuckImg);
  art.companions.spark = imgToCanvas(botSparkImg);
  art.companions.luma = imgToCanvas(botLumaImg);
  art.companions.halo = imgToCanvas(botHaloImg);
  art.botClerk = imgToCanvas(botClerkImg);
  art.shipCorvette = imgToCanvas(shipCorvetteImg);
  art.shipCrystal = imgToCanvas(shipCrystalImg);
  art.shipSolar = imgToCanvas(shipSolarImg);
  art.shipMonolith = imgToCanvas(shipMonolithImg);

  art.pedestal = imgToCanvas(pedestalImg);
  art.propSaleBox = imgToCanvas(saleBoxImg);
  art.propSleepPod = imgToCanvas(sleepPodImg);
  art.propBackroomDoor = imgToCanvas(backroomDoorImg);
  art.propTechKiosk = imgToCanvas(techKioskImg);
  art.propNyxStall = imgToCanvas(nyxStallImg);
  art.propJukebox = imgToCanvas(jukeboxImg);
  art.propBotDock = imgToCanvas(botDockImg);
  art.propTrophyS1 = imgToCanvas(trophyS1Img);
  art.podIntact = imgToCanvas(podImg);
  art.chestClosed = imgToCanvas(chestClosedImg);
  art.chestOpen = imgToCanvas(chestOpenImg);

  art.slime = imgToCanvas(slimeImg);
  art.slimeFlash = art.slime ? makeFlashSilhouette(art.slime, '#ffffff') : null;
  art.drone = imgToCanvas(droneImg);
  art.droneFlash = art.drone ? makeFlashSilhouette(art.drone, '#ffffff') : null;
  art.droneArc = imgToCanvas(droneArcImg);
  art.droneArcFlash = art.droneArc ? makeFlashSilhouette(art.droneArc, '#ffffff') : null;
  art.slimeMagma = imgToCanvas(slimeMagmaImg);
  art.slimeMagmaFlash = art.slimeMagma ? makeFlashSilhouette(art.slimeMagma, '#ffffff') : null;
  art.phaseStalker = imgToCanvas(phaseStalkerImg);
  art.phaseStalkerFlash = art.phaseStalker ? makeFlashSilhouette(art.phaseStalker, '#ffffff') : null;
  art.shieldDrone = imgToCanvas(shieldDroneImg);
  art.shieldDroneFlash = art.shieldDrone ? makeFlashSilhouette(art.shieldDrone, '#ffffff') : null;
  art.sporeSpitter = imgToCanvas(sporeSpitterImg);
  art.sporeSpitterFlash = art.sporeSpitter ? makeFlashSilhouette(art.sporeSpitter, '#ffffff') : null;
  art.turret0 = imgToCanvas(turret0Img);
  art.turret1 = imgToCanvas(turret1Img);
  art.turretFlash = art.turret0 ? makeFlashSilhouette(art.turret0, '#ffffff') : null;
  art.bossBreacher = imgToCanvas(bossBreacherImg);
  art.bossBreacherFlash = art.bossBreacher ? makeFlashSilhouette(art.bossBreacher, '#ffffff') : null;
  art.boss = imgToCanvas(bossImg);
  art.bossFlash = art.boss ? makeFlashSilhouette(art.boss, '#ffffff') : null;

  art.crystalCrawler = imgToCanvas(crystalCrawlerImg);
  art.crystalCrawlerFlash = art.crystalCrawler ? makeFlashSilhouette(art.crystalCrawler, '#ffffff') : null;
  art.prismDrone = imgToCanvas(prismDroneImg);
  art.prismDroneFlash = art.prismDrone ? makeFlashSilhouette(art.prismDrone, '#ffffff') : null;
  art.shardSniper = imgToCanvas(shardSniperImg);
  art.shardSniperFlash = art.shardSniper ? makeFlashSilhouette(art.shardSniper, '#ffffff') : null;
  art.voidCrawler = imgToCanvas(voidCrawlerImg);
  art.voidCrawlerFlash = art.voidCrawler ? makeFlashSilhouette(art.voidCrawler, '#ffffff') : null;
  art.resonanceWarden = imgToCanvas(resonanceWardenImg);
  art.resonanceWardenFlash = art.resonanceWarden ? makeFlashSilhouette(art.resonanceWarden, '#ffffff') : null;
  art.bossPrismaArchon = imgToCanvas(bossPrismaArchonImg);
  art.bossPrismaArchonFlash = art.bossPrismaArchon ? makeFlashSilhouette(art.bossPrismaArchon, '#ffffff') : null;

  art.slagBeetle = imgToCanvas(slagBeetleImg);
  art.slagBeetleFlash = art.slagBeetle ? makeFlashSilhouette(art.slagBeetle, '#ffffff') : null;
  art.solarDrone = imgToCanvas(solarDroneImg);
  art.solarDroneFlash = art.solarDrone ? makeFlashSilhouette(art.solarDrone, '#ffffff') : null;
  art.magmaMortar = imgToCanvas(magmaMortarImg);
  art.magmaMortarFlash = art.magmaMortar ? makeFlashSilhouette(art.magmaMortar, '#ffffff') : null;
  art.emberStalker = imgToCanvas(emberStalkerImg);
  art.emberStalkerFlash = art.emberStalker ? makeFlashSilhouette(art.emberStalker, '#ffffff') : null;
  art.forgeGolem = imgToCanvas(forgeGolemImg);
  art.forgeGolemFlash = art.forgeGolem ? makeFlashSilhouette(art.forgeGolem, '#ffffff') : null;
  art.bossVulkanTitan = imgToCanvas(bossVulkanTitanImg);
  art.bossVulkanTitanFlash = art.bossVulkanTitan ? makeFlashSilhouette(art.bossVulkanTitan, '#ffffff') : null;

  art.astralScarab = imgToCanvas(astralScarabImg);
  art.astralScarabFlash = art.astralScarab ? makeFlashSilhouette(art.astralScarab, '#ffffff') : null;
  art.chronoEye = imgToCanvas(chronoEyeImg);
  art.chronoEyeFlash = art.chronoEye ? makeFlashSilhouette(art.chronoEye, '#ffffff') : null;
  art.starLancer = imgToCanvas(starLancerImg);
  art.starLancerFlash = art.starLancer ? makeFlashSilhouette(art.starLancer, '#ffffff') : null;
  art.voidWraith = imgToCanvas(voidWraithImg);
  art.voidWraithFlash = art.voidWraith ? makeFlashSilhouette(art.voidWraith, '#ffffff') : null;
  art.monolithGuard = imgToCanvas(monolithGuardImg);
  art.monolithGuardFlash = art.monolithGuard ? makeFlashSilhouette(art.monolithGuard, '#ffffff') : null;
  art.bossStarArchon = imgToCanvas(bossStarArchonImg);
  art.bossStarArchonFlash = art.bossStarArchon ? makeFlashSilhouette(art.bossStarArchon, '#ffffff') : null;

  ITEMS.forEach((item, idx) => {
    const c = imgToCanvas(itemImgs[idx] ?? null);
    if (c) art.items[item.id] = c;
  });

  art.loaded = true;
  return art;
}
