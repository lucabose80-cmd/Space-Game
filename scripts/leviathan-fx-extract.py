"""Leviathan FX-Sheet (art_source/rigs/leviathan_fx2.png, 1536×1024, 3×2 auf Weiß) → public/art/sprites/arena_leviathan_fx_*.png.
Beschriftungen werden durch feste Zuschnitt-Rechtecke ausgeschlossen; Weiß wird per Flood-Fill von den Rändern freigestellt."""
from PIL import Image, ImageDraw
import numpy as np
sheet = Image.open('art_source/rigs/leviathan_fx2.png').convert('RGB')
CROPS = {  # name: (l, t, r, b, max_dim)
    'beam_head': (90, 10, 510, 470, 256),
    'beam_body': (730, 0, 940, 470, 256),
    'beam_impact': (1080, 0, 1500, 462, 256),
    'shockwave': (0, 570, 606, 942, 320),
    'cracks': (636, 570, 1060, 955, 256),
    'crackline': (1066, 690, 1536, 862, 256),
}
for name, (l, t, r, b, mx) in CROPS.items():
    c = sheet.crop((l, t, r, b))
    f = c.copy()
    for pt in [(0, 0), (c.width - 1, 0), (0, c.height - 1), (c.width - 1, c.height - 1)]:
        if f.getpixel(pt) != (255, 0, 255) and min(f.getpixel(pt)) > 225:
            ImageDraw.floodfill(f, pt, (255, 0, 255), thresh=30)
    a = np.array(c); m = np.array(f)
    bg = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    im = Image.fromarray(np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
    im = im.crop(im.getbbox())
    if name == 'shockwave':  # weiche Ränder (Ellipsen-Vignette), damit keine eckige Platte sichtbar bleibt
        w, h = im.size
        yy, xx = np.mgrid[0:h, 0:w]
        nx = (xx / (w - 1) - 0.5) * 2
        ny = (yy / (h - 1) - 0.5) * 2
        d = (np.abs(nx) ** 3 + np.abs(ny) ** 3) ** (1 / 3)
        f = np.clip((1.0 - d) / 0.35, 0, 1)
        arr = np.array(im)
        arr[:, :, 3] = (arr[:, :, 3] * f).astype(np.uint8)
        im = Image.fromarray(arr, 'RGBA')
    k = mx / max(im.size)
    if k < 1:
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(f'public/art/sprites/arena_leviathan_fx_{name}.png')
    print(name, im.size)
