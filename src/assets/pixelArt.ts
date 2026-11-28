export type Palette = Record<string, string>;

export function compilePixelArt(
  rows: string[],
  palette: Palette,
  scale = 1,
): HTMLCanvasElement {
  const height = rows.length;
  const width = rows[0]?.length ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

export function flipCanvasHorizontal(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function makeFlashSilhouette(
  source: HTMLCanvasElement,
  color = '#ffffff',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.35,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.42,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(10, 12, 22, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sichtbarer Fußabdruck eines Sprites (Anteile 0..1), einmal pro Bild gemessen. */
interface SpriteFootprint {
  left: number;
  right: number;
  bottom: number;
}
const footprintCache = new WeakMap<CanvasImageSource, SpriteFootprint>();

function measureFootprint(img: CanvasImageSource): SpriteFootprint {
  const cached = footprintCache.get(img);
  if (cached) return cached;
  let fp: SpriteFootprint = { left: 0.1, right: 0.9, bottom: 1 };
  try {
    const w = (img as HTMLImageElement | HTMLCanvasElement).width;
    const h = (img as HTMLImageElement | HTMLCanvasElement).height;
    if (w > 0 && h > 0) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d', { willReadFrequently: true });
      if (cx) {
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, w, h).data;
        let bottom = -1;
        for (let y = h - 1; y >= 0 && bottom < 0; y--) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 40) {
              bottom = y;
              break;
            }
          }
        }
        if (bottom >= 0) {
          // Breite der untersten ~12 % sichtbaren Zeilen = tatsächliche Standfläche
          const band = Math.max(2, Math.round(h * 0.12));
          let l = w;
          let r = -1;
          for (let y = Math.max(0, bottom - band); y <= bottom; y++) {
            for (let x = 0; x < w; x++) {
              if (data[(y * w + x) * 4 + 3] > 40) {
                if (x < l) l = x;
                if (x > r) r = x;
              }
            }
          }
          if (r >= l) fp = { left: l / w, right: (r + 1) / w, bottom: (bottom + 1) / h };
        }
      }
    }
  } catch {
    /* Bild nicht lesbar → Standardwerte */
  }
  footprintCache.set(img, fp);
  return fp;
}

/**
 * Kontaktschatten genau an der sichtbaren Unterkante eines gezeichneten Sprites (statt an einer geschätzten Position).
 * Zwei Lagen: breiter weicher Schatten + dunkler Kontaktkern direkt unter der Standfläche → Props sitzen auf dem Boden
 * statt zu schweben. Vor dem Sprite aufrufen (Schatten liegt dahinter).
 */
export function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource | null | undefined,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  alpha = 0.5,
): void {
  const fp = img ? measureFootprint(img) : { left: 0.1, right: 0.9, bottom: 1 };
  const baseW = Math.max(4, (fp.right - fp.left) * dw);
  const cx = dx + ((fp.left + fp.right) / 2) * dw;
  const by = dy + fp.bottom * dh;
  drawPixelShadow(ctx, cx, by - 0.5, baseW * 0.62, Math.max(2.2, baseW * 0.2), alpha * 0.55);
  drawPixelShadow(ctx, cx, by - 1.5, baseW * 0.46, Math.max(1.6, baseW * 0.12), alpha);
}
