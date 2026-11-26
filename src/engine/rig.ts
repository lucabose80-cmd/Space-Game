// M11 (Phase 1): Cut-out-Rig — Bosse/Gegner aus einzelnen Teilen zeichnen und bewegen.
// Reines Zeichnen/Rechnen, keine Spiellogik. Teile-Bilder sind bereits in Spielpixeln (art-import skaliert sie).
//
// Koordinaten: Rig-Ursprung = Fußpunkt der Figur. Jedes Teil hat einen Gelenkpunkt `pivot` (0…1 im Teilbild);
// Kinder hängen an `attach` (0…1 am Elternteil) + `offset` (px). Wurzelteile liegen bei `offset` vom Ursprung.
// `flipX` spiegelt Bild UND Anker (pivot/attach des Teils), nicht den Koordinatenrahmen der Kinder.

export interface RigPartDef {
  id: string;
  image?: string; // Bildname (Standard = id) — mehrere Teile dürfen ein Bild teilen (links/rechts)
  parent?: string;
  attach?: [number, number];
  pivot: [number, number];
  offset?: [number, number];
  z: number;
  flipX?: boolean;
  /** statische Grunddrehung (rad) — z. B. eine seitlich gezeichnete Faust, deren Manschette nach oben zeigen soll */
  rot?: number;
}

export interface RigDef {
  id: string;
  parts: RigPartDef[];
  /** Geräte-Pixel pro Spiel-Pixel der Teile-Bilder (art-import: 2 = RENDER_SCALE) → Bilder werden 1:1 auf dem Bildschirm gezeichnet */
  ratio?: number;
}

export interface RigImages {
  parts: Record<string, HTMLCanvasElement | null>;
  flash: Record<string, HTMLCanvasElement | null>;
}

export interface PartPose {
  rot?: number; // rad, um das Gelenk
  dx?: number;
  dy?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  hidden?: boolean;
}
export type Pose = Record<string, PartPose>;

export interface DrawRigOpts {
  flash?: boolean;
  scale?: number;
  flipX?: boolean;
  alpha?: number;
}

type Mat = [number, number, number, number, number, number]; // a b c d e f (Canvas-Konvention)

const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const rotScale = (rot: number, sx: number, sy: number): Mat => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [c * sx, s * sx, -s * sy, c * sy, 0, 0];
};

const flipCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function flipped(src: HTMLCanvasElement): HTMLCanvasElement {
  let f = flipCache.get(src);
  if (!f) {
    f = document.createElement('canvas');
    f.width = src.width;
    f.height = src.height;
    const g = f.getContext('2d')!;
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    flipCache.set(src, f);
  }
  return f;
}

export interface PartPlacement {
  def: RigPartDef;
  world: Mat;
  img: HTMLCanvasElement | null;
  flash: HTMLCanvasElement | null;
  w: number;
  h: number;
  px: number; // Gelenk im Teilbild (px, nach evtl. Spiegelung)
  py: number;
}

