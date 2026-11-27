// M12: Schatzkammer hinter der Boss-Wand (Idee des Inhabers, angelehnt an das Öffnen der Wand nach einem Endboss).
// Nach dem Sieg fährt in der Nordwand eine Tür auf (Kamera schwenkt hin), die Raumgrenzen wachsen nach Norden — Gang durch
// die Wand + Kammer mit Boss-Truhe — ganz ohne Ladeübergang. Nicht in der Wochen-Prüfung (dort gibt es keine Beute).
// Geometrie kommt aus `ArenaDef.vault` (relativ zur linken oberen Ecke der Spielfläche). Kein Zufall.
import { getHDArt } from '../assets/artLoader';
import { ARENAS, type ArenaVaultDef } from '../data/arenas';
import { sound } from '../engine/audio';
import type { DungeonScene } from '../scenes/DungeonScene';
import type { DungeonRoom, ObstacleRect } from '../world/dungeonGen';

export interface ArenaVaultState {
  /** Sekunden seit dem Sieg */
  t: number;
  /** Tür-Öffnung 0…1 */
  open: number;
  /** Grenzen/Hindernisse/Truhe übernommen */
  done: boolean;
}

/** Ab wann die Tür aufgeht und wie lange sie fährt (s) */
export const VAULT_DELAY = 1.8;
export const VAULT_OPEN_SEC = 1.4;

function vaultDef(room: DungeonRoom): ArenaVaultDef | undefined {
  return room.arenaKind ? ARENAS[room.arenaKind]?.vault : undefined;
}

/** Ursprung der Spielfläche (unveränderlich, auch nachdem `bounds.t` nach Norden gewachsen ist). */
function origin(room: DungeonRoom): { l: number; t: number } {
  const b = room.bounds!;
  return { l: b.l, t: room.arenaOriginT ?? b.t };
}

/** Beim Sieg: Öffnung vormerken. */
export function startArenaVault(scene: DungeonScene): void {
  const room = scene.currentRoom;
  if (scene.isWeeklyTrial || !vaultDef(room) || room.arenaVault) return;
  room.arenaOriginT = room.bounds!.t;
  room.arenaVault = { t: 0, open: 0, done: false };
}

export function updateArenaVault(scene: DungeonScene, dt: number): void {
  const room = scene.currentRoom;
  const V = room.arenaVault;
  const def = vaultDef(room);
  if (!V || V.done || !def || !room.bounds) return;
  const o = origin(room);
  const prevT = V.t;
  V.t += dt;
  const doorX = o.l + def.doorX + def.doorW / 2;
  if (prevT < VAULT_DELAY && V.t >= VAULT_DELAY) {
    scene.camera.focus(doorX, o.t - 20, 2.2);
    sound.playDoorUnlock();
    scene.triggerShake(0.5, 3);
    scene.callbacks.onToast('🔓 Hinter der Wand öffnet sich eine verborgene Schatzkammer!', 'good');
  }
  V.open = Math.max(0, Math.min(1, (V.t - VAULT_DELAY) / VAULT_OPEN_SEC));
  if (V.open > 0 && V.open < 1 && Math.floor(V.t * 8) !== Math.floor(prevT * 8)) scene.spawnBurst(doorX, o.t + 40, '#94a3b8', 3);
  if (V.open >= 1) {
    V.done = true;
    applyVaultGeometry(scene, room, def);
    sound.playSecretChime();
  }
}

