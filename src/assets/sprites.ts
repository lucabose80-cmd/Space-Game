import {
  compilePixelArt,
  flipCanvasHorizontal,
  makeFlashSilhouette,
  type Palette,
} from './pixelArt';

// Shared rich outline & sci-fi retro palette tokens
const BASE_PAL: Palette = {
  o: '#161423', // deep ink outline
  w: '#f8fafc', // crisp highlight white
  s: '#cbd5e1', // light steel
  m: '#64748b', // mid steel
  d: '#334155', // dark steel
  k: '#1e293b', // deep hull
  c: '#38e8d4', // bright cyan energy
  b: '#0ea5e9', // deep sky blue
  t: '#14b8a6', // teal mid
  a: '#fbbf24', // warm amber gold
  y: '#fde047', // bright solar yellow
  r: '#f97316', // retro space orange
  e: '#ea580c', // deep orange
  p: '#c084fc', // soft pastel lavender
  v: '#9333ea', // rich void violet
  g: '#4ade80', // lush biolum green
  l: '#15803d', // deep plant green
  h: '#fb7185', // coral/rose red
  n: '#9a5b32', // warm wood mid
  u: '#6b3b1e', // warm wood shadow
  f: '#f1c29b', // skin highlight
  z: '#d09168', // skin shadow
  x: '#92400e', // dark copper/leather
};

export interface SpriteAtlas {
  heroDown: [HTMLCanvasElement, HTMLCanvasElement];
  heroUp: [HTMLCanvasElement, HTMLCanvasElement];
  heroRight: [HTMLCanvasElement, HTMLCanvasElement];
  heroLeft: [HTMLCanvasElement, HTMLCanvasElement];
  heroFlash: HTMLCanvasElement;

  customers: Array<[HTMLCanvasElement, HTMLCanvasElement]>;

  slime: [HTMLCanvasElement, HTMLCanvasElement];
  slimeFlash: HTMLCanvasElement;
  drone: [HTMLCanvasElement, HTMLCanvasElement];
  droneFlash: HTMLCanvasElement;
  turret: [HTMLCanvasElement, HTMLCanvasElement];
  turretFlash: HTMLCanvasElement;
  boss: [HTMLCanvasElement, HTMLCanvasElement];
  bossFlash: HTMLCanvasElement;

  items: Record<string, HTMLCanvasElement>;

  props: {
    pedestalEmpty: HTMLCanvasElement;
    pedestalActive: HTMLCanvasElement;
    podIntact: HTMLCanvasElement;
    podBroken: HTMLCanvasElement;
    chestClosed: HTMLCanvasElement;
    chestOpen: HTMLCanvasElement;
    workbench: HTMLCanvasElement;
    storageChest: HTMLCanvasElement;
    plant: HTMLCanvasElement;
    crate: HTMLCanvasElement;
    shuttle: HTMLCanvasElement;
    shuttleSmall: HTMLCanvasElement;
  };

  emotes: Record<'cheap' | 'fair' | 'expensive' | 'outrageous' | 'coin', HTMLCanvasElement>;
}

let cachedAtlas: SpriteAtlas | null = null;