/** Berechnet für alle Teile die Welt-Matrix (relativ zu (x,y)) — Grundlage für Zeichnen und `partWorldPos`. */
export function layoutRig(def: RigDef, images: RigImages | null, pose: Pose, opts?: DrawRigOpts): PartPlacement[] {
  const byId = new Map<string, RigPartDef>(def.parts.map((p) => [p.id, p]));
  const cache = new Map<string, PartPlacement>();
  const scale = opts?.scale ?? 1;
  const mirror = opts?.flipX === true;

  const place = (id: string): PartPlacement => {
    const hit = cache.get(id);
    if (hit) return hit;
    const p = byId.get(id)!;
    const key = p.image ?? p.id;
    const baseImg = images?.parts[key] ?? null;
    const baseFlash = images?.flash[key] ?? null;
    const img = baseImg && p.flipX ? flipped(baseImg) : baseImg;
    const flash = baseFlash && p.flipX ? flipped(baseFlash) : baseFlash;
    const ratio = def.ratio ?? 1;
    const w = (img?.width ?? 0) / ratio;
    const h = (img?.height ?? 0) / ratio;
    const pvx = p.flipX ? 1 - p.pivot[0] : p.pivot[0];
    const pvy = p.pivot[1];
    const ps = pose[p.id] ?? {};
    let joint: [number, number];
    let parentWorld: Mat;
    if (p.parent) {
      const par = place(p.parent);
      const pd = par.def;
      const ax = p.attach?.[0] ?? 0.5;
      const ay = p.attach?.[1] ?? 0.5;
      const pax = pd.flipX ? 1 - ax : ax;
      const ppx = pd.flipX ? 1 - pd.pivot[0] : pd.pivot[0];
      joint = [(pax - ppx) * par.w + (p.offset?.[0] ?? 0), (ay - pd.pivot[1]) * par.h + (p.offset?.[1] ?? 0)];
      parentWorld = par.world;
    } else {
      joint = [(p.offset?.[0] ?? 0) * (mirror ? -1 : 1), p.offset?.[1] ?? 0];
      parentWorld = mirror ? [-scale, 0, 0, scale, 0, 0] : [scale, 0, 0, scale, 0, 0];
    }
    const local = mul(translate(joint[0] + (ps.dx ?? 0), joint[1] + (ps.dy ?? 0)), rotScale((p.rot ?? 0) + (ps.rot ?? 0), ps.sx ?? 1, ps.sy ?? 1));
    const placement: PartPlacement = { def: p, world: mul(parentWorld, local), img, flash, w, h, px: pvx * w, py: pvy * h };
    cache.set(id, placement);
    return placement;
  };
  return def.parts.map((p) => place(p.id));
}

export function drawRig(
  ctx: CanvasRenderingContext2D,
  def: RigDef,
  images: RigImages,
  x: number,
  y: number,
  pose: Pose,
  opts?: DrawRigOpts,
): void {
  const placed = layoutRig(def, images, pose, opts);
  const order = placed
    .map((pl, i) => ({ pl, i }))
    .sort((a, b) => a.pl.def.z - b.pl.def.z || a.i - b.i)
    .map((o) => o.pl);
  const baseAlpha = opts?.alpha ?? 1;
  ctx.save();
  ctx.translate(x, y);
  for (const pl of order) {
    const ps = pose[pl.def.id];
    if (ps?.hidden) continue;
    const img = opts?.flash ? pl.flash ?? pl.img : pl.img;
    if (!img) continue;
    ctx.save();
    const m = pl.world;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = baseAlpha * (ps?.alpha ?? 1);
    ctx.drawImage(img, -pl.px, -pl.py, pl.w, pl.h);
    ctx.restore();
  }
  ctx.restore();
}

/** Weltposition (relativ zu (x,y)) und Drehung des Gelenks eines Teils — z. B. für abgelöste Teile/Geschosse. */
export function partWorldPos(def: RigDef, images: RigImages | null, pose: Pose, partId: string, x = 0, y = 0, opts?: DrawRigOpts): { x: number; y: number; rot: number } {
  const pl = layoutRig(def, images, pose, opts).find((p) => p.def.id === partId);
  if (!pl) return { x, y, rot: 0 };
  const m = pl.world;
  return { x: x + m[4], y: y + m[5], rot: Math.atan2(m[1], m[0]) };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Weiches Überblenden zweier Posen (t = 0 → a, 1 → b). */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const pa = a[id] ?? {};
    const pb = b[id] ?? {};
    out[id] = {
      rot: lerp(pa.rot ?? 0, pb.rot ?? 0, t),
      dx: lerp(pa.dx ?? 0, pb.dx ?? 0, t),
      dy: lerp(pa.dy ?? 0, pb.dy ?? 0, t),
      sx: lerp(pa.sx ?? 1, pb.sx ?? 1, t),
      sy: lerp(pa.sy ?? 1, pb.sy ?? 1, t),
      alpha: lerp(pa.alpha ?? 1, pb.alpha ?? 1, t),
      hidden: t < 0.5 ? pa.hidden : pb.hidden,
    };
  }
  return out;
}
