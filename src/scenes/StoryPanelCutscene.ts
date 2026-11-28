import { getHDArt } from '../assets/artLoader';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';

export type PanelCutsceneId = 'intro_arrival' | 'story_gate5' | 'story_omega_finale';

export type ReplayableCutsceneId =
  | PanelCutsceneId
  | 'celebration_s1'
  | 'celebration_s2'
  | 'celebration_s3'
  | 'celebration_s4'
  | 'celebration_omega'
  | 'story_mina_arrives';

export interface CutsceneCatalogEntry {
  id: ReplayableCutsceneId;
  kind: 'panel' | 'hub';
  chapter: number;
  title: string;
  subtitle: string;
  icon: string;
}

/** Katalog aller wiederholbaren Story- & Feier-Cutscenes (für die Chronik im Logbuch). */
export const CUTSCENE_CATALOG: CutsceneCatalogEntry[] = [
  {
    id: 'intro_arrival',
    kind: 'panel',
    chapter: 0,
    title: 'Ankunft auf Port Solaris',
    subtitle: 'Prolog · Ein alter Laden am Rand der Wrack-Sektoren',
    icon: '🚀',
  },
  {
    id: 'celebration_s1',
    kind: 'hub',
    chapter: 1,
    title: 'Siegesfeier: Der Leviathan fällt',
    subtitle: 'Kapitel I · Die Lichterketten über Port Solaris erwachen',
    icon: '🎉',
  },
  {
    id: 'story_mina_arrives',
    kind: 'hub',
    chapter: 1,
    title: 'Kaels neue Gehilfin',
    subtitle: 'Exo-Schmiede · Mina übernimmt die zweite Werkbank',
    icon: '🔨',
  },
  {
    id: 'celebration_s2',
    kind: 'hub',
    chapter: 2,
    title: 'Fest der singenden Kristalle',
    subtitle: 'Kapitel II · Kristall-Laternen über der Promenade',
    icon: '💎',
  },
  {
    id: 'celebration_s3',
    kind: 'hub',
    chapter: 3,
    title: 'Funken der Sonnenschmiede',
    subtitle: 'Kapitel III · Solar-Wimpel & Jubel nach dem Vulkan-Titan',
    icon: '🔥',
  },
  {
    id: 'celebration_s4',
    kind: 'hub',
    chapter: 4,
    title: 'Erbe der Ältesten',
    subtitle: 'Kapitel IV · Der Holo-Obelisk erwacht auf dem Platz',
    icon: '✨',
  },
  {
    id: 'story_gate5',
    kind: 'panel',
    chapter: 4,
    title: 'Das 5. Tor öffnet sich',
    subtitle: 'Kapitel IV · Vier Sektor-Siegel vereint',
    icon: '🌀',
  },
  {
    id: 'celebration_omega',
    kind: 'hub',
    chapter: 5,
    title: 'Das große Omega-Fest',
    subtitle: 'Kapitel V · Sternenbanner & Feuerwerk über Port Solaris',
    icon: '🎆',
  },
  {
    id: 'story_omega_finale',
    kind: 'panel',
    chapter: 5,
    title: 'Licht jenseits des 5. Tors',
    subtitle: 'Kapitel V · Ein neuer Morgen für die Station',
    icon: '🌟',
  },
];

type PanelBgKey =
  | 'cutsceneIntro1'
  | 'cutsceneIntro2'
  | 'cutsceneIntro3'
  | 'cutsceneIntro4'
  | 'cutsceneStoryGate5'
  | 'cutsceneStoryOmega';

type FallbackBgKey = 'cutsceneBgS1' | 'cutsceneBgSolaris' | 'shopBg' | 'hubBg' | 'cutsceneBgS5';

type PanelFxMode = 'echo_space' | 'solaris_approach' | 'cozy_shop' | 'promenade_dusk' | 'gate5_seals' | 'omega_fireworks';

interface PanelDef {
  bgKey: PanelBgKey;
  fallbackKey: FallbackBgKey;
  fxMode: PanelFxMode;
  eyebrow: string;
  speaker?: string;
  speakerColor?: string;
  text: string;
  accent: string;
  durationSec: number;
  zoomFrom: number;
  zoomTo: number;
  panX: number;
}

interface PanelCutsceneDef {
  id: PanelCutsceneId;
  title: string;
  panels: PanelDef[];
}