function createItemSprites(): Record<string, HTMLCanvasElement> {
  const sprites: Record<string, HTMLCanvasElement> = {};

  // 1. Kupfer-Spule (Copper Coil)
  sprites.scrap_coil = compilePixelArt(
    [
      '................',
      '.....oooooo.....',
      '....osssssso....',
      '....osmmmmso....',
      '...ooorrrrooo...',
      '...ooraaaaroo...',
      '...ooeeeeeooo...',
      '...ooraaaaroo...',
      '...ooeeeeeooo...',
      '...ooraaaaroo...',
      '...ooeeeeeooo...',
      '....osmmmmso....',
      '....osddddso....',
      '.....oooooo.....',
      '......o..o......',
      '................',
    ],
    BASE_PAL,
  );

  // 2. Biolum-Gel
  sprites.bio_gel = compilePixelArt(
    [
      '................',
      '......oooo......',
      '.....osssso.....',
      '......ommo......',
      '....ooottooo....',
      '...ootccccoto...',
      '...otcwwcccto...',
      '..ootcwcgcccto..',
      '..ootcccccccto..',
      '..ootcggccctto..',
      '..oootttttttto..',
      '...oootttttto...',
      '....oooooooo....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 3. Alter Nav-Chip
  sprites.nav_chip = compilePixelArt(
    [
      '................',
      '....o.o..o.o....',
      '...oooooooooo...',
      '..oodddddddddo..',
      '.ooddkkkkkkddoo.',
      '..odkbbccbbkdo..',
      '.oodkbccccbkdoo.',
      '..odkbcwwcbkdo..',
      '.oodkbbccbbkdoo.',
      '..odkkaaakkkdo..',
      '.ooddkkkkkkddoo.',
      '..oodddddddddo..',
      '...oooooooooo...',
      '....o.o..o.o....',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 4. Plasma-Zelle
  sprites.plasma_cell = compilePixelArt(
    [
      '................',
      '.....oooooo.....',
      '....osssssso....',
      '....odmmmmddo...',
      '...oodccccdoo...',
      '...odccwwccdo...',
      '...odccwwccdo...',
      '...odbbccbbdo...',
      '...odccwwccdo...',
      '...odccwwccdo...',
      '...oodccccdoo...',
      '....odmmmmddo...',
      '....osssssso....',
      '.....oooooo.....',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 5. Äther-Kristall
  sprites.alien_prism = compilePixelArt(
    [
      '.......oo.......',
      '......occo......',
      '.....ocwwco.....',
      '....ocwcccto....',
      '...ocwcccctto...',
      '..ooccccccttoo..',
      '..occwwcccttoo..',
      '..occcccctttto..',
      '...occcctttto...',
      '...ootcctttto...',
      '....oottttto....',
      '.....oottto.....',
      '....oooxxooo....',
      '...oooxxxxooo...',
      '....oooooooo....',
      '................',
    ],
    BASE_PAL,
  );

  // 6. Drohnen-Kern
  sprites.drone_core = compilePixelArt(
    [
      '................',
      '.....oooooo.....',
      '...oossssssoo...',
      '..osmmddddmmso..',
      '..omdkkkkkkdmo..',
      '.osdkbbccbbkdso.',
      '.osdkbcwwcbkdso.',
      '.osdkbcwwcbkdso.',
      '.osdkbbccbbkdso.',
      '..omdkkkkkkdmo..',
      '..osmmddddmmso..',
      '...oossssssoo...',
      '.....oooooo.....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 7. Sternen-Kompass
  sprites.star_compass = compilePixelArt(
    [
      '......oooo......',
      '.....oayyao.....',
      '.....oa..ao.....',
      '...oooaaaooo....',
      '..oayykkkkyaao..',
      '.oaykbbccbbkyao.',
      '.oakbbcwccbbkao.',
      '.oakbcwwwwcbkao.',
      '.oakbbcwccbbkao.',
      '.oaykbbccbbkyao.',
      '..oayykkkkyaao..',
      '...ooaaaaaaao...',
      '.....oooooo.....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 8. Kryo-Bernstein (Fragile!)
  sprites.cryo_amber = compilePixelArt(
    [
      '................',
      '......oooo......',
      '....ooorrroo....',
      '...ooraaaaro....',
      '..oorayyyarro...',
      '..oraywwyarrro..',
      '..orayyyarerro..',
      '..oraaaarerero..',
      '..oorarreeerro..',
      '...oorrreeero...',
      '....ooorrrro....',
      '.....ooccco.....',
      '......oooo......',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 9. Quanten-Gyroskop (Warp-Anchor!)
  sprites.quantum_gyro = compilePixelArt(
    [
      '................',
      '.....oooooo.....',
      '...oocggggcoo...',
      '..ocgokkkkogco..',
      '.ocgokaaaaokgco.',
      '.ogokawyywaokgo.',
      '.ogokacwwcaokgo.',
      '.ogokacwwcaokgo.',
      '.ogokawyywaokgo.',
      '.ocgokaaaaokgco.',
      '..ocgokkkkogco..',
      '...oocggggcoo...',
      '.....oooooo.....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 10. Void-Relikt
  sprites.void_relic = compilePixelArt(
    [
      '.......oo.......',
      '......oppo......',
      '.....opwwpo.....',
      '....opvvvppo....',
      '..ooopvppvpooo..',
      '.opppvvwwvvpppo.',
      '.opvvvwwwwvvvpo.',
      '..ooovvwwvvooo..',
      '....opvvvvpo....',
      '....oovppvoo....',
      '.....oovvoo.....',
      '....ooaaaaoo....',
      '...ooaayyaaoo...',
      '....oooooooo....',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // 11. Chrono-Linse (Smuggler Bonus!)
  sprites.chrono_lens = compilePixelArt(
    [
      '................',
      '....oooooooo....',
      '...oaaayyaaao...',
      '..oaykcccckyao..',
      '.oaykcwwwwckyao.',
      '.oakccwyywcckao.',
      '.oakccywwycckao.',
      '.oakccwyywcckao.',
      '.oaykcwwwwckyao.',
      '..oaykcccckyao..',
      '...oaaayyaaao...',
      '....oooooooo....',
      '......oaaao.....',
      '.....oayyao.....',
      '......oooo......',
      '................',
    ],
    BASE_PAL,
  );

  // 12. MK-IV Reaktor-Kern (Boss Drop!)
  sprites.mk4_heart = compilePixelArt(
    [
      '......oooo......',
      '....ooaaaaoo....',
      '...oadmmmmddo...',
      '..odmerrrremdo..',
      '.odmeryyyyremdo.',
      '.odmrywwwwyrmdo.',
      '.odmrywwwwyrmdo.',
      '.odmeryyyyremdo.',
      '..odmerrrremdo..',
      '...oadmmmmddo...',
      '....ooaaaaoo....',
      '.....occcco.....',
      '......oooo......',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  return sprites;
}

function createHeroSprites() {
  // Compact 16x18 cozy retro spacesuit explorer (bright orange suit + cyan visor + jetpack!)
  const down0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osbbccbbso...',
      '...osbcwwcbso...',
      '...osbccccbso...',
      '...osddddddso...',
      '....oooooooo....',
      '...oorrrrrroo...',
      '..osorrrrroso...',
      '..oooraccaaooo..',
      '..ooorrrrrrooo..',
      '...oorreeerro...',
      '....ooddddoo....',
      '....ood..doo....',
      '....ook..koo....',
      '....ooo..ooo....',
    ],
    BASE_PAL,
  );

  const down1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osbbccbbso...',
      '...osbcwwcbso...',
      '...osbccccbso...',
      '...osddddddso...',
      '....oooooooo....',
      '...oorrrrrroo...',
      '..osorrrrroso...',
      '..oooraccaaooo..',
      '..ooorrrrrrooo..',
      '...oorreeerro...',
      '....ooddddoo....',
      '...oook..doo....',
      '...ooo....koo...',
      '..........ooo...',
    ],
    BASE_PAL,
  );

  const up0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osssssssso...',
      '...osmmmmmmso...',
      '...osddddddso...',
      '....oooooooo....',
      '...oommmmmmoo...',
      '..oromssssmoro..',
      '..oromsccsmooo..',
      '..oromddddmoro..',
      '...oommmmmmoo...',
      '...oorreeerro...',
      '....ooddddoo....',
      '....ood..doo....',
      '....ook..koo....',
      '....ooo..ooo....',
    ],
    BASE_PAL,
  );

  const up1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osssssssso...',
      '...osmmmmmmso...',
      '...osddddddso...',
      '....oooooooo....',
      '...oommmmmmoo...',
      '..oromssssmoro..',
      '..oromsccsmooo..',
      '..oromddddmoro..',
      '...oommmmmmoo...',
      '...oorreeerro...',
      '....ooddddoo....',
      '...oook..doo....',
      '...ooo....koo...',
      '..........ooo...',
    ],
    BASE_PAL,
  );

  const right0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osmmbbccso...',
      '...osmmbcwwco...',
      '...osmmbcccco...',
      '...osdddddsso...',
      '....oooooooo....',
      '..oomorrrroo....',
      '..omsocrrraoo...',
      '..omdorrrrroo...',
      '..oomorrrroo....',
      '....oorreeoo....',
      '....ooddddoo....',
      '....ood..doo....',
      '....ook..koo....',
      '....ooo..ooo....',
    ],
    BASE_PAL,
  );

  const right1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....osssssso....',
      '...osmmbbccso...',
      '...osmmbcwwco...',
      '...osmmbcccco...',
      '...osdddddsso...',
      '....oooooooo....',
      '..oomorrrroo....',
      '..omsocrrraoo...',
      '..omdorrrrroo...',
      '..oomorrrroo....',
      '....oorreeoo....',
      '....ooddddoo....',
      '...oook...doo...',
      '...ooo....koo...',
      '..........ooo...',
    ],
    BASE_PAL,
  );

  return {
    heroDown: [down0, down1] as [HTMLCanvasElement, HTMLCanvasElement],
    heroUp: [up0, up1] as [HTMLCanvasElement, HTMLCanvasElement],
    heroRight: [right0, right1] as [HTMLCanvasElement, HTMLCanvasElement],
    heroLeft: [flipCanvasHorizontal(right0), flipCanvasHorizontal(right1)] as [
      HTMLCanvasElement,
      HTMLCanvasElement,
    ],
    heroFlash: makeFlashSilhouette(down0, '#ffffff'),
  };
}

function createCustomerSprites(): Array<[HTMLCanvasElement, HTMLCanvasElement]> {
  // 1. White Astronaut Pilot
  const astro0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....owwwwwwo....',
      '...owbbbbbbwo...',
      '...owbwwwwbwo...',
      '...owbddddbwo...',
      '....oooooooo....',
      '...oowwwwwwoo...',
      '..oowwraaawwwo..',
      '..oowwwwwwwwoo..',
      '...oowsssswoo...',
      '....oossssoo....',
      '....ood..doo....',
      '....ook..koo....',
      '....ooo..ooo....',
    ],
    BASE_PAL,
  );
  const astro1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....owwwwwwo....',
      '...owbbbbbbwo...',
      '...owbwwwwbwo...',
      '...owbddddbwo...',
      '....oooooooo....',
      '...oowwwwwwoo...',
      '..oowwraaawwwo..',
      '..oowwwwwwwwoo..',
      '...oowsssswoo...',
      '....oossssoo....',
      '...oook..doo....',
      '...ooo....koo...',
      '..........ooo...',
    ],
    BASE_PAL,
  );

  // 2. Horned Lavender Alien Merchant (straight from our Shop concept art!)
  const alienHorn0 = compilePixelArt(
    [
      '...oo......oo...',
      '...oso....oso...',
      '....ooppppoo....',
      '...ooppppppoo...',
      '...opowppwopo...',
      '...ooppppppoo...',
      '....ooovvooo....',
      '...ooddddddoo...',
      '..ooddkcckddoo..',
      '..ooddkcckddoo..',
      '...ooddddddoo...',
      '....ook..koo....',
      '....ook..koo....',
      '....ooo..ooo....',
    ],
    BASE_PAL,
  );
  const alienHorn1 = compilePixelArt(
    [
      '...oo......oo...',
      '...oso....oso...',
      '....ooppppoo....',
      '...ooppppppoo...',
      '...opowppwopo...',
      '...ooppppppoo...',
      '....ooovvooo....',
      '...ooddddddoo...',
      '..ooddkcckddoo..',
      '..ooddkcckddoo..',
      '...ooddddddoo...',
      '...oook..koo....',
      '...ooo....koo...',
      '..........ooo...',
    ],
    BASE_PAL,
  );

  // 3. Green Alien Botanist with Red Scarf
  const green0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....oggggggo....',
      '...oggggggggo...',
      '...ogogggoggo...',
      '...oggggggggo...',
      '....ooggggoo....',
      '...oohhhhhhoo...',
      '..ootthhhhttoo..',
      '..oottttttttoo..',
      '...oottddttoo...',
      '....ood..doo....',
      '....ook..koo....',
      '....ooo..ooo....',
      '................',
    ],
    BASE_PAL,
  );
  const green1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....oggggggo....',
      '...oggggggggo...',
      '...ogogggoggo...',
      '...oggggggggo...',
      '....ooggggoo....',
      '...oohhhhhhoo...',
      '..ootthhhhttoo..',
      '..oottttttttoo..',
      '...oottddttoo...',
      '...oook..doo....',
      '...ooo....koo...',
      '..........ooo...',
      '................',
    ],
    BASE_PAL,
  );

  // 4. Amber Hooded Droid Collector
  const droid0 = compilePixelArt(
    [
      '.....oooooo.....',
      '....oaaaaaao....',
      '...oayyyyyyao...',
      '...oakkkkkkao...',
      '...oakbccbkao...',
      '...oakkkkkkao...',
      '....oooooooo....',
      '...oonnnnnnoo...',
      '..oonnaaaannoo..',
      '..oonnuuuunnoo..',
      '...ooddddddoo...',
      '....oom..moo....',
      '....ooo..ooo....',
      '................',
    ],
    BASE_PAL,
  );
  const droid1 = compilePixelArt(
    [
      '.....oooooo.....',
      '....oaaaaaao....',
      '...oayyyyyyao...',
      '...oakkkkkkao...',
      '...oakbccbkao...',
      '...oakkkkkkao...',
      '....oooooooo....',
      '...oonnnnnnoo...',
      '..oonnaaaannoo..',
      '..oonnuuuunnoo..',
      '...ooddddddoo...',
      '...ooom..moo....',
      '...ooo....ooo...',
      '................',
    ],
    BASE_PAL,
  );

  return [
    [astro0, astro1],
    [alienHorn0, alienHorn1],
    [green0, green1],
    [droid0, droid1],
  ];
}

