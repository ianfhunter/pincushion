"""Per-craft enable/disable for each search indexer."""

from __future__ import annotations

from pincushion.db import get_conn
from pincushion.indexers.registry import list_indexers
from pincushion.services.catalogues import SEARCH_HELPERS, default_enabled

_OBSOLETE_INDEXER_IDS = frozenset(
    {
        "ravelry",
        "lovecrafts",
        "copa",
        "patternreview",
        "vogue_patterns",
        "mccalls",
        "butterick",
        "simplicity",
        "vintage_pattern_wiki",
        "diamond_art_club",
        "diamond_dotz",
        "paint_with_diamonds",
        "miyuki",
        "toho",
        "perler",
        "hama",
        "artkal",
        "origami_shop",
        "origamiusa",
        "tuttle_origami",
        "joas",
        "origami_simulator",
        "fold_format",
    }
)


def _search_capable(indexer_id: str) -> bool:
    if indexer_id == "user_import":
        return False
    for idx in list_indexers():
        if idx.id == indexer_id:
            return bool(idx.capabilities.search_enabled)
    return False


def init_indexer_craft() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS indexer_craft (
                indexer_id TEXT NOT NULL,
                craft_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (indexer_id, craft_id)
            )
            """
        )
        crafts = [
            r["craft_id"] for r in conn.execute("SELECT craft_id FROM craft_files ORDER BY craft_id").fetchall()
        ]
        if not crafts:
            from pincushion.services.craft_files import CRAFT_ORDER

            crafts = list(CRAFT_ORDER)
        for idx in list_indexers():
            for craft_id in crafts:
                default_on = 1 if default_enabled(idx.id, craft_id) else 0
                conn.execute(
                    """
                    INSERT INTO indexer_craft (indexer_id, craft_id, enabled)
                    VALUES (?, ?, ?)
                    ON CONFLICT(indexer_id, craft_id) DO NOTHING
                    """,
                    (idx.id, craft_id, default_on),
                )
        for helper_id in SEARCH_HELPERS:
            for craft_id in crafts:
                conn.execute(
                    """
                    UPDATE indexer_craft SET enabled = 0
                    WHERE indexer_id = ? AND craft_id = ?
                    """,
                    (helper_id, craft_id),
                )
        for obsolete in _OBSOLETE_INDEXER_IDS:
            conn.execute("DELETE FROM indexer_craft WHERE indexer_id = ?", (obsolete,))
            # Keep indexers rows if external_releases still reference them (FK).
            # They are simply no longer registered/bootstrapped.


def is_indexer_enabled_for_craft(indexer_id: str, craft_id: str) -> bool:
    if not _search_capable(indexer_id):
        return False
    with get_conn() as conn:
        row = conn.execute(
            "SELECT enabled FROM indexer_craft WHERE indexer_id = ? AND craft_id = ?",
            (indexer_id, craft_id),
        ).fetchone()
    if row is None:
        return default_enabled(indexer_id, craft_id)
    return bool(row["enabled"])


def list_indexer_craft_matrix() -> dict[str, dict[str, bool]]:
    with get_conn() as conn:
        crafts = [
            r["craft_id"] for r in conn.execute("SELECT craft_id FROM craft_files ORDER BY craft_id").fetchall()
        ]
        matrix: dict[str, dict[str, bool]] = {}
        for idx in list_indexers():
            row_map: dict[str, bool] = {}
            for craft_id in crafts:
                row = conn.execute(
                    "SELECT enabled FROM indexer_craft WHERE indexer_id = ? AND craft_id = ?",
                    (idx.id, craft_id),
                ).fetchone()
                default = default_enabled(idx.id, craft_id)
                row_map[craft_id] = bool(row["enabled"]) if row else default
            matrix[idx.id] = row_map
    return matrix


def set_indexer_craft_enabled(indexer_id: str, craft_id: str, enabled: bool) -> dict[str, bool]:
    with get_conn() as conn:
        if not conn.execute("SELECT 1 FROM craft_files WHERE craft_id = ?", (craft_id,)).fetchone():
            raise KeyError(craft_id)
        if not any(i.id == indexer_id for i in list_indexers()):
            raise KeyError(indexer_id)
        conn.execute(
            """
            INSERT INTO indexer_craft (indexer_id, craft_id, enabled)
            VALUES (?, ?, ?)
            ON CONFLICT(indexer_id, craft_id) DO UPDATE SET enabled = excluded.enabled
            """,
            (indexer_id, craft_id, 1 if enabled else 0),
        )
    return list_indexer_craft_matrix().get(indexer_id, {})