const PANEL_CUTSCENES: Record<PanelCutsceneId, PanelCutsceneDef> = {
  intro_arrival: {
    id: 'intro_arrival',
    title: 'ANKUNFT AUF PORT SOLARIS',
    panels: [
      {
        bgKey: 'cutsceneIntro1',
        fallbackKey: 'cutsceneBgS1',
        fxMode: 'echo_space',
        eyebrow: 'PROLOG · DIE VIER SEKTOREN',
        text: 'Draußen im Sternennebel treiben vier uralte Wrack-Sektoren — voller vergessener Relikte und einem leisen, seltsamen Echo.',
        accent: '#38e8d4',
        durationSec: 5.8,
        zoomFrom: 1.0,
        zoomTo: 1.07,
        panX: -6,
      },
      {
        bgKey: 'cutsceneIntro2',
        fallbackKey: 'cutsceneBgSolaris',
        fxMode: 'solaris_approach',
        eyebrow: 'PROLOG · PORT SOLARIS',
        text: 'Am Rand der Sektoren schwebt Port Solaris: eine ruhige Handelsstation, deren Lichter seit Jahren schwächer geworden sind.',
        accent: '#f59e0b',
        durationSec: 5.8,
        zoomFrom: 1.06,
        zoomTo: 1.0,
        panX: 6,
      },
      {
        bgKey: 'cutsceneIntro3',
        fallbackKey: 'shopBg',
        fxMode: 'cozy_shop',
        eyebrow: 'PROLOG · ASTRO-BARTER',
        speaker: 'Dein neuer Laden',
        speakerColor: '#fbbf24',
        text: 'Ein Schlüssel, leere Vitrinen und ein alter Tresen — dein Erbe: der Relikt-Laden „Astro-Barter“. Hier beginnt dein Abenteuer.',
        accent: '#fbbf24',
        durationSec: 6.0,
        zoomFrom: 1.02,
        zoomTo: 1.08,
        panX: -4,
      },
      {
        bgKey: 'cutsceneIntro4',
        fallbackKey: 'hubBg',
        fxMode: 'promenade_dusk',
        eyebrow: 'PROLOG · EIN NEUES KAPITEL',
        speaker: 'Port Solaris',
        speakerColor: '#38bdf8',
        text: 'Tagsüber plünderst du die Sektoren. Nachts feilschst du im Laden — und vielleicht lüftest du das Geheimnis hinter dem 5. Tor.',
        accent: '#38bdf8',
        durationSec: 6.2,
        zoomFrom: 1.0,
        zoomTo: 1.06,
        panX: 5,
      },
    ],
  },
  story_gate5: {
    id: 'story_gate5',
    title: 'DAS 5. TOR ERWACHT',
    panels: [
      {
        bgKey: 'cutsceneStoryGate5',
        fallbackKey: 'cutsceneBgS5',
        fxMode: 'gate5_seals',
        eyebrow: 'KAPITEL IV · VIER SIEGEL VEREINT',
        speaker: 'Raumhafen',
        speakerColor: '#c084fc',
        text: 'Korvette, Kristall-Nebel, Solar-Gießerei und Monolith — alle vier Sektor-Siegel schwingen im Einklang. Das 5. Tor erwacht!',
        accent: '#c084fc',
        durationSec: 6.2,
        zoomFrom: 1.0,
        zoomTo: 1.09,
        panX: 0,
      },
      {
        bgKey: 'cutsceneStoryGate5',
        fallbackKey: 'cutsceneBgS5',
        fxMode: 'gate5_seals',
        eyebrow: 'KAPITEL IV · JENSEITS DES HORIZONTS',
        speaker: 'Vex',
        speakerColor: '#38bdf8',
        text: '„Es war nie eine Falle, {captain}. Das Echo war ein Leuchtfeuer! Mach dich bereit — dahinter wartet der Omega-Archon.“',
        accent: '#38bdf8',
        durationSec: 6.2,
        zoomFrom: 1.08,
        zoomTo: 1.01,
        panX: 4,
      },
    ],
  },
  story_omega_finale: {
    id: 'story_omega_finale',
    title: 'LICHT ÜBER PORT SOLARIS',
    panels: [
      {
        bgKey: 'cutsceneStoryOmega',
        fallbackKey: 'cutsceneBgSolaris',
        fxMode: 'omega_fireworks',
        eyebrow: 'KAPITEL V · DER OMEGA-SIEG',
        text: 'Das alte Echo verstummt — nicht in Dunkelheit, sondern in tausend goldenen Sternen, die bis zur Promenade hinüberleuchten.',
        accent: '#fbbf24',
        durationSec: 6.2,
        zoomFrom: 1.0,
        zoomTo: 1.07,
        panX: -4,
      },
      {
        bgKey: 'cutsceneStoryOmega',
        fallbackKey: 'cutsceneBgSolaris',
        fxMode: 'omega_fireworks',
        eyebrow: 'KAPITEL V · EIN NEUER MORGEN',
        speaker: 'Port Solaris',
        speakerColor: '#34d399',
        text: 'Händler, Pilger und Freunde feiern auf der Promenade. Port Solaris strahlt wieder — dank dir, {captain}.',
        accent: '#34d399',
        durationSec: 6.4,
        zoomFrom: 1.06,
        zoomTo: 1.0,
        panX: 4,
      },
    ],
  },
};

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

