import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';

export type HubCutsceneId =
  | 'celebration_s1'
  | 'celebration_s2'
  | 'celebration_s3'
  | 'celebration_s4'
  | 'celebration_omega'
  | 'story_mina_arrives'
  | 'story_pip_arrives'
  | 'story_ping_arrives'
  | 'story_midnight_arrives';

/** Einzug eines Begleiters/Gehilfen an einem Hub-Laden. */
interface ArrivalDef {
  companion: 'pip' | 'ping' | 'midnight';
  hostName: string;
  hostPos: { x: number; y: number };
  hostSprite: 'npcLyra' | 'npcVex' | 'npcNyx';
  start: { x: number; y: number };
  rest: { x: number; y: number };
  glow: string;
  tag: string;
}

interface CutsceneBeat {
  speaker: string;
  speakerColor: string;
  text: string;
  durationSec: number;
  /** Optionaler Effekt beim Start dieses Beats */
  onStart?: 'fanfare' | 'lights_on' | 'firework' | 'hammer' | 'chime';
  /** Wer hüpft/jubelt in diesem Beat? */
  cheerActor?: 'all' | 'kael' | 'lyra' | 'nyx' | 'vex' | 'mina' | 'player' | 'host' | 'companion';
}

interface HubCutsceneDef {
  id: HubCutsceneId;
  eyebrow: string;
  bannerTitle: string;
  accent: string;
  confettiColors: string[];
  fireworks: boolean;
  focusForge: boolean;
  /** Begleiter-Einzug (Pip, Ping, Mitternacht) statt Feier-/Mina-Bühne */
  arrival?: ArrivalDef;
  beats: CutsceneBeat[];
}

