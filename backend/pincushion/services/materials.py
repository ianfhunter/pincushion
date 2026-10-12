"""Materials stash: SQLite index + files under library/materials/{category}/{id}-slug/."""

from __future__ import annotations

import json
import logging
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pincushion.config import settings
from pincushion.db import get_conn

log = logging.getLogger(__name__)

META_FILENAME = "material.json"
_UNSAFE = re.compile(r"[^A-Za-z0-9._()\[\] -]+")

KNOWN_FLOSS_BRAND_IDS = frozenset(
    {"dmc", "anchor", "madeira", "cosmo", "sullivans", "jp_coats", "cxc", "hatchette"}
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def materials_root() -> Path:
    root = settings.library_dir / "materials"
    root.mkdir(parents=True, exist_ok=True)
    return root


def init_materials_table() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                colour_code TEXT,
                colour_rgb TEXT,
                colour_hex TEXT,
                modifiers_json TEXT NOT NULL DEFAULT '[]',
                quantity TEXT,
                length_per_skein TEXT,
                notes TEXT,
                folder_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        cols = {r[1] for r in conn.execute("PRAGMA table_info(materials)").fetchall()}
        if "quantity" not in cols:
            conn.execute("ALTER TABLE materials ADD COLUMN quantity TEXT")
        if "length_per_skein" not in cols:
            conn.execute("ALTER TABLE materials ADD COLUMN length_per_skein TEXT")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category)"
        )
    materials_root()


def _slugify(text: str, *, fallback: str = "item") -> str:
    raw = (text or "").strip().lower()
    raw = re.sub(r"\s+", "-", raw)
    raw = _UNSAFE.sub("-", raw)
    raw = re.sub(r"-{2,}", "-", raw).strip("-._")
    return raw[:80] or fallback


def _parse_modifiers(raw: str | list | None) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    text = str(raw).strip()
    if not text:
        return []
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
    except json.JSONDecodeError:
        pass
    return [p.strip() for p in text.split(",") if p.strip()]


def _parse_rgb(raw: str | None) -> tuple[int, int, int] | None:
    if not raw:
        return None
    parts = [p.strip() for p in str(raw).replace(" ", "").split(",")]
    if len(parts) != 3:
        return None
    try:
        rgb = tuple(int(p) for p in parts)
    except ValueError:
        return None
    if any(n < 0 or n > 255 for n in rgb):
        return None
    return rgb  # type: ignore[return-value]


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"{r:02X}{g:02X}{b:02X}"


def _row_to_dict(row: Any, *, files: list[dict] | None = None) -> dict[str, Any]:
    mods = _parse_modifiers(row["modifiers_json"])
    folder = Path(row["folder_path"])
    out = {
        "id": row["id"],
        "category": row["category"],
        "name": row["name"],
        "brand": row["brand"],
        "colour_code": row["colour_code"],
        "colour_rgb": row["colour_rgb"],
        "colour_hex": row["colour_hex"],
        "modifiers": mods,
        "quantity": row["quantity"] or "",
        "length_per_skein": row["length_per_skein"] or "",
        "notes": row["notes"] or "",
        "folder": str(folder),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "thumbnail_url": None,
        "files": files if files is not None else [],
    }
    thumb = folder / "thumb.jpg"
    if thumb.is_file():
        out["thumbnail_url"] = f"/api/materials/{row['id']}/file/thumb.jpg"
    return out


def list_materials(*, category: str | None = None, q: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM materials"
    params: list[Any] = []
    clauses: list[str] = []
    if category:
        clauses.append("category = ?")
        params.append(category)
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        clauses.append(
            "(lower(name) LIKE ? OR lower(COALESCE(brand,'')) LIKE ? "
            "OR lower(COALESCE(colour_code,'')) LIKE ? OR lower(COALESCE(notes,'')) LIKE ? "
            "OR lower(COALESCE(quantity,'')) LIKE ? OR lower(COALESCE(length_per_skein,'')) LIKE ?)"
        )
        params.extend([needle, needle, needle, needle, needle, needle])
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY lower(name) ASC, id ASC"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def list_category_counts() -> dict[str, int]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT category, COUNT(*) AS c FROM materials GROUP BY category"
        ).fetchall()
    return {r["category"]: int(r["c"]) for r in rows}


