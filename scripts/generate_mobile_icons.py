#!/usr/bin/env python3
"""Generate apps/mobile/assets/icons from repo-root assets/ brand pack.

Produces:
  - master-1024.png / master-clear-1024.png
  - web/* tiles used by Flutter AppLogo + PWA
  - android/res mipmap densities (launcher + adaptive + monochrome)
  - ios AppIcon set (opaque black-backed for App Store rules)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets"
OUT = ROOT / "apps" / "mobile" / "assets" / "icons"

BG = (9, 9, 11, 255)  # #09090B — Logstack zinc black


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def load_rgba(path: Path) -> Image.Image:
    if not path.is_file():
        die(f"missing {path}")
    return Image.open(path).convert("RGBA")


def solid_on_bg(im: Image.Image, size: int, bg: tuple[int, int, int, int] = BG) -> Image.Image:
    """Resize mark and composite onto opaque background (no alpha)."""
    mark = im.copy()
    mark.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg)
    # Center if thumbnail shrank unevenly
    x = (size - mark.width) // 2
    y = (size - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas.convert("RGB")


def resize_rgba(im: Image.Image, size: int) -> Image.Image:
    out = im.copy()
    out.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - out.width) // 2
    y = (size - out.height) // 2
    canvas.alpha_composite(out, (x, y))
    return canvas


def pad_foreground(mark: Image.Image, size: int, content_ratio: float = 0.66) -> Image.Image:
    """Android adaptive foreground: transparent canvas, mark in safe zone (~66%)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    content = max(1, int(size * content_ratio))
    glyph = resize_rgba(mark, content)
    x = (size - glyph.width) // 2
    y = (size - glyph.height) // 2
    canvas.alpha_composite(glyph, (x, y))
    return canvas


def solid_bg(size: int, color: tuple[int, int, int, int] = BG) -> Image.Image:
    return Image.new("RGB", (size, size), color[:3])


def monochrome_glyph(clear: Image.Image, size: int) -> Image.Image:
    """White silhouette on transparent (notification / themed icon)."""
    return resize_rgba(clear, size)


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGB":
        im.save(path, "PNG", optimize=True)
    else:
        im.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} ({im.size[0]}x{im.size[1]} {im.mode})")


def main() -> None:
    icon = load_rgba(SRC / "icon.png")
    clear = load_rgba(SRC / "icon_clear.png")

    print("→ masters")
    # Solid master: full brand tile for in-app / macOS / launchers
    save(solid_on_bg(icon, 1024), OUT / "master-1024.png")
    # Clear master: transparent white mark (scaled from icon_clear)
    save(resize_rgba(clear, 1024), OUT / "master-clear-1024.png")

    print("→ web tiles (Flutter AppLogo + mobile PWA)")
    web = OUT / "web"
    save(solid_on_bg(icon, 512), web / "icon-512.png")
    save(solid_on_bg(icon, 192), web / "icon-192.png")
    save(solid_on_bg(icon, 512), web / "icon-512-maskable.png")
    save(solid_on_bg(icon, 192), web / "icon-192-maskable.png")
    save(resize_rgba(clear, 512), web / "icon-clear-512.png")

    # Prefer root RealFavicon exports when present
    for name, dest in [
        ("apple-touch-icon.png", web / "apple-touch-icon.png"),
        ("favicon.ico", web / "favicon.ico"),
    ]:
        src = SRC / name
        if src.is_file():
            dest.write_bytes(src.read_bytes())
            print(f"  copied {dest.relative_to(ROOT)}")

    print("→ Android adaptive / launcher densities")
    # Adaptive foreground canvas is 108dp; xxxhdpi = 432px
    dens = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    fg_dens = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    android_res = OUT / "android" / "res"
    for name, size in dens.items():
        folder = android_res / f"mipmap-{name}"
        save(solid_on_bg(icon, size), folder / "ic_launcher.png")
        save(solid_bg(size), folder / "ic_launcher_background.png")
        save(pad_foreground(clear, fg_dens[name]), folder / "ic_launcher_foreground.png")
        save(monochrome_glyph(clear, size), folder / "ic_launcher_monochrome.png")

    anydpi = android_res / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
""",
        encoding="utf-8",
    )
    print(f"  wrote {anydpi.relative_to(ROOT)}/ic_launcher.xml")

    # Play Store listing asset
    save(solid_on_bg(icon, 512), OUT / "android" / "play_store_512.png")

    print("→ iOS AppIcon set")
    ios = OUT / "ios"
    # (filename, pixels) — matches existing Contents.json
    ios_sizes = [
        ("AppIcon@2x.png", 120),
        ("AppIcon@3x.png", 180),
        ("AppIcon~ipad.png", 76),
        ("AppIcon@2x~ipad.png", 152),
        ("AppIcon-83.5@2x~ipad.png", 167),
        ("AppIcon-40@2x.png", 80),
        ("AppIcon-40@3x.png", 120),
        ("AppIcon-40~ipad.png", 40),
        ("AppIcon-40@2x~ipad.png", 80),
        ("AppIcon-20@2x.png", 40),
        ("AppIcon-20@3x.png", 60),
        ("AppIcon-20~ipad.png", 20),
        ("AppIcon-20@2x~ipad.png", 40),
        ("AppIcon-29.png", 29),
        ("AppIcon-29@2x.png", 58),
        ("AppIcon-29@3x.png", 87),
        ("AppIcon-29~ipad.png", 29),
        ("AppIcon-29@2x~ipad.png", 58),
        ("AppIcon-60@2x~car.png", 120),
        ("AppIcon-60@3x~car.png", 180),
        ("AppIcon~ios-marketing.png", 1024),
    ]
    for filename, px in ios_sizes:
        # App Store marketing icon must be opaque RGB
        save(solid_on_bg(icon, px), ios / filename)

    # Preserve Contents.json if present; otherwise write IconKitchen-compatible map
    contents = ios / "Contents.json"
    if not contents.is_file():
        contents.write_text(
            json.dumps(
                {
                    "images": [
                        {"filename": f, "idiom": "universal", "size": f"{p}x{p}"}
                        for f, p in ios_sizes
                    ],
                    "info": {"author": "logstack", "version": 1},
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"  wrote {contents.relative_to(ROOT)}")
    else:
        print(f"  kept {contents.relative_to(ROOT)}")

    # README for web icons
    readme = web / "README.txt"
    readme.write_text(
        "Generated from repo-root assets/ by scripts/generate_mobile_icons.py.\n"
        "Do not edit by hand — re-run ./scripts/sync_brand_icons.sh\n",
        encoding="utf-8",
    )
    print("✓ mobile assets/icons generated")


if __name__ == "__main__":
    main()
