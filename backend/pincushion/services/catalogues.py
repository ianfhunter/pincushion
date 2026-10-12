"""Wanted catalogues: one per craft domain.

Vendors listed here must have remote pattern lookup (title + images).
Sewing: Simplicity/McCall shop + Vintage Patterns wiki.
Cross-stitch / embroidery: DMC Algolia storefront index.

Cross-reference ID: {catalogue_id}/{vendor_id}/{sku}
Example: sewing/vogue/V2193 · cross_stitch/dmc/PAT1630
"""

from __future__ import annotations

import re
from typing import Any

from pincushion.db import get_conn

# One catalogue per craft domain. Vendors are NOT listed here — look them up.
CATALOGUES: dict[str, dict[str, Any]] = {
    "cross_stitch": {
        "name": "Cross-stitch",
        "craft": "cross_stitch",
        "pattern_lookup": True,
        "notes": "Brand + pattern SKU (e.g. DMC PAT1630).",
    },
    "embroidery": {
        "name": "Embroidery",
        "craft": "embroidery",
        "pattern_lookup": True,
        "notes": "Brand + pattern SKU (e.g. DMC PAT1630).",
    },
    "yarn": {
        "name": "Yarn (knitting & crochet)",
        "craft": "knitting",
        "crafts": ["knitting", "crochet"],
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
    "sewing": {
        "name": "Sewing",
        "craft": "sewing",
        "pattern_lookup": True,
        "notes": "Brand dropdown + pattern number (e.g. Vogue / 2193).",
    },
    "quilting": {
        "name": "Quilting",
        "craft": "quilting",
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
    "diamond_painting": {
        "name": "Diamond painting",
        "craft": "diamond_painting",
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
    "beading": {
        "name": "Beading",
        "craft": "beading",
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
    "iron_beading": {
        "name": "Iron beading",
        "craft": "iron_beading",
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
    "origami": {
        "name": "Origami",
        "craft": "origami",
        "notes": "Add from Search results. No brand+SKU catalogue lookup yet.",
    },
}

# Vendors with remote pattern lookup only — no stub / manual-only brands.
VENDOR_DIRECTORY: dict[str, list[dict[str, Any]]] = {
    "cross_stitch": [
        {"id": "dmc", "name": "DMC", "site_url": "https://www.dmc.com", "aliases": ["dmc charts"]},
    ],
    "embroidery": [
        {"id": "dmc", "name": "DMC", "site_url": "https://www.dmc.com", "aliases": []},
    ],
    "sewing": [
        {"id": "vogue", "name": "Vogue", "site_url": "https://voguepatterns.mccall.com", "aliases": ["vogue patterns"]},
        {"id": "mccalls", "name": "McCall's", "site_url": "https://mccall.com", "aliases": ["mccall", "mccalls"]},
        {"id": "butterick", "name": "Butterick", "site_url": "https://butterick.mccall.com", "aliases": []},
        {"id": "simplicity", "name": "Simplicity", "site_url": "https://simplicity.com", "aliases": []},
        {"id": "new_look", "name": "New Look", "aliases": []},
    ],
}

SEARCH_DEFAULTS: dict[str, frozenset[str]] = {
    "antique_pattern_library": frozenset({"cross_stitch", "embroidery"}),
    "cross_stitch_quest": frozenset({"cross_stitch"}),
    "cyberstitchers": frozenset({"cross_stitch"}),
    "cross_stitch_com": frozenset({"cross_stitch"}),
    "free_patterns_online": frozenset({"cross_stitch"}),
    "wizardi": frozenset({"cross_stitch"}),
    "dmc_free": frozenset({"cross_stitch", "embroidery"}),
    "dmc_shop": frozenset({"cross_stitch", "embroidery"}),
}

SEARCH_HELPERS: frozenset[str] = frozenset(
    {
        "internet_archive",
        "wikimedia_commons",
        "europeana",
        "smithsonian",
        "openverse",
        "pixabay",
        "lospec",
        "kenney",
        "opengameart",
    }
)


def _crafts_for_catalogue(meta: dict[str, Any]) -> list[str]:
    if "crafts" in meta:
        return list(meta["crafts"])
    return [meta["craft"]]


def catalogue_for_craft(craft_id: str) -> dict[str, Any] | None:
    for cid, meta in CATALOGUES.items():
        if craft_id in _crafts_for_catalogue(meta):
            return _serialize_catalogue(cid, meta)
    return None


def catalogues_for_craft(craft_id: str) -> list[dict[str, Any]]:
    cat = catalogue_for_craft(craft_id)
    return [cat] if cat else []


def get_catalogue(catalogue_id: str) -> dict[str, Any] | None:
    meta = CATALOGUES.get(catalogue_id)
    if not meta:
        return None
    return _serialize_catalogue(catalogue_id, meta)


def vendor_slug(name_or_id: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", (name_or_id or "").strip().lower()).strip("_")
    return (s or "vendor")[:64]


def _directory_vendors(catalogue_id: str) -> list[dict[str, Any]]:
    rows = VENDOR_DIRECTORY.get(catalogue_id) or []
    out: list[dict[str, Any]] = []
    for v in rows:
        if not v.get("id") or not v.get("name"):
            continue
        out.append(
            {
                "id": str(v["id"]),
                "name": str(v["name"]),
                "site_url": v.get("site_url") or "",
                "aliases": list(v.get("aliases") or []),
                "source": "directory",
            }
        )
    return out


def _wanted_vendors(catalogue_id: str) -> list[dict[str, Any]]:
    """Vendors already used in Wanted for this catalogue."""
    try:
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT vendor_id, MAX(COALESCE(json_extract(er.metadata_json, '$.vendor_name'), '')) AS vname
                FROM wanted_items w
                JOIN external_releases er ON er.id = w.external_release_id
                WHERE w.catalogue_id = ? AND w.vendor_id IS NOT NULL AND w.vendor_id != ''
                GROUP BY vendor_id
                """,
                (catalogue_id,),
            ).fetchall()
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    for r in rows:
        vid = r["vendor_id"]
        name = (r["vname"] or "").strip() or vid.replace("_", " ").title()
        out.append({"id": vid, "name": name, "site_url": "", "aliases": [], "source": "wanted"})
    return out


def get_vendor(catalogue_id: str, vendor_id: str) -> dict[str, Any] | None:
    if catalogue_id not in CATALOGUES:
        return None
    vid = vendor_slug(vendor_id)
    for v in _directory_vendors(catalogue_id):
        if v["id"] == vid:
            return v
    for v in _wanted_vendors(catalogue_id):
        if v["id"] == vid:
            return v
    # Allow unresolved custom vendor ids (still cross-refable).
    if vid:
        return {"id": vid, "name": vid.replace("_", " ").title(), "site_url": "", "aliases": [], "source": "custom"}
    return None


def resolve_vendor(catalogue_id: str, vendor_query: str) -> dict[str, Any]:
    """Resolve typed vendor text to a vendor record (directory match or custom)."""
    if catalogue_id not in CATALOGUES:
        raise KeyError(f"Unknown catalogue: {catalogue_id}")
    q = (vendor_query or "").strip()
    if not q:
        raise ValueError("Vendor is required")
    # Exact id match
    vid = vendor_slug(q)
    hits = lookup_vendors(catalogue_id, q, limit=8)
    for h in hits:
        if h["id"] == vid or h["name"].lower() == q.lower():
            return h
    if hits and len(q) >= 2:
        # Prefer best-ranked hit when query is a prefix of the name
        top = hits[0]
        if top["name"].lower().startswith(q.lower()) or q.lower() in (top.get("aliases") or []):
            return top
    return {
        "id": vid,
        "name": q,
        "site_url": "",
        "aliases": [],
        "source": "custom",
    }


def lookup_vendors(catalogue_id: str, q: str = "", *, limit: int = 12) -> list[dict[str, Any]]:
    """Autocomplete vendor lookup for a catalogue."""
    if catalogue_id not in CATALOGUES:
        return []
    needle = (q or "").strip().lower()
    seen: set[str] = set()
    scored: list[tuple[int, dict[str, Any]]] = []

    def consider(v: dict[str, Any]) -> None:
        vid = v["id"]
        if vid in seen:
            return
        seen.add(vid)
        name = v["name"]
        aliases = [a.lower() for a in (v.get("aliases") or [])]
        blob = " ".join([vid, name.lower(), *aliases])
        if not needle:
            # Empty query: only return a short suggested set (directory first).
            if v.get("source") == "directory":
                scored.append((50, v))
            return
        if needle == vid or needle == name.lower():
            scored.append((0, v))
        elif name.lower().startswith(needle) or vid.startswith(needle):
            scored.append((1, v))
        elif any(a.startswith(needle) for a in aliases):
            scored.append((2, v))
        elif needle in blob:
            scored.append((3, v))

    for v in _directory_vendors(catalogue_id):
        consider(v)
    for v in _wanted_vendors(catalogue_id):
        consider(v)

    scored.sort(key=lambda t: (t[0], t[1]["name"].lower()))
    return [v for _, v in scored[:limit]]


def make_xref(catalogue_id: str, vendor_id: str, sku: str) -> str:
    return f"{catalogue_id}/{vendor_slug(vendor_id)}/{_norm_sku(sku)}"


def parse_xref(xref: str) -> tuple[str, str, str] | None:
    parts = (xref or "").strip().split("/", 2)
    if len(parts) != 3 or not all(parts):
        return None
    return parts[0], parts[1], parts[2]


def _norm_sku(sku: str) -> str:
    return " ".join((sku or "").strip().split())


def validate_vendor(catalogue_id: str, vendor_id: str) -> None:
    """Vendors may be directory, previously-used, or any non-empty slug."""
    if catalogue_id not in CATALOGUES:
        raise KeyError(f"Unknown catalogue: {catalogue_id}")
    if not vendor_slug(vendor_id):
        raise KeyError("Vendor id required")


def default_enabled(indexer_id: str, craft_id: str) -> bool:
    if indexer_id in SEARCH_HELPERS:
        return False
    crafts = SEARCH_DEFAULTS.get(indexer_id)
    if crafts is not None:
        return craft_id in crafts
    return False


def list_all_catalogue_summaries() -> list[dict[str, Any]]:
    return [_serialize_catalogue(cid, meta) for cid, meta in CATALOGUES.items()]


def _serialize_catalogue(cid: str, meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": cid,
        "name": meta["name"],
        "craft": meta["craft"],
        "crafts": _crafts_for_catalogue(meta),
        "notes": meta.get("notes") or "",
        "pattern_lookup": bool(meta.get("pattern_lookup")),
        # No vendor dump — use /vendors?q= autocomplete.
        "vendors": [],
        "vendor_lookup": f"/api/catalogues/{cid}/vendors",
    }
