import { getHDArt } from '../assets/artLoader';
import { drawGlow, drawPixelShadow } from '../assets/pixelArt';
import { sound } from '../engine/audio';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type InputManager } from '../engine/input';
import { getDeviceSettings } from '../systems/deviceSettings';
import { BAY_POS, StationTraffic } from './stationTraffic';

export type RescueCompanionId = 'mina' | 'pip' | 'ping' | 'midnight';

interface RescueBeat {
  speaker: string;
  color: string;
  text: string;
  durationSec: number;
}

interface RescueDef {
  companion: RescueCompanionId;
  eyebrow: string;
  accent: string;
  bg: 'cutsceneBgS1' | 'cutsceneBgS2' | 'cutsceneBgS3' | 'cutsceneBgS4';
  /** Wer holt ab? Drohne (Dr. Lyras Med-Evac) oder ein Schiff */
  carrier: 'drone' | 'ship';
  tag: string;
  beats: RescueBeat[];
  /** Stationskapitel der Außenansicht (Port Solaris wächst) */
  solarisTier: 0 | 1 | 2;
}

export const RESCUE_CUTSCENE_IDS = ['rescue_mina', 'rescue_pip', 'rescue_ping', 'rescue_midnight'] as const;
export type RescueCutsceneId = (typeof RESCUE_CUTSCENE_IDS)[number];

export function rescueIdFor(c: RescueCompanionId): RescueCutsceneId {
  return `rescue_${c}` as RescueCutsceneId;
}

const RESCUES: Record<RescueCompanionId, RescueDef> = {
  mina: {
    companion: 'mina',
    eyebrow: 'SEKTOR 1 · GESTRANDET IM WRACK',
    accent: '#fb923c',
    bg: 'cutsceneBgS1',
    carrier: 'ship',
    tag: 'MINA',
    solarisTier: 0,
    beats: [
      {
        speaker: 'Mina',
        color: '#fbbf24',
        text: 'Du hast den Leviathan besiegt! Ich sitze seit Tagen in diesem Wrack fest — und träume von einer richtigen Werkbank.',
        durationSec: 4.6,
      },
      {
        speaker: '{captain}',
        color: '#38e8d4',
        text: 'Dann ist jetzt Schluss damit. Mein Schiff nimmt dich mit nach Port Solaris — Kael sucht ohnehin Verstärkung!',
        durationSec: 4.4,
      },
    ],
  },
  pip: {
    companion: 'pip',
    eyebrow: 'SEKTOR 2 · VERSCHÜTTETE MED-STATION',
    accent: '#2dd4bf',
    bg: 'cutsceneBgS2',
    carrier: 'drone',
    tag: 'PIP',
    solarisTier: 1,
    beats: [
      {
        speaker: 'Pip',
        color: '#2dd4bf',
        text: 'Piep … Medizin-Assistent M-1, Energie bei 4 Prozent. Unter diesem Kristall liegen noch Pflaster. Bitte nicht zählen lassen!',
        durationSec: 4.8,
      },
      {
        speaker: 'Dr. Lyra (Funk)',
        color: '#34d399',
        text: 'Das ist er! Halt ihn fest, {captain} — ich schicke die Rettungsdrohne. In der Med-Bay wartet schon ein Platz.',
        durationSec: 4.6,
      },
    ],
  },
  ping: {
    companion: 'ping',
    eyebrow: 'SEKTOR 3 · GIESSEREI-WRACKS',
    accent: '#38bdf8',
    bg: 'cutsceneBgS3',
    carrier: 'drone',
    tag: 'PING',
    solarisTier: 1,
    beats: [
      {
        speaker: 'Ping',
        color: '#fb923c',
        text: 'Bip-bip … Signal gefunden! Aber ich hänge in den Kabeln fest. Neunundvierzig Sekunden bis zum nächsten Echo!',
        durationSec: 4.6,
      },
      {
        speaker: 'Vex (Funk)',
        color: '#38bdf8',
        text: 'Ich hab ihn auf dem Scanner! Bleib bei ihm, {captain} — die Rettungsdrohne ist unterwegs. Ich kalibriere schon sein Labor-Dock.',
        durationSec: 4.8,
      },
    ],
  },
  midnight: {
    companion: 'midnight',
    eyebrow: 'SEKTOR 4 · OBELISK-RUINEN',
    accent: '#c084fc',
    bg: 'cutsceneBgS4',
    carrier: 'drone',
    tag: 'MITTERNACHT',
    solarisTier: 2,
    beats: [
      {
        speaker: 'Mitternacht',
        color: '#e9d5ff',
        text: 'Mrrp. (Eine kleine Void-Katze sitzt auf einem Obelisken-Splitter und sieht dich an, als gehörtest du ihr.)',
        durationSec: 4.4,
      },
      {
        speaker: 'Nyx (Funk)',
        color: '#c084fc',
        text: 'Nicht im Katalog … aber sie gehört zu mir. Nimm sie mit, {captain}. Die Drohne holt euch beide von dort ab.',
        durationSec: 4.8,
      },
    ],
  },
};