/** Raum nach Norden erweitern: Gang durch die Wand + Kammer begehbar, Rest der Wand fest, Boss-Truhe in die Mitte. */
export function applyVaultGeometry(scene: DungeonScene, room: DungeonRoom, def: ArenaVaultDef): void {
  const b = room.bounds!;
  const o = origin(room);
  const top = o.t + def.y;
  // Innenraum der Kammer und Gang (Welt)
  const il = o.l + def.x + def.inset.side;
  const ir = o.l + def.x + def.w - def.inset.side;
  const it = top + def.inset.top;
  const ib = top + def.h - def.inset.bottom;
  const dl = o.l + def.doorX;
  const dr = dl + def.doorW;
  const wallBottom = o.t + 48;
  const W = 'bulkhead_wall' as const;
  const solid: ObstacleRect[] = ([
    { x: b.l, y: top, w: il - b.l, h: wallBottom - top, kind: W },
    { x: ir, y: top, w: b.r - ir, h: wallBottom - top, kind: W },
    { x: il, y: top, w: ir - il, h: it - top, kind: W },
    { x: il, y: ib, w: dl - il, h: wallBottom - ib, kind: W },
    { x: dr, y: ib, w: ir - dr, h: wallBottom - ib, kind: W },
  ] as ObstacleRect[]).filter((r) => r.w > 0 && r.h > 0);
  room.obstacles = room.obstacles.filter((ob) => ob.kind !== 'bulkhead_wall').concat(solid);
  room.bounds = { ...b, t: top, vt: top - 10 };
  room.chest = { x: (il + ir) / 2, y: (it + ib) / 2 + 4, opened: false, rare: true, secret: true, boss: true };
  scene.rebuildNav();
}

/** Zeichnet Kammer, Gang und Tür (Weltkoordinaten; nach Wand und Wandfuß). */
export function drawArenaVault(ctx: CanvasRenderingContext2D, room: DungeonRoom, time: number): void {
  const V = room.arenaVault;
  const def = vaultDef(room);
  if (!V || !def || !room.bounds) return;
  const o = origin(room);
  const top = o.t + def.y;
  const dl = o.l + def.doorX;
  const dw = def.doorW;
  const wallTop = o.t - 48;
  const wallBottom = o.t + 48;
  const p = V.open;
  if (p > 0) {
    // Kammer (P1-12) — Rückfall: warm beleuchteter Boden
    const img = getHDArt().arenaLeviathanVault;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 1.5);
    if (img) ctx.drawImage(img, o.l + def.x, top, def.w, def.h);
    else {
      ctx.fillStyle = '#2a1d14';
      ctx.fillRect(o.l + def.x, top, def.w, def.h);
      const g = ctx.createRadialGradient(o.l + def.x + def.w / 2, top + def.h / 2, 4, o.l + def.x + def.w / 2, top + def.h / 2, def.w / 2);
      g.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
      g.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(o.l + def.x, top, def.w, def.h);
    }
    ctx.restore();
    // Gang durch die Wand
    ctx.fillStyle = '#141a24';
    ctx.fillRect(dl, wallTop, dw, wallBottom - wallTop + 2);
    ctx.fillStyle = '#273142';
    for (let y = wallTop; y < wallBottom; y += 8) ctx.fillRect(dl + 2, y, dw - 4, 1);
    ctx.fillStyle = `rgba(251, 191, 36, ${0.25 + 0.15 * Math.sin(time * 3)})`;
    ctx.fillRect(dl + 1, wallTop, 2, wallBottom - wallTop);
    ctx.fillRect(dl + dw - 3, wallTop, 2, wallBottom - wallTop);
  }
  if (p < 1) {
    // Tür: zwei Panzer-Hälften fahren zur Seite in die Wand
    const half = dw / 2;
    const slide = half * p;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dl - 2, wallBottom - 40, dw + 4, 40);
    ctx.clip();
    for (const side of [-1, 1]) {
      const x = side < 0 ? dl - slide : dl + half + slide;
      ctx.fillStyle = '#3f4756';
      ctx.fillRect(x, wallBottom - 40, half, 40);
      ctx.fillStyle = '#56607a';
      ctx.fillRect(x, wallBottom - 40, half, 3);
      ctx.fillStyle = '#fbbf24';
      for (let k = 0; k < 4; k++) ctx.fillRect(side < 0 ? x + half - 3 : x, wallBottom - 36 + k * 10, 3, 5);
    }
    ctx.restore();
  }
  // Rahmen
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(dl - 1.5, wallBottom - 41.5, dw + 3, 42);
}
