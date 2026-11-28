// M12 Phase D: A.E.G.I.S. Leviathan als Arena-Endboss in der Reaktorhalle (MILESTONE_12_ARCHITECTURE.md §6).
// Läuft nur, wenn der Bossraum eine Arena ist (`room.arenaKind === 'boss_leviathan'`); sonst bleibt der alte Kampf.
//  Phase I  (100–65 %) Wache:      Kran-Hammer (Arm steckt 1,6 s → Arm angreifbar) · Kabel-Peitsche · Ventil-Dampf. Schwachstelle: Arme.
//  Phase II (65–30 %)  Überlast:   Mittel-Platten brechen weg (1,2 s Vorwarnung) · Zwillings-Strahl über die Halle · Trümmerfall ·
//                                   Kabel-Griff statt zerstörtem Arm. Schwachstelle: 4 Kühlventile → Linse 3 s offen.
//  Phase III (< 30 %)  Kern frei:  Panzer fällt ab · Glut-Wellen Nord→Süd (mit Lücken) · Omega-Puls (Ring mit Lücke) · Letzter Griff (Sog).
//                                   Schwachstelle: Kern-Linse dauerhaft offen; < 15 % kritisch (schnellere Züge).
// Schaden nur an offenen Schwachstellen, sonst Funken + „GEPANZERT“ (A3). Alle Gefahren über bossFx/debrisDrops mit Vorwarnung
// (≥ 0,4 s, Arena-Änderungen ≥ 0,8 s). Kein globaler Zufall (Trümmer-Positionen: mulberry32 je Boss/Zug).
import { getHDArt } from '../../assets/artLoader';
import { sound } from '../../engine/audio';
import { drawRig } from '../../engine/rig';
import { RIGS } from '../../data/rigs';
import { getBossPose } from '../anim/bossAnims';
import { startArenaVault } from '../arenaVault';
import { ENDBOSS_ARENA } from '../../data/balance';
import { ARENAS, ARENA_TILE, arenaTileRects } from '../../data/arenas';
import { mulberry32 } from '../../systems/seededRng';
import type { DungeonScene } from '../../scenes/DungeonScene';
import type { DetachedPart } from '../anim/detached';
import type { DungeonRoom } from '../../world/dungeonGen';
import type { Enemy, LeviathanArm } from '../dungeonTypes';

export type LevArenaMove = 'hammer' | 'whip' | 'steam' | 'beam' | 'debris' | 'grab' | 'pulse' | 'glow';
export type LevArenaState = 'intro' | 'idle' | 'move' | 'transition' | 'dead';

export interface LevVent {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  broken: boolean;
}

export interface LevArena {
  phase: 1 | 2 | 3;
  state: LevArenaState;
  /** Zeit im aktuellen Zustand / Restdauer */
  timer: number;
  move: LevArenaMove | null;
  moveIdx: number;
  armHp: [number, number];
  armMax: number;
  vents: LevVent[];
  /** Restzeit, in der die Kern-Linse offen ist (Phase II) */
  lensOpen: number;
  critical: boolean;
  platesBroken: boolean;
  /** Fortschritt (s) des 3-stufigen Plattenbruchs während der Phase-II-Vorwarnung */
  plateCrackT: number;
  /** zuletzt getroffener Trefferpunkt (gesetzt von getClosestEnemyHitPoint), gilt nur im selben Frame */
  lastHit: { id: string; weak: boolean; time: number } | null;
  armorMsgCd: number;
  /** Zug-Zähler für deterministische Muster */
  seq: number;
}

/** Zugfolgen je Phase (zyklisch). */
const SEQ: Record<1 | 2 | 3, LevArenaMove[]> = {
  1: ['hammer', 'whip', 'steam', 'hammer', 'whip', 'hammer', 'steam'],
  2: ['beam', 'debris', 'hammer', 'steam', 'debris', 'whip'],
  3: ['pulse', 'glow', 'grab', 'debris', 'pulse', 'whip'],
};

const PHASE_NAME: Record<1 | 2 | 3, string> = { 1: 'PHASE I · WACHE', 2: 'PHASE II · ÜBERLAST', 3: 'PHASE III · KERN FREI' };

const ARM_R = 17;
const VENT_R = 11;
const LENS_R = 14;
const LENS_DY = 6;

export function isLeviathanArena(scene: DungeonScene, e: Enemy): boolean {
  return e.kind === 'boss_leviathan' && !!e.levArena && scene.currentRoom.arenaKind === 'boss_leviathan';
}

/** Beim Spawn im Arena-Raum: Zustand anlegen, Arme weiter außen, Ventile aus dem Kachelplan. */
export function createLeviathanArena(scene: DungeonScene, e: Enemy): void {
  const def = ARENAS.boss_leviathan;
  const rb = scene.bounds;
  const vents: LevVent[] = [];
  if (def) {
    def.tiles.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== 'v') continue;
        const hp = Math.round(e.maxHp * ENDBOSS_ARENA.leviathan.ventHpShare);
        vents.push({ x: rb.l + c * ARENA_TILE + ARENA_TILE / 2, y: rb.t + r * ARENA_TILE + ARENA_TILE / 2, hp, maxHp: hp, broken: false });
      }
    });
  }
  const armMax = Math.round(e.maxHp * ENDBOSS_ARENA.leviathan.armHpShare);
  e.levArena = {
    phase: 1,
    state: 'intro',
    timer: -1,
    move: null,
    moveIdx: 0,
    armHp: [armMax, armMax],
    armMax,
    vents,
    lensOpen: 0,
    critical: false,
    platesBroken: false,
    plateCrackT: 0,
    lastHit: null,
    armorMsgCd: 0,
    seq: 0,
  };
  if (e.levArms) {
    for (const arm of e.levArms) {
      arm.homeX = rb.cx + arm.side * 102;
      arm.homeY = rb.t + 72;
      arm.x = arm.targetX = arm.homeX;
      arm.y = arm.targetY = arm.homeY;
    }
  }
  e.bossStatusText = 'REAKTORHALLE';
}

// ---------------------------------------------------------------- Schwachstellen / Treffer

export interface ArenaHitPoint {
  id: string;
  x: number;
  y: number;
  r: number;
  weak: boolean;
}

function armWeak(L: LevArena, arm: LeviathanArm): boolean {
  return L.phase < 3 && !arm.dead && arm.state === 'grounded';
}

export function lensIsOpen(L: LevArena): boolean {
  return L.phase === 3 || L.lensOpen > 0;
}

