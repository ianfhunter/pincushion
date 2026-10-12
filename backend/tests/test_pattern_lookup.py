"""Pattern metadata lookup (parse + sewing enrichment)."""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from pincushion.db import init_db
from pincushion.indexers.registry import bootstrap_indexers, shutdown_indexers
from pincushion.main import app
from pincushion.services import catalog
from pincushion.services.craft_files import init_craft_files
from pincushion.services.indexer_craft import init_indexer_craft
from pincushion.services.pattern_lookup import (
    _clean_title,
    _wiki_pretty_title,
    parse_pattern_query,
)
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

    asyncio.run(shutdown_indexers())


def test_parse_vogue_query():
    vendor, sku = parse_pattern_query("sewing", q="Vogue V2913")
    assert vendor.lower().startswith("vogue")
    assert "2913" in sku


def test_parse_bare_prefixed_sku():
    vendor, sku = parse_pattern_query("sewing", q="V2193")
    assert vendor == "vogue"
    assert "2193" in sku


def test_clean_simplicity_title():
    t = _clean_title(
        "V2193 |  Vogue Patterns 1980s Misses&#x27; Vintage Wrap Dress ",
        vendor_name="Vogue",
        sku="V2193",
    )
    assert "Wrap Dress" in t
    assert "V2193" not in t


def test_wiki_pretty_title():
    lead = (
        "Vogue Paris Original 2913; ca. 1982; Christian Dior - Semi-fitted, lined, "
        "above-hip-length jacket has shoulder pads. Straight, front wrap skirt."
    )
    title = _wiki_pretty_title("Vogue 2913", lead, sku_digits="2913")
    assert "1982" in title
    assert "Dior" in title
    assert "jacket" in title.lower()
    assert "…" not in title


def test_lookup_sewing_uses_shop_html(monkeypatch):
    import asyncio

    from pincushion.services import pattern_lookup as pl

    html = """
    <html><head>
    <script type="application/ld+json">
    {
      "@type": "Product",
      "name": "V2193 |  Vogue Patterns 1980s Misses' Vintage Wrap Dress",
      "sku": "V2193",
      "description": "Vintage wrap dress sewing pattern.",
      "image": "https://cdn.example/V2193_Front.jpg",
      "url": "https://simplicity.com/vogue-patterns/v2193",
      "brand": {"@type": "Brand", "name": "Vogue Patterns"}
    }
    </script>
    </head><body></body></html>
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "vogue-patterns/v2193" in url and "search.php" not in url:
            return httpx.Response(200, text=html, request=request)
        if "search.php" in url:
            return httpx.Response(200, text="<html></html>", request=request)
        if "fandom.com" in url:
            return httpx.Response(200, json=["", [], [], []], request=request)
        return httpx.Response(404, request=request)

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs = dict(kwargs)
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(pl.httpx, "AsyncClient", client_factory)

    results = asyncio.run(
        pl.lookup_pattern("sewing", q="Vogue V2193", limit=3)
    )
    assert results
    top = results[0]
    assert top["vendor_id"] == "vogue"
    assert "Wrap Dress" in top["title"]
    assert top["thumbnail_url"]
    assert top["xref_id"].startswith("sewing/vogue/")


def test_lookup_api_mocked(client: TestClient, monkeypatch):
    async def fake_lookup(catalogue_id, **kwargs):
        return [
            {
                "catalogue_id": catalogue_id,
                "vendor_id": "vogue",
                "vendor_name": "Vogue",
                "sku": "V2193",
                "title": "1980s Misses' Vintage Wrap Dress",
                "description": "wrap dress",
                "images": ["https://cdn.example/front.jpg"],
                "thumbnail_url": "https://cdn.example/front.jpg",
                "source_url": "https://simplicity.com/vogue-patterns/v2193",
                "source": "simplicity",
                "xref_id": "sewing/vogue/V2193",
            }
        ]

    monkeypatch.setattr(
        "pincushion.services.pattern_lookup.lookup_pattern", fake_lookup
    )
    r = client.get("/api/catalogues/sewing/lookup?q=Vogue%20V2193")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["results"][0]["title"] == "1980s Misses' Vintage Wrap Dress"


def test_lookup_unsupported_catalogue_empty():
    import asyncio

    from pincushion.services.pattern_lookup import lookup_pattern

    results = asyncio.run(lookup_pattern("yarn", q="Rowan 1234", limit=3))
    assert results == []


def test_parse_dmc_query():
    vendor, sku = parse_pattern_query("cross_stitch", q="DMC PAT1630")
    assert vendor.lower() == "dmc"
    assert "1630" in sku


def test_lookup_dmc_algolia_mocked(monkeypatch):
    import asyncio

    from pincushion.services import pattern_lookup as pl

    payload = {
        "hits": [
            {
                "category": "Patterns",
                "craft": "Cross Stitch",
                "name": "Cross Stitch Advent Calendar",
                "sku": ["PAT1630", "PAT1630S"],
                "slug": "cross-stitch-advent-calendar",
                "description": "Festive advent calendar pattern.",
                "image": "https://cdn.example/pat1630.jpg",
                "urls": {"US": "https://www.dmc.com/US/en/products/cross-stitch-advent-calendar"},
                "freePattern": True,
                "priceCents": {"US": 0},
            }
        ]
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        assert "algolia.net" in str(request.url)
        return httpx.Response(200, json=payload, request=request)

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs = dict(kwargs)
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(pl.httpx, "AsyncClient", client_factory)

    results = asyncio.run(
        pl.lookup_pattern("cross_stitch", vendor="dmc", sku="PAT1630", limit=3)
    )
    assert results
    top = results[0]
    assert top["vendor_id"] == "dmc"
    assert top["sku"] == "PAT1630"
    assert "Advent" in top["title"]
    assert top["thumbnail_url"]
    assert top["xref_id"] == "cross_stitch/dmc/PAT1630"
    assert top["source"] == "dmc_algolia"


def test_manual_wanted_stores_thumbnail(client: TestClient):
    r = client.post(
        "/api/wanted/manual",
        json={
            "craft": "sewing",
            "catalogue_id": "sewing",
            "vendor_query": "Vogue",
            "catalog_ref": "V2193",
            "title": "1980s Misses' Vintage Wrap Dress",
            "thumbnail_url": "https://cdn.example/front.jpg",
            "image_urls": ["https://cdn.example/front.jpg", "https://cdn.example/back.jpg"],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["xref_id"] == "sewing/vogue/V2193"
    assert body["thumbnail_url"] == "https://cdn.example/front.jpg"
