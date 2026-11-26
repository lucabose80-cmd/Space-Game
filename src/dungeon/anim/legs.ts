// M11 (Phase 2): prozedurale Beine für Gegner ohne eigene Beine im Sprite (Geschütz, Mörser, Scharfschütze).
// Füße haften in der Welt (Stützphase ortsfest) und machen kurze Schritte, sobald der Körper sich entfernt;
// zwei Beingruppen wechseln sich ab (Trippelschritt). Zwei-Knochen-IK mit Knie nach oben/außen.
// Rein darstellend — keine Hitbox-/Schadensänderung, kein globaler Zufall.
import type { Enemy } from '../dungeonTypes';

export interface LegDef {
  /** Hüfte relativ zu (e.x, e.y) */
  hip: [number, number];
  /** Ruhe-Fußpunkt relativ zu (e.x, e.y) */
  foot: [number, number];
  /** Beingruppe (0/1) — wechselt sich beim Gehen ab */
  group: 0 | 1;
}

export interface LegSpec {
  legs: LegDef[];
  /** Länge Oberschenkel / Unterschenkel (px) */
  l1: number;
  l2: number;
  /** Abstand Fuß ↔ Ruheposition, ab dem ein Schritt beginnt (px) */
  threshold: number;
  /** Dauer eines Schritts (s) bei Stillstand — schneller beim Rennen */
  stepTime: number;
  /** Fußhöhe in der Luft (px) */
  lift: number;
  color: string;
  dark: string;
  width: number;
}

const mirror = (x: number, y: number, fx: number, fy: number, g: 0 | 1): [LegDef, LegDef] => [
  { hip: [-x, y], foot: [-fx, fy], group: g },
  { hip: [x, y], foot: [fx, fy], group: (1 - g) as 0 | 1 },
];

/** Welche Gegner Beine bekommen. Krabbler/Käfer/Skarabäus haben ihre Beine schon im Sprite → erst mit „Körper ohne Beine“-Pose-Sheets (Phase 7). */
export const LEG_SPECS: Partial<Record<Enemy['kind'], LegSpec>> = {
  turret: {
    legs: [...mirror(5, 3, 13, 9, 0), ...mirror(4, 6, 10, 14, 1)],
    l1: 7, l2: 8, threshold: 4.5, stepTime: 0.13, lift: 3.2, color: '#94a3b8', dark: '#0f172a', width: 1.5,
  },
  magma_mortar: {
    legs: [...mirror(6, 3, 12, 8, 0), ...mirror(7, 6, 14, 12, 1), ...mirror(5, 8, 10, 15, 0)],
    l1: 5, l2: 6, threshold: 3.5, stepTime: 0.15, lift: 2.2, color: '#92400e', dark: '#1c0a05', width: 1.1,
  },
  shard_sniper: {
    legs: mirror(2, 1, 4, 10, 0),
    l1: 4.5, l2: 5.5, threshold: 4.5, stepTime: 0.2, lift: 3, color: '#c4b5fd', dark: '#1e1b4b', width: 1.1,
  },
};

export interface Foot {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  stepping: boolean;
  lift: number;
}

interface LegState {
  feet: Foot[];
  time: number;
  /** zuletzt gestartete Beingruppe — damit die andere Gruppe nicht verhungert */
  lastGroup: number;
}

const states = new WeakMap<Enemy, LegState>();

export function hasLegs(e: Enemy): boolean {
  return LEG_SPECS[e.kind] !== undefined;
}

const ease = (t: number): number => t * t * (3 - 2 * t);

