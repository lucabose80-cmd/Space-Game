#!/usr/bin/env python3
"""M11 Phase 0 — Sprite-Import: zerschneidet Teile-Sheets (3×2) / Pose-Sheets (2×2) aus Gemini/Antigravity.

  python3 scripts/art-import.py [ids …] [--force] [--resample lanczos|nearest|box] [--keep-cell N] [--src art_source] [--out public/art] [--rigs src/data/rigs.json]

Teile-Sheets:  art_source/rigs/<file>_parts.png   → public/art/rigs/<id>/<teil>.png (+ import.json)
Pose-Sheets:   art_source/poses/<id>_poses.png    → public/art/poses/<id>_<1-4>.png
Pose-Sets (M11 v2, `sheet.sets` in rigs.json): art_source/rigs/<file>.png (3×2, Zellmitte = Gelenk) → public/art/rigs/<id>/<ids[i]>.png
  mode "limb" (Arm/Bein) und "swap" (Kopf/Rumpf): KEIN enger Zuschnitt je Pose, sondern ein gemeinsamer, um die Zellmitte
  zentrierter Ausschnitt (größte Ausdehnung aller Posen) → alle Posen eines Sets sind gleich groß, Gelenk exakt bei (0.5, 0.5);
  Maßstab = Maßstab des Rigs (Teile-Sheet), also gleich wie die Pilot-Teile.
Verfahren (Art-Guide §3): Rand-Flood-Fill (nur äußerer Hintergrund) + 1-px-Defringe + enger Zuschnitt + gemeinsamer Maßstab.
"""
import argparse, hashlib, json, os, sys
from collections import deque
from PIL import Image

WHITE = 232
FRINGE = 205


def is_bg(p):
    return p[0] >= WHITE and p[1] >= WHITE and p[2] >= WHITE


def clean_cell(img):
    """Äußeren weißen Hintergrund entfernen (Flood-Fill vom Rand), 1-px-Defringe. Gibt RGBA zurück."""
    q = img.convert("RGBA")
    w, h = q.size
    px = q.load()
    seen = [[False] * w for _ in range(h)]
    dq = deque()
    for x in range(w):
        dq.append((x, 0)); dq.append((x, h - 1))
    for y in range(h):
        dq.append((0, y)); dq.append((w - 1, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        if is_bg(px[x, y]):
            seen[y][x] = True
            px[x, y] = (0, 0, 0, 0)
            dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    clear = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r >= FRINGE and g >= FRINGE and b >= FRINGE:
                if any(0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    clear.append((x, y))
    for x, y in clear:
        px[x, y] = (0, 0, 0, 0)
    return q


def trim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else None


def sheet_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:16]


def resize(img, scale, mode):
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    res = {"box": Image.Resampling.BOX, "lanczos": Image.Resampling.LANCZOS}.get(mode, Image.Resampling.NEAREST)
    out = img.resize((nw, nh), res)
    if mode in ("box", "lanczos"):
        # Halbtransparente Ränder wieder hart machen (Pixel-Art-Look)
        px = out.load()
        for y in range(nh):
            for x in range(nw):
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    return out


def cells(img, cols, rows):
    W, H = img.size
    cw, ch = W / cols, H / rows
    for r in range(rows):
        for c in range(cols):
            yield r * cols + c, img.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))


def import_set(rid, st, scale, args, outdir, meta, report):
    """Pose-Set (limb/swap): Zellmitte = Gelenk, gemeinsamer Ausschnitt + Maßstab. Gibt Anzahl Bilder zurück."""
    src = os.path.join(args.src, "rigs", f"{st['file']}.png")
    if not os.path.exists(src):
        report.append(f"  ! {rid}: Pose-Set fehlt ({src})")
        return 0
    sheet = Image.open(src)
    cleaned = []
    # optional `cells`: Zellenindizes (0-basiert), die dieses Set aus dem Sheet nimmt (ids[k] ← Zelle cells[k]) — so lassen sich
    # unterschiedlich große Teile eines Sheets in getrennte Sets mit eigenem Ausschnitt teilen (z. B. Arme ↔ Fäuste)
    want = st.get("cells")
    for i, cell in cells(sheet, st.get("cols", 3), st.get("rows", 2)):
        if want is not None:
            if i not in want or want.index(i) >= len(st["ids"]):
                continue
            cleaned.append((st["ids"][want.index(i)], clean_cell(cell)))
        else:
            if i >= len(st["ids"]):
                break
            cleaned.append((st["ids"][i], clean_cell(cell)))
    hx = hy = 1
    for pid, img in cleaned:
        bb = img.getbbox()
        if not bb:
            report.append(f"  ! {rid}: Zelle von '{pid}' ist leer")
            continue
        cx, cy = img.width // 2, img.height // 2
        hx = max(hx, cx - bb[0], bb[2] - cx)
        hy = max(hy, cy - bb[1], bb[3] - cy)
    for pid, img in cleaned:
        if not img.getbbox():
            continue
        cx, cy = img.width // 2, img.height // 2
        canvas = Image.new("RGBA", (hx * 2, hy * 2), (0, 0, 0, 0))
        canvas.paste(img.crop((cx - hx, cy - hy, cx + hx, cy + hy)), (0, 0))
        # gerade Zielgröße, damit die Bildmitte (= Gelenk) nach dem Skalieren exakt bei 0.5 liegt
        nw = max(2, round(canvas.width * scale / 2) * 2)
        nh = max(2, round(canvas.height * scale / 2) * 2)
        res = {"box": Image.Resampling.BOX, "lanczos": Image.Resampling.LANCZOS}.get(args.resample, Image.Resampling.NEAREST)
        out = canvas.resize((nw, nh), res)
        if args.resample in ("box", "lanczos"):
            px = out.load()
            for y in range(nh):
                for x in range(nw):
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, 255 if a >= 128 else 0)
        out.save(os.path.join(outdir, f"{pid}.png"))
        meta["parts"][pid] = {"w": out.width, "h": out.height, "mode": st.get("mode", "limb"), "set": st["file"]}
    return len(cleaned)


