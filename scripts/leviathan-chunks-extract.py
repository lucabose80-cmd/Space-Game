"""Leviathan Rüstungsbrocken: art_source/rigs/leviathan_chunks.png (1536×1024, 3×2 auf Weiß) → public/art/sprites/arena_leviathan_chunk_1..6.png (max 112 px)."""
from PIL import Image, ImageDraw
import numpy as np
sheet = Image.open('art_source/rigs/leviathan_chunks.png').convert('RGB')
for i in range(6):
    c, r = i % 3, i // 3
    cell = sheet.crop((c * 512, r * 512, (c + 1) * 512, (r + 1) * 512))
    f = cell.copy()
    for pt in [(0, 0), (511, 0), (0, 511), (511, 511)]:
        ImageDraw.floodfill(f, pt, (255, 0, 255), thresh=30)
    m = np.array(f); a = np.array(cell)
    bg = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    im = Image.fromarray(np.dstack([a, np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')
    im = im.crop(im.getbbox())
    k = 112 / max(im.size)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(f'public/art/sprites/arena_leviathan_chunk_{i + 1}.png'); print(i + 1, im.size)