def list_custom_brands(*, category: str = "floss") -> list[str]:
    """Brand labels stored on materials that are not built-in catalogue ids."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT brand FROM materials
            WHERE category = ? AND brand IS NOT NULL AND trim(brand) != ''
            ORDER BY lower(brand)
            """,
            (category,),
        ).fetchall()
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        brand = str(row["brand"]).strip()
        key = brand.lower()
        if not brand or key in seen:
            continue
        if key in KNOWN_FLOSS_BRAND_IDS:
            continue
        # Skip known display labels used as ids elsewhere.
        if key in {
            "dmc",
            "anchor",
            "madeira",
            "cosmo",
            "sullivans",
            "j&p coats",
            "jp coats",
            "cxc",
            "hatchette",
            "hachette",
        }:
            continue
        seen.add(key)
        out.append(brand)
    return out


def get_material(material_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
        if not row:
            return None
        folder = Path(row["folder_path"])
        files: list[dict[str, Any]] = []
        if folder.is_dir():
            for path in sorted(folder.iterdir()):
                if not path.is_file() or path.name == META_FILENAME:
                    continue
                files.append(
                    {
                        "filename": path.name,
                        "size_bytes": path.stat().st_size,
                        "url": f"/api/materials/{material_id}/file/{path.name}",
                    }
                )
        return _row_to_dict(row, files=files)


def _write_meta(folder: Path, payload: dict[str, Any]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / META_FILENAME).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _maybe_thumb_from_upload(folder: Path, src: Path) -> None:
    suffix = src.suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return
    dest = folder / "thumb.jpg"
    if dest.is_file():
        return
    try:
        from PIL import Image

        with Image.open(src) as im:
            rgb = im.convert("RGB")
            rgb.thumbnail((480, 480))
            rgb.save(dest, format="JPEG", quality=85, optimize=True)
    except Exception as e:
        log.debug("material thumb failed: %s", e)


def create_material(
    *,
    category: str,
    name: str | None = None,
    brand: str | None = None,
    colour_code: str | None = None,
    colour_rgb: str | None = None,
    modifiers: list[str] | str | None = None,
    quantity: str | None = None,
    length_per_skein: str | None = None,
    notes: str | None = None,
    files: list[tuple[str, bytes]] | None = None,
) -> dict[str, Any]:
    category = (category or "").strip().lower()
    if not category:
        raise ValueError("category is required")
    brand_clean = (brand or "").strip() or None
    code_clean = (colour_code or "").strip() or None
    quantity_clean = (quantity or "").strip() or None
    length_clean = (length_per_skein or "").strip() or None
    notes_clean = (notes or "").strip() or None
    mods = _parse_modifiers(modifiers)
    rgb = _parse_rgb(colour_rgb)
    hex_code = _rgb_to_hex(rgb) if rgb else None

    if category == "floss":
        if not code_clean:
            raise ValueError("Color Code / Description is required for floss")
        if not rgb:
            raise ValueError("RGB colour is required for floss")
        display = code_clean
        if brand_clean:
            display = f"{brand_clean} {code_clean}"
    else:
        display = (name or "").strip()
        if not display:
            raise ValueError("name is required")

    now = _utc_now()
    slug_src = display if category == "floss" else display
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO materials (
                category, name, brand, colour_code, colour_rgb, colour_hex,
                modifiers_json, quantity, length_per_skein, notes,
                folder_path, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                category,
                display,
                brand_clean,
                code_clean,
                ",".join(str(n) for n in rgb) if rgb else None,
                hex_code,
                json.dumps(mods),
                quantity_clean,
                length_clean,
                notes_clean,
                "",  # filled after id known
                now,
                now,
            ),
        )
        material_id = int(cur.lastrowid)
        folder = materials_root() / category / f"{material_id}-{_slugify(slug_src)}"
        folder.mkdir(parents=True, exist_ok=True)
        conn.execute(
            "UPDATE materials SET folder_path = ? WHERE id = ?",
            (str(folder), material_id),
        )

    meta = {
        "id": material_id,
        "category": category,
        "name": display,
        "brand": brand_clean,
        "colour_code": code_clean,
        "colour_rgb": list(rgb) if rgb else None,
        "colour_hex": hex_code,
        "modifiers": mods,
        "quantity": quantity_clean,
        "length_per_skein": length_clean,
        "notes": notes_clean,
        "created_at": now,
        "updated_at": now,
    }
    _write_meta(folder, meta)

    for filename, data in files or []:
        safe = _UNSAFE.sub("_", Path(filename).name).strip("._") or "upload.bin"
        dest = folder / safe
        dest.write_bytes(data)
        _maybe_thumb_from_upload(folder, dest)

    detail = get_material(material_id)
    assert detail is not None
    return detail


