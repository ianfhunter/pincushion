"""Catalogue pattern metadata lookup (title + images).

Sewing: Simplicity/McCall shop pages + Vintage Patterns Fandom wiki.
Cross-stitch / embroidery: DMC.com Algolia product index.
"""

from __future__ import annotations

import html
import json
import logging
import re
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from pincushion.config import settings
from pincushion.services.catalogues import (
    VENDOR_DIRECTORY,
    get_catalogue,
    lookup_vendors,
    make_xref,
    resolve_vendor,
    vendor_slug,
)

log = logging.getLogger(__name__)

UA = "PinCushion/0.1 (+self-hosted; pattern-metadata lookup)"
SIMPLICITY_ORIGIN = "https://simplicity.com"
WIKI_API = "https://vintagepatterns.fandom.com/api.php"
DMC_ALGOLIA_APP = "YCVRTN9Y8R"
DMC_ALGOLIA_KEY = "17b225eadafc806fc2580708484de4d5"
DMC_ALGOLIA_INDEX = "products_en_production"
DMC_ALGOLIA_URL = "https://{app_id}-dsn.algolia.net/1/indexes/{index}/query"

_DMC_CATALOGUES = frozenset({"cross_stitch", "embroidery"})
_DMC_CRAFT_LABEL = {
    "cross_stitch": "Cross Stitch",
    "embroidery": "Embroidery",
}

# Brand slug → shop path segment + SKU letter prefix used by current McCall/Simplicity site.
_SEWING_SHOP: dict[str, dict[str, str]] = {
    "vogue": {"path": "vogue-patterns", "prefix": "v", "label": "Vogue"},
    "butterick": {"path": "butterick", "prefix": "b", "label": "Butterick"},
    "simplicity": {"path": "simplicity", "prefix": "s", "label": "Simplicity"},
    "mccalls": {"path": "mccalls-patterns", "prefix": "m", "label": "McCall's"},
    "new_look": {"path": "new-look", "prefix": "n", "label": "New Look"},
}

_BRAND_QUERY_RE = re.compile(
    r"^(?P<brand>vogue|butterick|simplicity|new\s*look|"
    r"mccall'?s?|mc\s*call'?s?|dmc)\s+(?P<sku>[A-Za-z]?\d[\w./-]*)\s*$",
    re.I,
)
_PREFIX_SKU_RE = re.compile(r"^(?P<letter>[VvBbSsMmNn])(?P<digits>\d{3,5})\w*$")
_DMC_SKU_RE = re.compile(r"^(?P<sku>[A-Za-z]{2,6}\d[\w./-]*)\s*$")


def _unescape(text: str) -> str:
    return html.unescape(text or "").strip()


def _clean_title(title: str, *, vendor_name: str = "", sku: str = "") -> str:
    t = _unescape(title)
    t = re.sub(r"\s+", " ", t).strip(" |-\u2013\u2014")
    if "|" in t:
        parts = [p.strip() for p in t.split("|") if p.strip()]
        sku_keys = {sku.upper(), f"{sku}(PDF)".upper(), (vendor_name or "").upper(), "VOGUE PATTERNS", "MCCALL'S", "BUTTERICK", "SIMPLICITY"}
        descriptive = [
            p
            for p in parts
            if p.upper().replace(" ", "") not in {k.replace(" ", "") for k in sku_keys if k}
            and not re.fullmatch(r"[A-Za-z]?\d[\w-]*(?:\s*\(PDF\))?", p, flags=re.I)
        ]
        if descriptive:
            # Prefer the longest descriptive segment (page titles often end with brand).
            t = max(descriptive, key=len)
        elif len(parts) >= 2:
            t = parts[1]
    for prefix in (
        f"{vendor_name} Patterns",
        vendor_name,
        "Vogue Patterns",
        "McCall's Patterns",
        "Butterick Patterns",
        "Simplicity Patterns",
    ):
        if prefix and t.lower().startswith(prefix.lower()):
            t = t[len(prefix) :].strip(" |-\u2013\u2014")
    t = re.sub(r"\s*\(PDF\)\s*$", "", t, flags=re.I).strip()
    # Trailing brand crumbs after earlier pipe cleanup.
    t = re.sub(r"\s*\|\s*(Vogue|Butterick|Simplicity|McCall'?s).*$", "", t, flags=re.I).strip()
    return t or _unescape(title)


