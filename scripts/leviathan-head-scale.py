"""Leviathan: Köpfe (head/headP2/headDead) vergrößern, damit sie die Torso-Aussparung füllen (vorher sah man das Dunkle darunter).
Quelle: art_source/rigs/leviathan_head_orig/*.png (unskaliert) → public/art/rigs/boss_leviathan/ (Rahmen wächst mit, Pivot/Attach in der JSON bleiben Bruchteile).
Aufruf: python3 scripts/leviathan-head-scale.py [faktor=1.45]"""
import sys
from PIL import Image
K = float(sys.argv[1]) if len(sys.argv) > 1 else 1.45
for n in ['head', 'headP2', 'headDead']:
    im = Image.open(f'art_source/rigs/leviathan_head_orig/{n}.png').convert('RGBA')
    out = im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS)
    out.save(f'public/art/rigs/boss_leviathan/{n}.png'); print(n, out.size, out.getbbox())
