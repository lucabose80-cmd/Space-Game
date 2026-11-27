// M12 Phase D: A.E.G.I.S. Leviathan als Arena-Endboss in der Reaktorhalle (MILESTONE_12_ARCHITECTURE.md §6).
// Läuft nur, wenn der Bossraum eine Arena ist (`room.arenaKind === 'boss_leviathan'`); sonst bleibt der alte Kampf.
//  Phase I  (100–65 %) Wache:      Kran-Hammer (Arm steckt 1,6 s → Arm angreifbar) · Kabel-Peitsche · Ventil-Dampf. Schwachstelle: Arme.
//  Phase II (65–30 %)  Überlast:   Mittel-Platten brechen weg (1,2 s Vorwarnung) · Zwillings-Strahl über die Halle · Trümmerfall ·
//                                   Kabel-Griff statt zerstörtem Arm. Schwachstelle: 4 Kühlventile → Linse 3 s offen.
//  Phase III (< 30 %)  Kern frei:  Panzer fällt ab · Glut-Wellen Nord→Süd (mit Lücken) · Omega-Puls (Ring mit Lücke) · Letzter Griff (Sog).
//                                   Schwachstelle: Kern-Linse dauerhaft offen; < 15 % kritisch (schnellere Züge).
// Schaden nur an offenen Schwachstellen, sonst Funken + „GEPANZERT“ (A3). Alle Gefahren über bossFx/debrisDrops mit Vorwarnung
// (≥ 0,4 s, Arena-Änderungen ≥ 0,8 s). Kein globaler Zufall (Trümmer-Positionen: mulberry32 je Boss/Zug).
import { sound } from '../../engine/audio';
import { ENDBOSS_ARENA } from '../../data/balance';
import { ARENAS, ARENA_TILE } from '../../data/arenas';
import { mulberry32 } from '../../systems/seededRng';
import type { DungeonScene } from '../../scenes/DungeonScene';
import type { DetachedPart } from '../anim/detached';
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
    lastHit: null,
    armorMsgCd: 0,
    seq: 0,
  };
  if (e.levArms) {
    for (const arm of e.levArms) {
      arm.homeX = rb.cx + arm.side * 120;
      arm.homeY = rb.t + 66;
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
  e.vx = 0;
  e.vy = 0;
  updateArms(scene, e, dt);

  // ---- Auftritt (A6): Kamera fährt zum Boss, Titel-Banner; beim ersten Mal (noch nie besiegt) länger
  if (L.state === 'intro') {
    if (L.timer < 0) {
      const first = !scene.state.sector1Cleared;
      const dur = first ? ENDBOSS_ARENA.introSecFirst : ENDBOSS_ARENA.introSecRepeat;
      L.timer = dur;
      scene.camera.focus(e.x, e.y + 70, dur);
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
      // Kabel-Peitsche: fegt quer über die halbe Halle (Linie), von der Seite des Spielers
      const left = px < rb.cx;
      const y = Math.max(rb.t + 60, Math.min(rb.b - 14, py));
      const x0 = left ? rb.l + 4 : rb.r - 4;
      fx(scene).add({ shape: 'line', x: x0, y, x2: rb.cx + (left ? 24 : -24), y2: y, width: 16, delay: 0.85 * k, life: 0.22, burst: 18, color: '#a855f7', fx: 'dash' });
      if (L.phase === 3) {
        const y2 = Math.max(rb.t + 60, Math.min(rb.b - 14, y + (y > rb.cy ? -64 : 64)));
        fx(scene).add({ shape: 'line', x: left ? rb.r - 4 : rb.l + 4, y: y2, x2: rb.cx + (left ? -24 : 24), y2, width: 16, delay: 1.1 * k, life: 0.22, burst: 18, color: '#a855f7', fx: 'dash' });
      }
      L.timer = 1.4 * k;
      e.bossStatusText = 'KABEL-PEITSCHE!';
      sound.playBossCharge();
      break;
    }
    case 'steam': {
      // Ventil-Dampf: Seitenventile stoßen Dampf-Reihen in die Halle (oben- oder unten-Paar im Wechsel)
      const top = L.moveIdx % 2 === 0;
      for (const v of L.vents) {
        if ((v.y < rb.cy) !== top) continue;
        const fromLeft = v.x < rb.cx;
        const w = 170;
        fx(scene).add({ shape: 'rect', x: fromLeft ? v.x + 8 + w / 2 : v.x - 8 - w / 2, y: v.y, w, h: 30, delay: 0.9 * k, life: 1.1, dps: 16, color: '#e2e8f0' });
      }
      L.timer = 2.1 * k;
      e.bossStatusText = 'VENTIL-DAMPF!';
      break;
    }
    case 'beam': {
      // Zwillings-Strahl: drei Strahlen fegen nacheinander von den Kran-Schultern über die ganze Halle
      const len = scene.rayLimit(320);
      const sx = [rb.cx - 120, rb.cx + 120];
      const angs = [[0.35, 0.75, 1.15], [Math.PI - 0.35, Math.PI - 0.75, Math.PI - 1.15]];
      for (let s = 0; s < 2; s++) {
        angs[s].forEach((a, j) => {
          fx(scene).add({ shape: 'line', x: sx[s], y: rb.t + 66, x2: sx[s] + Math.cos(a) * len, y2: rb.t + 66 + Math.sin(a) * len, width: 12, delay: (0.8 + j * 0.45) * k, life: 0.35, burst: 18, color: '#fb7185' });
        });
      }
      L.timer = 2.6 * k;
      e.bossStatusText = 'ZWILLINGS-STRAHL!';
      sound.playBossLaser();
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
      // Kabel-Griff / Letzter Griff: Kabel ziehen am Spieler (Sog), dann schlägt der Kern zu
      const cx = e.x;
      const cy = e.y + 60;
      fx(scene).add({ shape: 'circle', x: cx, y: cy, r: 190, delay: 0.6, life: 2.0, pull: L.phase === 3 ? 62 : 52, color: '#818cf8', fx: 'pull' });
      fx(scene).add({ shape: 'circle', x: cx, y: cy - 10, r: 40, delay: 2.4 * k, life: 0.3, burst: 22, color: '#f87171', fx: 'blast' });
      L.timer = 3.0 * k;
      e.bossStatusText = L.phase === 3 ? 'LETZTER GRIFF!' : 'KABEL-GRIFF!';
      break;
    }
    case 'pulse': {
      // Omega-Puls: drei Ringwellen aus dem Kern, jede mit Lücke (Lücke wandert)
      const base = Math.atan2(py - (e.y + LENS_DY), px - e.x);
      [[30, 62, 0.8], [92, 124, 1.15], [154, 186, 1.5], [216, 248, 1.85]].forEach(([r0, r, d], j) => {
        fx(scene).add({ shape: 'ring', x: e.x, y: e.y + LENS_DY, r0, r, gapA: base + (j % 2 === 0 ? 0.9 : -0.9), gapHalf: 0.42, delay: d * k, life: 0.25, burst: 20, color: '#f43f5e' });
      });
      L.timer = 2.3 * k;
      e.bossStatusText = 'OMEGA-PULS!';
      sound.playBossRoar();
      break;
    }
    case 'glow': {
      // Glut-Wellen: Bänder wandern von Norden nach Süden, jedes mit einer Lücke (immer ein Ausweichweg)
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
        if (leftW > 4) fx(scene).add({ shape: 'rect', x: rb.l + leftW / 2, y, w: leftW, h: span * 0.8, delay, life: 0.32, burst: 16, color: '#fb923c' });
        if (rightW > 4) fx(scene).add({ shape: 'rect', x: gx + gapW + rightW / 2, y, w: rightW, h: span * 0.8, delay, life: 0.32, burst: 16, color: '#fb923c' });
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
  const plate = def ? plateRect(def.tiles, rb.l, rb.t) : null;
  if (plate && !L.platesBroken) {
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
        s.rebuildNav();
        s.triggerShake(0.5, 5);
        sound.playBossSlam();
        for (let i = 0; i < 6; i++) s.spawnBurst(plate.x + (plate.w * (i + 0.5)) / 6, plate.y + plate.h / 2, '#fb923c', 6);
      },
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

/** Begrenzungsrechteck der `p`-Kacheln (Bodenplatten). */
export function plateRect(tiles: string[], ox: number, oy: number): { x: number; y: number; w: number; h: number } | null {
  let c0 = Infinity, c1 = -1, r0 = Infinity, r1 = -1;
  tiles.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'p') continue;
      c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
    }
  });
  if (c1 < 0) return null;
  return { x: ox + c0 * ARENA_TILE, y: oy + r0 * ARENA_TILE, w: (c1 - c0 + 1) * ARENA_TILE, h: (r1 - r0 + 1) * ARENA_TILE };
}