const SKIP_LOCK_SEC = 0.28;
const PANEL_FADE_SEC = 0.42;

export class StoryPanelCutscene {
  public readonly id: PanelCutsceneId;
  public skipped = false;

  private def: PanelCutsceneDef;
  private captainName: string;
  private panelIdx = 0;
  private panelElapsed = 0;
  private totalElapsed = 0;
  private particles: SparkParticle[] = [];
  private fireworkTimer = 0.4;
  private pointerClicked = false;
  private onPointerDown: () => void;
  private disposed = false;

  constructor(id: PanelCutsceneId, captainName: string) {
    this.id = id;
    this.def = PANEL_CUTSCENES[id];
    this.captainName = captainName || 'Kapitän';

    this.onPointerDown = () => {
      this.pointerClicked = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.onPointerDown);
    }
    this.seedParticles();
    sound.playStoryChime();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.onPointerDown);
    }
  }

  public get panelIndex(): number {
    return this.panelIdx;
  }

  public get panelCount(): number {
    return this.def.panels.length;
  }

  /** Test-Hook: springt direkt zu einem Panel & Zeitpunkt. */
  public seek(panelIndex: number, elapsedSec = 1.2): void {
    this.panelIdx = Math.max(0, Math.min(this.def.panels.length - 1, panelIndex));
    this.panelElapsed = Math.max(0, elapsedSec);
    this.totalElapsed = Math.max(SKIP_LOCK_SEC + 0.1, elapsedSec);
    this.seedParticles();
  }

  private currentPanel(): PanelDef {
    return this.def.panels[this.panelIdx];
  }

  private resolvedText(panel: PanelDef): string {
    return panel.text.replaceAll('{captain}', this.captainName);
  }

  private charsPerSec(): number {
    const speed = getDeviceSettings().textSpeed;
    if (speed === 'instant') return 9999;
    if (speed === 'fast') return 95;
    return 48;
  }

  private isTextComplete(): boolean {
    const text = this.resolvedText(this.currentPanel());
    const shown = Math.floor(Math.max(0, this.panelElapsed - 0.15) * this.charsPerSec());
    return shown >= text.length;
  }

  private seedParticles(): void {
    this.particles = [];
    const mode = this.currentPanel().fxMode;
    const count = mode === 'omega_fireworks' ? 36 : 26;
    for (let i = 0; i < count; i++) {
      this.particles.push(this.makeAmbientParticle(mode, true));
    }
  }

  private makeAmbientParticle(mode: PanelFxMode, randomY: boolean): SparkParticle {
    const palette =
      mode === 'cozy_shop'
        ? ['#fde68a', '#fbbf24', '#fb923c']
        : mode === 'gate5_seals'
          ? ['#38e8d4', '#c084fc', '#fb923c', '#fde047']
          : mode === 'omega_fireworks'
            ? ['#fde047', '#38e8d4', '#f472b6', '#fb923c', '#a78bfa']
            : ['#e2e8f0', '#38e8d4', '#fbbf24'];
    const color = palette[Math.floor(Math.random() * palette.length)];
    return {
      x: Math.random() * VIRTUAL_WIDTH,
      y: randomY ? 26 + Math.random() * (VIRTUAL_HEIGHT - 96) : VIRTUAL_HEIGHT - 74,
      vx: (Math.random() - 0.5) * (mode === 'solaris_approach' ? 18 : 8),
      vy: mode === 'cozy_shop' || mode === 'promenade_dusk' ? -4 - Math.random() * 8 : (Math.random() - 0.5) * 6,
      size: Math.random() > 0.72 ? 2 : 1,
      color,
      life: 1.5 + Math.random() * 2.5,
      maxLife: 4,
    };
  }

  private spawnFirework(): void {
    const cx = 70 + Math.random() * (VIRTUAL_WIDTH - 140);
    const cy = 42 + Math.random() * 82;
    const colors = ['#fde047', '#38e8d4', '#f472b6', '#fb923c', '#a78bfa'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.2;
      const spd = 22 + Math.random() * 34;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: Math.random() > 0.4 ? 2 : 1,
        color,
        life: 0.7 + Math.random() * 0.55,
        maxLife: 1.25,
      });
    }
  }

  public update(dt: number, input: InputManager): boolean {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.totalElapsed += safeDt;
    this.panelElapsed += safeDt;

    const panel = this.currentPanel();
    const clicked = this.pointerClicked;
    this.pointerClicked = false;

    // Partikel updaten
    if (panel.fxMode === 'omega_fireworks') {
      this.fireworkTimer -= safeDt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 0.75 + Math.random() * 0.6;
        this.spawnFirework();
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      if (panel.fxMode === 'omega_fireworks' && p.maxLife < 2) {
        p.vy += 26 * safeDt;
      }
      p.life -= safeDt;
      if (p.life <= 0) {
        if (this.particles.length <= 28) {
          this.particles[i] = this.makeAmbientParticle(panel.fxMode, false);
        } else {
          this.particles.splice(i, 1);
        }
      }
    }

    // Eingabe nach kurzer Schutzzeit
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
          // Erst Text vollständig anzeigen
          this.panelElapsed = Math.max(this.panelElapsed, 4.0);
          return false;
        }
        return this.advancePanel();
      }
    }

    // Automatisches Weiterblättern nach Panel-Dauer (Kurz-Modus etwas zügiger)
    const dur = getDeviceSettings().shortCutscenes ? panel.durationSec * 0.7 : panel.durationSec;
    if (this.panelElapsed >= dur) {
      return this.advancePanel();
    }

    return false;
  }

  private advancePanel(): boolean {
    if (this.panelIdx + 1 < this.def.panels.length) {
      this.panelIdx += 1;
      this.panelElapsed = 0;
      this.seedParticles();
      sound.playStoryChime();
      return false;
    }
    this.dispose();
    return true;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const panel = this.currentPanel();
    const art = getHDArt();
    const img = art[panel.bgKey] ?? art[panel.fallbackKey];
    const tNorm = Math.min(1, this.panelElapsed / panel.durationSec);

    ctx.save();
    ctx.fillStyle = '#050812';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 1. Hintergrund mit sanftem Ken-Burns-Zoom & Pan
    if (img) {
      const zoom = panel.zoomFrom + (panel.zoomTo - panel.zoomFrom) * tNorm;
      const panX = panel.panX * (tNorm - 0.5);
      const drawW = VIRTUAL_WIDTH * zoom;
      const drawH = VIRTUAL_HEIGHT * zoom;
      const dx = (VIRTUAL_WIDTH - drawW) / 2 + panX;
      const dy = (VIRTUAL_HEIGHT - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }

    // 2. Atmosphärische Live-Overlays je Panel-Modus
    this.renderPanelFx(ctx, panel, tNorm);

    // 3. Partikel
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / Math.min(1, p.maxLife)));
      ctx.globalAlpha = alpha * 0.88;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 4. Sanfte Kino-Vignette & Balken oben/unten
    const vig = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    vig.addColorStop(0, 'rgba(4, 7, 16, 0.72)');
    vig.addColorStop(0.2, 'rgba(4, 7, 16, 0.08)');
    vig.addColorStop(0.64, 'rgba(4, 7, 16, 0.18)');
    vig.addColorStop(1, 'rgba(4, 7, 16, 0.94)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Oberer Kino-Balken + Fortschrittspunkte
    ctx.fillStyle = '#040710';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 22);
    ctx.fillStyle = panel.accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 22, VIRTUAL_WIDTH, 1);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = panel.accent;
    ctx.textAlign = 'left';
    ctx.fillText(panel.eyebrow, 14, 14);

    // Panel-Punkte rechts oben
    const count = this.def.panels.length;
    for (let i = 0; i < count; i++) {
      const px = VIRTUAL_WIDTH - 16 - (count - 1 - i) * 10;
      ctx.fillStyle = i === this.panelIdx ? panel.accent : i < this.panelIdx ? 'rgba(226,232,240,0.55)' : 'rgba(148,163,184,0.28)';
      ctx.fillRect(px - 3, 9, i === this.panelIdx ? 6 : 4, 4);
    }

    // 5. Unterer Kino-Balken + Schreibmaschinen-Textbox
    const boxY = VIRTUAL_HEIGHT - 68;
    ctx.fillStyle = 'rgba(6, 11, 24, 0.92)';
    ctx.fillRect(0, boxY, VIRTUAL_WIDTH, 68);
    ctx.fillStyle = panel.accent;
    ctx.fillRect(0, boxY, VIRTUAL_WIDTH, 1.5);

    let textStartY = boxY + 18;
    if (panel.speaker) {
      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = panel.speakerColor ?? panel.accent;
      ctx.textAlign = 'left';
      ctx.fillText(panel.speaker.toUpperCase(), 20, boxY + 14);
      textStartY = boxY + 27;
    }

    const fullText = this.resolvedText(panel);
    const shownCount = Math.min(fullText.length, Math.floor(Math.max(0, this.panelElapsed - 0.15) * this.charsPerSec()));
    const visibleText = fullText.slice(0, shownCount);

    ctx.font = '8.5px monospace';
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, visibleText, VIRTUAL_WIDTH - 40);
    lines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, 20, textStartY + idx * 12);
    });

    // Steuerungs-Hinweis rechts unten
    ctx.font = '6.5px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.textAlign = 'right';
    const hint = this.isTextComplete()
      ? this.panelIdx + 1 < count
        ? '[E / KLICK] WEITER · [ESC] ÜBERSPRINGEN'
        : '[E / KLICK] STARTEN · [ESC] ÜBERSPRINGEN'
      : '[E / KLICK] TEXT · [ESC] ÜBERSPRINGEN';
    ctx.fillText(hint, VIRTUAL_WIDTH - 14, VIRTUAL_HEIGHT - 7);

    // 6. Sanfte Überblendung am Panel-Anfang
    if (this.panelElapsed < PANEL_FADE_SEC) {
      const fade = 1 - this.panelElapsed / PANEL_FADE_SEC;
      ctx.fillStyle = `rgba(4, 7, 16, ${fade.toFixed(3)})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    ctx.restore();
  }

  private renderPanelFx(ctx: CanvasRenderingContext2D, panel: PanelDef, tNorm: number): void {
    const art = getHDArt();
    if (panel.fxMode === 'echo_space') {
      // Pulsierende Echo-Ringe im Tiefraum
      const cx = VIRTUAL_WIDTH * 0.62;
      const cy = VIRTUAL_HEIGHT * 0.38;
      for (let i = 0; i < 3; i++) {
        const phase = (this.panelElapsed * 0.45 + i * 0.33) % 1;
        ctx.save();
        ctx.strokeStyle = panel.accent;
        ctx.globalAlpha = (1 - phase) * 0.42;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 18 + phase * 110, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (panel.fxMode === 'solaris_approach') {
      // Kleine Korvette fliegt warm Richtung Port Solaris
      const ship = art.shipCorvetteBank ?? art.shipCorvette;
      if (ship) {
        const sx = 64 + tNorm * 168;
        const sy = 152 - tNorm * 42 + Math.sin(this.panelElapsed * 3.2) * 2.5;
        const sc = 1 - tNorm * 0.35;
        const sz = Math.round(48 * sc);
        ctx.save();
        // Sanfter Triebwerks-Schweif
        ctx.fillStyle = 'rgba(56, 232, 212, 0.35)';
        ctx.fillRect(sx - sz * 0.55, sy + 2, sz * 0.42, 3);
        ctx.drawImage(ship, sx - sz / 2, sy - sz / 2, sz, sz);
        ctx.restore();
      }
    } else if (panel.fxMode === 'cozy_shop') {
      // Warmes Glühlicht über dem Ladentresen
      const glow = ctx.createRadialGradient(VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT * 0.36, 12, VIRTUAL_WIDTH * 0.5, VIRTUAL_HEIGHT * 0.36, 150);
      const pulse = 0.24 + Math.sin(this.panelElapsed * 2.4) * 0.04;
      glow.addColorStop(0, `rgba(251, 191, 36, ${pulse.toFixed(3)})`);
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (panel.fxMode === 'promenade_dusk') {
      // Sanfter Abendschein + 5.-Tor-Schimmer rechts
      const glow = ctx.createRadialGradient(VIRTUAL_WIDTH * 0.82, VIRTUAL_HEIGHT * 0.42, 8, VIRTUAL_WIDTH * 0.82, VIRTUAL_HEIGHT * 0.42, 110);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    } else if (panel.fxMode === 'gate5_seals') {
      // 4 leuchtende Siegel kreisen in die Tormitte
      const cx = VIRTUAL_WIDTH * 0.5;
      const cy = VIRTUAL_HEIGHT * 0.38;
      const sealColors = ['#38e8d4', '#c084fc', '#fb923c', '#fde047'];
      sealColors.forEach((col, i) => {
        const ang = this.panelElapsed * 1.4 + (Math.PI * 2 * i) / 4;
        const rad = Math.max(12, 68 - tNorm * 42);
        const sx = cx + Math.cos(ang) * rad;
        const sy = cy + Math.sin(ang) * rad * 0.65;
        ctx.save();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
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
