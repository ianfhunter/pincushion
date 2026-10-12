"""Wanted queue + vendor autocomplete."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pincushion.db import init_db
from pincushion.indexers.registry import bootstrap_indexers, shutdown_indexers
from pincushion.main import app
from pincushion.services import catalog
from pincushion.services.catalogues import catalogues_for_craft, lookup_vendors, make_xref
from pincushion.services.craft_files import init_craft_files
from pincushion.services.indexer_craft import init_indexer_craft
from pincushion.services.wanted import init_wanted_table


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("PINCUSHION_DATA_DIR", str(tmp_path))
    from pincushion import config

    config.settings.data_dir = tmp_path
    config.settings.db_path = tmp_path / "pincushion.db"
    config.settings.library_dir = tmp_path / "library"
    init_db()
    init_craft_files()
    bootstrap_indexers()
    init_indexer_craft()
    init_wanted_table()
    catalog.seed_indexers()
    with TestClient(app) as c:
        yield c
    import asyncio

    asyncio.get_event_loop().run_until_complete(shutdown_indexers())


def test_catalogue_does_not_dump_vendors():
    cats = catalogues_for_craft("sewing")
    assert len(cats) == 1
    assert cats[0]["id"] == "sewing"
    assert cats[0]["vendors"] == []
    assert make_xref("sewing", "vogue", "1485") == "sewing/vogue/1485"


def test_vendor_autocomplete():
    hits = lookup_vendors("sewing", "vog")
    ids = [h["id"] for h in hits]
    assert "vogue" in ids
    # Only brands with remote lookup — no custom / stub vendors.
    assert not any(h.get("create") for h in lookup_vendors("sewing", "My Indie Co"))
    dmc = lookup_vendors("cross_stitch", "dmc")
    assert any(h["id"] == "dmc" for h in dmc)
    assert lookup_vendors("yarn", "ravelry") == []


def test_manual_wanted_with_vendor_query(client: TestClient):
    r = client.get("/api/catalogues/sewing/vendors?q=vogue")
    assert r.status_code == 200
    assert any(x["id"] == "vogue" for x in r.json()["results"])

    r = client.post(
        "/api/wanted/manual",
        json={
            "craft": "sewing",
            "catalogue_id": "sewing",
            "vendor_query": "Vogue",
            "catalog_ref": "1485",
            "title": "Dress with sleeves",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["xref_id"] == "sewing/vogue/1485"
    assert body["vendor_id"] == "vogue"