/** Alle Trefferpunkte (Körper = Panzer, Arme, Ventile, Linse). */
export function arenaHitPoints(e: Enemy): ArenaHitPoint[] {
  const L = e.levArena;
  if (!L) return [];
  const pts: ArenaHitPoint[] = [];
  const open = lensIsOpen(L);
  pts.push({ id: 'lens', x: e.x, y: e.y + LENS_DY, r: LENS_R, weak: open });
  pts.push({ id: 'body', x: e.x, y: e.y, r: e.radius, weak: false });
  e.levArms?.forEach((arm, i) => {
    if (!arm.dead) pts.push({ id: `arm${i}`, x: arm.x, y: arm.y, r: ARM_R, weak: armWeak(L, arm) });
  });
  L.vents.forEach((v, i) => {
    if (!v.broken) pts.push({ id: `vent${i}`, x: v.x, y: v.y, r: VENT_R, weak: L.phase >= 2 });
  });
  return pts;
}

/** Nächster Trefferpunkt zu (rx, ry); offene Schwachstellen haben Vorrang, wenn sie fast gleich nah sind. Merkt sich den Treffer. */
export function arenaClosestHitPoint(scene: DungeonScene, e: Enemy, rx: number, ry: number): ArenaHitPoint {
  const L = e.levArena!;
  let best: ArenaHitPoint | null = null;
  let bestD = Infinity;
  for (const p of arenaHitPoints(e)) {
    const d = Math.hypot(p.x - rx, p.y - ry) - p.r - (p.weak ? 12 : 0);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  const hit = best ?? { id: 'body', x: e.x, y: e.y, r: e.radius, weak: false };
  L.lastHit = { id: hit.id, weak: hit.weak, time: scene.time };
  return hit;
}

/** Strahl (Rail-Schuss): trifft er eine offene Schwachstelle? Merkt sich den Treffer. */
export function arenaBeamHit(scene: DungeonScene, e: Enemy, sx: number, sy: number, ex: number, ey: number): boolean {
  const L = e.levArena!;
  let any = false;
  let weakHit: ArenaHitPoint | null = null;
  for (const p of arenaHitPoints(e)) {
    if (scene.pointToSegmentDist(p.x, p.y, sx, sy, ex, ey) <= p.r + 6) {
      any = true;
      if (p.weak && !weakHit) weakHit = p;
    }
  }
  if (any) L.lastHit = { id: weakHit?.id ?? 'body', weak: !!weakHit, time: scene.time };
  return any;
}

/** Ziel-Hilfe: offene Schwachstellen als Ziele (Index 0–1 Arme, 2–5 Ventile, 6 Linse). */
export function arenaAimPoints(e: Enemy): Array<{ idx: number; x: number; y: number }> {
  const L = e.levArena;
  if (!L) return [];
  const out: Array<{ idx: number; x: number; y: number }> = [];
  e.levArms?.forEach((arm, i) => {
    if (armWeak(L, arm)) out.push({ idx: i, x: arm.x, y: arm.y });
  });
  if (L.phase >= 2) L.vents.forEach((v, i) => !v.broken && out.push({ idx: 2 + i, x: v.x, y: v.y }));
  if (lensIsOpen(L)) out.push({ idx: 6, x: e.x, y: e.y + LENS_DY });
  return out;
}

export function arenaAimPoint(e: Enemy, idx: number): { x: number; y: number; r: number } | null {
  const L = e.levArena;
  if (!L) return null;
  if (idx <= 1) {
    const arm = e.levArms?.[idx];
    return arm && !arm.dead ? { x: arm.x, y: arm.y, r: 12 } : null;
  }
  if (idx === 6) return { x: e.x, y: e.y + LENS_DY, r: LENS_R };
  const v = L.vents[idx - 2];
  return v && !v.broken ? { x: v.x, y: v.y, r: VENT_R } : null;
}

/**
 * Schadensfilter (aus `DungeonScene.damageEnemy`, direkt vor dem Abzug): Rückgabe = Schaden am HP-Pool (0 = gepanzert).
 * Ohne frischen Treffer im selben Frame (z. B. Brand, Ketten-Blitz) gilt der Panzer.
 */
export function leviathanArenaDamage(scene: DungeonScene, e: Enemy, amount: number): number {
  const L = e.levArena!;
  if (L.state === 'intro' || L.state === 'dead') return 0;
  const hit = L.lastHit && L.lastHit.time === scene.time ? L.lastHit : null;
  if (!hit || !hit.weak) {
    armorFeedback(scene, e, hit?.id);
    return 0;
  }
  if (hit.id.startsWith('arm')) {
    const i = Number(hit.id.slice(3)) as 0 | 1;
    const arm = e.levArms?.[i];
    if (!arm || arm.dead) return 0;
    const dealt = Math.min(amount, Math.max(0, L.armHp[i])); // nur die Teil-HP fließen in den Pool
    L.armHp[i] -= dealt;
    if (L.armHp[i] <= 0) destroyArm(scene, e, i);
    return dealt;
  }
  if (hit.id.startsWith('vent')) {
    const v = L.vents[Number(hit.id.slice(4))];
    if (!v || v.broken) return 0;
    const dealt = Math.min(amount, v.hp); // nur die Ventil-HP fließen in den Pool
    v.hp -= dealt;
    if (v.hp <= 0) {
      v.broken = true;
      v.hp = 0;
      L.lensOpen = Math.max(L.lensOpen, ENDBOSS_ARENA.leviathan.lensOpenSec);
      sound.playShieldBreak();
      scene.triggerShake(0.3, 4);
      scene.spawnBurst(v.x, v.y, '#38e8d4', 22);
      scene.floats.push({ x: v.x, y: v.y - 16, text: 'KÜHLUNG AUS!', color: '#38e8d4', life: 1.0, maxLife: 1.0 });
      scene.callbacks.onToast('❄ Kühlventil zerstört — die Kern-Linse überhitzt und öffnet sich!', 'good');
    }
    return dealt;
  }
  // Linse: kritische Stelle
  return Math.round(amount * ENDBOSS_ARENA.leviathan.lensDamageMult);
}

function armorFeedback(scene: DungeonScene, e: Enemy, id: string | undefined): void {
  const L = e.levArena!;
  let x = e.x;
  let y = e.y;
  const p = id ? arenaHitPoints(e).find((q) => q.id === id) : undefined;
  if (p) {
    x = p.x;
    y = p.y;
  }
  scene.spawnBurst(x, y, '#cbd5e1', 4);
  if (L.armorMsgCd <= 0) {
    L.armorMsgCd = 0.6;
    scene.floats.push({ x, y: y - 14, text: 'GEPANZERT', color: '#94a3b8', life: 0.6, maxLife: 0.6 });
    sound.playShieldBlock();
  }
}

function destroyArm(scene: DungeonScene, e: Enemy, i: 0 | 1): void {
  const L = e.levArena!;
  const arm = e.levArms![i];
  arm.dead = true;
  arm.state = 'idle';
  L.armHp[i] = 0;
  sound.playBossSlam();
  scene.triggerShake(0.4, 5);
  scene.spawnBurst(arm.x, arm.y, '#fbbf24', 30);
  scene.shockwaves.push({ x: arm.x, y: arm.y, maxRadius: 50, color: '#fbbf24', life: 0.3, maxLife: 0.3 });
  spawnScrap(scene, arm.x, arm.y, 3, i);
  scene.callbacks.onToast('💥 Kranarm zerstört!', 'good');
}

// ---------------------------------------------------------------- Laufzeit

function fx(scene: DungeonScene) {
  return scene.bossFx;
}

/** Deterministische Zahlen je Boss/Zug (kein globaler Zufall). */
function rngFor(e: Enemy, salt: number): () => number {
  return mulberry32(((e.id + 1) * 7919 + salt * 104729) >>> 0);
}

function speed(L: LevArena): number {
  return L.critical ? 0.72 : L.phase === 3 ? 0.85 : 1;
}

export function updateLeviathanArena(scene: DungeonScene, e: Enemy, dt: number): void {
  const L = e.levArena!;
  const rb = scene.bounds;
  L.armorMsgCd = Math.max(0, L.armorMsgCd - dt);
  if (L.phase === 2) L.lensOpen = Math.max(0, L.lensOpen - dt);
  if (L.plateCrackT > 0 && !L.platesBroken) L.plateCrackT += dt;
  if (L.critical && L.state !== 'dead') {
    const prevTick = Math.floor((scene.time - dt) * 5);
    const curTick = Math.floor(scene.time * 5);
    if (curTick !== prevTick) {
      const side = curTick % 2 === 0 ? -1 : 1;
      scene.spawnBurst(e.x + side * (28 + (curTick % 3) * 18), e.y - 14 + (curTick % 4) * 8, curTick % 3 === 0 ? '#fb923c' : '#fde047', 3);
    }
  }
  e.vx = 0;
  e.vy = 0;
  updateArms(scene, e, dt);

  // ---- Auftritt (A6): Kamera fährt zum Boss, Titel-Banner; beim ersten Mal (noch nie besiegt) länger
  if (L.state === 'intro') {
    if (L.timer < 0) {
      const first = !scene.state.sector1Cleared;
      const dur = first ? ENDBOSS_ARENA.introSecFirst : ENDBOSS_ARENA.introSecRepeat;
      L.timer = dur;
      scene.camera.focus(e.x, e.y - 6, dur);
      scene.arenaBanner = { title: 'A.E.G.I.S. LEVIATHAN', sub: 'Reaktorhalle · Sektor 1', t: dur + 0.8, max: dur + 0.8 };
      sound.playBossRoar();
      scene.triggerShake(0.4, 3);
      e.bossStatusText = 'ERWACHT';
    }
    L.timer -= dt;
    if (L.timer <= 0) {
      L.state = 'idle';
      L.timer = 0.6;
      e.bossStatusText = 'PHASE I · WACHE';
    }
    return;
  }

  // ---- Phasenwechsel
  const hpFrac = e.hp / Math.max(1, e.maxHp);
  const armsGone = !!e.levArms && e.levArms.every((a) => a.dead);
  if (L.state !== 'transition') {
    if (L.phase === 1 && (hpFrac <= ENDBOSS_ARENA.leviathan.phase2At || armsGone)) {
      startPhase2(scene, e);
      return;
    }
    if (L.phase === 2 && hpFrac <= ENDBOSS_ARENA.leviathan.phase3At) {
      startPhase3(scene, e);
      return;
    }
  }
  if (L.phase === 3 && !L.critical && hpFrac < 0.15) {
    L.critical = true;
    e.bossStatusText = 'KRITISCH!';
    scene.callbacks.onToast('⚠ A.E.G.I.S. KRITISCH — der Kern flackert!', 'warn');
  }

  if (L.state === 'transition') {
    L.timer -= dt;
    if (L.timer <= 0) {
      L.state = 'idle';
      L.timer = 0.5;
    }
    return;
  }

  if (L.state === 'move') {
    L.timer -= dt;
    if (L.timer <= 0) {
      // Nach großen Angriffen in Phase II: sind alle Ventile zerstört, öffnet sich die Linse im Erholungsfenster (kein Weichlock)
      if (L.phase === 2 && L.vents.every((v) => v.broken) && (L.move === 'beam' || L.move === 'debris')) {
        L.lensOpen = Math.max(L.lensOpen, ENDBOSS_ARENA.leviathan.lensRecoverSec);
      }
      L.state = 'idle';
      L.timer = 0.75 * speed(L);
      L.move = null;
      e.bossStatusText = L.critical ? 'KRITISCH!' : PHASE_NAME[L.phase];
    }
    return;
  }

  // idle → nächster Zug
  L.timer -= dt;
  if (L.timer > 0) return;
  const seq = SEQ[L.phase];
  let move = seq[L.seq % seq.length];
  L.seq++;
  const liveArm = e.levArms?.some((a) => !a.dead);
  if (move === 'hammer' && !liveArm) move = 'grab';
  startMove(scene, e, move, rb);
}

function startMove(scene: DungeonScene, e: Enemy, move: LevArenaMove, rb: DungeonScene['bounds']): void {
  const L = e.levArena!;
  const k = speed(L);
  L.state = 'move';
  L.move = move;
  L.moveIdx++;
  const px = scene.playerX;
  const py = scene.playerY;
  switch (move) {
    case 'hammer': {
      // Kran-Hammer: Arm verfolgt den Spieler, schlägt in die markierte Platte, steckt 1,6 s fest (angreifbar)
      const arms = e.levArms!;
      const order: Array<0 | 1> = (e.levActiveSide ?? 0) === 0 ? [1, 0] : [0, 1];
      const idx = order.find((i) => !arms[i].dead) ?? 0;
      e.levActiveSide = idx;
      const arm = arms[idx];
      arm.state = 'tracking';
      arm.timer = 0.85 * k;
      arm.targetX = Math.max(rb.l + 34, Math.min(rb.r - 34, px));
      arm.targetY = Math.max(rb.t + 70, Math.min(rb.b - 22, py));
      L.timer = arm.timer + 0.16 + ENDBOSS_ARENA.leviathan.armStuckSec + 0.4;
      e.bossStatusText = 'KRAN-HAMMER!';
      break;
    }
    case 'whip': {
      // Titanen-Schockwelle: breite Hochspannungs-Plasma-Welle schlägt vom Boss-Arm quer durch die Halle Richtung Spieler
      const left = px < rb.cx;
      const sideIdx: 0 | 1 = left ? 0 : 1;
      const arm = e.levArms?.[sideIdx];
      const shX = e.x + (left ? -BODY_SHOULDER_DX : BODY_SHOULDER_DX);
      const shY = e.y + LENS_DY + BODY_SHOULDER_DY;
      const ox = arm && !arm.dead ? arm.x : shX;
      const oy = arm && !arm.dead ? arm.y : shY;
      const tx = Math.max(rb.l + 18, Math.min(rb.r - 18, px + (left ? 44 : -44)));
      const ty = Math.max(rb.t + 76, Math.min(rb.b - 14, py));
      fx(scene).add({ shape: 'line', x: ox, y: oy, x2: tx, y2: ty, width: 26, delay: 0.85 * k, life: 0.34, burst: 20, color: '#a855f7', fx: 'whip', onFire: (s) => s.triggerShake(0.25, 4) });
      if (L.phase === 3) {
        const otherIdx: 0 | 1 = left ? 1 : 0;
        const arm2 = e.levArms?.[otherIdx];
        const ox2 = arm2 && !arm2.dead ? arm2.x : e.x + (left ? BODY_SHOULDER_DX : -BODY_SHOULDER_DX);
        const oy2 = arm2 && !arm2.dead ? arm2.y : shY;
        const tx2 = Math.max(rb.l + 18, Math.min(rb.r - 18, px + (left ? -48 : 48)));
        const ty2 = Math.max(rb.t + 76, Math.min(rb.b - 14, ty + (ty > rb.cy ? -54 : 54)));
        fx(scene).add({ shape: 'line', x: ox2, y: oy2, x2: tx2, y2: ty2, width: 26, delay: 1.12 * k, life: 0.34, burst: 20, color: '#a855f7', fx: 'whip' });
      }
      L.timer = 1.5 * k;
      e.bossStatusText = 'TITANEN-WELLE!';
      sound.playBossCharge();
      break;
    }
    case 'steam': {
      // Kühl-Überdruck-Sturm: nur intakte Seiten-Kühlaggregate blasen breite Hochdruck-Dampf-Korridore quer durch die Halle
      const top = L.moveIdx % 2 === 0;
      for (const v of L.vents) {
        if (v.broken) continue;
        if ((v.y < rb.cy) !== top) continue;
        const fromLeft = v.x < rb.cx;
        const w = 200;
        fx(scene).add({
          shape: 'rect',
          x: fromLeft ? v.x + 12 + w / 2 : v.x - 12 - w / 2,
          y: v.y,
          w,
          h: 44,
          delay: 0.9 * k,
          life: 1.15,
          dps: 16,
          color: '#e2e8f0',
          fx: 'steam',
          variant: fromLeft ? 1 : -1,
        });
      }
      L.timer = 2.15 * k;
      e.bossStatusText = 'ÜBERDRUCK-STURM!';
      break;
    }
    case 'beam': {
      // OMEGA-REAKTOR-STRAHL: monströse 68-px-Mega-Strahlen direkt aus der BRUST-LINSE des Leviathans (schwenken über die gesamte Halle!)
      const len = scene.rayLimit(400);
      const lx = e.x;
      const ly = e.y + LENS_DY;
      const aimToPlayer = Math.atan2(py - ly, px - lx);
      const clampedAim = Math.max(0.45, Math.min(Math.PI - 0.45, aimToPlayer));
      const sweep = clampedAim < Math.PI / 2 ? [clampedAim, clampedAim + 0.52] : [clampedAim, clampedAim - 0.52];
      // Arme stützen sich wuchtig ab während der Reaktor feuert
      for (const arm of e.levArms ?? []) {
        if (!arm.dead) {
          arm.state = 'beam';
          arm.timer = 2.4 * k;
          arm.beamAngle = sweep[0];
        }
      }
      sweep.forEach((a, j) => {
        fx(scene).add({
          shape: 'line',
          x: lx,
          y: ly,
          x2: lx + Math.cos(a) * len,
          y2: ly + Math.sin(a) * len,
          width: 34,
          delay: (0.9 + j * 1.0) * k,
          life: 0.5,
          burst: 22,
          color: '#fb7185',
          fx: 'beam',
          onFire: (s) => {
            s.triggerShake(0.4, 5.5);
            sound.playBossLaser();
          },
        });
      });
      L.timer = 2.65 * k;
      e.bossStatusText = 'OMEGA-REAKTOR-STRAHL!';
      sound.playBossRoar();
      break;
    }
    case 'debris': {
      // Trümmerfall: Deckenteile (erste auf den Spieler, Rest deterministisch über die Halle)
      const rnd = rngFor(e, L.moveIdx);
      const n = L.phase === 3 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? px : rb.l + 30 + rnd() * (rb.r - rb.l - 60);
        const y = i === 0 ? py : rb.t + 80 + rnd() * (rb.b - rb.t - 100);
        scene.debrisDrops.push({ x: Math.max(rb.l + 20, Math.min(rb.r - 20, x)), y: Math.max(rb.t + 70, Math.min(rb.b - 16, y)), r: 22, timer: (0.95 + i * 0.14) * k, maxTimer: (0.95 + i * 0.14) * k });
      }
      L.timer = (1.3 + n * 0.14) * k;
      e.bossStatusText = 'TRÜMMERFALL!';
      scene.triggerShake(0.35, 3);
      break;
    }
    case 'grab': {
      // Kabel-Griff / Letzter Griff: Gravitations-Wirbel vor der Kern-Linse zieht am Spieler, dann Kern-Stoß
      const cx = e.x;
      const cy = e.y + 58;
      fx(scene).add({ shape: 'circle', x: cx, y: cy, r: 190, delay: 0.6, life: 2.0, pull: L.phase === 3 ? 62 : 52, color: '#818cf8', fx: 'vortex' });
      fx(scene).add({ shape: 'circle', x: cx, y: cy - 10, r: 40, delay: 2.4 * k, life: 0.3, burst: 22, color: '#f87171', fx: 'blast' });
      L.timer = 3.0 * k;
      e.bossStatusText = L.phase === 3 ? 'LETZTER GRIFF!' : 'KABEL-GRIFF!';
      break;
    }
    case 'pulse': {
      // Omega-Puls: Ringwellen aus dem Reaktorkern, jede mit Lücke (Lücke wandert)
      const base = Math.atan2(py - (e.y + LENS_DY), px - e.x);
      [[30, 62, 0.8], [92, 124, 1.15], [154, 186, 1.5], [216, 248, 1.85]].forEach(([r0, r, d], j) => {
        fx(scene).add({ shape: 'ring', x: e.x, y: e.y + LENS_DY, r0, r, gapA: base + (j % 2 === 0 ? 0.9 : -0.9), gapHalf: 0.42, delay: d * k, life: 0.28, burst: 20, color: '#f43f5e', fx: 'pulse' });
      });
      L.timer = 2.3 * k;
      e.bossStatusText = 'OMEGA-PULS!';
      sound.playBossRoar();
      break;
    }
    case 'glow': {
      // Glut-Wellen: Flammenwände wandern von Norden nach Süden, jede mit einer Lücke (immer ein Ausweichweg)
      const rnd = rngFor(e, 1000 + L.moveIdx);
      const bands = 6;
      const span = (rb.b - rb.t - 76) / bands;
      for (let i = 0; i < bands; i++) {
        const y = rb.t + 70 + span * (i + 0.5);
        const gapW = 72;
        const gx = rb.l + 40 + rnd() * (rb.r - rb.l - 80 - gapW);
        const leftW = gx - rb.l;
        const rightW = rb.r - (gx + gapW);
        const delay = (0.9 + i * 0.38) * k;
        if (leftW > 4) fx(scene).add({ shape: 'rect', x: rb.l + leftW / 2, y, w: leftW, h: span * 0.8, delay, life: 0.36, burst: 16, color: '#fb923c', fx: 'flame' });
        if (rightW > 4) fx(scene).add({ shape: 'rect', x: gx + gapW + rightW / 2, y, w: rightW, h: span * 0.8, delay, life: 0.36, burst: 16, color: '#fb923c', fx: 'flame' });
      }
      L.timer = (1.4 + bands * 0.38) * k;
      e.bossStatusText = 'GLUT-WELLE!';
      break;
    }
  }
}

