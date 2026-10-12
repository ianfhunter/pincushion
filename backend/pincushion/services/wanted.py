"""Wanted queue: catalogue + vendor + SKU with stable xref IDs."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from pincushion.db import get_conn
from pincushion.indexers.registry import get_indexer
from pincushion.models import ExternalHit, LicenseClass, WantedStatus
from pincushion.services import catalog
from pincushion.services.catalogues import (
    get_catalogue,
    get_vendor,
    make_xref,
    validate_vendor,
)

log = logging.getLogger(__name__)

MANUAL_INDEXER_ID = "user_import"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", text.strip().lower()).strip("-")
    return (s or "item")[:120]


def init_wanted_table() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wanted_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_release_id INTEGER NOT NULL REFERENCES external_releases(id),
                craft TEXT NOT NULL DEFAULT 'cross_stitch',
                status TEXT NOT NULL DEFAULT 'wanted',
                catalogue_id TEXT,
                vendor_id TEXT,
                catalog_ref TEXT,
                xref_id TEXT,
                notes TEXT,
                error TEXT,
                pattern_id INTEGER REFERENCES patterns(id) ON DELETE SET NULL,
                added_at TEXT NOT NULL,
                last_checked_at TEXT,
                UNIQUE (external_release_id, craft)
            )
            """
        )
        # Migrations for DBs created before vendor/xref columns.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(wanted_items)").fetchall()}
        for col, decl in (
            ("catalogue_id", "TEXT"),
            ("vendor_id", "TEXT"),
            ("xref_id", "TEXT"),
        ):
            if col not in cols:
                conn.execute(f"ALTER TABLE wanted_items ADD COLUMN {col} {decl}")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_wanted_xref ON wanted_items(xref_id) "
            "WHERE xref_id IS NOT NULL"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_wanted_status ON wanted_items(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_wanted_craft ON wanted_items(craft)")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_wanted_vendor ON wanted_items(catalogue_id, vendor_id)"
        )


def _row_to_dict(row) -> dict[str, Any]:
    meta = {}
    try:
        meta = json.loads(row["metadata_json"] or "{}")
    except json.JSONDecodeError:
        meta = {}
    can_download = bool(row["can_download"]) if "can_download" in row.keys() else False
    catalogue_id = row["catalogue_id"] if "catalogue_id" in row.keys() else None
    vendor_id = row["vendor_id"] if "vendor_id" in row.keys() else None
    xref_id = row["xref_id"] if "xref_id" in row.keys() else None
    vendor_name = meta.get("vendor_name")
    if not vendor_name and catalogue_id and vendor_id:
        v = get_vendor(catalogue_id, vendor_id)
        vendor_name = v["name"] if v else vendor_id
    return {
        "id": int(row["id"]),
        "craft": row["craft"],
        "status": row["status"],
        "catalogue_id": catalogue_id,
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "catalog_ref": row["catalog_ref"],
        "xref_id": xref_id,
        "notes": row["notes"],
        "error": row["error"],
        "pattern_id": int(row["pattern_id"]) if row["pattern_id"] is not None else None,
        "added_at": row["added_at"],
        "last_checked_at": row["last_checked_at"],
        "indexer_id": row["indexer_id"],
        "external_id": row["external_id"],
        "title": row["title"],
        "designer": row["designer"],
        "source_url": row["source_url"],
        "thumbnail_url": meta.get("thumbnail_url") or meta.get("thumbnail"),
        "license_class": row["license_class"],
        "can_download": can_download,
        "download_mode": "auto" if can_download else "manual",
    }


