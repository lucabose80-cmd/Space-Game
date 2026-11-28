"""Leviathan Wrack (A13): Roh-Bild (Schulterstumpf) → public/art/rigs/boss_leviathan/armStump.png (240×260), Socket (1113,869) → (132,108), Skala 0,116.
Aufruf: python3 scripts/leviathan-stump.py <roh.png>"""
import sys
from PIL import Image, ImageDraw
import numpy as np
raw = Image.open(sys.argv[1]).convert('RGB')
f = raw.copy()
for pt in [(0, 0), (raw.width - 1, 0), (0, raw.height - 1), (raw.width - 1, raw.height - 1)]:
    ImageDraw.floodfill(f, pt, (255, 0, 255), thresh=28)
m = np.array(f); a = np.array(raw)
bg = ((m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)) | (a.min(2) > 225)
im = Image.fromarray(np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
K = 0.116; SX, SY = 1113, 869
im = im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS)
out = Image.new('RGBA', (240, 260), (0, 0, 0, 0))
ox, oy = round(132 - SX * K), round(108 - SY * K)
out.paste(im, (ox, oy), im)
out.save('public/art/rigs/boss_leviathan/armStump.png'); print(out.getbbox())
