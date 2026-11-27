#!/usr/bin/env python3
"""Sprite-/Sheet-Erzeugung direkt über die Gemini-Bild-API (für Claude-Chats UND Antigravity).

Beispiele:
  npm run art:gen -- --out art_source/rigs/shard_sniper_rig.png --sheet \
      --ref public/art/sprites/enemy_shard_sniper.png --prompt-file /tmp/prompt.txt
  npm run art:gen -- --out public/art/sprites/item_x.png --aspect 1:1 --prompt "..."

Ablauf: Anfrage → Rohbild nach art_source/_gen/<name>_raw_<n>.png (nicht committet)
  → mit --sheet: verlustarm auf reines #FFFFFF-Raster 1536×1024 gebracht + `art-check` (Prüfbild in art_source/_check/)
  → ohne --sheet: Rohbild wird unverändert nach --out kopiert (Einzel-Sprites danach nach ART_AND_DESIGN_GUIDE.md §3 freistellen).

API-Key (wird NIE ins Repo geschrieben, nie ausgegeben):
  1. Umgebungsvariable GEMINI_API_KEY, sonst
  2. ~/.config/starlighter/gemini_api_key (Antigravity-VM), sonst
  3. Platzhalter "proxy-injected" — in Claude-Code-Cloud-Sessions setzt der Netzwerk-Proxy den echten Key
     (Network Secret „Google AI Studio Key“, Header x-goog-api-key).
Regeln: AGENTS.md §3 Regel 7 + 14, SPRITE_QUEUE.md §0 — jedes erzeugte Sheet braucht eine Queue-Zeile.
"""
import argparse, base64, json, os, shutil, subprocess, sys, urllib.error, urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-nano-banana-2.1"
SHEET_W, SHEET_H = 1536, 1024


def api_key() -> str:
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    p = os.path.expanduser("~/.config/starlighter/gemini_api_key")
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as f:
            k = f.read().strip()
        if k:
            return k
    return "proxy-injected"


def mime_of(path: str) -> str:
    return "image/jpeg" if path.lower().endswith((".jpg", ".jpeg")) else "image/png"


def generate(model: str, prompt: str, refs: list[str], aspect: str, size: str | None) -> bytes:
    parts = [{"text": prompt}]
    for r in refs:
        with open(r, "rb") as f:
            parts.append({"inline_data": {"mime_type": mime_of(r), "data": base64.b64encode(f.read()).decode()}})
    image_cfg = {"aspectRatio": aspect}
    if size:
        image_cfg["imageSize"] = size
    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": image_cfg},
    }
    req = urllib.request.Request(
        API.format(model=model),
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")
        try:
            err = json.loads(msg)["error"]
            reason = (err.get("details") or [{}])[0].get("reason", "")
            msg = f"{err.get('status')} {reason}: {err.get('message', '')[:300]}"
        except Exception:
            msg = msg[:300]
        if e.code == 429:
            sys.exit(f"✗ Quota/Rate-Limit erreicht (429) — später erneut versuchen. {msg}")
        sys.exit(f"✗ API-Fehler {e.code}: {msg}")
    for cand in data.get("candidates", []):
        for p in cand.get("content", {}).get("parts", []):
            blob = p.get("inline_data") or p.get("inlineData")
            if blob and blob.get("data"):
                return base64.b64decode(blob["data"])
    reason = (data.get("candidates") or [{}])[0].get("finishReason") or data.get("promptFeedback")
    sys.exit(f"✗ Kein Bild in der Antwort (Grund: {reason}). Prompt anpassen.")


def to_sheet(raw_path: str, out_path: str) -> None:
    """Rohbild ohne Verzerrung auf 1536×1024 #FFFFFF bringen (einpassen + zentrieren)."""
    from PIL import Image

    im = Image.open(raw_path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    s = min(SHEET_W / im.width, SHEET_H / im.height)
    if abs(s - 1) > 1e-6:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    sheet = Image.new("RGB", (SHEET_W, SHEET_H), (255, 255, 255))
    sheet.paste(im, ((SHEET_W - im.width) // 2, (SHEET_H - im.height) // 2))
    sheet.save(out_path, optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Sprite/Sheet über Gemini erzeugen")
    ap.add_argument("--out", required=True, help="Zieldatei (Pfad aus SPRITE_QUEUE.md)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--prompt")
    g.add_argument("--prompt-file")
    ap.add_argument("--ref", action="append", default=[], help="Referenzbild (mehrfach möglich)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--aspect", default=None, help="z. B. 3:2 (Standard mit --sheet) oder 1:1")
    ap.add_argument("--size", default=None, help="optional: 1K / 2K / 4K (falls vom Modell unterstützt)")
    ap.add_argument("--sheet", action="store_true", help="3×2-Rig-Sheet: auf 1536×1024 #FFFFFF bringen + art-check")
    ap.add_argument("--force", action="store_true", help="vorhandene Zieldatei überschreiben (Ersatz-Sheet)")
    a = ap.parse_args()

    if os.path.exists(a.out) and not a.force:
        sys.exit(f"✗ {a.out} existiert schon — für ein Ersatz-Sheet --force setzen (und Queue-Zeile „ersetzt …“).")
    for r in a.ref:
        if not os.path.isfile(r):
            sys.exit(f"✗ Referenzbild fehlt: {r}")
    prompt = a.prompt if a.prompt else open(a.prompt_file, encoding="utf-8").read()
    aspect = a.aspect or ("3:2" if a.sheet else "1:1")

    print(f"▶ {a.model} · {aspect} · {len(a.ref)} Referenz(en) → {a.out}")
    img = generate(a.model, prompt, a.ref, aspect, a.size)

    gen_dir = os.path.join("art_source", "_gen")
    os.makedirs(gen_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(a.out))[0]
    n = 1
    while os.path.exists(os.path.join(gen_dir, f"{stem}_raw_{n}.png")):
        n += 1
    raw = os.path.join(gen_dir, f"{stem}_raw_{n}.png")
    from PIL import Image
    import io

    Image.open(io.BytesIO(img)).save(raw)
    print(f"  Rohbild: {raw}")

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    if a.sheet:
        to_sheet(raw, a.out)
        print(f"✔ Sheet {SHEET_W}×{SHEET_H}: {a.out}")
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "art-check.py"), a.out], check=False)
    else:
        shutil.copyfile(raw, a.out)
        print(f"✔ Bild: {a.out} (Einzel-Sprite: noch nach ART_AND_DESIGN_GUIDE.md §3 freistellen & skalieren)")
    print("→ Ergebnis per Read/view_file ANSEHEN, dann SPRITE_QUEUE.md-Zeile auf [x], handoff/ aktualisieren.")


if __name__ == "__main__":
    main()
