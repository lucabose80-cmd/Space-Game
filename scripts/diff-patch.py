#!/usr/bin/env python3
"""Aus Original + bearbeiteter Vollbild-Variante einen Overlay-Patch (RGBA) erzeugen:
Alpha = geglättete Differenzmaske (nur das tatsächlich Geänderte), Ausgabe zugeschnitten auf die BBox.
Nutzung: diff-patch.py <orig.png> <edit.png> <out.png> [--thr 28] [--grow 5] [--blur 3] [--rect x0,y0,x1,y1]
Gibt die BBox (x,y,w,h in 960×540) aus — im Code an genau dieser Position zeichnen."""
import sys
from PIL import Image, ImageChops, ImageFilter
orig, edit, out = sys.argv[1:4]
thr = int(sys.argv[sys.argv.index('--thr')+1]) if '--thr' in sys.argv else 28
grow = int(sys.argv[sys.argv.index('--grow')+1]) if '--grow' in sys.argv else 5
blur = float(sys.argv[sys.argv.index('--blur')+1]) if '--blur' in sys.argv else 3
a = Image.open(orig).convert('RGB').resize((960,540), Image.LANCZOS)
b = Image.open(edit).convert('RGB').resize((960,540), Image.LANCZOS)
d = ImageChops.difference(a, b).convert('L').filter(ImageFilter.GaussianBlur(1.2))
m = d.point(lambda v: 255 if v > thr else 0)
if '--rect' in sys.argv:
    x0,y0,x1,y1 = [int(v) for v in sys.argv[sys.argv.index('--rect')+1].split(',')]
    clip = Image.new('L', m.size, 0); clip.paste(255, (x0,y0,x1,y1)); m = ImageChops.multiply(m, clip)
m = m.filter(ImageFilter.MaxFilter(grow*2+1))      # zusammenhängend machen
m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(blur))
bb = m.point(lambda v: 255 if v > 8 else 0).getbbox()
rgba = b.convert('RGBA'); rgba.putalpha(m)
rgba = rgba.crop(bb); rgba.save(out)
print(out, 'x,y,w,h =', bb[0], bb[1], bb[2]-bb[0], bb[3]-bb[1])
