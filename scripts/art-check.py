#!/usr/bin/env python3
"""Prüfbild für Sheets (M11 v2): legt Raster, Zellnummern, Zellmitte (Fadenkreuz) und die Umrisse der erkannten Teile über das Sheet.
  python3 scripts/art-check.py art_source/rigs/krall_arms_R.png [--cols 3 --rows 2]
Ergebnis: art_source/_check/<name>_check.png — ansehen, ob Gelenk (Schulterring) im Fadenkreuz liegt und nichts die Zellgrenze berührt.
"""
import argparse, os, sys
from PIL import Image, ImageDraw

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--rows", type=int, default=2)
    a = ap.parse_args()
    im = Image.open(a.file).convert("RGB")
    W, H = im.size
    cw, ch = W / a.cols, H / a.rows
    d = ImageDraw.Draw(im, "RGBA")
    report = []
    for r in range(a.rows):
        for c in range(a.cols):
            x0, y0, x1, y1 = round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)
            cell = im.crop((x0, y0, x1, y1))
            px = cell.load()
            xs, ys = [], []
            for y in range(cell.height):
                for x in range(cell.width):
                    p = px[x, y]
                    if not (p[0] >= 232 and p[1] >= 232 and p[2] >= 232):
                        xs.append(x); ys.append(y)
            n = r * a.cols + c + 1
            d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 0, 255, 160))
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            d.line((cx - 14, cy, cx + 14, cy), fill=(255, 0, 0, 230), width=2)
            d.line((cx, cy - 14, cx, cy + 14), fill=(255, 0, 0, 230), width=2)
            d.text((x0 + 6, y0 + 4), str(n), fill=(255, 0, 255, 255))
            if xs:
                bx0, by0, bx1, by1 = min(xs) + x0, min(ys) + y0, max(xs) + x0, max(ys) + y0
                d.rectangle((bx0, by0, bx1, by1), outline=(0, 200, 255, 200))
                touch = min(xs) <= 3 or min(ys) <= 3 or max(xs) >= cell.width - 4 or max(ys) >= cell.height - 4
                report.append(f"Zelle {n}: Teil {max(xs)-min(xs)}×{max(ys)-min(ys)} px, Mitte ({(min(xs)+max(xs))//2},{(min(ys)+max(ys))//2}) von ({cell.width//2},{cell.height//2}){'  ⚠ berührt den Zellrand' if touch else ''}")
            else:
                report.append(f"Zelle {n}: leer")
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(a.file))), "_check")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, os.path.splitext(os.path.basename(a.file))[0] + "_check.png")
    im.save(out)
    print("\n".join(report)); print("→", out)

if __name__ == "__main__":
    sys.exit(main())