def update_material(
    material_id: int,
    *,
    name: str | None = None,
    brand: str | None = None,
    colour_code: str | None = None,
    colour_rgb: str | None = None,
    modifiers: list[str] | str | None = None,
    quantity: str | None = None,
    length_per_skein: str | None = None,
    notes: str | None = None,
    files: list[tuple[str, bytes]] | None = None,
) -> dict[str, Any]:
    """Replace editable fields on an existing material (same shape as create)."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
        if not row:
            raise KeyError(material_id)
        category = str(row["category"])
        folder = Path(row["folder_path"])

    brand_clean = (brand or "").strip() or None
    code_clean = (colour_code or "").strip() or None
    quantity_clean = (quantity or "").strip() or None
    length_clean = (length_per_skein or "").strip() or None
    notes_clean = (notes or "").strip() or None
    mods = _parse_modifiers(modifiers)
    rgb = _parse_rgb(colour_rgb)

    if category == "floss":
        if not code_clean:
            raise ValueError("Color Code / Description is required for floss")
        if not rgb:
            raise ValueError("RGB colour is required for floss")
        display = f"{brand_clean} {code_clean}" if brand_clean else code_clean
    else:
        display = (name or "").strip() or str(row["name"])
        if not display:
            raise ValueError("name is required")
        if rgb is None and row["colour_rgb"]:
            rgb = _parse_rgb(row["colour_rgb"])

    hex_code = _rgb_to_hex(rgb) if rgb else None
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE materials SET
                name = ?, brand = ?, colour_code = ?, colour_rgb = ?, colour_hex = ?,
                modifiers_json = ?, quantity = ?, length_per_skein = ?, notes = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                display,
                brand_clean,
                code_clean,
                ",".join(str(n) for n in rgb) if rgb else None,
                hex_code,
                json.dumps(mods),
                quantity_clean,
                length_clean,
                notes_clean,
                now,
                material_id,
            ),
        )

    meta = {
        "id": material_id,
        "category": category,
        "name": display,
        "brand": brand_clean,
        "colour_code": code_clean,
        "colour_rgb": list(rgb) if rgb else None,
        "colour_hex": hex_code,
        "modifiers": mods,
        "quantity": quantity_clean,
        "length_per_skein": length_clean,
        "notes": notes_clean,
        "updated_at": now,
    }
    if folder.is_dir():
        _write_meta(folder, meta)
        for filename, data in files or []:
            safe = _UNSAFE.sub("_", Path(filename).name).strip("._") or "upload.bin"
            dest = folder / safe
            dest.write_bytes(data)
            _maybe_thumb_from_upload(folder, dest)

    detail = get_material(material_id)
    assert detail is not None
    return detail


def delete_material(material_id: int) -> None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT folder_path FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if not row:
            raise KeyError(material_id)
        folder = Path(row["folder_path"])
        conn.execute("DELETE FROM materials WHERE id = ?", (material_id,))
    if folder.is_dir():
        shutil.rmtree(folder, ignore_errors=True)


def material_file_path(material_id: int, filename: str) -> Path:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT folder_path FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if not row:
            raise KeyError(material_id)
    folder = Path(row["folder_path"]).resolve()
    # Prevent path traversal.
    name = Path(filename).name
    path = (folder / name).resolve()
    if folder not in path.parents and path != folder:
        raise PermissionError("Invalid path")
    if not path.is_file():
        raise FileNotFoundError(name)
    return path
