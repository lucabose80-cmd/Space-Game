#!/usr/bin/env python3
"""Fügt aus einem bearbeiteten Vollbild nur ein Rechteck (weich übergeblendet) in das Basisbild ein.
So bleibt der Rest des Raums pixelgleich. Nutzung: zone-composite.py <base> <edit> <out> --rect x0,y0,x1,y1 [--feather 10] (Koordinaten in 960×540)"""
import sys
from PIL import Image, ImageChops, ImageFilter
base, edit, out = sys.argv[1:4]
x0,y0,x1,y1 = [int(v) for v in sys.argv[sys.argv.index('--rect')+1].split(',')]
fe = int(sys.argv[sys.argv.index('--feather')+1]) if '--feather' in sys.argv else 10
a = Image.open(base).convert('RGB').resize((960,540), Image.LANCZOS)
b = Image.open(edit).convert('RGB').resize((960,540), Image.LANCZOS)
m = Image.new('L', (960,540), 0); m.paste(255, (x0+fe//2, y0+fe//2, x1-fe//2, y1-fe//2)); m = m.filter(ImageFilter.GaussianBlur(fe/2))
Image.composite(b, a, m).save(out); print('ok', out)