function startPhase2(scene: DungeonScene, e: Enemy): void {
  const L = e.levArena!;
  const rb = scene.bounds;
  L.phase = 2;
  L.state = 'transition';
  L.timer = 2.2;
  L.seq = 0;
  e.bossPhase2 = true;
  e.bossStatusText = 'PHASE II · ÜBERLAST';
  for (const arm of e.levArms ?? []) if (!arm.dead) arm.state = 'returning';
  sound.playBossRoar();
  scene.triggerShake(0.6, 6);
  scene.callbacks.onToast('🚨 PHASE II: ÜBERLAST — die Bodenplatten brechen! Zerstöre die Kühlventile!', 'warn');
  // Arena-Änderung (A4): Mittel-Platten brechen weg — 1,2 s Vorwarnung, dann Abgrund (Glut-Schacht)
  const def = ARENAS.boss_leviathan;
  const plates = def ? arenaTileRects(def, (ch) => ch === 'p', rb.l, rb.t) : [];
  if (plates.length && !L.platesBroken) {
    L.plateCrackT = 0.01;
    plates.forEach((plate, i) => {
      fx(scene).add({
        shape: 'rect',
        x: plate.x + plate.w / 2,
        y: plate.y + plate.h / 2,
        w: plate.w,
        h: plate.h,
        delay: ENDBOSS_ARENA.leviathan.plateWarnSec,
        life: 0.2,
        color: '#fb923c',
        onFire: (s) => {
          L.platesBroken = true;
          s.currentRoom.chasms.push({ x: plate.x, y: plate.y, w: plate.w, h: plate.h });
          if (i === plates.length - 1) {
            s.rebuildNav();
            const safe = s.findSafeFloorPos(s.lastSafeX, s.lastSafeY);
            s.lastSafeX = safe.x;
            s.lastSafeY = safe.y;
            s.triggerShake(0.5, 5);
            sound.playBossSlam();
          }
          s.spawnBurst(plate.x + plate.w / 2, plate.y + plate.h / 2, '#fb923c', 8);
        },
      });
    });
  }
}