/** Füße fortschreiben (Zeit in s, wie `scene.time`). Gibt die aktuellen Füße zurück. */
export function updateLegs(e: Enemy, time: number): Foot[] {
  const spec = LEG_SPECS[e.kind];
  if (!spec) return [];
  let st = states.get(e);
  const spread = (e.telegraphTimer ?? 0) > 0 ? 1.15 : 1; // beim Feuern: Füße stemmen sich nach außen
  const rest = (d: LegDef): [number, number] => [e.x + d.foot[0] * spread, e.y + d.foot[1]];
  if (!st) {
    st = {
      time,
      lastGroup: 1,
      feet: spec.legs.map((d) => {
        const [rx, ry] = rest(d);
        return { x: rx, y: ry, fromX: rx, fromY: ry, toX: rx, toY: ry, t: 1, stepping: false, lift: 0 };
      }),
    };
    states.set(e, st);
    return st.feet;
  }
  const dt = Math.max(0, Math.min(0.1, time - st.time));
  st.time = time;
  const speed = Math.hypot(e.vx, e.vy);
  const dur = spec.stepTime / (1 + speed / 110);
  const leadX = Math.max(-6, Math.min(6, e.vx * 0.13));
  const leadY = Math.max(-4, Math.min(4, e.vy * 0.1));
  const stepping = [false, false];
  st.feet.forEach((f, i) => {
    if (f.stepping) stepping[spec.legs[i].group] = true;
  });
  // „fällig“: Standbein einer Gruppe hat sich zu weit vom Ruhepunkt entfernt
  const due = [false, false];
  st.feet.forEach((f, i) => {
    if (f.stepping) return;
    const d = spec.legs[i];
    const [rx, ry] = rest(d);
    if (Math.hypot(f.x - (rx + leadX), f.y - (ry + leadY)) > spec.threshold) due[d.group] = true;
  });
  st.feet.forEach((f, i) => {
    const d = spec.legs[i];
    if (f.stepping) {
      f.t = Math.min(1, f.t + dt / dur);
      const k = ease(f.t);
      f.x = f.fromX + (f.toX - f.fromX) * k;
      f.y = f.fromY + (f.toY - f.fromY) * k;
      f.lift = Math.sin(f.t * Math.PI) * spec.lift;
      if (f.t >= 1) {
        f.stepping = false;
        f.lift = 0;
        f.x = f.toX;
        f.y = f.toY;
      }
      return;
    }
    const [rx, ry] = rest(d);
    const dist = Math.hypot(f.x - (rx + leadX), f.y - (ry + leadY));
    const far = dist > spec.threshold * 6; // Rückstoß/Teleport: sofort nachziehen
    if (dist > spec.threshold && (far || (!stepping[1 - d.group] && (d.group !== st.lastGroup || !due[1 - d.group])))) {
      st.lastGroup = d.group;
      f.stepping = true;
      f.t = 0;
      f.fromX = f.x;
      f.fromY = f.y;
      f.toX = rx + leadX;
      f.toY = ry + leadY;
      stepping[d.group] = true;
    }
  });
  return st.feet;
}

/** Knie-Position (2-Knochen-IK); `side` = Beugerichtung (−1 links/außen nach oben, +1 rechts). */
export function kneePos(hx: number, hy: number, fx: number, fy: number, l1: number, l2: number, side: number): [number, number] {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ang = Math.atan2(dy, dx);
  const mx = hx + Math.cos(ang) * a;
  const my = hy + Math.sin(ang) * a;
  // Knie weicht senkrecht zur Hüfte→Fuß-Linie aus, bevorzugt nach oben
  let px = -Math.sin(ang) * h * side;
  let py = Math.cos(ang) * h * side;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  return [mx + px, my + py];
}

/** Beine zeichnen — vor dem Körper aufrufen (liegen dahinter). */
export function drawLegs(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const spec = LEG_SPECS[e.kind];
  if (!spec) return;
  const feet = updateLegs(e, time);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? spec.dark : spec.color;
    ctx.lineWidth = pass === 0 ? spec.width + 1.2 : spec.width;
    spec.legs.forEach((d, i) => {
      const f = feet[i];
      const hx = e.x + d.hip[0];
      const hy = e.y + d.hip[1];
      const fy = f.y - f.lift;
      const [kx, ky] = kneePos(hx, hy, f.x, fy, spec.l1, spec.l2, d.hip[0] < 0 ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(f.x, fy);
      ctx.stroke();
    });
  }
  ctx.restore();
}
