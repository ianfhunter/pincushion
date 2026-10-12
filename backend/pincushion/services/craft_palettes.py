"""Craft-specific colour systems (floss, drills, fuse beads, seed beads)."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from pincushion.services.floss_catalog import (
    DEFAULT_FLOSS_BRAND,
    FLOSS_BRANDS,
    list_floss_brands,
    looks_like_floss_label,
    nearest_floss,
    normalize_floss_brand,
    parse_hex_rgb,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Brands that live in JSON under data/ (non-floss systems).
MATERIAL_BRANDS: dict[str, dict[str, str]] = {
    "dmc_drills": {
        "id": "dmc_drills",
        "label": "DMC",
        "file": "dmc_drills.json",
        "description": "DMC-coded diamond painting drills (kit / loose-drill numbering).",
    },
    "perler": {
        "id": "perler",
        "label": "Perler",
        "file": "perler_beads.json",
        "description": "Perler midi fuse beads (pegboard).",
    },
    "hama": {
        "id": "hama",
        "label": "Hama",
        "file": "hama_beads.json",
        "description": "Hama midi fuse beads (pegboard).",
    },
    "artkal": {
        "id": "artkal",
        "label": "Artkal",
        "file": "artkal_beads.json",
        "description": "Artkal S-series midi fuse beads.",
    },
    "miyuki_delica": {
        "id": "miyuki_delica",
        "label": "Miyuki Delica",
        "file": "miyuki_delica.json",
        "description": "Miyuki Delica cylinder seed beads (common opaques).",
    },
    "toho": {
        "id": "toho",
        "label": "Toho",
        "file": "toho_beads.json",
        "description": "Toho seed beads (common opaques).",
    },
}

# Preferred palette brand options per craft.
CRAFT_PALETTE_OPTIONS: dict[str, tuple[str, ...]] = {
    "cross_stitch": tuple(FLOSS_BRANDS.keys()),
    "embroidery": tuple(FLOSS_BRANDS.keys()),
    "diamond_painting": ("dmc_drills",),
    "iron_beading": ("perler", "hama", "artkal"),
    "beading": ("miyuki_delica", "toho"),
}

DEFAULT_CRAFT_BRANDS: dict[str, str] = {
    "cross_stitch": DEFAULT_FLOSS_BRAND,
    "embroidery": DEFAULT_FLOSS_BRAND,
    "diamond_painting": "dmc_drills",
    "iron_beading": "perler",
    "beading": "miyuki_delica",
}

_MATERIAL_ALIASES = {
    "dmc": "dmc_drills",
    "dmc_drill": "dmc_drills",
    "dmc_drills": "dmc_drills",
    "diamond_dotz": "dmc_drills",
    "perler": "perler",
    "hama": "hama",
    "artkal": "artkal",
    "miyuki": "miyuki_delica",
    "miyuki_delica": "miyuki_delica",
    "delica": "miyuki_delica",
    "toho": "toho",
}


def craft_uses_floss(craft_id: str | None) -> bool:
    return (craft_id or "cross_stitch") in {"cross_stitch", "embroidery"}


def default_brand_for_craft(craft_id: str | None) -> str:
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    return DEFAULT_CRAFT_BRANDS.get(craft, DEFAULT_FLOSS_BRAND)


def normalize_material_brand(raw: str | None, *, craft_id: str | None = None) -> str:
    key = (raw or "").strip().lower().replace(" ", "_").replace("-", "_")
    if key in MATERIAL_BRANDS:
        return key
    if key in _MATERIAL_ALIASES:
        return _MATERIAL_ALIASES[key]
    for brand_id, meta in MATERIAL_BRANDS.items():
        if key == meta["label"].lower().replace(" ", "_"):
            return brand_id
    return default_brand_for_craft(craft_id)


def normalize_brand_for_craft(raw: str | None, craft_id: str | None) -> str:
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    options = CRAFT_PALETTE_OPTIONS.get(craft)
    if not options:
        return default_brand_for_craft(craft)
    if craft_uses_floss(craft):
        brand = normalize_floss_brand(raw)
        return brand if brand in options else default_brand_for_craft(craft)
    brand = normalize_material_brand(raw, craft_id=craft)
    return brand if brand in options else default_brand_for_craft(craft)


def list_brands_for_craft(craft_id: str | None) -> list[dict]:
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    if craft_uses_floss(craft):
        return list_floss_brands()
    out: list[dict] = []
    for brand_id in CRAFT_PALETTE_OPTIONS.get(craft, ()):
        meta = MATERIAL_BRANDS[brand_id]
        path = DATA_DIR / meta["file"]
        count = len(_load_material_palette(brand_id)) if path.is_file() else 0
        out.append(
            {
                "id": brand_id,
                "label": meta["label"],
                "description": meta["description"],
                "color_count": count,
                "available": count > 0,
            }
        )
    return out


@lru_cache(maxsize=16)
def _load_material_palette(brand_id: str) -> tuple[dict, ...]:
    brand = normalize_material_brand(brand_id)
    meta = MATERIAL_BRANDS.get(brand)
    if not meta:
        return tuple()
    path = DATA_DIR / meta["file"]
    if not path.is_file():
        return tuple()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(raw)


def _srgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    def _lin(c: float) -> float:
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = _lin(rgb[0]), _lin(rgb[1]), _lin(rgb[2])
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    xn, yn, zn = 0.95047, 1.0, 1.08883

    def _f(t: float) -> float:
        return t ** (1.0 / 3.0) if t > 0.008856 else (7.787 * t + 16.0 / 116.0)

    fx, fy, fz = _f(x / xn), _f(y / yn), _f(z / zn)
    return 116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)


@lru_cache(maxsize=16)
def _material_labs(brand_id: str) -> tuple[tuple[dict, tuple[float, float, float]], ...]:
    return tuple((entry, _srgb_to_lab(tuple(entry["rgb"]))) for entry in _load_material_palette(brand_id))


def material_brand_label(brand_id: str | None) -> str:
    brand = normalize_material_brand(brand_id)
    meta = MATERIAL_BRANDS.get(brand)
    return meta["label"] if meta else (brand_id or "Colour")


def nearest_material(
    rgb: tuple[int, int, int],
    *,
    brand: str | None = None,
    craft_id: str | None = None,
) -> tuple[str, str, str]:
    brand_id = normalize_brand_for_craft(brand, craft_id)
    labs = _material_labs(brand_id)
    if not labs:
        brand_id = default_brand_for_craft(craft_id)
        labs = _material_labs(brand_id)
    if not labs:
        r, g, b = rgb
        return "Colour", "Colour", f"{r:02X}{g:02X}{b:02X}"
    sl, sa, sb = _srgb_to_lab(rgb)
    best = labs[0][0]
    best_dist = 1e18
    for entry, (ll, aa, bb) in labs:
        dist = (sl - ll) ** 2 + 1.6 * (sa - aa) ** 2 + 1.6 * (sb - bb) ** 2
        if dist < best_dist:
            best_dist = dist
            best = entry
    r, g, b = best["rgb"]
    label = material_brand_label(brand_id)
    return f"{label} {best['number']}", best["name"], f"{r:02X}{g:02X}{b:02X}"


def looks_like_material_label(text: str | None, *, brand: str | None = None, craft_id: str | None = None) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    if re.match(r"^colour\s+\d+$", raw, re.I):
        return False
    brand_id = normalize_brand_for_craft(brand, craft_id)
    label = material_brand_label(brand_id)
    upper = raw.upper()
    if upper.startswith(f"{label.upper()} "):
        return True
    if brand_id == "dmc_drills":
        return bool(re.match(r"^((DMC)\s+)?(\d{1,4}|Blanc|Ecru|B5200|White)$", raw, re.I))
    if brand_id == "perler":
        return bool(re.match(r"^(Perler\s+)?P?\d{1,3}$", raw, re.I))
    if brand_id == "hama":
        return bool(re.match(r"^(Hama\s+)?H?\d{1,3}$", raw, re.I))
    if brand_id == "artkal":
        return bool(re.match(r"^(Artkal\s+)?S?\d{1,3}$", raw, re.I))
    if brand_id == "miyuki_delica":
        return bool(re.match(r"^((Miyuki(\s+Delica)?|Delica)\s+)?DB?\d{2,4}$", raw, re.I))
    if brand_id == "toho":
        return bool(re.match(r"^(Toho\s+)?TR?\d{1,4}[A-Z]?$", raw, re.I))
    return False


def nearest_for_craft(
    rgb: tuple[int, int, int],
    craft_id: str | None,
    *,
    brand: str | None = None,
) -> tuple[str, str, str]:
    """Return (number_label, name, hex) using the craft's preferred colour system."""
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    if craft_uses_floss(craft):
        return nearest_floss(rgb, brand=brand or normalize_brand_for_craft(None, craft))
    return nearest_material(rgb, brand=brand, craft_id=craft)


def looks_like_palette_label(
    text: str | None,
    craft_id: str | None,
    *,
    brand: str | None = None,
) -> bool:
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    if craft_uses_floss(craft):
        return looks_like_floss_label(text, brand=brand)
    return looks_like_material_label(text, brand=brand, craft_id=craft)


def preferred_brand_for_craft(craft_id: str | None) -> str:
    from pincushion.services.supplies import get_preferred_brand_for_craft

    return get_preferred_brand_for_craft(craft_id)


__all__ = [
    "CRAFT_PALETTE_OPTIONS",
    "DEFAULT_CRAFT_BRANDS",
    "craft_uses_floss",
    "default_brand_for_craft",
    "list_brands_for_craft",
    "looks_like_palette_label",
    "nearest_for_craft",
    "normalize_brand_for_craft",
    "parse_hex_rgb",
    "preferred_brand_for_craft",
]