def import_rig(rid, rig, args, report):
    sh = rig["sheet"]
    parts_all = []
    # bis zu zwei Sheets: <file>_parts.png, <file>_parts2.png
    srcs = [os.path.join(args.src, "rigs", f"{sh['file']}_parts.png"), os.path.join(args.src, "rigs", f"{sh['file']}_parts2.png")]
    order = list(sh["order"])
    if not os.path.exists(srcs[0]):
        report.append(f"– {rid}: Sheet fehlt ({srcs[0]})")
        return
    outdir = os.path.join(args.out, "rigs", rid)
    meta_path = os.path.join(outdir, "import.json")
    sets = sh.get("sets", [])
    set_srcs = [os.path.join(args.src, "rigs", f"{st['file']}.png") for st in sets]
    hashes = {os.path.basename(s): sheet_hash(s) for s in srcs + set_srcs if os.path.exists(s)}
    if not args.force and os.path.exists(meta_path):
        try:
            old = json.load(open(meta_path))
            if old.get("sheets") == hashes and old.get("resample") == args.resample and old.get("torsoDisplayH") == sh["torsoDisplayH"] and old.get("pixelRatio") == sh.get("pixelRatio", 1):
                report.append(f"= {rid}: unverändert")
                return
        except Exception:
            pass
    cleaned = {}
    n_per = sh["cols"] * sh["rows"]
    for si, src in enumerate(srcs):
        if not os.path.exists(src):
            continue
        sheet = Image.open(src)
        for i, cell in cells(sheet, sh["cols"], sh["rows"]):
            idx = si * n_per + i
            if idx >= len(order) or not order[idx]:
                continue
            if args.keep_cell is not None and idx + 1 == args.keep_cell:
                continue
            t = trim(clean_cell(cell))
            if t is None:
                report.append(f"  ! {rid}: Zelle {idx + 1} ({order[idx]}) ist leer")
                continue
            cleaned[order[idx]] = t
    ref = sh.get("scaleRef", order[0])
    if ref not in cleaned:
        report.append(f"! {rid}: Referenzteil '{ref}' fehlt — Abbruch")
        return
    ratio = sh.get("pixelRatio", 1)  # Geräte-Pixel pro Spiel-Pixel (RENDER_SCALE) — Teile liegen 1:1 in Bildschirmauflösung vor
    scale = sh["torsoDisplayH"] * ratio / cleaned[ref].height
    os.makedirs(outdir, exist_ok=True)
    meta = {"rig": rid, "scale": round(scale, 5), "resample": args.resample, "torsoDisplayH": sh["torsoDisplayH"], "pixelRatio": ratio, "sheets": hashes, "parts": {}}
    for pid, img in cleaned.items():
        out = resize(img, scale, args.resample)
        out.save(os.path.join(outdir, f"{pid}.png"))
        meta["parts"][pid] = {"w": out.width, "h": out.height, "srcW": img.width, "srcH": img.height}
    n_set = sum(import_set(rid, st, scale, args, outdir, meta, report) for st in sets)
    json.dump(meta, open(meta_path, "w"), indent=1)
    report.append(f"✔ {rid}: {len(cleaned)} Teile + {n_set} Posen · Maßstab {scale:.3f} · {args.resample}")


def import_poses(pid, args, report):
    src = os.path.join(args.src, "poses", f"{pid}_poses.png")
    if not os.path.exists(src):
        return False
    outdir = os.path.join(args.out, "poses")
    os.makedirs(outdir, exist_ok=True)
    sheet = Image.open(src)
    imgs = []
    for i, cell in cells(sheet, 2, 2):
        t = trim(clean_cell(cell))
        if t is None:
            report.append(f"  ! {pid}: Pose {i + 1} leer")
            return True
        imgs.append((i, t))
    # gemeinsamer Maßstab: größte Pose bestimmt die Zielhöhe (Anzeige 28 px)
    target = 28
    scale = target / max(t.height for _, t in imgs)
    for i, t in imgs:
        resize(t, scale, args.resample).save(os.path.join(outdir, f"{pid}_{i + 1}.png"))
    report.append(f"✔ {pid}: 4 Posen · Maßstab {scale:.3f}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--src", default="art_source")
    ap.add_argument("--out", default="public/art")
    ap.add_argument("--rigs", default="src/data/rigs.json")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--resample", default="lanczos", choices=["lanczos", "nearest", "box"])
    ap.add_argument("--keep-cell", type=int, default=None)
    args = ap.parse_args()
    rigs = json.load(open(args.rigs))
    report = []
    ids = args.ids or list(rigs.keys())
    for rid in ids:
        if rid in rigs:
            import_rig(rid, rigs[rid], args, report)
        elif not import_poses(rid, args, report):
            report.append(f"? {rid}: weder Rig noch Pose-Sheet gefunden")
    if not args.ids:
        pdir = os.path.join(args.src, "poses")
        if os.path.isdir(pdir):
            for f in sorted(os.listdir(pdir)):
                if f.endswith("_poses.png"):
                    import_poses(f[:-len("_poses.png")], args, report)
    print("\n".join(report) if report else "Nichts zu tun.")


if __name__ == "__main__":
    sys.exit(main())
