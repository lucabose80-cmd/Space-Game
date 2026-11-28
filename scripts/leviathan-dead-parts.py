"""Leviathan: Roh-Bild (weißer Hintergrund) → public/art/rigs/boss_leviathan/' + PART + '.png (240×260, an armIdle ausgerichtet)
und art_source/rigs/boss_leviathan_' + PART + '.png (Rohquelle). Aufruf: python3 scripts/leviathan-arm-dead.py <roh.png>"""
import sys, shutil
from PIL import Image
import numpy as np
from PIL import ImageDraw
src = sys.argv[1]
PART = sys.argv[2] if len(sys.argv) > 2 else 'armDead'  # armDead | headDead
REF = 'armIdle' if PART == 'armDead' else 'head'
raw = Image.open(src).convert('RGB')
# Flood-Fill von den Ecken (Weiß ≥ 235), nur Außenhintergrund wird transparent
w = raw.copy()
for pt in [(0, 0), (w.width-1, 0), (0, w.height-1), (w.width-1, w.height-1)]:
    ImageDraw.floodfill(w, pt, (255, 0, 255), thresh=28)
a = np.array(raw)
m = np.array(w)
bg = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
rgba = np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)])
im = Image.fromarray(rgba, 'RGBA')
bb = im.getbbox(); im = im.crop(bb)
ref = Image.open('public/art/rigs/boss_leviathan/' + REF + '.png'); rb = ref.getbbox()
k = min((rb[2]-rb[0]) / im.width, (rb[3]-rb[1]) / im.height)
im = im.resize((round(im.width*k), round(im.height*k)), Image.LANCZOS)
out = Image.new('RGBA', ref.size, (0, 0, 0, 0))
out.paste(im, (rb[0] + ((rb[2]-rb[0]) - im.width)//2, rb[3] - im.height), im)
out.save('public/art/rigs/boss_leviathan/' + PART + '.png')
shutil.copy(src, 'art_source/rigs/boss_leviathan_' + PART + '.png')
print('ok', out.getbbox(), 'ref', rb)