const SKIP_LOCK_SEC = 0.3;
const FADE_IN = 0.5;
const DESCEND = 1.2;
const BEAM = 1.0;
const LIFT = 1.2;
const FLY_OFF = 0.9;
const FLIGHT_HOME = 2.6;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width <= maxW) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Begleiter-Rettung (vor dem Einzug auf Port Solaris): Der Kapitän trifft Mina/Pip/Ping/Mitternacht im Sektor-Wrack,
 * es gibt einen kurzen Dialog — dann holt die Rettungsdrohne (bzw. beim Gehilfen Mina das Schiff) den Begleiter im
 * Stasis-Strahl ab und fliegt ihn nach Port Solaris (Hafenverkehr, Hangar-Schleuse). Danach folgt wie bisher die Einzugs-Szene.
 * Rein visuell, jederzeit überspringbar, respektiert „Kurze Cutscenes“.
 */
export class CompanionRescueCutscene {
  private t = 0;
  private skipped = false;
  private playedBeam = false;
  private playedLift = false;
  private playedFly = false;
  private readonly def: RescueDef;
  private readonly captain: string;
  private readonly scale: number;
  private readonly traffic = new StationTraffic(3, 17, ['pass_top']);
  private readonly beatEnds: number[] = [];
  private readonly tRescue: number;
  private readonly tHome: number;
  private readonly total: number;

  constructor(companion: RescueCompanionId, captainName: string) {
    this.def = RESCUES[companion];
    this.captain = captainName;
    this.scale = getDeviceSettings().shortCutscenes ? 0.7 : 1;
    let acc = FADE_IN;
    for (const b of this.def.beats) {
      acc += b.durationSec;
      this.beatEnds.push(acc);
    }
    this.tRescue = acc;
    this.tHome = this.tRescue + DESCEND + BEAM + LIFT + FLY_OFF;
    this.total = this.tHome + FLIGHT_HOME;
  }

  public get companionId(): RescueCompanionId {
    return this.def.companion;
  }

  public get duration(): number {
    return this.total * this.scale;
  }

  /** Teststudio: springt zu einem Zeitpunkt (Sekunden, unskaliert). */
  public seek(sec: number): void {
    this.t = Math.max(0, Math.min(this.total, sec));
  }

  public skip(): void {
    this.skipped = true;
  }

  public dispose(): void {
    /* keine globalen Listener */
  }

  public update(dt: number, input: InputManager): boolean {
    const d = Math.min(dt, 0.05) / this.scale;
    this.t += d;
    if (this.t >= this.tHome - 0.4) this.traffic.update(d);
    const rt = this.t - this.tRescue;
    if (!this.playedBeam && rt >= DESCEND) {
      this.playedBeam = true;
      sound.playDropBeam();
    }
    if (!this.playedLift && rt >= DESCEND + BEAM) {
      this.playedLift = true;
      sound.playBoardingChime();
    }
    if (!this.playedFly && this.t >= this.tHome - FLY_OFF) {
      this.playedFly = true;
      sound.playApproachWhoosh();
    }
    if (this.t * this.scale >= SKIP_LOCK_SEC) {
      if (
        input.wasPressed('Space', true) ||
        input.wasPressed('Enter', true) ||
        input.wasPressed('Escape', true) ||
        input.wasPressed('KeyE', true) ||
        input.primaryPressed()
      ) {
        this.skipped = true;
      }
    }
    return this.skipped || this.t >= this.total;
  }