function startPhase3(scene: DungeonScene, e: Enemy): void {
  const L = e.levArena!;
  L.phase = 3;
  L.state = 'transition';
  L.timer = 2.4;
  L.seq = 0;
  L.lensOpen = 0;
  e.bossStatusText = 'PHASE III · KERN FREI';
  for (const arm of e.levArms ?? []) if (!arm.dead) arm.state = 'returning';
  sound.playBossRoar();
  scene.triggerShake(0.9, 7);
  scene.camera.focus(e.x, e.y + 60, 1.2);
  // Wand-Panzer fällt ab (rein optisch)
  spawnScrap(scene, e.x, e.y + 10, 5, 7);
  scene.callbacks.onToast('🔥 PHASE III: Der Panzer fällt — die Kern-Linse liegt frei!', 'warn');
}

/** Schienen-Kran-Koloss: fährt auf der Nordwand-Schiene zum Ziel und schlägt mit dem echten M11-Rig-Arm direkt vor sich auf den Boden (+ Erdbeben-Welle nach Süden). */
function updateArms(scene: DungeonScene, e: Enemy, dt: number): void {
  const L = e.levArena!;
  const rb = scene.bounds;
  const railMin = rb.l + 150;
  const railMax = rb.r - 150;

  // Schienen-Fahrt: wenn ein Arm ausholt (tracking), fährt der gesamte Koloss wuchtig zur Spieler-X-Position!
  const trackingArm = (e.levArms ?? []).find((a) => !a.dead && a.state === 'tracking');
  const slammedArm = (e.levArms ?? []).find((a) => !a.dead && (a.state === 'slamming' || a.state === 'grounded'));
  let targetRailX = e.x;
  let railSpeed = 0;
  if (L.state !== 'intro' && L.state !== 'dead') {
    if (trackingArm && trackingArm.timer > 0.25) {
      targetRailX = Math.max(railMin, Math.min(railMax, scene.playerX - trackingArm.side * 72));
      railSpeed = 165;
    } else if (!slammedArm && L.state === 'idle') {
      targetRailX = rb.cx;
      railSpeed = 75;
    }
  }
  const prevX = e.x;
  if (railSpeed > 0 && Math.abs(targetRailX - e.x) > 1) {
    const step = Math.sign(targetRailX - e.x) * Math.min(Math.abs(targetRailX - e.x), railSpeed * dt);
    e.x = Math.max(railMin, Math.min(railMax, e.x + step));
  }
  e.vx = dt > 0 ? (e.x - prevX) / dt : 0;

  (e.levArms ?? []).forEach((arm, idx) => {
    if (arm.dead) return;
    arm.homeX = e.x + arm.side * 74;
    arm.homeY = e.y + 16;
    // Beschädigungs-Funken an angeschlagenen Fäusten (< 70 % HP)
    const armFrac = L.armHp[idx] / Math.max(1, L.armMax);
    if (armFrac < 0.7) {
      const rate = armFrac < 0.35 ? 6 : 2.5;
      const pTick = Math.floor((scene.time - dt) * rate);
      const cTick = Math.floor(scene.time * rate);
      if (cTick !== pTick) {
        scene.spawnBurst(arm.x + ((cTick % 3) - 1) * 8, arm.y - 4, armFrac < 0.35 ? '#fb923c' : '#fde047', 2);
      }
    }
    if (arm.state === 'beam') {
      arm.timer -= dt;
      arm.x = arm.homeX + arm.side * 10;
      arm.y = arm.homeY - 6;
      if (arm.timer <= 0) arm.state = 'returning';
    } else if (arm.state === 'idle' || arm.state === 'returning') {
      const hoverY = arm.homeY + Math.sin(scene.time * 2.5 + arm.side) * 3;
      arm.x += (arm.homeX - arm.x) * Math.min(1, dt * 10);
      arm.y += (hoverY - arm.y) * Math.min(1, dt * 10);
      if (arm.state !== 'idle' && Math.hypot(arm.x - arm.homeX, arm.y - hoverY) < 4) arm.state = 'idle';
    } else if (arm.state === 'tracking') {
      arm.timer -= dt;
      // Zielpunkt liegt exakt dort, wo die echte Rig-Faust vor dem Koloss einschlägt!
      arm.targetX = e.x + arm.side * 74;
      arm.targetY = e.y + 44;
      if (arm.timer <= 0.32 && !arm.locked) {
        arm.locked = true;
        fx(scene).add({ shape: 'circle', x: arm.targetX, y: arm.targetY, r: 36, delay: arm.timer + 0.16, life: 0.14, burst: 22, color: '#fb923c', fx: 'blast' });
        // Erdbeben-Spalt schießt vom Einschlag direkt nach Süden durch die gesamte Halle!
        fx(scene).add({ shape: 'line', x: arm.targetX, y: arm.targetY, x2: arm.targetX, y2: rb.b - 16, width: 32, delay: arm.timer + 0.32, life: 0.28, burst: 18, color: '#fb923c', fx: 'whip' });
      }
      arm.x = arm.targetX;
      arm.y = arm.homeY - 16;
      if (arm.timer <= 0) {
        arm.state = 'slamming';
        arm.timer = 0.16;
        arm.locked = false;
      }
    } else if (arm.state === 'slamming') {
      arm.timer -= dt;
      arm.x = arm.targetX;
      arm.y += (arm.targetY - arm.y) * Math.min(1, dt * 24);
      if (arm.timer <= 0) {
        arm.x = arm.targetX;
        arm.y = arm.targetY;
        arm.state = 'grounded';
        arm.timer = ENDBOSS_ARENA.leviathan.armStuckSec;
        sound.playBossSlam();
        scene.triggerShake(0.36, 5.5);
        scene.decals.push({ x: arm.x, y: arm.y + 6, r: 24, color: 'rgba(15, 23, 42, 0.58)', life: 6, maxLife: 6 });
        scene.shockwaves.push({ x: arm.x, y: arm.y + 2, maxRadius: 68, color: '#fb923c', life: 0.34, maxLife: 0.34 });
        scene.spawnBurst(arm.x, arm.y + 4, '#fbbf24', 24);
        scene.floats.push({ x: arm.x, y: arm.y - 24, text: 'ARM STECKT FEST!', color: '#fde047', life: 0.9, maxLife: 0.9 });
      }
    } else if (arm.state === 'grounded') {
      arm.timer -= dt;
      arm.x = arm.targetX;
      arm.y = arm.targetY;
      if (arm.timer <= 0) arm.state = 'returning';
    }
  });
}