/** Kran-Arme: Schweben, Verfolgen, Zuschlagen, Feststecken (angreifbar), Zurückkehren. */
function updateArms(scene: DungeonScene, e: Enemy, dt: number): void {
  const L = e.levArena!;
  for (const arm of e.levArms ?? []) {
    if (arm.dead) continue;
    if (arm.state === 'idle' || arm.state === 'returning' || arm.state === 'beam') {
      const hoverY = arm.homeY + Math.sin(scene.time * 3.0 + arm.side) * 4;
      arm.x += (arm.homeX - arm.x) * Math.min(1, dt * 6);
      arm.y += (hoverY - arm.y) * Math.min(1, dt * 6);
      if (arm.state !== 'idle' && Math.hypot(arm.x - arm.homeX, arm.y - hoverY) < 4) arm.state = 'idle';
    } else if (arm.state === 'tracking') {
      arm.timer -= dt;
      if (arm.timer > 0.3) {
        arm.targetX += (scene.playerX - arm.targetX) * Math.min(1, dt * 7);
        arm.targetY += (Math.max(scene.bounds.t + 70, Math.min(scene.bounds.b - 22, scene.playerY)) - arm.targetY) * Math.min(1, dt * 7);
      } else if (!arm.locked) {
        // Ziel fest → Vorwarnung am Boden (0,3 s + 0,16 s Schlag ≥ 0,4 s)
        arm.locked = true;
        fx(scene).add({ shape: 'circle', x: arm.targetX, y: arm.targetY, r: 34, delay: arm.timer + 0.16, life: 0.12, burst: 22, color: '#fb923c', fx: 'blast' });
      }
      arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 5);
      arm.y += (arm.targetY - 38 - arm.y) * Math.min(1, dt * 5);
      if (arm.timer <= 0) {
        arm.state = 'slamming';
        arm.timer = 0.16;
        arm.locked = false;
      }
    } else if (arm.state === 'slamming') {
      arm.timer -= dt;
      arm.x += (arm.targetX - arm.x) * Math.min(1, dt * 22);
      arm.y += (arm.targetY - arm.y) * Math.min(1, dt * 24);
      if (arm.timer <= 0) {
        arm.x = arm.targetX;
        arm.y = arm.targetY;
        arm.state = 'grounded';
        arm.timer = ENDBOSS_ARENA.leviathan.armStuckSec;
        sound.playBossSlam();
        scene.triggerShake(0.32, 5.2);
        scene.decals.push({ x: arm.x, y: arm.y + 6, r: 22, color: 'rgba(15, 23, 42, 0.58)', life: 6, maxLife: 6 });
        scene.shockwaves.push({ x: arm.x, y: arm.y + 2, maxRadius: 58, color: '#fb923c', life: 0.32, maxLife: 0.32 });
        scene.spawnBurst(arm.x, arm.y + 4, '#fbbf24', 22);
        scene.floats.push({ x: arm.x, y: arm.y - 22, text: 'ARM STECKT FEST!', color: '#fde047', life: 0.9, maxLife: 0.9 });
      }
    } else if (arm.state === 'grounded') {
      arm.timer -= dt;
      if (arm.timer <= 0) arm.state = 'returning';
    }
  }
  void L;
}

