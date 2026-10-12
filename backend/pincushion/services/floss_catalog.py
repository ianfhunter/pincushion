"""Embroidery floss brand palettes and nearest-colour matching."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

FLOSS_BRANDS: dict[str, dict[str, str]] = {
    "dmc": {
        "id": "dmc",
        "label": "DMC",
        "file": "dmc_floss.json",
        "description": "DMC six-strand embroidery cotton (Mouliné Spécial).",
    },
    "anchor": {
        "id": "anchor",
        "label": "Anchor",
        "file": "anchor_floss.json",
        "description": "Anchor stranded cotton (Coats).",
    },
    "madeira": {
        "id": "madeira",
        "label": "Madeira",
        "file": "madeira_floss.json",
        "description": "Madeira Mouliné stranded cotton.",
    },
    "cosmo": {
        "id": "cosmo",
        "label": "Cosmo",
        "file": "cosmo_floss.json",
        "description": "Cosmo (Lecien) stranded cotton.",
    },
    "sullivans": {
        "id": "sullivans",
        "label": "Sullivans",
        "file": "sullivans_floss.json",
        "description": "Sullivans six-strand embroidery floss.",
    },
    "jp_coats": {
        "id": "jp_coats",
        "label": "J&P Coats",
        "file": "jp_coats_floss.json",
        "description": "J&P Coats dual-duty / embroidery floss.",
    },
    "cxc": {
        "id": "cxc",
        "label": "CXC",
        "file": "cxc_floss.json",
        "description": "CXC embroidery floss (DMC-compatible numbering).",
    },
    "hatchette": {
        "id": "hatchette",
        "label": "Hatchette",
        "file": "hatchette_floss.json",
        "description": "Hatchette (Hachette Partworks) kit floss, matched to DMC.",
    },
}

DEFAULT_FLOSS_BRAND = "dmc"

_BRAND_ALIASES = {
    "dmc": "dmc",
    "anchor": "anchor",
    "madeira": "madeira",
    "cosmo": "cosmo",
    "lecien": "cosmo",
    "lecien_cosmo": "cosmo",
    "sullivans": "sullivans",
    "sullivan": "sullivans",
    "jp_coats": "jp_coats",
    "j_p_coats": "jp_coats",
    "j&p_coats": "jp_coats",
    "jpcoats": "jp_coats",
    "coats": "jp_coats",
    "cxc": "cxc",
    "hatchette": "hatchette",
    "hachette": "hatchette",
}


def list_floss_brands() -> list[dict]:
    out: list[dict] = []
    for brand_id, meta in FLOSS_BRANDS.items():
        path = DATA_DIR / meta["file"]
        count = len(_load_palette(brand_id)) if path.is_file() else 0
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


def normalize_floss_brand(raw: str | None) -> str:
    key = (raw or "").strip().lower()
    key = key.replace("&", "and").replace(" ", "_").replace("-", "_")
    key = key.replace("and_", "").replace("__", "_")
    # jandp_coats / jp_coats variants
    if key in {"jandp_coats", "j_and_p_coats", "jandpcoats"}:
        return "jp_coats"
    if key in FLOSS_BRANDS:
        return key
    if key in _BRAND_ALIASES:
        return _BRAND_ALIASES[key]
    for brand_id, meta in FLOSS_BRANDS.items():
        label_key = meta["label"].lower().replace("&", "and").replace(" ", "_").replace("-", "_")
        label_key = label_key.replace("and_", "")
        if key == label_key or key == meta["label"].lower():
            return brand_id
    return DEFAULT_FLOSS_BRAND


def brand_label(brand_id: str | None) -> str:
    brand = normalize_floss_brand(brand_id)
    return FLOSS_BRANDS[brand]["label"]


@lru_cache(maxsize=16)
def _load_palette(brand_id: str) -> tuple[dict, ...]:
    brand = normalize_floss_brand(brand_id)
    path = DATA_DIR / FLOSS_BRANDS[brand]["file"]
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
def _brand_labs(brand_id: str) -> tuple[tuple[dict, tuple[float, float, float]], ...]:
    return tuple((entry, _srgb_to_lab(tuple(entry["rgb"]))) for entry in _load_palette(brand_id))


def parse_hex_rgb(color: str) -> tuple[int, int, int]:
    raw = color.strip().lstrip("#")
    if len(raw) != 6:
        raise ValueError("Colour must be 6-digit hex")
    return int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)


def nearest_floss(
    rgb: tuple[int, int, int],
    *,
    brand: str | None = None,
) -> tuple[str, str, str]:
    """Return (number_label, name, hex) for the nearest colour in the brand palette."""
    brand_id = normalize_floss_brand(brand)
    labs = _brand_labs(brand_id)
    if not labs:
        brand_id = DEFAULT_FLOSS_BRAND
        labs = _brand_labs(brand_id)
    if not labs:
        r, g, b = rgb
        return "Colour", "Colour", f"{r:02X}{g:02X}{b:02X}"
    sl, sa, sb = _srgb_to_lab(rgb)
    best = labs[0][0]
    best_dist = 1e18
    for entry, (ll, aa, bb) in labs:
        # Hue/chroma outweigh lightness so gold does not snap to olive-black.
        dist = (sl - ll) ** 2 + 1.6 * (sa - aa) ** 2 + 1.6 * (sb - bb) ** 2
        if dist < best_dist:
            best_dist = dist
            best = entry
    r, g, b = best["rgb"]
    label = brand_label(brand_id)
    return f"{label} {best['number']}", best["name"], f"{r:02X}{g:02X}{b:02X}"


def _entry_payload(entry: dict, *, brand_id: str) -> dict:
    r, g, b = entry["rgb"]
    return {
        "number": str(entry.get("number", "")),
        "name": entry.get("name") or "",
        "rgb": [int(r), int(g), int(b)],
        "hex": f"{int(r):02X}{int(g):02X}{int(b):02X}",
        "brand": brand_id,
        "brand_label": brand_label(brand_id),
    }


def lookup_floss_by_number(
    number: str,
    *,
    brand: str | None = None,
) -> dict | None:
    """Return palette entry {number, name, rgb, hex, brand} when the code is known."""
    raw = (number or "").strip()
    if not raw:
        return None
    brand_id = normalize_floss_brand(brand) if brand else DEFAULT_FLOSS_BRAND
    # Allow "DMC 310" / brand-prefixed codes.
    label = brand_label(brand_id)
    upper = raw.upper()
    prefix = f"{label.upper()} "
    if upper.startswith(prefix):
        raw = raw[len(prefix) :].strip()
    key = raw.strip().upper()
    for entry in _load_palette(brand_id):
        if str(entry.get("number", "")).strip().upper() == key:
            return _entry_payload(entry, brand_id=brand_id)
    return None


def suggest_floss(
    query: str,
    *,
    brand: str | None = None,
    limit: int = 12,
) -> list[dict]:
    """Autocomplete colour codes / names for a known brand palette."""
    q = (query or "").strip()
    if len(q) < 1:
        return []
    brand_id = normalize_floss_brand(brand) if brand else DEFAULT_FLOSS_BRAND
    palette = _load_palette(brand_id)
    if not palette:
        return []
    label = brand_label(brand_id)
    upper = q.upper()
    prefix = f"{label.upper()} "
    if upper.startswith(prefix):
        q = q[len(prefix) :].strip()
        upper = q.upper()
    if not upper:
        return []
    name_q = q.lower()
    scored: list[tuple[int, dict]] = []
    for entry in palette:
        number = str(entry.get("number", "")).strip()
        name = str(entry.get("name") or "")
        num_u = number.upper()
        name_l = name.lower()
        if num_u == upper:
            score = 0
        elif num_u.startswith(upper):
            score = 1
        elif upper in num_u:
            score = 2
        elif name_q and name_l.startswith(name_q):
            score = 3
        elif name_q and name_q in name_l:
            score = 4
        else:
            continue
        scored.append((score, entry))
    scored.sort(key=lambda item: (item[0], str(item[1].get("number", ""))))
    return [_entry_payload(entry, brand_id=brand_id) for _, entry in scored[: max(1, min(limit, 40))]]


def looks_like_floss_label(text: str | None, *, brand: str | None = None) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    if re.match(r"^colour\s+\d+$", raw, re.I):
        return False
    labels = [brand_label(brand)] if brand else [meta["label"] for meta in FLOSS_BRANDS.values()]
    upper = raw.upper()
    for label in labels:
        if upper.startswith(f"{label.upper()} "):
            return True
    # Bare codes for the preferred (or default) brand.
    brand_id = normalize_floss_brand(brand) if brand else DEFAULT_FLOSS_BRAND
    if brand_id in {"dmc", "cxc"}:
        return bool(re.match(r"^((DMC|CXC)\s+)?(\d{1,4}|Blanc|Ecru|B5200|White)$", raw, re.I))
    if brand_id == "anchor":
        return bool(re.match(r"^(Anchor\s+)?\d{1,4}$", raw, re.I))
    if brand_id == "madeira":
        return bool(re.match(r"^(Madeira\s+)?\d{3,4}$", raw, re.I))
    if brand_id == "cosmo":
        return bool(re.match(r"^(Cosmo\s+)?\d{1,4}[A-Z]?$", raw, re.I))
    if brand_id == "sullivans":
        return bool(re.match(r"^(Sullivans\s+)?\d{4,5}$", raw, re.I))
    if brand_id == "jp_coats":
        return bool(re.match(r"^((J&P\s+Coats|JP\s*Coats|Coats)\s+)?\d{3,4}$", raw, re.I))
    if brand_id == "hatchette":
        return bool(re.match(r"^((Hatchette|Hachette)\s+)?\d{1,3}$", raw, re.I))
    return False


# Back-compat aliases used elsewhere.
def nearest_dmc(rgb: tuple[int, int, int]) -> tuple[str, str, str]:
    return nearest_floss(rgb, brand="dmc")


def looks_like_dmc_label(text: str | None) -> bool:
    return looks_like_floss_label(text, brand="dmc")