const HUB_CUTSCENES: Record<HubCutsceneId, HubCutsceneDef> = {
  celebration_s1: {
    id: 'celebration_s1',
    eyebrow: 'PORT SOLARIS · SIEGESFEIER',
    bannerTitle: 'DER LEVIATHAN IST GEFALLEN!',
    accent: '#fbbf24',
    confettiColors: ['#fbbf24', '#38e8d4', '#fb923c', '#f472b6', '#fde047'],
    fireworks: true,
    focusForge: false,
    beats: [
      {
        speaker: 'Port Solaris',
        speakerColor: '#fbbf24',
        text: 'Jubel hallt über die Promenade! Die alten Lichterketten flammen eine nach der anderen wieder auf.',
        durationSec: 4.4,
        onStart: 'lights_on',
        cheerActor: 'all',
      },
      {
        speaker: 'Kael',
        speakerColor: '#fb923c',
        text: 'Du hast es wirklich geschafft, {captain}! Der A.E.G.I.S. Leviathan ist Geschichte — die ganze Station feiert dich!',
        durationSec: 4.8,
        onStart: 'fanfare',
        cheerActor: 'kael',
      },
      {
        speaker: 'Dr. Lyra',
        speakerColor: '#34d399',
        text: 'Hörst du das? Das seltsame Echo aus den Wracks ist leiser geworden. Und deine Trophäe leuchtet schon in der Vitrine!',
        durationSec: 4.8,
        onStart: 'firework',
        cheerActor: 'lyra',
      },
      {
        speaker: 'Nyx & Vex',
        speakerColor: '#38bdf8',
        text: 'Auf unseren Kapitän! Heute Nacht wird „Astro-Barter“ aus allen Nähten platzen — und die tieferen Sektoren warten!',
        durationSec: 4.8,
        onStart: 'firework',
        cheerActor: 'all',
      },
    ],
  },
  celebration_s2: {
    id: 'celebration_s2',
    eyebrow: 'PORT SOLARIS · KRISTALL-FEST',
    bannerTitle: 'PRISMA-ARCHON BEZWUNGEN!',
    accent: '#c084fc',
    confettiColors: ['#c084fc', '#67e8f9', '#f5d0fe', '#fbbf24'],
    fireworks: true,
    focusForge: false,
    beats: [
      {
        speaker: 'Port Solaris',
        speakerColor: '#c084fc',
        text: 'Violettes Kristalllicht flutet die Promenade — neue Kristall-Laternen entzünden sich an Schmiede und Med-Bay!',
        durationSec: 4.5,
        onStart: 'fanfare',
        cheerActor: 'all',
      },
      {
        speaker: 'Vex',
        speakerColor: '#38bdf8',
        text: 'Unglaublich, {captain}! Die Kristall-Resonanz hat echte Koordinaten entschlüsselt. Die Pilger strömen schon zur Station!',
        durationSec: 4.8,
        onStart: 'firework',
        cheerActor: 'vex',
      },
      {
        speaker: 'Dr. Lyra',
        speakerColor: '#34d399',
        text: 'Die ganze Promenade singt leise mit. Gönn dir eine Pause — oder starte direkt Richtung Solar-Gießerei!',
        durationSec: 4.5,
        cheerActor: 'all',
      },
    ],
  },
  celebration_s3: {
    id: 'celebration_s3',
    eyebrow: 'PORT SOLARIS · SONNENFEST',
    bannerTitle: 'VULKAN-TITAN GESCHLAGEN!',
    accent: '#fb923c',
    confettiColors: ['#fb923c', '#fde047', '#f97316', '#38e8d4'],
    fireworks: true,
    focusForge: false,
    beats: [
      {
        speaker: 'Port Solaris',
        speakerColor: '#fb923c',
        text: 'Goldene Solar-Wimpel wehen über dem Platz! Die Hitze der Gießerei verwandelt sich in warmes Festlicht.',
        durationSec: 4.4,
        onStart: 'fanfare',
        cheerActor: 'all',
      },
      {
        speaker: 'Kael',
        speakerColor: '#fb923c',
        text: 'Den Vulkan-Titan zu bezwingen — das ist wahre Schmiedekunst, {captain}! Drei Siegel sind unser!',
        durationSec: 4.6,
        onStart: 'hammer',
        cheerActor: 'kael',
      },
      {
        speaker: 'Nyx',
        speakerColor: '#c084fc',
        text: 'Nur noch ein Sektor bis zum 5. Tor. Die Händler der Galaxis reden nur noch von deinem Laden!',
        durationSec: 4.5,
        onStart: 'firework',
        cheerActor: 'all',
      },
    ],
  },
  celebration_s4: {
    id: 'celebration_s4',
    eyebrow: 'PORT SOLARIS · ERBE DER ÄLTESTEN',
    bannerTitle: 'ALLE VIER SIEGEL FREI!',
    accent: '#38e8d4',
    confettiColors: ['#38e8d4', '#fde047', '#c084fc', '#fb923c'],
    fireworks: true,
    focusForge: false,
    beats: [
      {
        speaker: 'Port Solaris',
        speakerColor: '#38e8d4',
        text: 'In der Platzmitte erwacht der Holo-Obelisk der Ältesten! Vier leuchtende Ringe strahlen Richtung Raumhafen.',
        durationSec: 4.6,
        onStart: 'fanfare',
        cheerActor: 'all',
      },
      {
        speaker: 'Vex',
        speakerColor: '#38bdf8',
        text: 'Alle vier Siegel schwingen gleichzeitig, {captain}! Das 5. Tor im Raumhafen öffnet sich!',
        durationSec: 4.8,
        onStart: 'firework',
        cheerActor: 'vex',
      },
    ],
  },
  celebration_omega: {
    id: 'celebration_omega',
    eyebrow: 'PORT SOLARIS · DAS GROSSE OMEGA-FEST',
    bannerTitle: 'FEUERWERK ÜBER PORT SOLARIS!',
    accent: '#fde047',
    confettiColors: ['#fde047', '#38e8d4', '#f472b6', '#fb923c', '#c084fc'],
    fireworks: true,
    focusForge: false,
    beats: [
      {
        speaker: 'Port Solaris',
        speakerColor: '#fde047',
        text: 'Sternenbanner flattern über der Promenade, während tausend Funken den Nachthimmel über Port Solaris erhellen!',
        durationSec: 4.6,
        onStart: 'fanfare',
        cheerActor: 'all',
      },
      {
        speaker: 'Alle Freunde',
        speakerColor: '#34d399',
        text: 'Auf {captain} — Held der fünf Sektoren und Herz von Port Solaris!',
        durationSec: 4.8,
        onStart: 'firework',
        cheerActor: 'all',
      },
    ],
  },
  story_pip_arrives: {
    id: 'story_pip_arrives',
    eyebrow: 'MED-BAY · NEUER ASSISTENT',
    bannerTitle: 'PIP ASSISTIERT DR. LYRA!',
    accent: '#34d399',
    confettiColors: ['#34d399', '#99f6e4', '#fde047'],
    fireworks: false,
    focusForge: false,
    arrival: {
      companion: 'pip',
      hostName: 'Dr. Lyra',
      hostPos: { x: 348, y: 130 },
      hostSprite: 'npcLyra',
      start: { x: 430, y: 60 },
      rest: { x: 322, y: 132 },
      glow: '#2dd4bf',
      tag: 'PIP',
    },
    beats: [
      {
        speaker: 'Dr. Lyra',
        speakerColor: '#34d399',
        text: 'Seit dem Echo-Fieber stapeln sich meine Patienten. Also habe ich mir Hilfe gebaut. {captain}, darf ich vorstellen?',
        durationSec: 5.0,
        onStart: 'chime',
        cheerActor: 'host',
      },
      {
        speaker: 'Pip',
        speakerColor: '#2dd4bf',
        text: 'Piep! Pip, medizinischer Assistent, Baureihe M-1. Ich zähle Pflaster, Pulsschläge und Sternschnuppen.',
        durationSec: 4.8,
        onStart: 'chime',
        cheerActor: 'companion',
      },
      {
        speaker: 'Dr. Lyra',
        speakerColor: '#34d399',
        text: 'Er hat deine Vitalwerte gespeichert. Wenn du angeschlagen heimkehrst, ist er schneller beim Verband als ich.',
        durationSec: 4.8,
        onStart: 'fanfare',
        cheerActor: 'host',
      },
    ],
  },
  story_ping_arrives: {
    id: 'story_ping_arrives',
    eyebrow: 'TECH-LABOR · NEUE ECHO-SONDE',
    bannerTitle: 'PING FOLGT DEM SIGNAL!',
    accent: '#38bdf8',
    confettiColors: ['#38bdf8', '#fb923c', '#fde047'],
    fireworks: false,
    focusForge: false,
    arrival: {
      companion: 'ping',
      hostName: 'Vex',
      hostPos: { x: 295, y: 178 },
      hostSprite: 'npcVex',
      start: { x: 440, y: 200 },
      rest: { x: 318, y: 180 },
      glow: '#38bdf8',
      tag: 'PING',
    },
    beats: [
      {
        speaker: 'Vex',
        speakerColor: '#38bdf8',
        text: 'Aus den Gießerei-Wracks habe ich Sensorreste gefischt und etwas gebaut, das das Echo hören kann. {captain}, das ist Ping!',
        durationSec: 5.2,
        onStart: 'chime',
        cheerActor: 'host',
      },
      {
        speaker: 'Ping',
        speakerColor: '#fb923c',
        text: 'Bip-bip! Signal gefunden! Neunundvierzig Sekunden … nein, siebenundvierzig!',
        durationSec: 4.4,
        onStart: 'hammer',
        cheerActor: 'companion',
      },
      {
        speaker: 'Vex',
        speakerColor: '#38bdf8',
        text: 'Er zählt schon mit mir! Ab jetzt kalibriert Ping deine Module, und mein Labor brummt endlich im Takt.',
        durationSec: 4.8,
        onStart: 'fanfare',
        cheerActor: 'host',
      },
    ],
  },
  story_midnight_arrives: {
    id: 'story_midnight_arrives',
    eyebrow: 'SCHWARZMARKT · EIN UNGEBETENER GAST',
    bannerTitle: 'MITTERNACHT BLEIBT!',
    accent: '#c084fc',
    confettiColors: ['#c084fc', '#e9d5ff', '#fde047'],
    fireworks: false,
    focusForge: false,
    arrival: {
      companion: 'midnight',
      hostName: 'Nyx',
      hostPos: { x: 185, y: 178 },
      hostSprite: 'npcNyx',
      start: { x: 40, y: 214 },
      rest: { x: 208, y: 184 },
      glow: '#c084fc',
      tag: 'MITTERNACHT',
    },
    beats: [
      {
        speaker: 'Nyx',
        speakerColor: '#c084fc',
        text: 'Seit der Obelisk leuchtet, sitzt sie auf meinem Tresen. Niemand weiß, woher sie kam. Nicht im Katalog.',
        durationSec: 5.0,
        onStart: 'chime',
        cheerActor: 'host',
      },
      {
        speaker: 'Mitternacht',
        speakerColor: '#e9d5ff',
        text: 'Mrrp.',
        durationSec: 2.6,
        onStart: 'chime',
        cheerActor: 'companion',
      },
      {
        speaker: 'Nyx',
        speakerColor: '#c084fc',
        text: 'Sie stiehlt nur, was nicht festgenagelt ist. Also alles. Sie mag dich, {captain} — das ist ein Kompliment.',
        durationSec: 5.0,
        onStart: 'fanfare',
        cheerActor: 'host',
      },
    ],
  },
  story_mina_arrives: {
    id: 'story_mina_arrives',
    eyebrow: 'EXO-SCHMIEDE · NEUE GEHILFIN',
    bannerTitle: 'MINA TRITT DER SCHMIEDE BEI!',
    accent: '#fb923c',
    confettiColors: ['#fb923c', '#fde047', '#38e8d4'],
    fireworks: false,
    focusForge: true,
    beats: [
      {
        speaker: 'Mina',
        speakerColor: '#fbbf24',
        text: 'Meister Kael! Ich hab gehört, der Leviathan ist gefallen — darf ich endlich an der zweiten Werkbank mithelfen?',
        durationSec: 4.8,
        onStart: 'chime',
        cheerActor: 'mina',
      },
      {
        speaker: 'Kael',
        speakerColor: '#fb923c',
        text: 'Hm … die Bank stand lange genug still. Hier — nimm den Energie-Hammer, Mina. Zeig uns, ob du Funken schlagen kannst!',
        durationSec: 5.0,
        onStart: 'hammer',
        cheerActor: 'kael',
      },
      {
        speaker: 'Mina',
        speakerColor: '#fbbf24',
        text: 'Juhu! Ich versprech’s, {captain} — ab sofort schmieden Kael und ich deine besten Waffen und Upgrades gemeinsam!',
        durationSec: 4.8,
        onStart: 'fanfare',
        cheerActor: 'mina',
      },
    ],
  },
};

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const SKIP_LOCK_SEC = 0.28;