def parse_pattern_query(
    catalogue_id: str,
    *,
    q: str = "",
    vendor: str = "",
    sku: str = "",
) -> tuple[str, str]:
    """Return (vendor_query, sku) from free text and/or explicit fields."""
    vendor_q = (vendor or "").strip()
    sku_q = (sku or "").strip()
    raw = (q or "").strip()

    if raw and (not vendor_q or not sku_q):
        m = _BRAND_QUERY_RE.match(raw)
        if m:
            vendor_q = vendor_q or m.group("brand")
            sku_q = sku_q or m.group("sku")
        elif catalogue_id in _DMC_CATALOGUES and not sku_q:
            dm = _DMC_SKU_RE.match(raw.replace(" ", ""))
            if dm:
                vendor_q = vendor_q or "dmc"
                sku_q = dm.group("sku")
            elif not vendor_q:
                sku_q = raw
            else:
                sku_q = raw
        elif not sku_q and not vendor_q:
            # Bare SKU like V2193 — infer brand from letter prefix when possible.
            pm = _PREFIX_SKU_RE.match(raw.replace(" ", ""))
            if pm:
                letter = pm.group("letter").lower()
                letter_map = {"v": "vogue", "b": "butterick", "s": "simplicity", "m": "mccalls", "n": "new look"}
                vendor_q = letter_map.get(letter, "")
                sku_q = raw.replace(" ", "")
            else:
                # "1485" alone — leave vendor empty; caller may already have it.
                sku_q = raw
        elif not sku_q:
            sku_q = raw

    return vendor_q, sku_q


def _sku_candidates(sku: str, *, prefix: str = "") -> list[str]:
    raw = (sku or "").strip()
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()

    def add(s: str) -> None:
        s = s.strip()
        if not s or s.lower() in seen:
            return
        seen.add(s.lower())
        out.append(s)

    add(raw)
    add(raw.upper())
    add(raw.lower())
    compact = re.sub(r"\s+", "", raw)
    add(compact)
    digits = re.sub(r"^[A-Za-z]+", "", compact)
    digits = re.sub(r"[^\d].*$", "", digits) if digits else ""
    if not digits:
        m = re.search(r"(\d{3,5})", compact)
        digits = m.group(1) if m else ""
    if digits:
        add(digits)
        if prefix:
            add(f"{prefix}{digits}")
            add(f"{prefix.upper()}{digits}")
            add(f"{prefix.lower()}{digits}")
    return out


def _result(
    *,
    catalogue_id: str,
    vendor_id: str,
    vendor_name: str,
    sku: str,
    title: str,
    description: str = "",
    images: list[str] | None = None,
    source_url: str = "",
    source: str = "",
) -> dict[str, Any]:
    imgs = [u for u in (images or []) if u]
    # Prefer envelope front when filename hints at it.
    imgs.sort(key=lambda u: (0 if re.search(r"front|_0+1\b", u, re.I) else 1, u))
    thumb = imgs[0] if imgs else ""
    clean = _clean_title(title, vendor_name=vendor_name, sku=sku)
    return {
        "catalogue_id": catalogue_id,
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "sku": sku,
        "title": clean,
        "description": _unescape(description)[:1200],
        "images": imgs[:8],
        "thumbnail_url": thumb,
        "source_url": source_url,
        "source": source,
        "xref_id": make_xref(catalogue_id, vendor_id, sku),
    }


async def lookup_pattern(
    catalogue_id: str,
    *,
    q: str = "",
    vendor: str = "",
    sku: str = "",
    limit: int = 5,
) -> list[dict[str, Any]]:
    if not get_catalogue(catalogue_id):
        return []
    vendor_q, sku_q = parse_pattern_query(catalogue_id, q=q, vendor=vendor, sku=sku)
    if not sku_q and not vendor_q and not (q or "").strip():
        return []

    if catalogue_id == "sewing":
        return await _lookup_sewing(vendor_q=vendor_q, sku_q=sku_q, q=q, limit=limit)

    if catalogue_id in _DMC_CATALOGUES:
        return await _lookup_dmc(
            catalogue_id=catalogue_id,
            vendor_q=vendor_q,
            sku_q=sku_q,
            q=q,
            limit=limit,
        )

    return []