function createEnemySprites() {
  // Void-Slime (glowing purple-magenta space jelly with bright eye)
  const slime0 = compilePixelArt(
    [
      '................',
      '................',
      '.....oooooo.....',
      '...ooppppppoo...',
      '..oppwwppppvpo..',
      '..opwppppvvvvo..',
      '.oppppcwwcpvvvo.',
      '.oppppcwwcpvvvo.',
      '.opvvvvccvvvvvo.',
      '.ovvvvvvvvvvvvo.',
      '..ovvvvkkvvvvo..',
      '..oovvvvvvvvoo..',
      '...oooooooooo...',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );
  const slime1 = compilePixelArt(
    [
      '................',
      '................',
      '................',
      '....oooooooo....',
      '..ooppppppppoo..',
      '.oppwwppppppvpo.',
      '.oppppcwwcpvvvo.',
      '.oppppcwwcpvvvo.',
      'opvvvvvccvvvvvpo',
      'ovvvvvvvvvvvvvvo',
      '.ovvvvvkkvvvvvo.',
      '..oooooooooooo..',
      '................',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // Security Drone
  const drone0 = compilePixelArt(
    [
      '.......oo.......',
      '......occo......',
      '.....oossoo.....',
      '...oossssssoo...',
      '..osmmddddmmso..',
      '.osmdkkkkkkdmso.',
      '.osdkkppppkkdso.',
      '.osdkpwwwwpkdso.',
      '.osdkkppppkkdso.',
      '..osmdkkkkdmso..',
      '...oosddddsoo...',
      '....oo....oo....',
      '....oc....co....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );
  const drone1 = compilePixelArt(
    [
      '.......oo.......',
      '......owwo......',
      '.....oossoo.....',
      '...oossssssoo...',
      '..osmmddddmmso..',
      '.osmdkkkkkkdmso.',
      '.osdkkhhhhkkdso.',
      '.osdkhwwwwhkdso.',
      '.osdkkhhhhkkdso.',
      '..osmdkkkkdmso..',
      '...oosddddsoo...',
      '....oo....oo....',
      '....oy....yo....',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // Plasma Turret
  const turret0 = compilePixelArt(
    [
      '................',
      '....oooooooo....',
      '...odmmmmmmddo..',
      '..odmssssssmmdo.',
      '..omskkkkkksmdo.',
      '.odmskarraksmdo.',
      '.odmskawwaksmdo.',
      '.odmskarraksmdo.',
      '..omskkkkkksmdo.',
      '..odmddddddmmdo.',
      '..oodkddddkddoo.',
      '...oo.oooo.oo...',
      '................',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );
  const turretCharge = compilePixelArt(
    [
      '................',
      '....oooooooo....',
      '...odmmmmmmddo..',
      '..odmssssssmmdo.',
      '..omskaaaaksmdo.',
      '.odmsayyyyysmdo.',
      '.odmsaywwyysmdo.',
      '.odmsayyyyysmdo.',
      '..omskaaaaksmdo.',
      '..odmddddddmmdo.',
      '..oodkddddkddoo.',
      '...oo.oooo.oo...',
      '................',
      '................',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // BOSS: Kern-Wächter MK-IV (28x28 compiled crisp)
  const bossRows0 = [
    '..........oooooooo..........',
    '........ooaaaaaaaaao........',
    '......ooaddmmmmmmddao.......',
    '.....oadmssssssssssmdo......',
    '....odmsddddddddddddmdo.....',
    '...odmsdkkkkkkkkkkkdsmdo....',
    '..ooosdkkkcwwwwckkkdsooo....',
    '.oaaosdkkcwwyywwckkdsoaaao..',
    '.oayodmkkcwywwywckkmdoyao...',
    '.oaoodmkkcwwyywwckkmdooao...',
    '..ooodmdkkcwwwwckkdmdooo....',
    '..oddmddkkkkkkkkkkddmddo....',
    '.odmsssddddddddddddsssmdo...',
    '.odmsddmddrrrrrrddmddsmdo...',
    '.odmsddmdryyyyyyrdmddsmdo...',
    '.odmsddmdrywwwwyrdmddsmdo...',
    '.odmsddmdrywwwwyrdmddsmdo...',
    '.odmsddmdryyyyyyrdmddsmdo...',
    '.odmsssdddrrrrrrdddsssmdo...',
    '..oddmddddddddddddddmddo....',
    '...oodmmddddddddddmmdoo.....',
    '....ooaddmmmmmmmmddao.......',
    '.....ooooddddddddoooo.......',
    '.....oocoo......oocoo.......',
    '......ooo........ooo........',
  ];
  const bossRows1 = bossRows0.map((r, idx) =>
    idx >= 13 && idx <= 18 ? r.replaceAll('r', 'a').replaceAll('y', 'w') : r,
  );

  const boss0 = compilePixelArt(bossRows0, BASE_PAL);
  const boss1 = compilePixelArt(bossRows1, BASE_PAL);

  return {
    slime: [slime0, slime1] as [HTMLCanvasElement, HTMLCanvasElement],
    slimeFlash: makeFlashSilhouette(slime0, '#ffffff'),
    drone: [drone0, drone1] as [HTMLCanvasElement, HTMLCanvasElement],
    droneFlash: makeFlashSilhouette(drone0, '#ffffff'),
    turret: [turret0, turretCharge] as [HTMLCanvasElement, HTMLCanvasElement],
    turretFlash: makeFlashSilhouette(turret0, '#ffffff'),
    boss: [boss0, boss1] as [HTMLCanvasElement, HTMLCanvasElement],
    bossFlash: makeFlashSilhouette(boss0, '#ffffff'),
  };
}

function createProps() {
  // Holo-Pedestal (24x24)
  const pedestalEmpty = compilePixelArt(
    [
      '....oooooooooooooooo....',
      '...osssssssssssssssso...',
      '..osddddddddddddddddso..',
      '..osdttttttttttttttdso..',
      '..osdtcccccccccccctdso..',
      '..osdtcccccccccccctdso..',
      '..osdtcccccccccccctdso..',
      '..osdttttttttttttttdso..',
      '..osddddddddddddddddso..',
      '..oommmmmmmmmmmmmmmmoo..',
      '..oomdmmddddddddmmdmoo..',
      '..oomdmmddccccddmmdmoo..',
      '..oomdmmddddddddmmdmoo..',
      '..oommmmmmmmmmmmmmmmoo..',
      '..ooddddddddddddddddoo..',
      '...oooooooooooooooooo...',
    ],
    BASE_PAL,
  );

  const pedestalActive = compilePixelArt(
    [
      '....oooooooooooooooo....',
      '...osssssssssssssssso...',
      '..osddddddddddddddddso..',
      '..osdccccccccccccccdso..',
      '..osdcwwwwwwwwwwwwcdso..',
      '..osdcwccccccccccwcdso..',
      '..osdcwwwwwwwwwwwwcdso..',
      '..osdccccccccccccccdso..',
      '..osddddddddddddddddso..',
      '..oommmmmmmmmmmmmmmmoo..',
      '..oomdmmddddddddmmdmoo..',
      '..oomdmmddaaaaddmmdmoo..',
      '..oomdmmddddddddmmdmoo..',
      '..oommmmmmmmmmmmmmmmoo..',
      '..ooddddddddddddddddoo..',
      '...oooooooooooooooooo...',
    ],
    BASE_PAL,
  );

  // Alien Golden Frachtkapsel (destructible loot pod!)
  const podIntact = compilePixelArt(
    [
      '.....oooooo.....',
      '...ooaaaaaaoo...',
      '..oayyannayyao..',
      '..oaynnnnnnyao..',
      '.oannnccccnnnao.',
      '.oannncwwcnnnao.',
      '.oannnccccnnnao.',
      '.oaunnnnnnnnuao.',
      '.oauuunnnnuuuao.',
      '..oauuuuuuuuao..',
      '..ooaauuuuaaoo..',
      '...oooooooooo...',
    ],
    BASE_PAL,
  );

  const podBroken = compilePixelArt(
    [
      '................',
      '................',
      '................',
      '................',
      '..oo......oo....',
      '.oauo....oauo...',
      '..oauuooouao....',
      '.oouuuuuuuuoo...',
      '..ooauuuuuaoo...',
      '...oooooooooo...',
      '................',
      '................',
    ],
    BASE_PAL,
  );

  // Ancient Treasure Chest (20x16)
  const chestClosed = compilePixelArt(
    [
      '..oooooooooooooooo..',
      '.oaaaaaaaaaaaaaaaaao',
      '.oayyynnnnnnnnyyyao.',
      '.oaynnccccccccnnyao.',
      '.oannnccccccccnnnao.',
      '.oooooooooooooooooo.',
      '.oaaannnaaaannnaaao.',
      '.oannnnayyyannnnnao.',
      '.oauuuuayyyauuuuuao.',
      '.oauuuunaaanuuuuuao.',
      '.oauuuuuuuuuuuuuuao.',
      '..oooooooooooooooo..',
    ],
    BASE_PAL,
  );

  const chestOpen = compilePixelArt(
    [
      '..oooooooooooooooo..',
      '.oaaaaaaaaaaaaaaaaao',
      '.oakkkkkkkkkkkkkkao.',
      '.oakkkkkkkkkkkkkkao.',
      '.oakcckkkkkkkkcckao.',
      '.oooooooooooooooooo.',
      '.oaaannnkkknnnnaaao.',
      '.oannnnnkkknnnnnnao.',
      '.oauuuuuuuuuuuuuuao.',
      '.oauuuuuuuuuuuuuuao.',
      '.oauuuuuuuuuuuuuuao.',
      '..oooooooooooooooo..',
    ],
    BASE_PAL,
  );

  // Exo-Werkbank (28x22)
  const workbench = compilePixelArt(
    [
      '....oooooooooooooooooooo....',
      '...osssssssssssssssssssso...',
      '..osddddddddddddddddddddso..',
      '..osdkkkkkkkcccckkkkkkkkso..',
      '..osdkrrrrkccwwcckbbbdkkso..',
      '..osdkraarkcccccckbccdkkso..',
      '..osdkkkkkkddddddkddddkkso..',
      '..oommmmmmmmmmmmmmmmmmmmoo..',
      '..oonnnnnnnnnnnnnnnnnnnnoo..',
      '..oonnuunnnnaaaannnnuunnoo..',
      '..oonnuunnnnayyannnnuunnoo..',
      '..oonnuunnnnaaaannnnuunnoo..',
      '..oouuuuuuuuuuuuuuuuuuuuoo..',
      '..ooddddddddddddddddddddoo..',
      '...oooooooooooooooooooooo...',
    ],
    BASE_PAL,
  );

  // Shop Storage Chest (22x16)
  const storageChest = compilePixelArt(
    [
      '..oooooooooooooooooo..',
      '.osssssssssssssssssso.',
      '.osmmmmbbbbbbbbmmmmso.',
      '.osmmmbccccccccbmmso..',
      '.osmmmmbbbbbbbbmmmmso.',
      '.oooooooooooooooooooo.',
      '.odddddssaaaassdddddo.',
      '.odddddssayyassdddddo.',
      '.oddddddddddddddddddo.',
      '.okkkkkkkkkkkkkkkkkko.',
      '..oooooooooooooooooo..',
    ],
    BASE_PAL,
  );

  // Cozy Potted Space Plant
  const plant = compilePixelArt(
    [
      '.....oo..oo.....',
      '....oggo.ggo....',
      '...ogggoogggo...',
      '..oggllggllggo..',
      '...ogglgglggo...',
      '....ooggggoo....',
      '.....ooccoo.....',
      '....oonnnnoo....',
      '....onnuunno....',
      '.....onnnno.....',
      '.....oouuoo.....',
      '......oooo......',
    ],
    BASE_PAL,
  );

  // Wooden/Metal Crate
  const crate = compilePixelArt(
    [
      '.oooooooooooooo.',
      'onnnnnnnnnnnnnno',
      'onauuuuuuuuuuano',
      'onuunnnnnnnnuuno',
      'onunnuuuuuunnuno',
      'onunnuannnunnuno',
      'onunnuannnunnuno',
      'onunnuuuuuunnuno',
      'onuunnnnnnnnuuno',
      'onauuuuuuuuuuano',
      'ouuuuuuuuuuuuuuo',
      '.oooooooooooooo.',
    ],
    BASE_PAL,
  );

  // Background passing shuttle for Shop viewport window
  const shuttle = compilePixelArt(
    [
      '............oooo....',
      '.........ooossssoo..',
      '....oooossssbbccssso',
      '.yyrrsssssssbccccsso',
      '.yyrrsssssssddddssso',
      '....oooosssssssssso.',
      '.........ooossssoo..',
      '............oooo....',
    ],
    BASE_PAL,
  );

  const shuttleSmall = compilePixelArt(
    [
      '.....oooo...',
      '..yrrssbcsso',
      '..yrrsssssso',
      '.....oooo...',
    ],
    BASE_PAL,
  );

  return {
    pedestalEmpty,
    pedestalActive,
    podIntact,
    podBroken,
    chestClosed,
    chestOpen,
    workbench,
    storageChest,
    plant,
    crate,
    shuttle,
    shuttleSmall,
  };
}

function createEmotes() {
  const cheap = compilePixelArt(
    [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      '.owwccwwccwwo.',
      '.owccccwcccwo.',
      '.owwwwwwwwwwo.',
      '.owwccccccwwo.',
      '.owwwccccwwwo.',
      '.owwwwwwwwwwo.',
      '..oooooooooo..',
      '.....oooo.....',
      '......oo......',
    ],
    BASE_PAL,
  );

  const fair = compilePixelArt(
    [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      '.owwggwwggwwo.',
      '.owwggwwggwwo.',
      '.owwwwwwwwwwo.',
      '.owwgwwwwgwwo.',
      '.owwwggggwwwo.',
      '.owwwwwwwwwwo.',
      '..oooooooooo..',
      '.....oooo.....',
      '......oo......',
    ],
    BASE_PAL,
  );

  const expensive = compilePixelArt(
    [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      '.owwrrwwrrwwo.',
      '.owwwwwwwwwwo.',
      '.owwwwwwwwwwo.',
      '.owwwrrrrwwwo.',
      '.owwrwwwwrwwo.',
      '.owwwwwwwwwwo.',
      '..oooooooooo..',
      '.....oooo.....',
      '......oo......',
    ],
    BASE_PAL,
  );

  const outrageous = compilePixelArt(
    [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      '.owhwwhhwwhwo.',
      '.owwhhwwhhwwo.',
      '.owwwwwwwwwwo.',
      '.owwwhhhhwwwo.',
      '.owwhwwwwhwwo.',
      '.owwwwwwwwwwo.',
      '..oooooooooo..',
      '.....oooo.....',
      '......oo......',
    ],
    BASE_PAL,
  );

  const coin = compilePixelArt(
    [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      '.owwwaaawwwwo.',
      '.owwayyyawwwo.',
      '.owwayayawwwo.',
      '.owwayyyawwwo.',
      '.owwwaaawwwwo.',
      '.owwwwwwwwwwo.',
      '..oooooooooo..',
      '.....oooo.....',
      '......oo......',
    ],
    BASE_PAL,
  );

  return { cheap, fair, expensive, outrageous, coin };
}

export function getAtlas(): SpriteAtlas {
  if (cachedAtlas) return cachedAtlas;
  const hero = createHeroSprites();
  const enemies = createEnemySprites();
  const items = createItemSprites();

  cachedAtlas = {
    ...hero,
    customers: createCustomerSprites(),
    ...enemies,
    items,
    props: createProps(),
    emotes: createEmotes(),
  };

  return cachedAtlas;
}