/**
 * Zeichnet Kaels Schmiede-Gehilfin Mina — nutzt das optionale Pixel-Art-Sprite `npc_mina.png`
 * oder einen liebevollen, handgepixelten Fallback im selben 3/4-Top-Down-Stil wie Kael & Lyra.
 */
export function drawMinaSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  working = true,
): void {
  const art = getHDArt();
  const bob = Math.sin(time * (working ? 5.2 : 3.0)) * 1.1;
  drawPixelShadow(ctx, x, y + 6, 8, 3);

  if (art.npcMina) {
    ctx.drawImage(art.npcMina, Math.round(x - 13), Math.round(y - 22 + bob), 26, 28);
    return;
  }

  // Handgepixelter 16-Bit-Fallback (dunkle Kontur, Lederschürze, Schutzbrille, Energie-Hammer)
  const px = Math.round(x);
  const py = Math.round(y + bob);
  const hammerSwing = working ? Math.sin(time * 6.5) * 2.5 : 0;

  ctx.save();
  // Stiefel
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(px - 5, py + 1, 4, 5);
  ctx.fillRect(px + 1, py + 1, 4, 5);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(px - 4, py + 2, 2, 3);
  ctx.fillRect(px + 2, py + 2, 2, 3);

  // Körper + türkises Shirt + braune Schmiede-Lederschürze
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(px - 6, py - 9, 12, 11);
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(px - 5, py - 8, 10, 9);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(px - 4, py - 7, 8, 8);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(px - 3, py - 6, 6, 2); // Schürzen-Brustlatz

  // Kopf + warmer Hautton + Pferdeschwanz
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(px - 5, py - 18, 10, 10);
  ctx.fillStyle = '#f5cfa0';
  ctx.fillRect(px - 4, py - 16, 8, 7);
  // Kastanienbraunes Haar + Zopf
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(px - 5, py - 18, 10, 4);
  ctx.fillRect(px + 4, py - 15, 3, 5);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(px + 5, py - 14, 1, 3);
  // Messing-Schutzbrille auf der Stirn (cyan leuchtende Gläser)
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(px - 4, py - 17, 8, 2);
  ctx.fillStyle = '#38e8d4';
  ctx.fillRect(px - 3, py - 17, 2, 2);
  ctx.fillRect(px + 1, py - 17, 2, 2);
  // Augen
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(px - 2, py - 13, 1, 2);
  ctx.fillRect(px + 1, py - 13, 1, 2);

  // Kleiner Energie-Hammer rechts
  const hx = px + 6;
  const hy = Math.round(py - 7 + hammerSwing);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(hx, hy, 2, 7);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(hx - 2, hy - 3, 6, 4);
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(hx - 1, hy - 2, 4, 2);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(hx, hy - 2, 2, 1);
  ctx.restore();
}