/** Sieg: Glut sinkt (Abgrund schließt sich), Kamera schwenkt zur Linse. */
export function onLeviathanArenaDefeated(scene: DungeonScene, e: Enemy, firstClear = false): void {
  const L = e.levArena;
  if (!L) return;
  L.state = 'dead';
  scene.bossFx.clear();
  scene.debrisDrops.length = 0;
  if (L.platesBroken) {
    scene.currentRoom.chasms = [];
    scene.rebuildNav();
  }
  scene.camera.focus(e.x, e.y + 40, 1.5);
  scene.arenaBanner = { title: 'A.E.G.I.S. ABGESCHALTET', sub: 'Der Reaktorkern erlischt', t: 2.6, max: 2.6 };
  startArenaVault(scene, firstClear); // Schatzkammer hinter der Wand öffnet sich
}

// ---------------------------------------------------------------- Optik (rein darstellend)

/** Schrott-/Panzerteile, die abfallen (prozedurale Bilder, kein Zufall). */
function spawnScrap(scene: DungeonScene, x: number, y: number, n: number, salt: number): void {
  if (typeof document === 'undefined') return;
  for (let i = 0; i < n; i++) {
    const w = 18 + ((i * 7 + salt) % 3) * 6;
    const h = 10 + ((i * 5 + salt) % 3) * 4;
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    const g = c.getContext('2d');
    if (!g) continue;
    g.scale(2, 2);
    g.fillStyle = '#475569';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#64748b';
    g.fillRect(1, 1, w - 2, 2);
    g.fillStyle = '#fb923c';
    g.fillRect(w * 0.3, h - 3, w * 0.4, 1.5);
    const a = ((i + 0.5) / n) * Math.PI - Math.PI;
    const part: DetachedPart = {
      img: c,
      w,
      h,
      px: w / 2,
      py: h / 2,
      x,
      y: y + 10,
      z: 20,
      vx: Math.cos(a) * 60,
      vy: 40 + i * 12,
      vz: 90,
      rot: 0,
      vrot: (i % 2 === 0 ? 1 : -1) * 5,
      life: 1.7,
      maxLife: 1.7,
      bounced: false,
    };
    scene.detached.push(part);
  }
}