  private companionSprite(): HTMLCanvasElement | null {
    const art = getHDArt();
    switch (this.def.companion) {
      case 'mina':
        return art.npcMina;
      case 'pip':
        return art.npcPip;
      case 'ping':
        return art.npcPing;
      default:
        return art.npcMidnight;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const art = getHDArt();
    const d = this.def;
    const inFlightHome = this.t >= this.tHome;
    ctx.save();
    ctx.fillStyle = '#050812';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (!inFlightHome) this.renderField(ctx, art);
    else this.renderHome(ctx, art);

    // Kino-Balken
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 20);
    ctx.fillRect(0, VIRTUAL_HEIGHT - 20, VIRTUAL_WIDTH, 20);
    ctx.font = 'bold 7px "Silkscreen", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = d.accent;
    ctx.fillText(inFlightHome ? 'RÜCKFLUG · PORT SOLARIS' : d.eyebrow, 12, 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
    ctx.font = '6px "Silkscreen", monospace';
    ctx.fillText('[KLICK / SPACE] ÜBERSPRINGEN', VIRTUAL_WIDTH - 10, VIRTUAL_HEIGHT - 10);

    // Ein-/Ausblenden
    const fadeIn = 1 - clamp01(this.t / FADE_IN);
    const fadeOut = clamp01((this.t - (this.total - 0.45)) / 0.45);
    const black = Math.max(fadeIn, fadeOut);
    if (black > 0.01) {
      ctx.fillStyle = `rgba(5, 8, 18, ${black})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
    ctx.restore();
  }

  private renderField(ctx: CanvasRenderingContext2D, art: ReturnType<typeof getHDArt>): void {
    const d = this.def;
    const t = this.t;
    const bg = art[d.bg];
    const zoom = 1.08 + Math.sin(t * 0.3) * 0.01;
    if (bg) {
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(bg, (VIRTUAL_WIDTH - w) / 2 + Math.sin(t * 0.4) * 3, (VIRTUAL_HEIGHT - h) / 2 - 6, w, h);
    }
    // sanfte Abdunklung, damit Figuren & Textbox stehen
    ctx.fillStyle = 'rgba(5, 10, 20, 0.28)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    const rt = t - this.tRescue; // < 0 = Dialog
    const groundY = 160;
    const compX = 292;
    const heroX = 236;

    // Figuren am Boden
    const sprite = this.companionSprite();
    const sz = d.companion === 'mina' ? 38 : d.companion === 'midnight' ? 26 : 28;
    const lift = rt > DESCEND + BEAM ? easeInOut(clamp01((rt - DESCEND - BEAM) / LIFT)) : 0;
    const carried = rt >= DESCEND + BEAM + LIFT;
    const flyP = carried ? easeInOut(clamp01((rt - DESCEND - BEAM - LIFT) / FLY_OFF)) : 0;

    // Kapitän (schaut zum Begleiter, winkt beim Abflug)
    drawPixelShadow(ctx, heroX, groundY + 3, 9, 3.4);
    const hero = art.heroRight;
    const wave = carried ? Math.sin(t * 9) * 1.5 : 0;
    if (hero) ctx.drawImage(hero, Math.round(heroX - 13), Math.round(groundY - 28 + wave * 0.4), 26, 30);

    // Begleiter am Boden / im Strahl
    const hoverY = -lift * 62;
    const bob = Math.sin(t * 3.4) * (d.companion === 'mina' || d.companion === 'midnight' ? 0 : 1.4);
    if (!carried) {
      drawPixelShadow(ctx, compX, groundY + 3, sz * 0.32 * (1 - lift * 0.5), 3, 0.5 * (1 - lift));
      if (lift > 0) drawGlow(ctx, compX, groundY - sz * 0.5 + hoverY, 26, d.accent, 0.4);
      if (sprite) {
        const cScale = 1 - lift * 0.12;
        ctx.drawImage(
          sprite,
          Math.round(compX - (sz * cScale) / 2),
          Math.round(groundY - sz * cScale + hoverY + bob),
          Math.round(sz * cScale),
          Math.round(sz * cScale),
        );
      }
      // Namensschild
      ctx.font = 'bold 6.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = d.accent;
      ctx.fillText(d.tag, compX, Math.round(groundY - sz - 4 + hoverY + bob));
    }

    // Rettungs-Phase: Träger + Strahl
    if (rt > -0.2) {
      const drop = easeOut(clamp01((rt + 0.2) / (DESCEND + 0.2)));
      const baseX = compX;
      const carrierY = -30 + drop * 74; // von oben bis ~44
      const offX = flyP * 260;
      const offY = -flyP * 120;
      const cx = baseX + offX;
      const cy = carrierY + offY;
      const beamOn = rt >= DESCEND && !carried;
      if (beamOn) {
        const bp = clamp01((rt - DESCEND) / 0.25);
        const grad = ctx.createLinearGradient(0, cy + 10, 0, groundY + 4);
        grad.addColorStop(0, `rgba(165, 243, 252, ${0.55 * bp})`);
        grad.addColorStop(1, `rgba(56, 232, 212, ${0.12 * bp})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 10);
        ctx.lineTo(cx + 5, cy + 10);
        ctx.lineTo(cx + 22, groundY + 4);
        ctx.lineTo(cx - 22, groundY + 4);
        ctx.closePath();
        ctx.fill();
        // aufsteigende Lichtpunkte
        for (let i = 0; i < 9; i++) {
          const ph = (t * 1.3 + i * 0.29) % 1;
          ctx.globalAlpha = (1 - ph) * 0.9;
          ctx.fillStyle = '#e0fbff';
          ctx.fillRect(Math.round(cx - 16 + ((i * 37) % 32)), Math.round(groundY - ph * (groundY - cy - 12)), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
      this.drawCarrier(ctx, art, cx, cy, t, d.carrier);
      // Der Begleiter hängt am Träger (nach dem Hochziehen)
      if (carried && sprite) {
        drawGlow(ctx, cx, cy + 12, 14, d.accent, 0.45);
        const s2 = sz * 0.6;
        ctx.drawImage(sprite, Math.round(cx - s2 / 2), Math.round(cy + 7), Math.round(s2), Math.round(s2));
      }
      // Abgasschweif beim Abflug
      if (carried && flyP > 0.02) {
        for (let i = 1; i <= 6; i++) {
          ctx.globalAlpha = (1 - i / 7) * 0.7;
          ctx.fillStyle = i % 2 ? '#fde047' : '#38e8d4';
          ctx.fillRect(Math.round(cx - i * 8 * (1 + flyP)), Math.round(cy + 4 + i * 3), 3, 3);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Dialogbox
    const beatIdx = this.beatEnds.findIndex((e) => t < e);
    if (beatIdx >= 0 && t >= FADE_IN * 0.6) {
      const b = d.beats[beatIdx];
      const start = beatIdx === 0 ? FADE_IN : this.beatEnds[beatIdx - 1];
      this.drawDialog(ctx, b, t - start);
    }
  }

  private drawCarrier(
    ctx: CanvasRenderingContext2D,
    art: ReturnType<typeof getHDArt>,
    x: number,
    y: number,
    t: number,
    kind: 'drone' | 'ship',
  ): void {
    const hov = Math.sin(t * 5) * 1.2;
    if (kind === 'drone') {
      const img = art.cutsceneMedDrone;
      drawGlow(ctx, x, y + 8, 22, '#f87171', 0.18 + Math.sin(t * 9) * 0.06);
      if (img) ctx.drawImage(img, Math.round(x - 24), Math.round(y - 22 + hov), 48, 48);
      else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x - 12, y - 4 + hov, 24, 10);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - 3, y - 2 + hov, 6, 6);
      }
    } else {
      const img = art.shipCorvetteBank ?? art.shipCorvette;
      drawGlow(ctx, x - 14, y + 4, 14, '#fbbf24', 0.35);
      if (img) ctx.drawImage(img, Math.round(x - 26), Math.round(y - 26 + hov), 52, 52);
      else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x - 20, y - 4 + hov, 40, 10);
      }
    }
  }

