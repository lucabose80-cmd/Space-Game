"""Leviathan-Rig: Torso-Varianten (torso/torsoP2) im 200×200-Rahmen waagerecht auf Mitte 100 schieben,
damit alle 4 Torso-Zustände dieselbe Körpermitte haben (sonst springen Schultern/Arme beim Phasenwechsel)."""
from PIL import Image
import numpy as np, sys
d = 'public/art/rigs/boss_leviathan/'
for n in ['torso', 'torsoP2', 'torsoP3', 'torsoDead']:
    im = Image.open(d + n + '.png').convert('RGBA')
    a = np.array(im)[:, :, 3] > 40
    cols = np.where(a.any(0))[0]
    shift = 100 - int(round((cols.min() + cols.max()) / 2))
    if shift == 0 or abs(shift) > 40:
        continue
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (shift, 0))
    out.save(d + n + '.png')
    print(n, 'verschoben um', shift)
