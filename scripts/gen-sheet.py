#!/usr/bin/env python3
"""Gemini Image API Generator für STARLIGHTER (M10/M11/M12 Sprite- & Rig-Sheets).

Nutzt ausschließlich die Python-Standardbibliothek (+ Pillow für verlustfreie PNG-Ausgabe)
und liest den API-Key NIEMALS aus dem Git-Repository, sondern nur aus:
  1. Umgebungsvariable GEMINI_API_KEY (oder GOOGLE_API_KEY)
  2. Lokaler Datei außerhalb des Repos: ~/.config/starlighter/gemini_api_key

Beispiele:
  python3 scripts/gen-sheet.py --check-key
  python3 scripts/gen-sheet.py \
    --prompt "Crisp 16-bit pixel art ..." \
    --ref public/art/sprites/enemy_shard_sniper.png \
    --aspect 3:2 --size 2K \
    --out art_source/_raw/shard_sniper_raw.png
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import mimetypes
import os
import pathlib
import sys
import urllib.error
import urllib.request

from PIL import Image

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
KEY_FILE = pathlib.Path.home() / ".config" / "starlighter" / "gemini_api_key"
DEFAULT_MODEL = "gemini-nano-banana-2.1"


def load_api_key() -> str:
    for var in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var, "").strip()
        if val:
            return val
    if KEY_FILE.is_file():
        val = KEY_FILE.read_text(encoding="utf-8").strip()
        if val:
            return val
    print(
        "✗ Kein Gemini-API-Key gefunden.\n"
        f"  Setze GEMINI_API_KEY oder speichere den Key lokal (außerhalb des Repos) in:\n"
        f"  {KEY_FILE}  (chmod 600)",
        file=sys.stderr,
    )
    sys.exit(2)


def api_request(url: str, key: str, payload: dict | None = None, timeout: int = 180) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"x-goog-api-key": key}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 429:
            print(f"✗ RATE_LIMIT (HTTP 429): {body[:400]}", file=sys.stderr)
            sys.exit(42)
        if e.code == 404:
            print(
                f"✗ Modell nicht gefunden (HTTP 404). Prüfe verfügbare Modelle mit --check-key.\n{body[:400]}",
                file=sys.stderr,
            )
            sys.exit(4)
        print(f"✗ API-Fehler HTTP {e.code}: {body[:600]}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"✗ Netzwerkfehler: {e}", file=sys.stderr)
        sys.exit(3)


def check_key(key: str) -> int:
    res = api_request(f"{API_BASE}/models?pageSize=200", key, payload=None, timeout=30)
    models = res.get("models", [])
    image_models = [
        m.get("name", "").removeprefix("models/")
        for m in models
        if any(k in m.get("name", "").lower() for k in ("image", "banana", "imagen"))
    ]
    print(f"✔ API-Key gültig ({len(models)} Modelle erreichbar).")
    if image_models:
        print("Verfügbare Bild-Modelle:")
        for name in sorted(image_models):
            print(f"  - {name}")
    else:
        print("ℹ Keine expliziten image/banana-Modelle in der Modellliste gefunden.")
    return 0


def encode_image_part(path: pathlib.Path) -> dict:
    if not path.is_file():
        print(f"✗ Referenzbild nicht gefunden: {path}", file=sys.stderr)
        sys.exit(2)
    mime, _ = mimetypes.guess_type(str(path))
    if not mime or not mime.startswith("image/"):
        mime = "image/png"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"inline_data": {"mime_type": mime, "data": b64}}


def generate_image(
    key: str,
    model: str,
    prompt: str,
    refs: list[pathlib.Path],
    aspect: str,
    size: str,
    out_path: pathlib.Path,
) -> int:
    parts: list[dict] = [encode_image_part(r) for r in refs]
    parts.append({"text": prompt})

    image_cfg: dict[str, str] = {"aspectRatio": aspect}
    if size:
        image_cfg["imageSize"] = size

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": image_cfg,
        },
    }

    url = f"{API_BASE}/models/{model}:generateContent"
    res = api_request(url, key, payload=payload, timeout=180)

    candidates = res.get("candidates") or []
    if not candidates:
        print(f"✗ Keine Antwort-Kandidaten erhalten: {json.dumps(res)[:500]}", file=sys.stderr)
        return 1

    cand = candidates[0]
    finish = cand.get("finishReason", "UNKNOWN")
    content_parts = (cand.get("content") or {}).get("parts") or []

    image_bytes: bytes | None = None
    notes: list[str] = []
    for p in content_parts:
        if "text" in p and p["text"].strip():
            notes.append(p["text"].strip())
        inline = p.get("inlineData") or p.get("inline_data")
        if inline and inline.get("data") and not p.get("thought"):
            image_bytes = base64.b64decode(inline["data"])

    if not image_bytes:
        print(f"✗ Kein Bild in der Antwort (finishReason={finish}).", file=sys.stderr)
        if notes:
            print("Modell-Text:", " | ".join(notes)[:500], file=sys.stderr)
        return 1

    img = Image.open(io.BytesIO(image_bytes))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")

    usage = res.get("usageMetadata") or {}
    tok_info = ""
    if usage:
        tok_info = f" · tokens in={usage.get('promptTokenCount', '?')}/out={usage.get('candidatesTokenCount', '?')}"
    print(f"✔ Gespeichert: {out_path} ({img.width}×{img.height} {img.mode}, model={model}, finish={finish}{tok_info})")
    if notes:
        print("ℹ Modell-Hinweis:", " | ".join(notes)[:240])
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Gemini Image API Generator für STARLIGHTER")
    ap.add_argument("--check-key", action="store_true", help="API-Key prüfen und verfügbare Bild-Modelle auflisten (0 Kosten)")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Modell-ID (Standard: {DEFAULT_MODEL}; Alternativen: gemini-3.1-flash-image, gemini-3-pro-image)")
    ap.add_argument("--prompt", default="", help="Prompt-Text")
    ap.add_argument("--prompt-file", default="", help="Datei mit Prompt-Text (UTF-8)")
    ap.add_argument("--ref", action="append", default=[], help="Referenzbild-Pfad (mehrfach angebbar, bis zu 14)")
    ap.add_argument("--aspect", default="3:2", help="Seitenverhältnis (Standard: 3:2; z. B. 1:1)")
    ap.add_argument("--size", default="2K", help="Auflösung (1K, 2K, 4K; Standard: 2K)")
    ap.add_argument("--out", default="", help="Zielpfad für die PNG-Ausgabe")
    args = ap.parse_args()

    key = load_api_key()
    if args.check_key:
        return check_key(key)

    prompt = args.prompt.strip()
    if args.prompt_file:
        prompt = pathlib.Path(args.prompt_file).read_text(encoding="utf-8").strip()
    if not prompt:
        print("✗ Bitte --prompt oder --prompt-file angeben.", file=sys.stderr)
        return 2
    if not args.out:
        print("✗ Bitte --out <ziel.png> angeben.", file=sys.stderr)
        return 2

    refs = [pathlib.Path(r) for r in args.ref]
    return generate_image(key, args.model, prompt, refs, args.aspect, args.size, pathlib.Path(args.out))


if __name__ == "__main__":
    sys.exit(main())