export class HubCutsceneOverlay {
  public readonly id: HubCutsceneId;
  public skipped = false;

  private def: HubCutsceneDef;
  private captainName: string;
  private beatIdx = 0;
  private beatElapsed = 0;
  private totalElapsed = 0;
  private particles: Confetti[] = [];
  private fireworkTimer = 0.55;
  private pointerClicked = false;
  private onPointerDown: () => void;
  private disposed = false;

  constructor(id: HubCutsceneId, captainName: string) {
    this.id = id;
    this.def = HUB_CUTSCENES[id];
    this.captainName = captainName || 'Kapitän';

    this.onPointerDown = () => {
      this.pointerClicked = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.onPointerDown);
    }
    this.triggerBeatStart(this.def.beats[0]);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.onPointerDown);
    }
  }

  public get beatIndex(): number {
    return this.beatIdx;
  }

  /** Test-Hook: springt direkt zu einem Beat & Zeitpunkt. */
  public seek(beatIndex: number, elapsedSec = 1.4): void {
    this.beatIdx = Math.max(0, Math.min(this.def.beats.length - 1, beatIndex));
    this.beatElapsed = Math.max(0, elapsedSec);
    this.totalElapsed = Math.max(SKIP_LOCK_SEC + 0.1, elapsedSec + this.beatIdx * 4);
    this.spawnConfettiBurst(240, 110, 26);
  }

  private currentBeat(): CutsceneBeat {
    return this.def.beats[this.beatIdx];
  }

  private resolvedText(beat: CutsceneBeat): string {
    return beat.text.replaceAll('{captain}', this.captainName);
  }

  private charsPerSec(): number {
    const speed = getDeviceSettings().textSpeed;
    if (speed === 'instant') return 9999;
    if (speed === 'fast') return 95;
    return 52;
  }

  private isTextComplete(): boolean {
    const text = this.resolvedText(this.currentBeat());
    const shown = Math.floor(Math.max(0, this.beatElapsed - 0.1) * this.charsPerSec());
    return shown >= text.length;
  }

  private triggerBeatStart(beat: CutsceneBeat): void {
    if (beat.onStart === 'fanfare') {
      sound.playCelebrationFanfare();
      this.spawnConfettiBurst(240, 92, 34);
    } else if (beat.onStart === 'lights_on') {
      sound.playSecretChime();
      for (let i = 0; i < 6; i++) {
        this.spawnConfettiBurst(78 + i * 64, 72 + (i % 2) * 8, 7);
      }
    } else if (beat.onStart === 'firework') {
      this.spawnFirework(120 + Math.random() * 240, 48 + Math.random() * 38);
      sound.playSecretChime();
    } else if (beat.onStart === 'hammer') {
      sound.playForgeHammer();
      this.spawnConfettiBurst(164, 124, 24);
    } else if (beat.onStart === 'chime') {
      sound.playStoryChime();
    }
  }

  private spawnConfettiBurst(cx: number, cy: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 16 + Math.random() * 52;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 18,
        y: cy + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 22,
        color: this.def.confettiColors[i % this.def.confettiColors.length],
        size: Math.random() > 0.45 ? 2 : 1,
        life: 1.1 + Math.random() * 1.1,
        maxLife: 2.2,
      });
    }
  }

  private spawnFirework(cx: number, cy: number): void {
    const col = this.def.confettiColors[Math.floor(Math.random() * this.def.confettiColors.length)];
    for (let i = 0; i < 20; i++) {
      const ang = (Math.PI * 2 * i) / 20;
      const spd = 24 + Math.random() * 34;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: i % 3 === 0 ? '#ffffff' : col,
        size: i % 2 === 0 ? 2 : 1,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
      });
    }
  }

  public update(dt: number, input: InputManager): boolean {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.totalElapsed += safeDt;
    this.beatElapsed += safeDt;

    const clicked = this.pointerClicked;
    this.pointerClicked = false;

    if (this.def.fireworks) {
      this.fireworkTimer -= safeDt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 0.85 + Math.random() * 0.65;
        this.spawnFirework(85 + Math.random() * 310, 38 + Math.random() * 44);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.vy += 32 * safeDt;
      p.life -= safeDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.totalElapsed >= SKIP_LOCK_SEC) {
      if (input.wasPressed('Escape')) {
        this.skipped = true;
        this.dispose();
        return true;
      }
      const advancePressed =
        clicked ||
        input.wasPressed('KeyE') ||
        input.wasPressed('Space') ||
        input.wasPressed('Enter');
      if (advancePressed) {
        if (!this.isTextComplete()) {
          this.beatElapsed = Math.max(this.beatElapsed, 4.0);
          return false;
        }
        return this.advanceBeat();
      }
    }

    const dur = getDeviceSettings().shortCutscenes
      ? this.currentBeat().durationSec * 0.72
      : this.currentBeat().durationSec;
    if (this.beatElapsed >= dur) {
      return this.advanceBeat();
    }

    return false;
  }

  private advanceBeat(): boolean {
    if (this.beatIdx + 1 < this.def.beats.length) {
      this.beatIdx += 1;
      this.beatElapsed = 0;
      this.triggerBeatStart(this.currentBeat());
      return false;
    }
    this.dispose();
    return true;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const beat = this.currentBeat();
    const cheer = beat.cheerActor;

    ctx.save();

    // 1. Live-Regie auf der Promenade: Versammelte NPCs & Effekte
    if (this.def.arrival) {
      this.renderCompanionArrivalStage(ctx, art, cheer, this.def.arrival);
    } else if (this.def.focusForge) {
      this.renderMinaArrivalStage(ctx, art, cheer);
    } else {
      this.renderCelebrationStage(ctx, art, cheer);
    }

    // 2. Konfetti & Feuerwerk
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 3. Kino-Balken oben + Banner
    ctx.fillStyle = 'rgba(4, 7, 16, 0.9)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 24);
    ctx.fillStyle = this.def.accent;
    ctx.fillRect(0, 24, VIRTUAL_WIDTH, 1.5);

    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = this.def.accent;
    ctx.textAlign = 'left';
    ctx.fillText(this.def.eyebrow, 14, 10);

    ctx.font = 'bold 8.5px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(this.def.bannerTitle, 14, 20);

    // Beat-Fortschritt rechts oben
    const count = this.def.beats.length;
    for (let i = 0; i < count; i++) {
      const px = VIRTUAL_WIDTH - 16 - (count - 1 - i) * 10;
      ctx.fillStyle = i === this.beatIdx ? this.def.accent : i < this.beatIdx ? 'rgba(226,232,240,0.6)' : 'rgba(148,163,184,0.28)';
      ctx.fillRect(px - 3, 10, i === this.beatIdx ? 6 : 4, 4);
    }

    // 4. Unterer Dialog-Balken
    const boxY = VIRTUAL_HEIGHT - 62;
    ctx.fillStyle = 'rgba(6, 11, 24, 0.92)';
    ctx.fillRect(0, boxY, VIRTUAL_WIDTH, 62);
    ctx.fillStyle = beat.speakerColor;
    ctx.fillRect(0, boxY, VIRTUAL_WIDTH, 1.5);

    ctx.font = 'bold 7.5px monospace';
    ctx.fillStyle = beat.speakerColor;
    ctx.textAlign = 'left';
    ctx.fillText(beat.speaker.toUpperCase(), 18, boxY + 13);

    const fullText = this.resolvedText(beat);
    const shownCount = Math.min(fullText.length, Math.floor(Math.max(0, this.beatElapsed - 0.1) * this.charsPerSec()));
    const visibleText = fullText.slice(0, shownCount);

    ctx.font = '8.5px monospace';
    ctx.fillStyle = '#f1f5f9';
    const lines = wrapText(ctx, visibleText, VIRTUAL_WIDTH - 36);
    lines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, 18, boxY + 26 + idx * 11);
    });

    ctx.font = '6.5px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.textAlign = 'right';
    ctx.fillText('[E / KLICK] WEITER · [ESC] ÜBERSPRINGEN', VIRTUAL_WIDTH - 14, VIRTUAL_HEIGHT - 6);

    ctx.restore();
  }

  private renderCelebrationStage(
    ctx: CanvasRenderingContext2D,
    art: ReturnType<typeof getHDArt>,
    cheer: CutsceneBeat['cheerActor'],
  ): void {
    // Warmer Festschein in der Platzmitte
    drawGlow(ctx, 240, 152, 74, this.def.accent, 0.16 + Math.sin(this.totalElapsed * 3) * 0.04);

    // Lichterketten-Aufleuchten bei Sektor-1-Siegesfeier
    if (this.id === 'celebration_s1') {
      const litCount = Math.min(8, Math.floor(this.totalElapsed * 4.5) + 1);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(76, 86);
      ctx.quadraticCurveTo(240, 102, 404, 86);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const u = (i + 0.5) / 8;
        const lx = 76 + (404 - 76) * u;
        const ly = 86 + Math.sin(u * Math.PI) * 8;
        if (i < litCount) {
          const col = i % 2 === 0 ? '#fde047' : '#38e8d4';
          drawGlow(ctx, lx, ly, 9, col, 0.36);
          ctx.fillStyle = col;
          ctx.fillRect(Math.round(lx - 1.5), Math.round(ly - 1.5), 3, 3);
        } else {
          ctx.fillStyle = '#334155';
          ctx.fillRect(Math.round(lx - 1), Math.round(ly - 1), 2, 2);
        }
      }
    }

    // Versammelte Freunde rund um den Kapitän auf dem zentralen Platz (240, 156)
    const jump = (who: string): number => {
      if (cheer === 'all' || cheer === who) {
        return -Math.abs(Math.sin(this.totalElapsed * 6.2 + who.length)) * 5;
      }
      return Math.sin(this.totalElapsed * 2.5 + who.length) * 0.8;
    };

    const actors: Array<{
      id: string;
      x: number;
      y: number;
      spr: HTMLCanvasElement | null;
      w: number;
      h: number;
      label: string;
      color: string;
    }> = [
      { id: 'kael', x: 196, y: 150, spr: art.npcKael, w: 30, h: 30, label: 'Kael', color: '#fb923c' },
      { id: 'lyra', x: 284, y: 150, spr: art.npcLyra, w: 28, h: 28, label: 'Dr. Lyra', color: '#34d399' },
      { id: 'nyx', x: 212, y: 174, spr: art.npcNyx, w: 28, h: 28, label: 'Nyx', color: '#c084fc' },
      { id: 'vex', x: 268, y: 174, spr: art.npcVex, w: 28, h: 28, label: 'Vex', color: '#38bdf8' },
      { id: 'player', x: 240, y: 158, spr: art.heroDown, w: 26, h: 30, label: this.captainName, color: '#fde047' },
    ];

    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      const jy = jump(a.id);
      drawPixelShadow(ctx, a.x, a.y + 6, 9, 3.5);
      if (a.spr) {
        ctx.drawImage(a.spr, Math.round(a.x - a.w / 2), Math.round(a.y - a.h + 6 + jy), a.w, a.h);
      }
      // Kleines Jubel-Symbol über dem aktiven Sprecher
      if (cheer === 'all' || cheer === a.id) {
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = a.color;
        ctx.textAlign = 'center';
        ctx.fillText(a.id === 'player' ? '★' : '!', a.x, Math.round(a.y - a.h + 2 + jy));
      }
    }
  }

  /** Einzug eines Begleiters: Er fliegt/läuft von außen zum Laden, der Gastgeber begrüßt ihn, der Kapitän schaut zu. */
  private renderCompanionArrivalStage(
    ctx: CanvasRenderingContext2D,
    art: ReturnType<typeof getHDArt>,
    cheer: CutsceneBeat['cheerActor'],
    a: ArrivalDef,
  ): void {
    drawGlow(ctx, a.rest.x, a.rest.y - 8, 56, a.glow, 0.18 + Math.sin(this.totalElapsed * 4) * 0.05);
    const walkT = this.beatIdx === 0 ? Math.min(1, this.beatElapsed / 1.6) : 1;
    const e = walkT * walkT * (3 - 2 * walkT);
    const cx = a.start.x + (a.rest.x - a.start.x) * e;
    const cy = a.start.y + (a.rest.y - a.start.y) * e;
    const hop = (who: 'host' | 'companion'): number =>
      cheer === who && walkT >= 1 ? -Math.abs(Math.sin(this.totalElapsed * 6.4)) * 4 : 0;

    // Gastgeber
    const host = art[a.hostSprite];
    drawPixelShadow(ctx, a.hostPos.x, a.hostPos.y + 6, 9, 3.5);
    if (host) ctx.drawImage(host, Math.round(a.hostPos.x - 14), Math.round(a.hostPos.y - 22 + hop('host')), 28, 28);

    // Begleiter (Droiden schweben, die Katze springt auf den Platz)
    const spr = a.companion === 'pip' ? art.npcPip : a.companion === 'ping' ? art.npcPing : art.npcMidnight;
    const floaty = a.companion !== 'midnight';
    const bob = floaty ? Math.sin(this.totalElapsed * 3.8) * 1.6 : 0;
    const arcY = walkT < 1 ? -Math.sin(walkT * Math.PI) * (floaty ? 14 : 8) : 0;
    drawPixelShadow(ctx, cx, a.rest.y + 8, floaty ? 6 : 8, 2.4, floaty ? 0.35 : 0.5);
    if (floaty) drawGlow(ctx, cx, cy - 6 + arcY + bob, 10, a.glow, 0.2);
    if (spr) ctx.drawImage(spr, Math.round(cx - 12), Math.round(cy - 26 + arcY + bob + hop('companion')), 24, 24);

    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = a.glow;
    ctx.textAlign = 'center';
    ctx.fillText(a.tag, Math.round(cx), Math.round(cy - 30 + arcY + bob + hop('companion')));

    // Kapitän schaut zu
    const heroX = a.rest.x < 240 ? a.rest.x + 34 : a.rest.x - 34;
    drawPixelShadow(ctx, heroX, a.rest.y + 14, 8, 3);
    const hero = a.rest.x < 240 ? art.heroLeft : art.heroRight;
    if (hero) ctx.drawImage(hero, Math.round(heroX - 13), Math.round(a.rest.y - 17), 26, 30);
  }

  private renderMinaArrivalStage(
    ctx: CanvasRenderingContext2D,
    art: ReturnType<typeof getHDArt>,
    cheer: CutsceneBeat['cheerActor'],
  ): void {
    // Fokus-Vignette auf die Exo-Schmiede (144, 126)
    drawGlow(ctx, 156, 134, 62, '#fb923c', 0.2 + Math.sin(this.totalElapsed * 4) * 0.05);

    // Mina läuft im 1. Beat von unten-rechts an die zweite Werkbank (168, 136)
    const walkT = this.beatIdx === 0 ? Math.min(1, this.beatElapsed / 1.45) : 1;
    const minaX = 216 + (168 - 216) * walkT;
    const minaY = 178 + (136 - 178) * walkT;
    const minaHop = cheer === 'mina' && walkT >= 1 ? -Math.abs(Math.sin(this.totalElapsed * 6.8)) * 4.5 : 0;

    // Kael an seiner Esse
    const kaelJump = cheer === 'kael' ? -Math.abs(Math.sin(this.totalElapsed * 5.2)) * 3 : 0;
    drawPixelShadow(ctx, 144, 136, 9, 3.5);
    if (art.npcKael) {
      ctx.drawImage(art.npcKael, 129, Math.round(112 + kaelJump), 30, 30);
    }

    // Zweite Werkbank mit Amboss-Glühen (ab Beat 2 flammt sie richtig auf!)
    const lit = this.beatIdx >= 1;
    ctx.fillStyle = '#334155';
    ctx.fillRect(160, 122, 16, 8);
    ctx.fillStyle = lit ? '#fb923c' : '#64748b';
    ctx.fillRect(163, 120, 10, 3);
    if (lit) {
      drawGlow(ctx, 168, 122, 16, '#fbbf24', 0.35 + Math.sin(this.totalElapsed * 8) * 0.08);
    }

    // Mina
    drawMinaSprite(ctx, minaX, minaY + minaHop, this.totalElapsed, lit);

    // Kleines Namensschild über Mina
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText('MINA', Math.round(minaX), Math.round(minaY - 24 + minaHop));

    // Kapitän steht schauend auf dem offenen Platz rechts daneben
    drawPixelShadow(ctx, 198, 156, 8, 3);
    if (art.heroLeft) {
      ctx.drawImage(art.heroLeft, 185, 131, 26, 30);
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