  private drawDialog(ctx: CanvasRenderingContext2D, b: RescueBeat, beatT: number): void {
    const text = b.text.replace('{captain}', this.captain);
    const speaker = b.speaker.replace('{captain}', this.captain);
    const bw = 400;
    const bh = 58;
    const bx = (VIRTUAL_WIDTH - bw) / 2;
    const by = VIRTUAL_HEIGHT - 20 - bh - 6;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 24, 0.9)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px "Silkscreen", monospace';
    ctx.fillStyle = b.color;
    ctx.fillText(speaker.toUpperCase(), bx + 10, by + 11);
    ctx.font = '9px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#f1f5f9';
    const shown = Math.min(text.length, Math.floor(beatT * 55));
    const lines = wrap(ctx, text.slice(0, shown), bw - 20);
    // Zeilen aus dem vollständigen Text umbrechen, damit nichts springt
    const full = wrap(ctx, text, bw - 20);
    let consumed = 0;
    for (let i = 0; i < full.length; i++) {
      const lineLen = full[i].length + 1;
      const part = text.slice(consumed, Math.min(shown, consumed + lineLen)).trimEnd();
      consumed += lineLen;
      if (part) ctx.fillText(part, bx + 10, by + 26 + i * 12);
    }
    void lines;
    ctx.restore();
  }

  private renderHome(ctx: CanvasRenderingContext2D, art: ReturnType<typeof getHDArt>): void {
    const d = this.def;
    const ht = this.t - this.tHome;
    const p = clamp01(ht / FLIGHT_HOME);
    const bg =
      (d.solarisTier === 2 && art.cutsceneBgSolarisG2) ||
      (d.solarisTier === 1 && art.cutsceneBgSolarisG1) ||
      art.cutsceneBgSolaris;
    const zoom = 1.02 + p * 0.12;
    const panX = Math.sin(this.t * 0.8) * 3;
    const panY = Math.cos(this.t * 0.6) * 2;
    if (bg) {
      const w = VIRTUAL_WIDTH * zoom;
      const h = VIRTUAL_HEIGHT * zoom;
      ctx.drawImage(bg, (VIRTUAL_WIDTH - w) / 2 + panX, (VIRTUAL_HEIGHT - h) / 2 + panY, w, h);
    }
    this.traffic.render(ctx, { zoom, panX, panY }, clamp01(ht / 0.5));

    // Träger fliegt von rechts unten in die Schleuse (Verkehr meidet diese Bahn: nur obere/Abflug-Bahnen)
    const u = easeOut(clamp01(p / 0.92));
    const x = 430 + (BAY_POS.x - 430) * u;
    const y = 250 + (BAY_POS.y - 250) * u - Math.sin(u * Math.PI) * 26;
    const sc = 1 - 0.62 * u;
    const alpha = p > 0.8 ? clamp01(1 - (p - 0.8) / 0.18) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    this.drawCarrier(ctx, art, 0, 0, this.t, d.carrier);
    const sprite = this.companionSprite();
    if (sprite) ctx.drawImage(sprite, -8, 6, 16, 16);
    ctx.restore();

    // Schleuse leuchtet beim Einflug
    if (p > 0.6) {
      drawGlow(ctx, BAY_POS.x, BAY_POS.y, 34, '#38e8d4', Math.sin(clamp01((p - 0.6) / 0.4) * Math.PI) * 0.6);
    }

    // Ortskarte
    const ca = clamp01(ht / 0.4) * (1 - clamp01((ht - (FLIGHT_HOME - 0.7)) / 0.5));
    if (ca > 0.02) {
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.82)';
      ctx.fillRect(VIRTUAL_WIDTH / 2 - 120, VIRTUAL_HEIGHT - 78, 240, 36);
      ctx.strokeStyle = d.accent;
      ctx.strokeRect(VIRTUAL_WIDTH / 2 - 119.5, VIRTUAL_HEIGHT - 77.5, 239, 35);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 7px "Silkscreen", monospace';
      ctx.fillStyle = d.accent;
      ctx.fillText(`${d.tag} · AUF DEM WEG NACH PORT SOLARIS`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 66);
      ctx.font = '8px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(d.carrier === 'drone' ? `Die Rettungsdrohne bringt ${d.beats[0].speaker} sicher heim.` : `Dein Schiff bringt ${d.beats[0].speaker} sicher heim.`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 52);
      ctx.restore();
    }
  }
}