/** Zeichnet Ventile, Schwachstellen-Markierungen und Linse (nach dem Boss-Körper). */
export function drawLeviathanArena(ctx: CanvasRenderingContext2D, scene: DungeonScene, e: Enemy): void {
  const L = e.levArena;
  if (!L) return;
  const t = scene.time;
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const art = getHDArt();
  const hasBg = !!art.arenaLeviathanBg;
  // A12: 3-stufiger Plattenbruch während der Phase-II-Vorwarnung (P1-06)
  if (L.plateCrackT > 0 && !L.platesBroken) {
    const def = ARENAS.boss_leviathan;
    const rb = scene.bounds;
    const frac = Math.min(1, L.plateCrackT / ENDBOSS_ARENA.leviathan.plateWarnSec);
    const plateSpr = frac < 0.35 ? art.arenaLeviathanPlate1 : frac < 0.7 ? art.arenaLeviathanPlate2 : art.arenaLeviathanPlate3;
    if (def && plateSpr) {
      const plates = arenaTileRects(def, (ch) => ch === 'p', rb.l, rb.t);
      ctx.save();
      ctx.globalAlpha = 0.85 + 0.15 * pulse;
      for (const pl of plates) {
        for (let py = pl.y; py < pl.y + pl.h; py += ARENA_TILE) {
          for (let px = pl.x; px < pl.x + pl.w; px += ARENA_TILE) {
            ctx.drawImage(plateSpr, px, py, ARENA_TILE, ARENA_TILE);
          }
        }
      }
      ctx.restore();
    }
  }
  // Kühlventile: nahtlos im Hintergrund-Kühlschacht integriert (kein aufgeklebtes Fremd-Kästchen!)
  const steamActive = L.state === 'move' && L.move === 'steam';
  const steamTop = L.moveIdx % 2 === 0;
  for (const v of L.vents) {
    ctx.save();
    if (v.broken) {
      if (art.arenaLeviathanVentBroken) {
        ctx.translate(v.x, v.y);
        if (v.x > scene.bounds.cx) ctx.scale(-1, 1);
        ctx.drawImage(art.arenaLeviathanVentBroken, -18, -18, 36, 36);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(v.x - 10, v.y - 12, 20, 24);
      }
      ctx.restore();
      ctx.save();
      ctx.fillStyle = `rgba(148, 163, 184, ${0.28 + 0.18 * Math.sin(t * 5 + v.y)})`;
      ctx.beginPath();
      ctx.arc(v.x + (v.x < scene.bounds.cx ? 8 : -8), v.y - 8 - ((t * 20) % 14), 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const weak = L.phase >= 2;
      const charging = steamActive && (v.y < scene.bounds.cy) === steamTop;
      if (!hasBg) {
        ctx.fillStyle = '#0d2536';
        ctx.fillRect(v.x - 10, v.y - 12, 20, 24);
        ctx.fillStyle = weak ? `rgba(56, 232, 212, ${0.6 + 0.4 * pulse})` : '#1e6f6a';
        for (let k = -6; k <= 4; k += 4) ctx.fillRect(v.x - 7, v.y + k, 14, 2);
      }
      // Überdruck-Vorwarnung: weiches Aufglühen direkt im eingebauten Kühlschacht
      if (charging) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(v.x, v.y, 2, v.x, v.y, 26);
        g.addColorStop(0, `rgba(224, 242, 254, ${0.55 + 0.35 * pulse})`);
        g.addColorStop(0.5, `rgba(56, 232, 212, ${0.3 + 0.2 * pulse})`);
        g.addColorStop(1, 'rgba(56, 232, 212, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (weak) {
        // Dezente Ziel-Klammern & saubere HP-Leiste am Kühlschacht
        const br = 13 + pulse * 1.5;
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.5 + 0.45 * pulse})`;
        ctx.lineWidth = 1.2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          ctx.beginPath();
          ctx.moveTo(v.x + sx * br, v.y + sy * (br - 5));
          ctx.lineTo(v.x + sx * br, v.y + sy * br);
          ctx.lineTo(v.x + sx * (br - 5), v.y + sy * br);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(11, 16, 25, 0.85)';
        ctx.fillRect(v.x - 11, v.y + 16, 22, 3);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(v.x - 10.5, v.y + 16.5, 21 * (v.hp / Math.max(1, v.maxHp)), 2);
      }
    }
    ctx.restore();
  }
  // Arme: zerstörter Arm = dezenter Rauch & Funken an der Arm-Seite; steckende Durchbruch-Faust = saubere HP-Leiste (kein harter gelber Kreis!)
  (e.levArms ?? []).forEach((arm, idx) => {
    if (arm.dead) {
      const shX = e.x + arm.side * BODY_SHOULDER_DX;
      const shY = e.y + LENS_DY + BODY_SHOULDER_DY + 28;
      ctx.save();
      ctx.strokeStyle = pulse > 0.5 ? '#fde047' : '#38e8d4';
      ctx.lineWidth = 1.1;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(shX + k * 4, shY);
        ctx.lineTo(shX + k * 7 + Math.sin(t * 15 + k) * 2.5, shY + 12 + (k === 0 ? 4 : 0));
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (!armWeak(L, arm)) return;
    const frac = Math.max(0, Math.min(1, L.armHp[idx] / Math.max(1, L.armMax)));
    ctx.save();
    ctx.fillStyle = 'rgba(11, 16, 25, 0.88)';
    ctx.fillRect(arm.x - 18, arm.y + 27, 36, 4);
    ctx.fillStyle = frac < 0.35 ? '#fb7185' : frac < 0.7 ? '#fb923c' : '#fbbf24';
    ctx.fillRect(arm.x - 17.5, arm.y + 27.5, 35 * frac, 3);
    ctx.restore();
  });
  // Kern-Linse: bereits voll im Vollposen-Sprite integriert — nur bei offener Linse / Reaktor-Strahl weiches Energie-Aufleuchten!
  const lx = e.x;
  const ly = e.y + LENS_DY;
  const beamFiring = L.state === 'move' && L.move === 'beam';
  if (lensIsOpen(L) || beamFiring) {
    ctx.save();
    const flicker = L.critical ? 0.65 + 0.35 * Math.sin(t * 30) : 1;
    ctx.globalAlpha = flicker;
    if (art.arenaLeviathanLensFlare) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(lx, ly);
      ctx.rotate(t * 0.85);
      const fsz = (beamFiring ? 58 : 48) + pulse * 8;
      ctx.drawImage(art.arenaLeviathanLensFlare, -fsz / 2, -fsz / 2, fsz, fsz);
      ctx.restore();
    }
    if (lensIsOpen(L) && L.phase === 2 && L.lensOpen > 0) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`LINSE OFFEN ${L.lensOpen.toFixed(1)}`, lx, ly - LENS_R - 14);
    }
    ctx.restore();
  }
}

/** Vereinheitlichtes Vollposen-Boss-Sprite (320×178 logisch = 640×356 HD): Körper + beide massiven Arme/Fäuste aus einem Guss! */
export const BODY_W = 320;
export const BODY_H = 178;
const BODY_LENS_X = 160;
const BODY_LENS_Y = 118;
/** Schulter-Referenz relativ zur Linse (für Funken/Effekte) */
export const BODY_SHOULDER_DX = 96;
export const BODY_SHOULDER_DY = -8;

/** Zeichnet die feste, unbewegliche Schwerlast-Laufschiene an der Nordwand (wackelt NIE mit!). */
function drawCraneRail(ctx: CanvasRenderingContext2D, leftX: number, rightX: number, railY: number): void {
  const w = rightX - leftX;
  ctx.save();
  // Dunkler Stahlträger-Schatten
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(leftX, railY - 7, w, 15);
  // Haupt-I-Träger (rostiger Industriestahl)
  ctx.fillStyle = '#334155';
  ctx.fillRect(leftX, railY - 5, w, 10);
  ctx.fillStyle = '#475569';
  ctx.fillRect(leftX, railY - 5, w, 2);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(leftX, railY + 3, w, 2);
  // Nieten & Schienen-Streben alle 28 px
  ctx.fillStyle = '#64748b';
  for (let x = leftX + 12; x < rightX - 8; x += 28) {
    ctx.fillRect(x, railY - 3, 2, 2);
    ctx.fillRect(x, railY + 1, 2, 2);
  }
  ctx.restore();
}

/**
 * Zeichnet den Leviathan als dynamisches M11-Schienen-Kran-Rig (wie Kern-Wächter & Krall):
 * feste Nordwand-Schiene + starrer Schlitten + atmender/neigender Torso + Spieler-verfolgender Kopf + 2 massive Pose-Set-Arme.
 */
export function drawLeviathanBody(ctx: CanvasRenderingContext2D, scene: DungeonScene, e: Enemy): boolean {
  const L = e.levArena;
  const art = getHDArt();
  const rigImgs = art.rigs.boss_leviathan;
  const rigDef = RIGS.boss_leviathan;
  if (!L) return false;
  if (rigImgs && rigDef) {
    const rb = scene.bounds;
    drawCraneRail(ctx, rb.l + 24, rb.r - 24, e.y - 34);
    const pose = getBossPose('boss_leviathan', e, scene.time, scene.playerX, scene.playerY);
    drawRig(ctx, rigDef, rigImgs, e.x, e.y, pose, { flash: e.flashTimer > 0 });
    return true;
  }
  // Rückfall auf Vollposen-Sprite falls Rig noch nicht geladen
  const base = art.arenaLeviathanBody;
  if (!base) return false;
  const dead = L.state === 'dead' || e.hp <= 0;
  const phaseImg = dead ? art.arenaLeviathanBodyDead : L.phase === 3 ? art.arenaLeviathanBodyP3 : L.phase === 2 ? art.arenaLeviathanBodyP2 : null;
  const img = phaseImg ?? base;
  ctx.save();
  if (e.flashTimer > 0) ctx.filter = 'brightness(1.9)';
  ctx.drawImage(img, Math.round(e.x - BODY_LENS_X), Math.round(e.y + LENS_DY - BODY_LENS_Y), BODY_W, BODY_H);
  ctx.restore();
  return true;
}

/** Nach dem Sieg (Boss entfernt): erloschener Schienen-Kran-Koloss hängt abgeschaltet an der Nordwand-Schiene. */
export function drawLeviathanBodyStatic(ctx: CanvasRenderingContext2D, room: DungeonRoom): void {
  const art = getHDArt();
  const def = ARENAS.boss_leviathan;
  if (!def || !room.bounds) return;
  const t = room.arenaOriginT ?? room.bounds.t;
  const lx = room.bounds.l + def.bossAnchor.x;
  const ly = t + def.bossAnchor.y;
  const rigImgs = art.rigs.boss_leviathan;
  const rigDef = RIGS.boss_leviathan;
  if (rigImgs && rigDef) {
    drawCraneRail(ctx, room.bounds.l + 24, room.bounds.r - 24, ly - 34);
    const deadPose = {
      carriage: { dx: 0, dy: 0, rot: 0 },
      torso: { dx: 0, dy: 4, rot: 0, variant: 3 },
      head: { dx: 0, dy: 5, rot: 0.14, variant: 1 },
      armL: { rot: -0.1, dy: 8, variant: 3 },
      armR: { rot: 0.1, dy: 8, variant: 3 },
    };
    drawRig(ctx, rigDef, rigImgs, lx, ly, deadPose);
    return;
  }
  const base = art.arenaLeviathanBody;
  if (!base) return;
  const img = art.arenaLeviathanBodyDead ?? base;
  ctx.save();
  if (!art.arenaLeviathanBodyDead) ctx.filter = 'brightness(0.55) saturate(0.6)';
  ctx.drawImage(img, Math.round(lx - BODY_LENS_X), Math.round(ly + LENS_DY - BODY_LENS_Y), BODY_W, BODY_H);
  ctx.restore();
}

/** Titel-Banner (Bildschirmkoordinaten, ohne Kamera). */
export function drawArenaBanner(ctx: CanvasRenderingContext2D, b: { title: string; sub: string; t: number; max: number }, w: number): void {
  const a = Math.min(1, b.t / 0.5, (b.max - b.t) / 0.35);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = 'rgba(11, 16, 28, 0.82)';
  ctx.fillRect(0, 44, w, 34);
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(0, 44, w, 1);
  ctx.fillRect(0, 77, w, 1);
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Silkscreen, monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(b.title, w / 2, 62);
  ctx.font = 'bold 5.5px Silkscreen, monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(b.sub, w / 2, 72);
  ctx.restore();
}
