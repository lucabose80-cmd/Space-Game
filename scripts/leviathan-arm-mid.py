"""Leviathan Zwischenposen (Ellbogen nach außen): Roh-Bild mit 2 Armen (links Anlauf, rechts Schlag) → armWind.png / armStrike.png (240×260),
am Schulter-Gelenk (Quadrat-Socket) auf armIdle-Pivot (101,107) ausgerichtet. Aufruf: python3 scripts/leviathan-arm-mid.py <roh.png> [scale=0.155]"""
import sys
from PIL import Image, ImageDraw
import numpy as np
src = sys.argv[1]; K = float(sys.argv[2]) if len(sys.argv) > 2 else 0.155
raw = Image.open(src).convert('RGB')
W, H = raw.size
SOCK = {'armWind': (636, 617), 'armStrike': (1890, 605)}  # Socket-Mitte im Rohbild (px), per Sichtprüfung
for name, (x0, x1) in {'armWind': (0, W // 2), 'armStrike': (W // 2, W)}.items():
    c = raw.crop((x0, 0, x1, H))
    f = c.copy()
    for pt in [(0, 0), (c.width - 1, 0), (0, c.height - 1), (c.width - 1, c.height - 1)]:
        ImageDraw.floodfill(f, pt, (255, 0, 255), thresh=28)
    m = np.array(f); a = np.array(c)
    bg = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    bg |= (a.min(2) > 222)  # weiße Fransen/Reste in Lücken (Kabel) ebenfalls weg
    im = Image.fromarray(np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
    sx, sy = SOCK[name][0] - x0, SOCK[name][1]
    im = im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS)
    out = Image.new('RGBA', (240, 260), (0, 0, 0, 0))
    out.alpha_composite(im, (round(101 - sx * K), round(107 - sy * K))) if (round(101 - sx * K) >= 0 and round(107 - sy * K) >= 0) else out.paste(im, (round(101 - sx * K), round(107 - sy * K)), im)
    out.save(f'public/art/rigs/boss_leviathan/{name}.png')
    print(name, out.getbbox())
