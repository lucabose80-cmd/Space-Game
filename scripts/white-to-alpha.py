#!/usr/bin/env python3
"""Weißen Generator-Hintergrund → Alpha (Flood-Fill vom Rand, Innenflächen bleiben), auf BBox zuschneiden,
in ein Zielformat einpassen (unten mittig). Nutzung: white-to-alpha.py <in.png> <out.png> <W> <H> [--pad N]"""
import sys
from collections import deque
from PIL import Image
src, dst, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()
def white(p): return p[0] > 238 and p[1] > 238 and p[2] > 238
seen = bytearray(w*h); q = deque()
for x in range(w):
    q.append((x,0)); q.append((x,h-1))
for y in range(h):
    q.append((0,y)); q.append((w-1,y))
while q:
    x,y = q.popleft()
    if x<0 or y<0 or x>=w or y>=h or seen[y*w+x]: continue
    if not white(px[x,y]): continue
    seen[y*w+x]=1; px[x,y]=(255,255,255,0)
    q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
bb = im.getchannel('A').point(lambda a: 255 if a>40 else 0).getbbox()
im = im.crop(bb); s = min(W/im.width, H/im.height)
im = im.resize((max(1,round(im.width*s)), max(1,round(im.height*s))), Image.LANCZOS)
out = Image.new('RGBA',(W,H),(0,0,0,0)); out.paste(im,((W-im.width)//2, H-im.height), im)
out.save(dst); print(dst, out.size, 'bbox', out.getchannel('A').getbbox())
