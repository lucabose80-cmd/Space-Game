import { ITEMS } from '../data/items';
import type { WeaponId } from '../types';
import { flipCanvasHorizontal, makeFlashSilhouette } from './pixelArt';

export interface HDArtAssets {
  loaded: boolean;
  shopBg: HTMLImageElement | null;
  shopBgT2: HTMLImageElement | null;
  shopBgT3: HTMLImageElement | null;
  backroomBg: HTMLImageElement | null;
  hubBg: HTMLImageElement | null;
  dungeonBg: HTMLImageElement | null;

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
  npcWanderer: HTMLCanvasElement | null;

  weapons: Record<WeaponId, HTMLCanvasElement | null>;
  weaponUrls: Record<WeaponId, string>;

  pedestal: HTMLCanvasElement | null;
  propSaleBox: HTMLCanvasElement | null;
  propSleepPod: HTMLCanvasElement | null;
  propBackroomDoor: HTMLCanvasElement | null;
  propTechKiosk: HTMLCanvasElement | null;
  propTrophyS1: HTMLCanvasElement | null;
  podIntact: HTMLCanvasElement | null;
  chestClosed: HTMLCanvasElement | null;
  chestOpen: HTMLCanvasElement | null;

  slime: HTMLCanvasElement | null;
  slimeFlash: HTMLCanvasElement | null;
  drone: HTMLCanvasElement | null;
  droneFlash: HTMLCanvasElement | null;
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
  dungeonBg: null,
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
  npcWanderer: null,
  weapons: {
    blade: null,
    blaster: null,
    hammer: null,
    spear: null,
  },
  weaponUrls: {
    blade: '/art/sprites/weapon_blade.png',
    blaster: '/art/sprites/weapon_blaster.png',
    hammer: '/art/sprites/weapon_hammer.png',
    spear: '/art/sprites/weapon_spear.png',
  },
  pedestal: null,
  propSaleBox: null,
  propSleepPod: null,
  propBackroomDoor: null,
  propTechKiosk: null,
  propTrophyS1: null,
  podIntact: null,
  chestClosed: null,
  chestOpen: null,
  slime: null,
  slimeFlash: null,
  drone: null,
  droneFlash: null,
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
    dungeonBg,
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
    npcWandererImg,
    weaponBladeImg,
    weaponBlasterImg,
    weaponHammerImg,
    weaponSpearImg,
    pedestalImg,
    saleBoxImg,
    sleepPodImg,
    backroomDoorImg,
    techKioskImg,
    trophyS1Img,
    podImg,
    chestClosedImg,
    chestOpenImg,
    slimeImg,
    droneImg,
    shieldDroneImg,
    sporeSpitterImg,
    turret0Img,
    turret1Img,
    bossBreacherImg,
    bossImg,
    ...itemImgs
  ] = await Promise.all([
    loadImage('/art/shop_bg.png'),
    loadImage('/art/shop_bg_t2.png'),
    loadImage('/art/shop_bg_t3.png'),
    loadImage('/art/backroom_bg.png'),
    loadImage('/art/hub_bg.png'),
    loadImage('/art/dungeon_bg.png'),
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
    loadImage('/art/sprites/npc_wanderer.png'),
    loadImage('/art/sprites/weapon_blade.png'),
    loadImage('/art/sprites/weapon_blaster.png'),
    loadImage('/art/sprites/weapon_hammer.png'),
    loadImage('/art/sprites/weapon_spear.png'),
    loadImage('/art/sprites/pedestal.png'),
    loadImage('/art/sprites/prop_salebox.png'),
    loadImage('/art/sprites/prop_sleep_pod.png'),
    loadImage('/art/sprites/prop_backroom_door.png'),
    loadImage('/art/sprites/prop_tech_kiosk.png'),
    loadImage('/art/sprites/prop_trophy_s1.png'),
    loadImage('/art/sprites/pod_intact.png'),
    loadImage('/art/sprites/chest_closed.png'),
    loadImage('/art/sprites/chest_open.png'),
    loadImage('/art/sprites/slime.png'),
    loadImage('/art/sprites/drone.png'),
    loadImage('/art/sprites/enemy_shield_drone.png'),
    loadImage('/art/sprites/enemy_spore_spitter.png'),
    loadImage('/art/sprites/turret_0.png'),
    loadImage('/art/sprites/turret_1.png'),
    loadImage('/art/sprites/boss_breacher.png'),
    loadImage('/art/sprites/boss.png'),
    ...ITEMS.map((item) => loadImage(`/art/sprites/item_${item.id}.png`)),
  ]);

  art.shopBg = shopBg;
  art.shopBgT2 = shopBgT2;
  art.shopBgT3 = shopBgT3;
  art.backroomBg = backroomBg;
  art.hubBg = hubBg;
  art.dungeonBg = dungeonBg;

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
  art.npcWanderer = imgToCanvas(npcWandererImg);

  art.weapons.blade = imgToCanvas(weaponBladeImg);
  art.weapons.blaster = imgToCanvas(weaponBlasterImg);
  art.weapons.hammer = imgToCanvas(weaponHammerImg);
  art.weapons.spear = imgToCanvas(weaponSpearImg);

  art.pedestal = imgToCanvas(pedestalImg);
  art.propSaleBox = imgToCanvas(saleBoxImg);
  art.propSleepPod = imgToCanvas(sleepPodImg);
  art.propBackroomDoor = imgToCanvas(backroomDoorImg);
  art.propTechKiosk = imgToCanvas(techKioskImg);
  art.propTrophyS1 = imgToCanvas(trophyS1Img);
  art.podIntact = imgToCanvas(podImg);
  art.chestClosed = imgToCanvas(chestClosedImg);
  art.chestOpen = imgToCanvas(chestOpenImg);

  art.slime = imgToCanvas(slimeImg);
  art.slimeFlash = art.slime ? makeFlashSilhouette(art.slime, '#ffffff') : null;
  art.drone = imgToCanvas(droneImg);
  art.droneFlash = art.drone ? makeFlashSilhouette(art.drone, '#ffffff') : null;
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

  ITEMS.forEach((item, idx) => {
    const c = imgToCanvas(itemImgs[idx] ?? null);
    if (c) art.items[item.id] = c;
  });

  art.loaded = true;
  return art;
}
