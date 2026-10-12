"""User supplies preferences (preferred colour brands per craft)."""

from __future__ import annotations

import json

from pincushion.db import get_conn
from pincushion.services.craft_palettes import (
    CRAFT_PALETTE_OPTIONS,
    DEFAULT_CRAFT_BRANDS,
    craft_uses_floss,
    list_brands_for_craft,
    normalize_brand_for_craft,
)
from pincushion.services.floss_catalog import DEFAULT_FLOSS_BRAND, list_floss_brands, normalize_floss_brand

_CRAFT_BRAND_KEYS = ("cross_stitch", "diamond_painting", "iron_beading", "beading")


def init_supplies() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS supplies_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                floss_brand TEXT NOT NULL DEFAULT 'dmc',
                craft_brands_json TEXT
            )
            """
        )
        cols = {r[1] for r in conn.execute("PRAGMA table_info(supplies_settings)").fetchall()}
        if "craft_brands_json" not in cols:
            conn.execute("ALTER TABLE supplies_settings ADD COLUMN craft_brands_json TEXT")
        conn.execute(
            """
            INSERT INTO supplies_settings (id, floss_brand, craft_brands_json)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO NOTHING
            """,
            (DEFAULT_FLOSS_BRAND, json.dumps(dict(DEFAULT_CRAFT_BRANDS))),
        )
        # Keep craft_brands_json populated for existing installs.
        row = conn.execute(
            "SELECT floss_brand, craft_brands_json FROM supplies_settings WHERE id = 1"
        ).fetchone()
        if row and not row["craft_brands_json"]:
            brands = dict(DEFAULT_CRAFT_BRANDS)
            brands["cross_stitch"] = normalize_floss_brand(row["floss_brand"])
            brands["embroidery"] = brands["cross_stitch"]
            conn.execute(
                "UPDATE supplies_settings SET craft_brands_json = ? WHERE id = 1",
                (json.dumps(brands),),
            )


def _load_craft_brands(conn) -> dict[str, str]:
    row = conn.execute(
        "SELECT floss_brand, craft_brands_json FROM supplies_settings WHERE id = 1"
    ).fetchone()
    brands = dict(DEFAULT_CRAFT_BRANDS)
    if not row:
        return brands
    try:
        stored = json.loads(row["craft_brands_json"] or "{}")
        if isinstance(stored, dict):
            for craft_id, brand in stored.items():
                if craft_id in CRAFT_PALETTE_OPTIONS or craft_id in DEFAULT_CRAFT_BRANDS:
                    brands[craft_id] = normalize_brand_for_craft(str(brand), craft_id)
    except json.JSONDecodeError:
        pass
    # floss_brand column remains source of truth for cross-stitch / embroidery.
    floss = normalize_floss_brand(row["floss_brand"])
    brands["cross_stitch"] = floss
    brands["embroidery"] = floss
    return brands


def get_preferred_floss_brand() -> str:
    with get_conn() as conn:
        row = conn.execute("SELECT floss_brand FROM supplies_settings WHERE id = 1").fetchone()
        if not row:
            return DEFAULT_FLOSS_BRAND
        return normalize_floss_brand(row["floss_brand"])


def get_preferred_brand_for_craft(craft_id: str | None) -> str:
    craft = (craft_id or "cross_stitch").strip() or "cross_stitch"
    if craft_uses_floss(craft):
        return get_preferred_floss_brand()
    with get_conn() as conn:
        brands = _load_craft_brands(conn)
    return normalize_brand_for_craft(brands.get(craft), craft)


def get_supplies() -> dict:
    with get_conn() as conn:
        brands = _load_craft_brands(conn)
    floss = brands.get("cross_stitch", DEFAULT_FLOSS_BRAND)
    craft_sections = []
    for craft_id in _CRAFT_BRAND_KEYS:
        options = list_brands_for_craft(craft_id)
        label = {
            "cross_stitch": "Cross-stitch / embroidery floss",
            "diamond_painting": "Diamond painting drills",
            "iron_beading": "Iron / fuse beads",
            "beading": "Seed beads",
        }.get(craft_id, craft_id)
        blurb = {
            "cross_stitch": "Used for cross-stitch charts and embroidery colour matching.",
            "diamond_painting": "Drill bag codes — DMC numbering is the usual kit language.",
            "iron_beading": "Perler, Hama, or Artkal midi fuse-bead catalogues.",
            "beading": "Miyuki Delica or Toho seed-bead catalogues.",
        }.get(craft_id, "")
        craft_sections.append(
            {
                "craft_id": craft_id,
                "label": label,
                "description": blurb,
                "brand": brands.get(craft_id, DEFAULT_CRAFT_BRANDS.get(craft_id, floss)),
                "brands": options,
            }
        )
    return {
        "floss_brand": floss,
        "floss_brands": list_floss_brands(),
        "craft_brands": {c["craft_id"]: c["brand"] for c in craft_sections},
        "craft_palettes": craft_sections,
    }


def update_supplies(
    *,
    floss_brand: str | None = None,
    craft_brands: dict[str, str] | None = None,
) -> dict:
    with get_conn() as conn:
        current = _load_craft_brands(conn)
        if floss_brand is not None:
            brand = normalize_floss_brand(floss_brand)
            available = {b["id"]: b for b in list_floss_brands()}
            meta = available.get(brand)
            if not meta or not meta.get("available"):
                raise ValueError(f"Unknown or unavailable floss brand: {floss_brand}")
            current["cross_stitch"] = brand
            current["embroidery"] = brand
            conn.execute(
                """
                INSERT INTO supplies_settings (id, floss_brand, craft_brands_json)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    floss_brand = excluded.floss_brand,
                    craft_brands_json = excluded.craft_brands_json
                """,
                (brand, json.dumps(current)),
            )
        if craft_brands:
            for craft_id, brand_raw in craft_brands.items():
                craft = (craft_id or "").strip()
                if craft not in CRAFT_PALETTE_OPTIONS and craft not in DEFAULT_CRAFT_BRANDS:
                    raise ValueError(f"Unknown craft for palette preference: {craft_id}")
                brand = normalize_brand_for_craft(brand_raw, craft)
                options = {b["id"]: b for b in list_brands_for_craft(craft)}
                meta = options.get(brand)
                if not meta or not meta.get("available"):
                    raise ValueError(f"Unknown or unavailable brand for {craft}: {brand_raw}")
                current[craft] = brand
                if craft_uses_floss(craft):
                    current["cross_stitch"] = brand
                    current["embroidery"] = brand
            floss = current.get("cross_stitch", DEFAULT_FLOSS_BRAND)
            conn.execute(
                """
                INSERT INTO supplies_settings (id, floss_brand, craft_brands_json)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    floss_brand = excluded.floss_brand,
                    craft_brands_json = excluded.craft_brands_json
                """,
                (floss, json.dumps(current)),
            )
    return get_supplies()