def list_wanted(
    *,
    craft: str | None = None,
    status: str | None = None,
    catalogue_id: str | None = None,
    vendor_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    q = """
        SELECT w.*, er.indexer_id, er.external_id, er.title, er.designer,
               er.source_url, er.metadata_json, er.license_class,
               COALESCE(i.can_download, 0) AS can_download
        FROM wanted_items w
        JOIN external_releases er ON er.id = w.external_release_id
        LEFT JOIN indexers i ON i.id = er.indexer_id
        WHERE 1=1
    """
    params: list[Any] = []
    if craft:
        q += " AND w.craft = ?"
        params.append(craft)
    if status:
        q += " AND w.status = ?"
        params.append(status)
    if catalogue_id:
        q += " AND w.catalogue_id = ?"
        params.append(catalogue_id)
    if vendor_id:
        q += " AND w.vendor_id = ?"
        params.append(vendor_id)
    q += " ORDER BY w.added_at DESC LIMIT ?"
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(q, params).fetchall()
    return [_row_to_dict(r) for r in rows]


async def add_from_indexer(
    indexer_id: str,
    external_id: str,
    *,
    craft: str,
    notes: str | None = None,
    catalog_ref: str | None = None,
    catalogue_id: str | None = None,
    vendor_id: str | None = None,
) -> dict[str, Any]:
    indexer = get_indexer(indexer_id)
    try:
        detail = await indexer.get_pattern(external_id, craft=craft)
    except Exception:
        detail = ExternalHit(
            indexer_id=indexer_id,
            external_id=external_id,
            title=external_id,
            source_url=indexer.capabilities.site_url or "",
            craft=craft,
            license_class=LicenseClass.UNKNOWN,
        )
    # Map search indexer → catalogue vendor when possible.
    if not catalogue_id:
        catalogue_id = craft if get_catalogue(craft) else None
        if craft in ("knitting", "crochet"):
            catalogue_id = "yarn"
    if not vendor_id and catalogue_id:
        # Prefer matching vendor id == indexer id when present.
        if get_vendor(catalogue_id, indexer_id):
            vendor_id = indexer_id
        elif indexer_id.startswith("dmc") and get_vendor(catalogue_id, "dmc"):
            vendor_id = "dmc"

    release_id = await catalog.upsert_external_release(detail)
    if getattr(detail, "thumbnail_url", None):
        with get_conn() as conn:
            row = conn.execute(
                "SELECT metadata_json FROM external_releases WHERE id = ?", (release_id,)
            ).fetchone()
            meta = json.loads(row["metadata_json"] or "{}")
            if not meta.get("thumbnail_url"):
                meta["thumbnail_url"] = detail.thumbnail_url
                conn.execute(
                    "UPDATE external_releases SET metadata_json = ? WHERE id = ?",
                    (json.dumps(meta), release_id),
                )

    ref = (
        catalog_ref
        or detail.metadata.get("catalog_ref")
        or detail.metadata.get("pattern_number")
        or external_id
    )
    xref = None
    if catalogue_id and vendor_id and ref:
        try:
            validate_vendor(catalogue_id, vendor_id)
            xref = make_xref(catalogue_id, vendor_id, str(ref))
        except KeyError:
            catalogue_id = None
            vendor_id = None
            xref = None

    now = _utc_now()
    can_dl = bool(indexer.capabilities.can_download)
    status = WantedStatus.QUEUED.value if can_dl else WantedStatus.WANTED.value
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO wanted_items (
                external_release_id, craft, status, catalogue_id, vendor_id,
                catalog_ref, xref_id, notes, added_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(external_release_id, craft) DO UPDATE SET
                notes=COALESCE(excluded.notes, wanted_items.notes),
                catalog_ref=COALESCE(excluded.catalog_ref, wanted_items.catalog_ref),
                catalogue_id=COALESCE(excluded.catalogue_id, wanted_items.catalogue_id),
                vendor_id=COALESCE(excluded.vendor_id, wanted_items.vendor_id),
                xref_id=COALESCE(excluded.xref_id, wanted_items.xref_id),
                status=CASE
                    WHEN wanted_items.status IN ('imported', 'downloading') THEN wanted_items.status
                    ELSE excluded.status
                END
            """,
            (release_id, craft, status, catalogue_id, vendor_id, ref, xref, notes, now),
        )
        return _fetch_wanted_row(conn, release_id=release_id, craft=craft)


async def add_manual(
    *,
    craft: str,
    title: str,
    catalogue_id: str,
    vendor_id: str,
    catalog_ref: str,
    source_url: str = "",
    designer: str | None = None,
    notes: str | None = None,
    vendor_query: str | None = None,
    thumbnail_url: str | None = None,
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    from pincushion.services.catalogues import resolve_vendor, vendor_slug

    vendor = resolve_vendor(catalogue_id, vendor_query or vendor_id)
    vendor_id = vendor_slug(vendor["id"])
    sku = catalog_ref.strip()
    if not sku:
        raise ValueError("catalog_ref (SKU / pattern number) is required")
    xref = make_xref(catalogue_id, vendor_id, sku)
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM wanted_items WHERE xref_id = ?", (xref,)
        ).fetchone()
        if existing:
            item = get_wanted(int(existing["id"]))
            assert item is not None
            return item

    get_indexer(MANUAL_INDEXER_ID)
    external_id = _slug(xref)
    images = [u for u in (image_urls or []) if u][:12]
    thumb = (thumbnail_url or (images[0] if images else "") or "").strip() or None
    meta: dict[str, Any] = {
        "catalogue_id": catalogue_id,
        "vendor_id": vendor_id,
        "vendor_name": vendor["name"],
        "catalog_ref": sku,
        "xref_id": xref,
        "manual": True,
    }
    if thumb:
        meta["thumbnail_url"] = thumb
    if images:
        meta["image_urls"] = images
    hit = ExternalHit(
        indexer_id=MANUAL_INDEXER_ID,
        external_id=external_id,
        title=(title.strip() or f"{vendor['name']} {sku}"),
        designer=designer or vendor["name"],
        source_url=(source_url.strip() or vendor.get("site_url") or ""),
        craft=craft,
        license_class=LicenseClass.UNKNOWN,
        thumbnail_url=thumb,
        metadata=meta,
    )
    release_id = await catalog.upsert_external_release(hit)
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO wanted_items (
                external_release_id, craft, status, catalogue_id, vendor_id,
                catalog_ref, xref_id, notes, added_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(external_release_id, craft) DO UPDATE SET
                notes=COALESCE(excluded.notes, wanted_items.notes),
                catalog_ref=excluded.catalog_ref,
                catalogue_id=excluded.catalogue_id,
                vendor_id=excluded.vendor_id,
                xref_id=excluded.xref_id
            """,
            (
                release_id,
                craft,
                WantedStatus.WANTED.value,
                catalogue_id,
                vendor_id,
                sku,
                xref,
                notes,
                now,
            ),
        )
        return _fetch_wanted_row(conn, release_id=release_id, craft=craft)


def _fetch_wanted_row(conn, *, release_id: int, craft: str) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT w.*, er.indexer_id, er.external_id, er.title, er.designer,
               er.source_url, er.metadata_json, er.license_class,
               COALESCE(i.can_download, 0) AS can_download
        FROM wanted_items w
        JOIN external_releases er ON er.id = w.external_release_id
        LEFT JOIN indexers i ON i.id = er.indexer_id
        WHERE w.external_release_id = ? AND w.craft = ?
        """,
        (release_id, craft),
    ).fetchone()
    return _row_to_dict(row)


def get_wanted(wanted_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT w.*, er.indexer_id, er.external_id, er.title, er.designer,
                   er.source_url, er.metadata_json, er.license_class,
                   COALESCE(i.can_download, 0) AS can_download
            FROM wanted_items w
            JOIN external_releases er ON er.id = w.external_release_id
            LEFT JOIN indexers i ON i.id = er.indexer_id
            WHERE w.id = ?
            """,
            (wanted_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_wanted_by_xref(xref_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT w.*, er.indexer_id, er.external_id, er.title, er.designer,
                   er.source_url, er.metadata_json, er.license_class,
                   COALESCE(i.can_download, 0) AS can_download
            FROM wanted_items w
            JOIN external_releases er ON er.id = w.external_release_id
            LEFT JOIN indexers i ON i.id = er.indexer_id
            WHERE w.xref_id = ?
            """,
            (xref_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def update_wanted(
    wanted_id: int,
    *,
    status: str | None = None,
    notes: str | None = None,
    catalog_ref: str | None = None,
    pattern_id: int | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM wanted_items WHERE id = ?", (wanted_id,)).fetchone()
        if not row:
            raise KeyError(wanted_id)
        new_status = status if status is not None else row["status"]
        new_notes = notes if notes is not None else row["notes"]
        new_ref = catalog_ref if catalog_ref is not None else row["catalog_ref"]
        new_pattern = pattern_id if pattern_id is not None else row["pattern_id"]
        new_error = error if error is not None else row["error"]
        new_xref = row["xref_id"] if "xref_id" in row.keys() else None
        if (
            catalog_ref is not None
            and row["catalogue_id"]
            and row["vendor_id"]
        ):
            new_xref = make_xref(row["catalogue_id"], row["vendor_id"], catalog_ref)
        conn.execute(
            """
            UPDATE wanted_items
            SET status = ?, notes = ?, catalog_ref = ?, xref_id = ?, pattern_id = ?,
                error = ?, last_checked_at = ?
            WHERE id = ?
            """,
            (
                new_status,
                new_notes,
                new_ref,
                new_xref,
                new_pattern,
                new_error,
                _utc_now(),
                wanted_id,
            ),
        )
    item = get_wanted(wanted_id)
    assert item is not None
    return item


def delete_wanted(wanted_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM wanted_items WHERE id = ?", (wanted_id,))
        if cur.rowcount == 0:
            raise KeyError(wanted_id)


def mark_imported(wanted_id: int, pattern_id: int | None = None) -> dict[str, Any]:
    return update_wanted(
        wanted_id,
        status=WantedStatus.IMPORTED.value,
        pattern_id=pattern_id,
        error=None,
    )


async def process_one(wanted_id: int) -> dict[str, Any]:
    from pincushion.services.import_service import import_from_indexer

    item = get_wanted(wanted_id)
    if not item:
        raise KeyError(wanted_id)
    if not item["can_download"]:
        return update_wanted(
            wanted_id,
            status=WantedStatus.WANTED.value,
            error="Manual catalogue entry — open the vendor site and mark imported after you have the file.",
        )
    update_wanted(wanted_id, status=WantedStatus.DOWNLOADING.value, error=None)
    try:
        result = await import_from_indexer(
            item["indexer_id"], item["external_id"], craft=item["craft"]
        )
        pid = result.pattern_id or result.duplicate_of
        return mark_imported(wanted_id, pid)
    except Exception as e:
        log.warning("Wanted %s download failed: %s", wanted_id, e)
        return update_wanted(
            wanted_id,
            status=WantedStatus.FAILED.value,
            error=str(e)[:500],
        )


async def process_queue(*, limit: int = 3) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT w.id
            FROM wanted_items w
            JOIN external_releases er ON er.id = w.external_release_id
            LEFT JOIN indexers i ON i.id = er.indexer_id
            WHERE w.status IN ('wanted', 'queued', 'failed')
              AND COALESCE(i.can_download, 0) = 1
            ORDER BY
              CASE w.status WHEN 'queued' THEN 0 WHEN 'wanted' THEN 1 ELSE 2 END,
              w.added_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    results: list[dict[str, Any]] = []
    for row in rows:
        results.append(await process_one(int(row["id"])))
    return results
