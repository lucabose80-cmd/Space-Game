// M10-C (G3): kleine Zug-Engine für Bosse. Jeder Boss = BossDef (Idle-Bewegung + Züge); Zustände:
// idle → windup (Telegraphie) → active (optional, z. B. Strahlen) → recover → idle … Phase 2 ab < 50 % HP.
import { sound } from '../../engine/audio';
import { ROOM_BOTTOM, ROOM_CENTER_X, ROOM_CENTER_Y, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP } from '../../world/dungeonGen';
import type { DungeonScene } from '../../scenes/DungeonScene';
import type { Enemy } from '../dungeonTypes';

export interface BossCtx {
  scene: DungeonScene;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  dist: number;
  dt: number;
  p2: boolean;
}

export interface BossMove {
  name: string;
  windup: number;
  /** Beginn der Vorwarnung: Zonen/Warn-Strahlen anlegen */
  start?: (e: Enemy, c: BossCtx) => void;
  /** Ende der Vorwarnung: Projektile, Sprünge, Impulse … */
  fire?: (e: Enemy, c: BossCtx) => void;
  /** Dauer des aktiven Zustands (0 = keiner); `active` wird jeden Frame mit der Zeit seit Beginn gerufen */
  duration?: number;
  active?: (e: Enemy, c: BossCtx, t: number) => void;
  /** Warn-Darstellung während der Vorwarnung (jeder Frame), p = Fortschritt 0…1 */
  windupTick?: (e: Enemy, c: BossCtx, p: number) => void;
  recover: number;
}

export interface BossDef {
  title: string;
  phase2Toast: string;
  idleSec: [number, number];
  idleMove: (e: Enemy, c: BossCtx) => void;
  onPhase2?: (e: Enemy, c: BossCtx) => void;
  moves: BossMove[];
  /** Zugfolge in Phase 2 (Indizes in `moves`); sonst dieselbe Reihenfolge wie Phase 1 */
  movesP2?: number[];
  /** Zugfolge in Phase 1 (Indizes); Standard = alle der Reihe nach */
  movesP1?: number[];
  /** M11 Teilen: Zugfolgen der beiden Hälften [A, B] (Indizes in `moves`), solange der Boss geteilt ist */
  splitMoves?: [number[], number[]];
}

export function bossBolt(
  scene: DungeonScene,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
  color: string,
  radius = 3.8,
  life = 2.2,
): void {
  scene.projectiles.push({
    x: x + Math.cos(angle) * 10,
    y: y + Math.sin(angle) * 10,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    fromPlayer: false,
    damage,
    color,
    radius,
    life,
  });
}

export function clampToRoom(x: number, y: number, m = 18): { x: number; y: number } {
  return {
    x: Math.max(ROOM_LEFT + m, Math.min(ROOM_RIGHT - m, x)),
    y: Math.max(ROOM_TOP + m, Math.min(ROOM_BOTTOM - m, y)),
  };
}

/** Deterministische Verteilung rund um den Spieler (kein Zufall): Schritt i von n, Radius r, Startwinkel a0. */
export function around(c: BossCtx, i: number, n: number, r: number, a0 = 0): { x: number; y: number } {
  const a = a0 + (i / n) * Math.PI * 2;
  return clampToRoom(c.scene.playerX + Math.cos(a) * r, c.scene.playerY + Math.sin(a) * r, 14);
}

export const ROOM = { L: ROOM_LEFT, R: ROOM_RIGHT, T: ROOM_TOP, B: ROOM_BOTTOM, CX: ROOM_CENTER_X, CY: ROOM_CENTER_Y };

/** Gleiter: Boss zu einem Zielpunkt ziehen (weich, ohne Zufall). */
export function glideTo(e: Enemy, tx: number, ty: number, gain = 2): void {
  e.vx = (tx - e.x) * gain;
  e.vy = (ty - e.y) * gain;
}

export function runBoss(e: Enemy, c: BossCtx, def: BossDef): void {
  const { scene, dt } = c;
  const p2 = e.hp <= e.maxHp * 0.5;
  if (p2 && !e.bossPhase2) {
    e.bossPhase2 = true;
    sound.playBossRoar();
    scene.triggerShake(0.5, 5.5);
    scene.shockwaves.push({ x: e.x, y: e.y, maxRadius: 120, color: '#fb923c', life: 0.45, maxLife: 0.45 });
    scene.spawnBurst(e.x, e.y, '#fde047', 26);
    scene.callbacks.onToast(def.phase2Toast, 'warn');
    def.onPhase2?.(e, { ...c, p2: true });
  }
  const split = e.splitGroup !== undefined && def.splitMoves !== undefined;
  const ctx: BossCtx = { ...c, p2: e.bossPhase2 === true && !split }; // geteilt statt verdoppelt
  e.aimAngle = Math.atan2(c.dy, c.dx);
  const sub = e.bossSub ?? 'idle';
  e.bossStateTimer = (e.bossStateTimer ?? 0) - dt;
  const seq = split ? def.splitMoves![e.splitRole ?? 0] : ctx.p2 ? def.movesP2 ?? def.movesP1 : def.movesP1;
  const order = seq ?? def.moves.map((_, i) => i);
  const move = def.moves[order[(e.bossMoveIdx ?? 0) % order.length]];

  if (sub === 'idle') {
    def.idleMove(e, ctx);
    e.bossStatusText = ctx.p2 ? 'PHASE II' : 'AKTIV';
    if (e.bossStateTimer <= 0) {
      e.bossSub = 'windup';
      e.bossStateMax = move.windup;
      e.bossStateTimer = move.windup;
      e.bossStatusText = move.name;
      move.start?.(e, ctx);
    }
  } else if (sub === 'windup') {
    e.vx *= 0.25;
    e.vy *= 0.25;
    const p = 1 - Math.max(0, e.bossStateTimer) / Math.max(0.01, e.bossStateMax ?? move.windup);
    move.windupTick?.(e, ctx, p);
    if (e.bossStateTimer <= 0) {
      move.fire?.(e, ctx);
      if ((move.duration ?? 0) > 0) {
        e.bossSub = 'active';
        e.bossT = 0;
        e.bossStateTimer = move.duration ?? 0;
      } else {
        e.bossSub = 'recover';
        e.bossStateTimer = move.recover;
      }
    }
  } else if (sub === 'active') {
    e.bossT = (e.bossT ?? 0) + dt;
    move.active?.(e, ctx, e.bossT);
    if (e.bossStateTimer <= 0) {
      e.bossSub = 'recover';
      e.bossStateTimer = move.recover;
    }
  } else {
    // recover
    e.vx *= 0.5;
    e.vy *= 0.5;
    if (e.bossStateTimer <= 0) {
      e.bossSub = 'idle';
      e.bossMoveIdx = (e.bossMoveIdx ?? 0) + 1;
      e.bossStateTimer = ctx.p2 ? def.idleSec[1] : def.idleSec[0];
    }
  }
}