async def _lookup_dmc(
    *,
    catalogue_id: str,
    vendor_q: str,
    sku_q: str,
    q: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Resolve DMC pattern SKUs via the public storefront Algolia index."""
    vendor_id = "dmc"
    vendor_name = "DMC"
    if vendor_q:
        try:
            v = resolve_vendor(catalogue_id, vendor_q)
            vendor_id = v["id"]
            vendor_name = v["name"]
        except (KeyError, ValueError):
            hits = lookup_vendors(catalogue_id, vendor_q, limit=1)
            if hits:
                vendor_id = hits[0]["id"]
                vendor_name = hits[0]["name"]
    if vendor_id != "dmc":
        return []

    sku = (sku_q or (q or "").strip()).strip()
    if not sku:
        return []
    # Drop trailing regional suffix noise for matching (PAT1630S → PAT1630).
    sku_key = re.sub(r"[^A-Za-z0-9]", "", sku).upper()
    sku_core = re.sub(r"S$", "", sku_key) if sku_key.endswith("S") and len(sku_key) > 4 else sku_key

    craft_label = _DMC_CRAFT_LABEL.get(catalogue_id, "")
    app_id = (settings.dmc_algolia_app_id or DMC_ALGOLIA_APP).strip()
    api_key = (settings.dmc_algolia_search_key or DMC_ALGOLIA_KEY).strip()
    index = (settings.dmc_algolia_index or DMC_ALGOLIA_INDEX).strip()
    url = DMC_ALGOLIA_URL.format(app_id=app_id, index=quote(index, safe=""))

    body = {
        "query": sku,
        "hitsPerPage": min(max(limit * 4, 8), 40),
        "facetFilters": [["category:Patterns"]],
    }

    try:
        async with httpx.AsyncClient(
            timeout=12.0,
            headers={
                "User-Agent": UA,
                "X-Algolia-Application-Id": app_id,
                "X-Algolia-API-Key": api_key,
            },
        ) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            records = resp.json().get("hits") or []
    except (httpx.HTTPError, json.JSONDecodeError) as e:
        log.debug("dmc algolia lookup failed %s: %s", sku, e)
        return []

    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    def rank(rec: dict[str, Any]) -> tuple[int, int, str]:
        skus = rec.get("sku") or []
        if isinstance(skus, str):
            skus = [skus]
        sku_blob = " ".join(str(s) for s in skus).upper().replace(" ", "")
        exact = 0 if sku_core and sku_core in sku_blob else 1
        craft = str(rec.get("craft") or "")
        craft_ok = 0 if (not craft_label or craft == craft_label) else 1
        return (exact, craft_ok, str(rec.get("name") or ""))

    for rec in sorted(records, key=rank):
        if rec.get("category") != "Patterns":
            continue
        craft = str(rec.get("craft") or "")
        if craft_label and craft and craft != craft_label:
            continue
        skus = rec.get("sku") or []
        if isinstance(skus, str):
            skus = [skus]
        skus = [str(s).strip() for s in skus if s]
        if not skus:
            continue
        sku_blob = " ".join(skus).upper().replace(" ", "")
        if sku_core and sku_core not in sku_blob and sku_key not in sku_blob:
            # Soft match: query text in name/slug when SKU field missing exact.
            name_blob = f"{rec.get('name') or ''} {rec.get('slug') or ''}".upper()
            if sku_core not in re.sub(r"[^A-Z0-9]", "", name_blob):
                continue
        # Prefer canonical SKU without trailing S when present.
        pick_sku = skus[0]
        for s in skus:
            su = re.sub(r"[^A-Za-z0-9]", "", s).upper()
            if su == sku_core or su == sku_key:
                pick_sku = s
                break
            if not su.endswith("S") and sku_core.startswith(su):
                pick_sku = s

        urls = rec.get("urls") or {}
        source_url = str(urls.get("US") or urls.get("GB") or "").replace("http://", "https://")
        if not source_url and rec.get("slug"):
            source_url = f"https://www.dmc.com/US/en/products/{rec['slug']}"
        images = []
        if rec.get("image"):
            images.append(str(rec["image"]))
        title = _clean_title(str(rec.get("name") or pick_sku), vendor_name=vendor_name, sku=pick_sku)
        item = _result(
            catalogue_id=catalogue_id,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            sku=pick_sku,
            title=title,
            description=str(rec.get("description") or "")[:1200],
            images=images,
            source_url=source_url,
            source="dmc_algolia",
        )
        key = item["xref_id"].lower()
        if key in seen:
            continue
        seen.add(key)
        results.append(item)
        if len(results) >= limit:
            break

    return results


async def _lookup_sewing(
    *,
    vendor_q: str,
    sku_q: str,
    q: str,
    limit: int,
) -> list[dict[str, Any]]:
    vendor_id = ""
    vendor_name = ""
    if vendor_q:
        try:
            v = resolve_vendor("sewing", vendor_q)
            vendor_id = v["id"]
            vendor_name = v["name"]
        except (KeyError, ValueError):
            hits = lookup_vendors("sewing", vendor_q, limit=1)
            if hits:
                vendor_id = hits[0]["id"]
                vendor_name = hits[0]["name"]

    shop = _SEWING_SHOP.get(vendor_id or "")
    prefix = (shop or {}).get("prefix", "")
    sku = sku_q or (q or "").strip()
    candidates = _sku_candidates(sku, prefix=prefix)

    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(item: dict[str, Any] | None) -> None:
        if not item:
            return
        key = item["xref_id"].lower()
        if key in seen:
            return
        seen.add(key)
        results.append(item)

    async with httpx.AsyncClient(
        timeout=12.0,
        follow_redirects=True,
        headers={"User-Agent": UA, "Accept": "text/html,application/json"},
    ) as client:
        # 1) Direct product URLs for known shop brands.
        if shop and candidates:
            for cand in candidates[:6]:
                slug = cand.lower()
                if not slug.startswith(shop["prefix"]) and re.fullmatch(r"\d{3,5}", slug):
                    slug = f"{shop['prefix']}{slug}"
                for path_sku in (slug, f"pd{slug}"):
                    url = f"{SIMPLICITY_ORIGIN}/{shop['path']}/{path_sku}"
                    hit = await _fetch_simplicity_product(
                        client, url, vendor_id=vendor_id or vendor_slug(shop["label"]), vendor_name=vendor_name or shop["label"]
                    )
                    if hit and not path_sku.startswith("pd"):
                        add(hit)
                        break
                if results:
                    break

        # 2) Site search (works across brands; also finds PDF variants).
        want_digits = _sku_digits(sku) or next((_sku_digits(c) for c in candidates if _sku_digits(c)), "")
        if len(results) < limit:
            search_terms = []
            if vendor_name and sku:
                search_terms.append(f"{vendor_name} {sku}")
            search_terms.extend(candidates[:4])
            if q and q.strip() not in search_terms:
                search_terms.append(q.strip())
            for term in search_terms:
                for hit in await _search_simplicity(
                    client, term, prefer_vendor_id=vendor_id, require_digits=want_digits
                ):
                    add(hit)
                    if len(results) >= limit:
                        break
                if len(results) >= limit:
                    break

        # 3) Vintage Patterns wiki (great for out-of-print / historic envelopes).
        if len(results) < limit:
            for hit in await _lookup_vintage_wiki(
                client,
                vendor_id=vendor_id,
                vendor_name=vendor_name,
                sku=sku,
                candidates=candidates,
            ):
                add(hit)
                if len(results) >= limit:
                    break

    return results[:limit]


async def _fetch_simplicity_product(
    client: httpx.AsyncClient,
    url: str,
    *,
    vendor_id: str,
    vendor_name: str,
) -> dict[str, Any] | None:
    try:
        resp = await client.get(url)
    except httpx.HTTPError as e:
        log.debug("simplicity product fetch failed %s: %s", url, e)
        return None
    if resp.status_code != 200:
        return None
    final = str(resp.url)
    if "/search.php" in final:
        return None
    parsed = _parse_simplicity_product_html(
        resp.text, page_url=final, vendor_id=vendor_id, vendor_name=vendor_name
    )
    if not parsed:
        return None
    # Reject category landings that only expose unrelated Product cards.
    path_tail = urlparse(final).path.rstrip("/").rsplit("/", 1)[-1].lower()
    sku_key = re.sub(r"[^a-z0-9]", "", (parsed.get("sku") or "").lower())
    if path_tail and sku_key and path_tail.removeprefix("pd") not in sku_key and sku_key not in path_tail:
        return None
    return parsed


def _parse_simplicity_product_html(
    page: str,
    *,
    page_url: str,
    vendor_id: str,
    vendor_name: str,
) -> dict[str, Any] | None:
    products: list[dict[str, Any]] = []
    for raw in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        page,
        flags=re.I | re.S,
    ):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            types = item.get("@type")
            type_list = types if isinstance(types, list) else [types]
            if "Product" not in type_list:
                continue
            products.append(item)

    if not products:
        return None

    # Prefer the product whose URL matches the page (ignore related products).
    page_path = urlparse(page_url).path.rstrip("/").lower()
    best = None
    for p in products:
        purl = str(p.get("url") or "")
        if urlparse(purl).path.rstrip("/").lower() == page_path:
            best = p
            break
    if best is None:
        # Fall back to product whose sku appears in the path.
        path_tail = page_path.rsplit("/", 1)[-1]
        for p in products:
            sku = str(p.get("sku") or p.get("name") or "").lower()
            if path_tail and path_tail in sku.replace(" ", ""):
                best = p
                break
    if best is None:
        best = products[0]

    sku = str(best.get("sku") or "").strip()
    name = _unescape(str(best.get("name") or ""))
    if not sku:
        m = re.match(r"^([A-Za-z]?\d[\w-]*)\b", name)
        sku = m.group(1) if m else page_path.rsplit("/", 1)[-1].upper().removeprefix("PD")
    sku = re.sub(r"\s*\(PDF\)\s*$", "", sku, flags=re.I).strip() or sku

    # Shop Product.name is often just the SKU — prefer the visible product title.
    h1 = re.search(
        r'class="[^"]*productView-title[^"]*"[^>]*>\s*([^<]+)',
        page,
        flags=re.I,
    )
    page_title = re.search(r"<title>([^<]+)</title>", page, flags=re.I)
    for candidate in (
        _unescape(h1.group(1)) if h1 else "",
        _unescape(page_title.group(1)) if page_title else "",
        name,
    ):
        cleaned = _clean_title(candidate, vendor_name=vendor_name, sku=sku)
        if cleaned and cleaned.upper() != sku.upper() and not re.fullmatch(r"[A-Za-z]?\d[\w-]*", cleaned):
            name = candidate
            break

    images: list[str] = []
    img = best.get("image")
    if isinstance(img, str) and img:
        images.append(img)
    elif isinstance(img, list):
        images.extend(str(x) for x in img if x)

    # Gallery imgs — keep only those that look like this SKU's envelope.
    sku_digits = re.sub(r"\D", "", sku)
    sku_token = re.sub(r"[^A-Za-z0-9]", "", sku).lower()
    for m in re.finditer(
        r"(https://cdn\d*\.bigcommerce\.com/[^\"'\s]+?\.(?:jpg|jpeg|png|webp)[^\"'\s]*)",
        page,
        flags=re.I,
    ):
        u = m.group(1).replace("\\/", "/")
        ul = u.lower()
        if sku_token and sku_token in re.sub(r"[^a-z0-9]", "", ul):
            if u not in images:
                images.append(u)
        elif sku_digits and sku_digits in ul and re.search(rf"[/_.-]{re.escape(sku_digits)}[/_.-]", ul):
            if u not in images:
                images.append(u)

    # Drop tiny thumbs / unrelated leftovers; prefer larger stencil sizes.
    def _img_rank(u: str) -> tuple[int, int, str]:
        ul = u.lower()
        size = 0
        sm = re.search(r"/stencil/(\d+)x(\d+)/", ul)
        if sm:
            size = int(sm.group(1)) * int(sm.group(2))
        elif "original" in ul:
            size = 10_000_000
        front = 0 if "front" in ul else 1
        return (front, -size, u)

    images = sorted(dict.fromkeys(images), key=_img_rank)

    brand = best.get("brand") or {}
    if isinstance(brand, dict) and brand.get("name"):
        vendor_name = vendor_name or str(brand["name"]).replace(" Patterns", "").strip()
        if not vendor_id:
            try:
                vendor_id = resolve_vendor("sewing", vendor_name)["id"]
            except (KeyError, ValueError):
                vendor_id = vendor_slug(vendor_name)

    if not vendor_id:
        vendor_id = vendor_slug(vendor_name or "unknown")

    desc = str(best.get("description") or "")
    title = _clean_title(name, vendor_name=vendor_name, sku=sku)
    return _result(
        catalogue_id="sewing",
        vendor_id=vendor_id,
        vendor_name=vendor_name or vendor_id.replace("_", " ").title(),
        sku=sku,
        title=title,
        description=desc,
        images=images,
        source_url=page_url.split("?")[0],
        source="simplicity",
    )


def _sku_digits(value: str) -> str:
    m = re.search(r"(\d{3,5})", value or "")
    return m.group(1) if m else ""


async def _search_simplicity(
    client: httpx.AsyncClient,
    term: str,
    *,
    prefer_vendor_id: str = "",
    require_digits: str = "",
) -> list[dict[str, Any]]:
    term = (term or "").strip()
    if len(term) < 2:
        return []
    want_digits = require_digits or _sku_digits(term)
    url = f"{SIMPLICITY_ORIGIN}/search.php?search_query={quote(term)}"
    try:
        resp = await client.get(url)
    except httpx.HTTPError as e:
        log.debug("simplicity search failed %s: %s", term, e)
        return []
    if resp.status_code != 200:
        return []

    hits: list[dict[str, Any]] = []
    # Product card titles embed absolute product URLs.
    for m in re.finditer(
        r'class="card-title"[^>]*href="(https://simplicity\.com/[^"]+)"[^>]*>\s*([^<]+)',
        resp.text,
        flags=re.I,
    ):
        href = _unescape(m.group(1)).split("?")[0]
        label = _unescape(m.group(2))
        path = urlparse(href).path.strip("/")
        parts = path.split("/")
        path_tail = (parts[-1] if parts else "").lower()
        if want_digits and want_digits not in path_tail and want_digits not in label:
            continue
        if path_tail.startswith("pd") and hits:
            # Prefer paper envelope over PDF duplicate.
            continue
        # Infer vendor from path.
        path_brand = parts[0] if parts else ""
        brand_map = {
            "vogue-patterns": ("vogue", "Vogue"),
            "butterick": ("butterick", "Butterick"),
            "simplicity": ("simplicity", "Simplicity"),
            "mccalls-patterns": ("mccalls", "McCall's"),
            "mccalls": ("mccalls", "McCall's"),
            "new-look": ("new_look", "New Look"),
        }
        vid, vname = brand_map.get(path_brand, ("", ""))
        if prefer_vendor_id and vid and vid != prefer_vendor_id:
            continue
        # Fetch full product for images/description (cheap; usually 1–2 cards).
        product = await _fetch_simplicity_product(
            client, href, vendor_id=vid or prefer_vendor_id, vendor_name=vname
        )
        if product:
            if want_digits and want_digits not in _sku_digits(product.get("sku") or ""):
                continue
            hits.append(product)
        else:
            sku_m = re.search(r"\b([A-Za-z]?\d{3,5})\b", label)
            sku = sku_m.group(1) if sku_m else parts[-1].upper()
            hits.append(
                _result(
                    catalogue_id="sewing",
                    vendor_id=vid or prefer_vendor_id or "unknown",
                    vendor_name=vname or vid or "Unknown",
                    sku=sku,
                    title=label,
                    source_url=href,
                    source="simplicity",
                )
            )
        if len(hits) >= 3:
            break
    return hits


async def _lookup_vintage_wiki(
    client: httpx.AsyncClient,
    *,
    vendor_id: str,
    vendor_name: str,
    sku: str,
    candidates: list[str],
) -> list[dict[str, Any]]:
    # Build search phrases like "Vogue 2913".
    digits = ""
    for c in candidates:
        m = re.search(r"(\d{3,5})", c)
        if m:
            digits = m.group(1)
            break
    if not digits and sku:
        m = re.search(r"(\d{3,5})", sku)
        digits = m.group(1) if m else ""
    if not digits:
        return []

    label = vendor_name or (
        next((v["name"] for v in VENDOR_DIRECTORY.get("sewing", []) if v["id"] == vendor_id), "")
        if vendor_id
        else ""
    )
    # Wiki uses "McCall's" with apostrophe.
    if vendor_id == "mccalls":
        label = "McCall's"
    searches = []
    if label:
        searches.append(f"{label} {digits}")
    searches.append(digits)

    titles: list[str] = []
    for term in searches:
        try:
            resp = await client.get(
                WIKI_API,
                params={"action": "opensearch", "search": term, "limit": 8, "format": "json"},
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, json.JSONDecodeError) as e:
            log.debug("wiki opensearch failed %s: %s", term, e)
            continue
        if isinstance(data, list) and len(data) > 1:
            for t in data[1]:
                if t and t not in titles:
                    titles.append(t)

    # Rank: exact "Brand Digits", then without A/B suffix noise.
    def rank(title: str) -> tuple[int, int, str]:
        tl = title.lower()
        brand_l = (label or "").lower()
        exact = f"{brand_l} {digits}".lower()
        if tl == exact:
            return (0, 0, title)
        if tl.startswith(exact + " ") or tl == exact:
            return (1, len(title), title)
        if digits in tl and (not brand_l or brand_l.split()[0] in tl):
            return (2, len(title), title)
        return (5, len(title), title)

    titles = sorted(titles, key=rank)[:5]
    out: list[dict[str, Any]] = []
    for title in titles:
        hit = await _fetch_wiki_page(client, title, vendor_id=vendor_id, vendor_name=label, sku_digits=digits)
        if hit:
            out.append(hit)
        if len(out) >= 3:
            break
    return out


async def _fetch_wiki_page(
    client: httpx.AsyncClient,
    title: str,
    *,
    vendor_id: str,
    vendor_name: str,
    sku_digits: str,
) -> dict[str, Any] | None:
    try:
        resp = await client.get(
            WIKI_API,
            params={
                "action": "query",
                "titles": title,
                "prop": "pageimages|revisions|info",
                "rvprop": "content",
                "rvslots": "main",
                "pithumbsize": 600,
                "inprop": "url",
                "format": "json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, json.JSONDecodeError) as e:
        log.debug("wiki page fetch failed %s: %s", title, e)
        return None

    pages = (data.get("query") or {}).get("pages") or {}
    page = next(iter(pages.values()), None)
    if not page or page.get("missing") is not None:
        return None

    content = ""
    revs = page.get("revisions") or []
    if revs:
        content = ((revs[0].get("slots") or {}).get("main") or {}).get("*") or revs[0].get("*") or ""

    images: list[str] = []
    thumb = (page.get("thumbnail") or {}).get("source")
    if thumb:
        images.append(thumb)
    # Full-size page image if available via filename.
    pageimage = page.get("pageimage")
    if pageimage:
        file_url = await _wiki_file_url(client, pageimage)
        if file_url and file_url not in images:
            images.insert(0, file_url)

    lead = _wiki_lead(content)
    pretty_title = _wiki_pretty_title(title, lead, sku_digits=sku_digits)
    source_url = page.get("fullurl") or page.get("canonicalurl") or (
        f"https://vintagepatterns.fandom.com/wiki/{quote(title.replace(' ', '_'))}"
    )

    # Infer vendor from page title when not provided.
    vid = vendor_id
    vname = vendor_name
    if not vid:
        m = re.match(r"^(Vogue|Butterick|Simplicity|McCall'?s|New Look)\b", title, re.I)
        if m:
            try:
                v = resolve_vendor("sewing", m.group(1))
                vid, vname = v["id"], v["name"]
            except (KeyError, ValueError):
                vid = vendor_slug(m.group(1))
                vname = m.group(1)
    if not vid:
        vid = "unknown"
        vname = vname or "Unknown"

    # Prefer canonical brand+number as SKU (Vogue pages are "Vogue 2913").
    sku = f"{sku_digits}"
    if vid == "vogue":
        sku = f"V{sku_digits}"
    elif vid == "butterick":
        sku = f"B{sku_digits}"
    elif vid == "simplicity":
        sku = f"S{sku_digits}"
    elif vid == "mccalls":
        sku = f"M{sku_digits}"
    elif vid == "new_look":
        sku = f"N{sku_digits}"

    return _result(
        catalogue_id="sewing",
        vendor_id=vid,
        vendor_name=vname or vid.replace("_", " ").title(),
        sku=sku,
        title=pretty_title,
        description=lead,
        images=images,
        source_url=source_url,
        source="vintagepatterns_wiki",
    )


async def _wiki_file_url(client: httpx.AsyncClient, filename: str) -> str:
    try:
        resp = await client.get(
            WIKI_API,
            params={
                "action": "query",
                "titles": f"File:{filename}",
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            },
        )
        resp.raise_for_status()
        pages = (resp.json().get("query") or {}).get("pages") or {}
        page = next(iter(pages.values()), {})
        infos = page.get("imageinfo") or []
        if infos:
            return str(infos[0].get("url") or "")
    except (httpx.HTTPError, json.JSONDecodeError, StopIteration):
        return ""
    return ""


def _wiki_lead(wikitext: str) -> str:
    text = wikitext or ""
    # Drop image / gallery / category chrome.
    text = re.sub(r"\[\[Image:[^\]]*\]\]", "", text, flags=re.I)
    text = re.sub(r"\[\[File:[^\]]*\]\]", "", text, flags=re.I)
    text = re.sub(r"<gallery[\s\S]*?</gallery>", "", text, flags=re.I)
    text = re.sub(r"\{\{[^}]+\}\}", "", text)
    text = re.sub(r"\[\[Category:[^\]]*\]\]", "", text, flags=re.I)
    text = re.sub(r"==+[^=]+==+", "", text)
    # Links [[Foo|bar]] -> bar; [[Foo]] -> Foo
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    # Skip wishlist / sources stubs.
    for p in paras:
        if p.lower().startswith(("[insert", "==", "featured in")):
            continue
        if len(p) < 40:
            continue
        return re.sub(r"\s+", " ", p)[:1200]
    return re.sub(r"\s+", " ", paras[0])[:1200] if paras else ""


def _garment_hints(text: str) -> str:
    blob = (text or "").lower()
    order = [
        "wrap dress",
        "cocktail dress",
        "evening dress",
        "dress",
        "jacket",
        "coat",
        "blouse",
        "shirt",
        "wrap skirt",
        "skirt",
        "trousers",
        "pants",
        "suit",
        "jumpsuit",
        "romper",
        "vest",
        "cape",
        "top",
    ]
    found: list[str] = []
    for g in order:
        if g in blob and g not in found:
            # Avoid adding "dress" if "wrap dress" already present.
            if any(g in longer for longer in found):
                continue
            found.append(g)
        if len(found) >= 2:
            break
    return " & ".join(found)


def _wiki_pretty_title(page_title: str, lead: str, *, sku_digits: str) -> str:
    """Build a human title from wiki lead (era / designer / garment)."""
    lead = lead or ""
    garments = _garment_hints(lead)
    # "Vogue Paris Original 2913; ca. 1982; Christian Dior - Semi-fitted..."
    m = re.match(
        r"^[^;]{0,80};\s*(ca\.\s*\d{4}|\d{4}s?)\s*;\s*([^-–—;]{2,60})\s*[-–—]\s*(.+)$",
        lead,
        flags=re.I,
    )
    if m:
        era, designer = m.group(1), m.group(2).strip()
        if garments:
            return f"{era} {designer} — {garments}"
        return f"{era} {designer}"

    m2 = re.match(r"^[^;]{0,80};\s*(ca\.\s*\d{4}|\d{4}s?)\s*;\s*(.+)$", lead, flags=re.I)
    if m2:
        era, rest = m2.group(1), m2.group(2).strip()
        if garments:
            return f"{era} {garments}"
        # Designer-only clause before em-dash/description.
        designer = re.split(r"[-–—]", rest, maxsplit=1)[0].strip()
        if 2 < len(designer) < 50:
            return f"{era} {designer}"
        return era

    if garments and re.search(r"\b(19\d0s|20\d0s|ca\.\s*\d{4})\b", lead, re.I):
        era_m = re.search(r"\b(19\d0s|20\d0s|ca\.\s*\d{4})\b", lead, re.I)
        return f"{era_m.group(1)} {garments}" if era_m else garments

    if lead:
        first = lead.split(".")[0].strip()
        if 20 < len(first) <= 100:
            return first

    return page_title if page_title else f"Pattern {sku_digits}"