/** Sieg: Glut sinkt (Abgrund schließt sich), Kamera schwenkt zur Linse. */
export function onLeviathanArenaDefeated(scene: DungeonScene, e: Enemy): void {
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
  // Kühlventile
  for (const v of L.vents) {
    ctx.save();
    if (v.broken) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(v.x - 7, v.y - 9, 14, 18);
      ctx.fillStyle = `rgba(148, 163, 184, ${0.3 + 0.2 * Math.sin(t * 5 + v.y)})`;
      ctx.beginPath();
      ctx.arc(v.x + (v.x < scene.bounds.cx ? 8 : -8), v.y - 6 - ((t * 20) % 12), 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const weak = L.phase >= 2;
      ctx.fillStyle = '#0d2536';
      ctx.fillRect(v.x - 7, v.y - 9, 14, 18);
      ctx.fillStyle = weak ? `rgba(56, 232, 212, ${0.6 + 0.4 * pulse})` : '#1e6f6a';
      for (let k = -6; k <= 4; k += 4) ctx.fillRect(v.x - 5, v.y + k, 10, 2);
      if (weak) {
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(v.x, v.y, VENT_R + 3 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
        // kleine HP-Leiste
        ctx.fillStyle = '#0b1019';
        ctx.fillRect(v.x - 9, v.y + 12, 18, 3);
        ctx.fillStyle = '#38e8d4';
        ctx.fillRect(v.x - 9, v.y + 12, 18 * (v.hp / Math.max(1, v.maxHp)), 3);
      }
    }
    ctx.restore();
  }
  // Arme: angreifbar → pulsierender Ring
  for (const arm of e.levArms ?? []) {
    if (!armWeak(L, arm)) continue;
    ctx.save();
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.55 + 0.45 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(arm.x, arm.y, ARM_R + 4 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Kern-Linse
  const lx = e.x;
  const ly = e.y + LENS_DY;
  ctx.save();
  if (lensIsOpen(L)) {
    const flicker = L.critical ? 0.6 + 0.4 * Math.sin(t * 30) : 1;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(lx, ly, LENS_R + 8 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, LENS_R + 3, 0, Math.PI * 2);
    ctx.stroke();
    if (L.phase === 2 && L.lensOpen > 0) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`LINSE OFFEN ${L.lensOpen.toFixed(1)}`, lx, ly - LENS_R - 10);
    }
  } else {
    // Linse verriegelt: Lamellen
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.arc(lx, ly, LENS_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(a) * LENS_R, ly + Math.sin(a) * LENS_R);
      ctx.stroke();
    }
  }
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
