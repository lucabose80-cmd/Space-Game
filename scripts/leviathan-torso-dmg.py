"""Leviathan Beschädigungsstufen (D12): Roh-Sheets mit je 2 Torsos (links leicht, rechts schwer) → public/art/rigs/boss_leviathan/{torsoD1,torsoD2,torsoP2D1,torsoP2D2}.png
Ausrichtung an torso/torsoP2 (200×200): Körperbreite (ohne Rauch), Mitte x=100, Unterkante.  Aufruf: python3 scripts/leviathan-torso-dmg.py"""
from PIL import Image, ImageDraw
import numpy as np
D = 'public/art/rigs/boss_leviathan/'
JOBS = [('art_source/rigs/boss_leviathan_torsoDmg_p1_raw.png', 'torso', ['torsoD1', 'torsoD2']),
        ('art_source/rigs/boss_leviathan_torsoDmg_p2_raw.png', 'torsoP2', ['torsoP2D1', 'torsoP2D2'])]
def cut(im):
    f = im.copy()
    for pt in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        ImageDraw.floodfill(f, pt, (255, 0, 255), thresh=28)
    m = np.array(f); a = np.array(im)
    bg = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    bg |= a.min(2) > 235
    return Image.fromarray(np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
def body_bbox(im):
    a = np.array(im); al = a[:, :, 3] > 40
    mx = a[:, :, :3].max(2).astype(int); mn = a[:, :, :3].min(2).astype(int)
    sat = (mx - mn)
    smoke = (sat < 28) & (mx > 120)  # hellgrauer Rauch
    k = al & ~smoke
    # Rauchfahnen weg: nur Zeilen/Spalten mit genug Körper zählen
    cols = np.where(k.sum(0) > 12)[0]; rows = np.where(k.sum(1) > 12)[0]
    return cols.min(), rows.min(), cols.max(), rows.max()
for raw, refn, outs in JOBS:
    sheet = Image.open(raw).convert('RGB'); W, H = sheet.size
    ref = Image.open(D + refn + '.png'); ra = np.array(ref)[:, :, 3] > 40
    rc = np.where(ra.sum(0) > 5)[0]; rr = np.where(ra.sum(1) > 5)[0]
    rw = rc.max() - rc.min() + 1; rbot = rr.max()
    for i, name in enumerate(outs):
        im = cut(sheet.crop((i * W // 2, 0, (i + 1) * W // 2, H)))
        x0, y0, x1, y1 = body_bbox(im)
        k = rw / (x1 - x0 + 1)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        cx = (x0 + x1) / 2 * k; bot = y1 * k
        out = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
        ox = round(100 - cx); oy = round(rbot - bot)
        tmp = Image.new('RGBA', (200, 200), (0, 0, 0, 0)); tmp.paste(im, (ox, oy), im); out = tmp
        out.save(D + name + '.png'); print(name, out.getbbox(), 'ref', ref.getbbox())
