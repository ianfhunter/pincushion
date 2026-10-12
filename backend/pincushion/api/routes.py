import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

from pincushion.config import settings
from pincushion.db import get_conn
from pincushion.indexers.registry import get_indexer, list_indexers
from pincushion.models import (
    BlankPatternRequest,
    ChartSaveRequest,
    ConvertChartRequest,
    CraftFilesUpdate,
    YarnSaveRequest,
    FileRenameRequest,
    RegeneratePackageRequest,
    ImportResult,
    IndexerCraftUpdate,
    LicenseClass,
    ImportFromIndexer,
    PatternUpdate,
    ProjectStatus,
    ProjectUpdate,
    SearchResponse,
    SuppliesUpdate,
    WantedAddRequest,
    WantedManualRequest,
    WantedUpdateRequest,
)
from pincushion.services import catalog
from pincushion.services.craft_files import get_craft, list_crafts, update_craft
from pincushion.services.indexer_craft import (
    is_indexer_enabled_for_craft,
    list_indexer_craft_matrix,
    set_indexer_craft_enabled,
)
from pincushion.services.search_merge import fair_merge_hits
from pincushion.services.import_service import guess_mime, import_from_indexer, import_local_file
from pincushion.services.supplies import get_preferred_floss_brand, get_supplies, update_supplies

router = APIRouter(prefix="/api")


@router.get("/indexers")
def api_indexers():
    matrix = list_indexer_craft_matrix()
    return [
        {
            "id": idx.id,
            "name": idx.name,
            "capabilities": idx.capabilities.model_dump(),
            "craft_enabled": matrix.get(idx.id, {}),
        }
        for idx in list_indexers()
    ]


@router.put("/indexers/{indexer_id}/craft")
def api_set_indexer_craft(indexer_id: str, body: IndexerCraftUpdate):
    try:
        craft_enabled = set_indexer_craft_enabled(indexer_id, body.craft_id, body.enabled)
    except KeyError:
        raise HTTPException(404, "Indexer or craft not found")
    return {"indexer_id": indexer_id, "craft_enabled": craft_enabled}


@router.get("/catalogues")
def api_catalogues(craft: str | None = Query(None)):
    from pincushion.services.catalogues import catalogues_for_craft, list_all_catalogue_summaries

    if craft:
        if get_craft(craft) is None:
            raise HTTPException(400, "Unknown craft")
        return {"craft": craft, "catalogues": catalogues_for_craft(craft)}
    return {"catalogues": list_all_catalogue_summaries()}


@router.get("/catalogues/{catalogue_id}")
def api_get_catalogue(catalogue_id: str):
    from pincushion.services.catalogues import get_catalogue

    cat = get_catalogue(catalogue_id)
    if not cat:
        raise HTTPException(404, "Catalogue not found")
    return cat


@router.get("/catalogues/{catalogue_id}/vendors")
def api_lookup_vendors(
    catalogue_id: str,
    q: str = Query("", max_length=200),
    limit: int = Query(12, ge=1, le=40),
):
    from pincushion.services.catalogues import get_catalogue, lookup_vendors

    if not get_catalogue(catalogue_id):
        raise HTTPException(404, "Catalogue not found")
    return {"catalogue_id": catalogue_id, "query": q, "results": lookup_vendors(catalogue_id, q, limit=limit)}


@router.get("/catalogues/{catalogue_id}/lookup")
async def api_lookup_pattern(
    catalogue_id: str,
    q: str = Query("", max_length=200, description="Free text, e.g. 'Vogue V2193'"),
    vendor: str = Query("", max_length=120),
    sku: str = Query("", max_length=120),
    limit: int = Query(5, ge=1, le=12),
):
    """Look up pattern title / images for a catalogue SKU (sewing: shop + vintage wiki)."""
    from pincushion.services.catalogues import get_catalogue
    from pincushion.services.pattern_lookup import lookup_pattern

    if not get_catalogue(catalogue_id):
        raise HTTPException(404, "Catalogue not found")
    if not (q or vendor or sku).strip():
        raise HTTPException(400, "Provide q and/or vendor+sku")
    results = await lookup_pattern(
        catalogue_id, q=q, vendor=vendor, sku=sku, limit=limit
    )
    return {
        "catalogue_id": catalogue_id,
        "query": q,
        "vendor": vendor,
        "sku": sku,
        "results": results,
    }


@router.get("/catalogues/{catalogue_id}/vendors/{vendor_id}")
def api_get_vendor(catalogue_id: str, vendor_id: str):
    from pincushion.services.catalogues import get_vendor

    vendor = get_vendor(catalogue_id, vendor_id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return {"catalogue_id": catalogue_id, **vendor}


@router.get("/wanted")
def api_list_wanted(
    craft: str | None = Query(None),
    status: str | None = Query(None),
    catalogue_id: str | None = Query(None),
    vendor_id: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
):
    from pincushion.services import wanted as wanted_svc

    return wanted_svc.list_wanted(
        craft=craft,
        status=status,
        catalogue_id=catalogue_id,
        vendor_id=vendor_id,
        limit=limit,
    )


@router.get("/wanted/by-xref/{xref_id:path}")
def api_wanted_by_xref(xref_id: str):
    from pincushion.services import wanted as wanted_svc

    item = wanted_svc.get_wanted_by_xref(xref_id)
    if not item:
        raise HTTPException(404, "Wanted item not found")
    return item


@router.post("/wanted")
async def api_add_wanted(body: WantedAddRequest):
    from pincushion.services import wanted as wanted_svc

    if get_craft(body.craft) is None:
        raise HTTPException(400, "Unknown craft")
    try:
        get_indexer(body.indexer_id)
    except KeyError:
        raise HTTPException(404, "Indexer not found")
    try:
        return await wanted_svc.add_from_indexer(
            body.indexer_id,
            body.external_id,
            craft=body.craft,
            notes=body.notes,
            catalog_ref=body.catalog_ref,
        )
    except Exception as e:
        raise HTTPException(502, f"Could not add to Wanted: {e}") from e


@router.post("/wanted/manual")
async def api_add_wanted_manual(body: WantedManualRequest):
    from pincushion.services import wanted as wanted_svc

    if get_craft(body.craft) is None:
        raise HTTPException(400, "Unknown craft")
    try:
        return await wanted_svc.add_manual(
            craft=body.craft,
            title=body.title,
            catalogue_id=body.catalogue_id,
            vendor_id=body.vendor_id or body.vendor_query or "",
            vendor_query=body.vendor_query or body.vendor_id,
            catalog_ref=body.catalog_ref,
            source_url=body.source_url,
            designer=body.designer,
            notes=body.notes,
            thumbnail_url=body.thumbnail_url,
            image_urls=body.image_urls,
        )
    except KeyError as e:
        raise HTTPException(400, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/wanted/process")
async def api_process_wanted(limit: int = Query(3, ge=1, le=20)):
    from pincushion.services import wanted as wanted_svc

    return await wanted_svc.process_queue(limit=limit)


@router.get("/wanted/{wanted_id}")
def api_get_wanted(wanted_id: int):
    from pincushion.services import wanted as wanted_svc

    item = wanted_svc.get_wanted(wanted_id)
    if not item:
        raise HTTPException(404, "Wanted item not found")
    return item


@router.patch("/wanted/{wanted_id}")
def api_patch_wanted(wanted_id: int, body: WantedUpdateRequest):
    from pincushion.services import wanted as wanted_svc

    try:
        return wanted_svc.update_wanted(
            wanted_id,
            status=body.status.value if body.status else None,
            notes=body.notes,
            catalog_ref=body.catalog_ref,
            pattern_id=body.pattern_id,
        )
    except KeyError:
        raise HTTPException(404, "Wanted item not found")


@router.delete("/wanted/{wanted_id}")
def api_delete_wanted(wanted_id: int):
    from pincushion.services import wanted as wanted_svc

    try:
        wanted_svc.delete_wanted(wanted_id)
    except KeyError:
        raise HTTPException(404, "Wanted item not found")
    return {"deleted": True, "id": wanted_id}


@router.post("/wanted/{wanted_id}/fetch")
async def api_fetch_wanted(wanted_id: int):
    from pincushion.services import wanted as wanted_svc

    try:
        return await wanted_svc.process_one(wanted_id)
    except KeyError:
        raise HTTPException(404, "Wanted item not found")


@router.get("/about")
async def api_about():
    from pincushion.services.about import about_info

    return await about_info()


@router.get("/docs")
def api_list_docs():
    from pincushion.services.docs_catalog import list_docs

    return list_docs()


@router.get("/docs/{doc_id}")
def api_get_doc(doc_id: str):
    from pincushion.services.docs_catalog import get_doc

    try:
        return get_doc(doc_id)
    except KeyError:
        raise HTTPException(404, "Documentation page not found")
    except FileNotFoundError:
        raise HTTPException(404, "Documentation file missing")


@router.get("/craft-files")
def api_list_craft_files():
    return list_crafts()


@router.put("/craft-files/{craft_id}")
def api_update_craft_files(craft_id: str, body: CraftFilesUpdate):
    try:
        return update_craft(
            craft_id,
            label=body.label,
            extensions=body.extensions,
            enabled=body.enabled,
        )
    except KeyError:
        raise HTTPException(404, "Craft not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/supplies")
def api_get_supplies():
    return get_supplies()


@router.put("/supplies")
def api_update_supplies(body: SuppliesUpdate):
    try:
        return update_supplies(floss_brand=body.floss_brand, craft_brands=body.craft_brands)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/materials")
def api_list_materials(
    category: str | None = Query(None),
    q: str | None = Query(None),
):
    from pincushion.services.materials import list_category_counts, list_materials

    return {
        "materials": list_materials(category=category, q=q),
        "counts": list_category_counts(),
    }


@router.get("/materials/brands")
def api_material_brands(category: str = Query("floss")):
    from pincushion.services.materials import list_custom_brands

    return {"category": category, "brands": list_custom_brands(category=category)}


@router.get("/materials/{material_id}")
def api_get_material(material_id: int):
    from pincushion.services.materials import get_material

    detail = get_material(material_id)
    if not detail:
        raise HTTPException(404, "Material not found")
    return detail


@router.post("/materials")
async def api_create_material(
    category: str = Form(...),
    name: str | None = Form(None),
    brand: str | None = Form(None),
    colour_code: str | None = Form(None),
    colour_rgb: str | None = Form(None),
    modifiers: str | None = Form(None),
    quantity: str | None = Form(None),
    length_per_skein: str | None = Form(None),
    notes: str | None = Form(None),
    files: list[UploadFile] | None = File(None),
):
    from pincushion.services.materials import create_material

    uploaded: list[tuple[str, bytes]] = []
    for f in files or []:
        data = await f.read()
        if not data:
            continue
        uploaded.append((f.filename or "upload.bin", data))
    try:
        return create_material(
            category=category,
            name=name,
            brand=brand,
            colour_code=colour_code,
            colour_rgb=colour_rgb,
            modifiers=modifiers,
            quantity=quantity,
            length_per_skein=length_per_skein,
            notes=notes,
            files=uploaded,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/materials/{material_id}")
async def api_update_material(
    material_id: int,
    name: str | None = Form(None),
    brand: str | None = Form(None),
    colour_code: str | None = Form(None),
    colour_rgb: str | None = Form(None),
    modifiers: str | None = Form(None),
    quantity: str | None = Form(None),
    length_per_skein: str | None = Form(None),
    notes: str | None = Form(None),
    files: list[UploadFile] | None = File(None),
):
    from pincushion.services.materials import update_material

    uploaded: list[tuple[str, bytes]] = []
    for f in files or []:
        data = await f.read()
        if not data:
            continue
        uploaded.append((f.filename or "upload.bin", data))
    try:
        return update_material(
            material_id,
            name=name,
            brand=brand,
            colour_code=colour_code,
            colour_rgb=colour_rgb,
            modifiers=modifiers,
            quantity=quantity,
            length_per_skein=length_per_skein,
            notes=notes,
            files=uploaded or None,
        )
    except KeyError:
        raise HTTPException(404, "Material not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.delete("/materials/{material_id}")
def api_delete_material(material_id: int):
    from pincushion.services.materials import delete_material

    try:
        delete_material(material_id)
    except KeyError:
        raise HTTPException(404, "Material not found")
    return {"ok": True}


@router.get("/materials/{material_id}/file/{filename}")
def api_material_file(material_id: int, filename: str):
    from pincushion.services.materials import material_file_path

    try:
        path = material_file_path(material_id, filename)
    except KeyError:
        raise HTTPException(404, "Material not found")
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except PermissionError:
        raise HTTPException(400, "Invalid path")
    return FileResponse(path, filename=path.name)


@router.get("/palette/nearest")
def api_nearest_palette(
    hex: str = Query(..., min_length=6, max_length=7),
    craft: str = Query("cross_stitch", description="Craft id for colour system"),
    brand: str | None = Query(default=None, description="Brand id; defaults to Supplies preference"),
):
    from pincushion.services.craft_palettes import nearest_for_craft, normalize_brand_for_craft, parse_hex_rgb
    from pincushion.services.supplies import get_preferred_brand_for_craft

    try:
        rgb = parse_hex_rgb(hex)
        brand_id = normalize_brand_for_craft(brand, craft) if brand else get_preferred_brand_for_craft(craft)
        number, name, color = nearest_for_craft(rgb, craft, brand=brand_id)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {
        "number": number,
        "name": name,
        "color": color,
        "brand": brand_id,
        "craft": craft,
        "rgb": [int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)],
    }


@router.get("/floss/by-number")
def api_floss_by_number(
    number: str = Query(..., min_length=1, max_length=40),
    brand: str | None = Query(default=None, description="Floss brand id; defaults to Supplies preference"),
):
    """Look up a catalogue floss by colour code. Returns known=false when not in the palette."""
    from pincushion.services.floss_catalog import lookup_floss_by_number, normalize_floss_brand

    brand_id = normalize_floss_brand(brand) if brand else get_preferred_floss_brand()
    hit = lookup_floss_by_number(number, brand=brand_id)
    if not hit:
        return {"known": False, "brand": brand_id, "number": number.strip()}
    return {"known": True, **hit}


@router.get("/floss/suggest")
def api_floss_suggest(
    q: str = Query("", max_length=40),
    brand: str | None = Query(default=None, description="Floss brand id; defaults to Supplies preference"),
    limit: int = Query(12, ge=1, le=40),
):
    """Autocomplete colour codes / names for brands with a built-in palette."""
    from pincushion.services.floss_catalog import normalize_floss_brand, suggest_floss

    brand_id = normalize_floss_brand(brand) if brand else get_preferred_floss_brand()
    return {
        "brand": brand_id,
        "q": q,
        "suggestions": suggest_floss(q, brand=brand_id, limit=limit),
    }


@router.get("/floss/nearest")
def api_nearest_floss(
    hex: str = Query(..., min_length=6, max_length=7),
    brand: str | None = Query(default=None, description="Floss brand id; defaults to Supplies preference"),
    craft: str | None = Query(default=None, description="Optional craft id — uses craft palette when set"),
):
    if craft:
        return api_nearest_palette(hex=hex, craft=craft, brand=brand)
    from pincushion.services.floss_catalog import nearest_floss, normalize_floss_brand, parse_hex_rgb

    try:
        rgb = parse_hex_rgb(hex)
        brand_id = normalize_floss_brand(brand) if brand else get_preferred_floss_brand()
        number, name, color = nearest_floss(rgb, brand=brand_id)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {
        "number": number,
        "name": name,
        "color": color,
        "brand": brand_id,
        "rgb": [int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)],
    }


@router.get("/dmc/nearest")
def api_nearest_dmc(hex: str = Query(..., min_length=6, max_length=7)):
    """Back-compat alias — uses preferred Supplies brand (not hard-coded DMC)."""
    return api_nearest_floss(hex=hex, brand=None)


@router.get("/search", response_model=SearchResponse)
async def api_search(
    q: str = Query("", min_length=0),
    indexer_id: str = Query("internet_archive"),
    craft: str = Query("cross_stitch"),
    limit: int = Query(30, ge=1, le=50),
):
    if get_craft(craft) is None:
        raise HTTPException(400, "Unknown craft")
    if indexer_id == "all":
        per_source = max(1, limit)
        sources = [
            idx
            for idx in list_indexers()
            if idx.capabilities.search_enabled
            and idx.capabilities.status.value != "planned"
            and is_indexer_enabled_for_craft(idx.id, craft)
        ]

        async def _one(idx):
            try:
                return await idx.search(q, limit=per_source, craft=craft)
            except Exception:
                return []

        hit_lists = await asyncio.gather(*[_one(idx) for idx in sources])
        merged = fair_merge_hits(list(hit_lists), limit)
        return SearchResponse(query=q, indexer_id="all", craft=craft, results=merged)

    try:
        indexer = get_indexer(indexer_id)
    except KeyError:
        raise HTTPException(404, "Indexer not found")
    if not indexer.capabilities.search_enabled:
        raise HTTPException(400, "This indexer does not support search")
    if not is_indexer_enabled_for_craft(indexer_id, craft):
        raise HTTPException(400, "This indexer is disabled for the selected craft")
    try:
        results = await indexer.search(q, limit=limit, craft=craft)
    except Exception as e:
        raise HTTPException(502, f"Search failed: {e}") from e
    return SearchResponse(query=q, indexer_id=indexer_id, craft=craft, results=results)


@router.get("/external/{indexer_id}/{external_id:path}")
async def api_external_detail(
    indexer_id: str,
    external_id: str,
    craft: str = Query("cross_stitch"),
):
    try:
        indexer = get_indexer(indexer_id)
    except KeyError:
        raise HTTPException(404, "Indexer not found")
    return await indexer.get_pattern(external_id, craft=craft)


@router.get("/patterns")
def api_list_patterns(
    downloaded: bool | None = None,
    craft: str | None = Query(None, description="Craft id, or 'other' for non primary crafts"),
    limit: int = Query(100, ge=1, le=5000),
):
    return catalog.list_patterns(downloaded_only=downloaded, craft=craft, limit=limit)


@router.delete("/patterns/{pattern_id}")
def api_delete_pattern(pattern_id: int):
    try:
        catalog.delete_pattern(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    return {"deleted": True, "pattern_id": pattern_id}


@router.get("/patterns/{pattern_id}/pdf-info")
def api_pdf_info(pattern_id: int):
    try:
        return catalog.pdf_info(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/patterns/{pattern_id}/raster-preview")
def api_raster_preview(pattern_id: int, page: int = Query(1, ge=1)):
    try:
        data = catalog.raster_preview_jpeg(pattern_id, pdf_page=page)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return Response(content=data, media_type="image/jpeg")


@router.post("/patterns/{pattern_id}/convert-chart")
def api_convert_pattern_chart(pattern_id: int, body: ConvertChartRequest | None = None):
    crop = body.crop if body else None
    pdf_page = body.pdf_page if body else None
    symbol_mode = body.symbol_mode if body else None
    try:
        message = catalog.convert_pattern_to_chart(
            pattern_id, crop=crop, pdf_page=pdf_page, symbol_mode=symbol_mode
        )
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"pattern_id": pattern_id, "message": message}


@router.post("/patterns/{pattern_id}/regenerate-package")
def api_regenerate_package(pattern_id: int, body: RegeneratePackageRequest | None = None):
    symbol_mode = body.symbol_mode if body else None
    try:
        message = catalog.regenerate_pattern_package(pattern_id, symbol_mode=symbol_mode)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"pattern_id": pattern_id, "message": message}


@router.post("/patterns/blank")
def api_create_blank_pattern(body: BlankPatternRequest):
    """Create an empty chart or yarn-craft instruction project."""
    craft = (body.craft or "cross_stitch").strip() or "cross_stitch"
    from pincushion.services.craft_files import CHART_CRAFTS

    if craft not in CHART_CRAFTS and craft not in ("crochet", "knitting"):
        raise HTTPException(
            400,
            "Blank projects are only supported for chart crafts (incl. pixel crafts), crochet, and knitting",
        )
    try:
        detail = catalog.create_blank_pattern(
            title=body.title,
            width=body.width,
            height=body.height,
            craft=craft,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return detail


def _yarn_craft_or_404(pattern_id: int, expected: str):
    from pincushion.services import yarn_pattern as yarn_svc

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, craft FROM patterns WHERE id = ?", (pattern_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Pattern not found")
    if row["craft"] != expected:
        raise HTTPException(400, f"This editor is only available for {expected} patterns")
    return row, yarn_svc


@router.get("/patterns/{pattern_id}/embroidery")
def api_get_embroidery(pattern_id: int):
    from pincushion.services import embroidery as emb_svc

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, craft FROM patterns WHERE id = ?", (pattern_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Pattern not found")
    if row["craft"] not in ("embroidery", "quilting"):
        raise HTTPException(400, "Embroidery viewer is only for embroidery/quilting patterns")
    try:
        meta = emb_svc.get_or_process(pattern_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    lib = settings.library_dir / str(pattern_id)
    return {
        **meta,
        "preview_png_url": f"/api/patterns/{pattern_id}/embroidery/preview.png"
        if (lib / emb_svc.PREVIEW_PNG).is_file()
        else None,
        "preview_svg_url": f"/api/patterns/{pattern_id}/embroidery/preview.svg"
        if (lib / emb_svc.PREVIEW_SVG).is_file()
        else None,
    }


@router.get("/patterns/{pattern_id}/embroidery/preview.png")
def api_embroidery_preview_png(pattern_id: int):
    from pincushion.services import embroidery as emb_svc

    path = settings.library_dir / str(pattern_id) / emb_svc.PREVIEW_PNG
    if not path.is_file():
        try:
            emb_svc.get_or_process(pattern_id)
        except Exception:
            pass
    if not path.is_file():
        raise HTTPException(404, "No embroidery preview")
    return FileResponse(path, media_type="image/png")


@router.get("/patterns/{pattern_id}/embroidery/preview.svg")
def api_embroidery_preview_svg(pattern_id: int):
    from pincushion.services import embroidery as emb_svc

    path = settings.library_dir / str(pattern_id) / emb_svc.PREVIEW_SVG
    if not path.is_file():
        try:
            emb_svc.get_or_process(pattern_id)
        except Exception:
            pass
    if not path.is_file():
        raise HTTPException(404, "No embroidery SVG preview")
    return FileResponse(path, media_type="image/svg+xml")


@router.post("/patterns/{pattern_id}/embroidery/extract")
def api_embroidery_extract(pattern_id: int):
    from pincushion.services import embroidery as emb_svc

    with get_conn() as conn:
        row = conn.execute("SELECT id, craft FROM patterns WHERE id = ?", (pattern_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Pattern not found")
    if row["craft"] not in ("embroidery", "quilting"):
        raise HTTPException(400, "Only embroidery/quilting patterns support machine parse")
    try:
        return emb_svc.process_machine_file(pattern_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/patterns/{pattern_id}/origami")
def api_get_origami(pattern_id: int):
    from pincushion.services import origami as ori_svc
    from pincushion.services import origami_steps as steps_svc

    with get_conn() as conn:
        row = conn.execute("SELECT id, craft FROM patterns WHERE id = ?", (pattern_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Pattern not found")
    if row["craft"] != "origami":
        raise HTTPException(400, "Origami viewer is only for origami patterns")
    meta = None
    fold = None
    frames: list = []
    try:
        meta = ori_svc.get_or_process(pattern_id)
        fold_path = ori_svc.find_fold_file(pattern_id)
        fold = ori_svc.load_fold(fold_path) if fold_path else None
        frames = ori_svc.collect_fold_frames(fold) if fold else []
    except (FileNotFoundError, ValueError):
        meta = {
            "format": "pincushion_origami_v1",
            "frame_title": None,
            "vertex_count": 0,
            "edge_count": 0,
            "face_count": 0,
            "frame_count": 0,
            "assignment_counts": {},
        }
    return {
        "meta": meta,
        "fold": fold,
        "frames": frames,
        "preview_svg_url": f"/api/patterns/{pattern_id}/origami/preview.svg",
        "steps": steps_svc.enrich_steps_for_api(pattern_id, steps_svc.load_steps(pattern_id)),
    }


@router.get("/patterns/{pattern_id}/origami/preview.svg")
def api_origami_preview_svg(pattern_id: int):
    from pincushion.services import origami as ori_svc

    path = settings.library_dir / str(pattern_id) / ori_svc.PREVIEW_SVG
    if not path.is_file():
        try:
            ori_svc.get_or_process(pattern_id)
        except Exception:
            pass
    if not path.is_file():
        raise HTTPException(404, "No origami preview")
    return FileResponse(path, media_type="image/svg+xml")


@router.post("/patterns/{pattern_id}/origami/extract")
def api_origami_extract(pattern_id: int):
    from pincushion.services import origami as ori_svc

    with get_conn() as conn:
        row = conn.execute("SELECT id, craft FROM patterns WHERE id = ?", (pattern_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Pattern not found")
    if row["craft"] != "origami":
        raise HTTPException(400, "Only origami patterns support FOLD extract")
    try:
        return ori_svc.process_fold(pattern_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/patterns/{pattern_id}/origami/steps")
def api_get_origami_steps(pattern_id: int):
    from pincushion.services import origami_steps as steps_svc

    try:
        steps_svc.assert_origami_pattern(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return steps_svc.enrich_steps_for_api(pattern_id, steps_svc.load_steps(pattern_id))


@router.put("/patterns/{pattern_id}/origami/steps")
async def api_save_origami_steps(pattern_id: int, body: dict):
    from pincushion.services import origami_steps as steps_svc

    try:
        steps_svc.assert_origami_pattern(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    saved = steps_svc.save_steps(pattern_id, body if isinstance(body, dict) else {})
    return steps_svc.enrich_steps_for_api(pattern_id, saved)


@router.post("/patterns/{pattern_id}/origami/steps/media")
async def api_upload_origami_step_media(pattern_id: int, file: UploadFile = File(...)):
    from pincushion.services import origami_steps as steps_svc

    try:
        steps_svc.assert_origami_pattern(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty upload")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 25MB)")
    name = steps_svc.save_step_media(pattern_id, file.filename or "step.bin", data)
    return {
        "media": name,
        "preview_url": f"/api/patterns/{pattern_id}/origami/steps/media/{name}",
    }


@router.get("/patterns/{pattern_id}/origami/steps/media/{name}")
def api_origami_step_media(pattern_id: int, name: str):
    from pincushion.services import origami_steps as steps_svc

    try:
        steps_svc.assert_origami_pattern(pattern_id)
        path = steps_svc.resolve_media_path(pattern_id, name)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileNotFoundError:
        raise HTTPException(404, "Media not found")
    import mimetypes

    mime, _ = mimetypes.guess_type(path.name)
    return FileResponse(path, media_type=mime or "application/octet-stream", filename=path.name)


@router.get("/patterns/{pattern_id}/file/{file_id}/preview.jpg")
def api_pattern_file_preview(pattern_id: int, file_id: int, page: int = Query(1, ge=1)):
    """Raster preview for a specific pattern file (images or PDF page)."""
    import io

    from pincushion.services.image_to_oxs import raster_preview_image

    with get_conn() as conn:
        row = conn.execute(
            "SELECT path, filename FROM pattern_files WHERE id = ? AND pattern_id = ?",
            (file_id, pattern_id),
        ).fetchone()
    if not row:
        raise HTTPException(404, "File not found")
    path = Path(row["path"])
    if not path.is_file():
        # Fallback: library dir + filename
        alt = settings.library_dir / str(pattern_id) / (row["filename"] or "")
        path = alt if alt.is_file() else path
    if not path.is_file():
        raise HTTPException(404, "File missing on disk")
    try:
        im = raster_preview_image(path, max_side=1200, pdf_page=max(0, page - 1))
    except Exception as e:
        raise HTTPException(400, f"Could not preview file: {e}") from e
    buf = io.BytesIO()
    im.convert("RGB").save(buf, format="JPEG", quality=88, optimize=True)
    return Response(content=buf.getvalue(), media_type="image/jpeg")


@router.get("/patterns/{pattern_id}/crochet")
def api_get_crochet(pattern_id: int):
    from pincushion.services import yarn_pattern as yarn_svc

    try:
        return yarn_svc.get_or_extract(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/patterns/{pattern_id}/crochet/extract")
def api_extract_crochet(pattern_id: int):
    from pincushion.services import yarn_pattern as yarn_svc

    try:
        _yarn_craft_or_404(pattern_id, "crochet")
        return yarn_svc.extract_from_pdf(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.put("/patterns/{pattern_id}/crochet")
def api_save_crochet(pattern_id: int, body: YarnSaveRequest):
    row, yarn_svc = _yarn_craft_or_404(pattern_id, "crochet")
    existing = yarn_svc.load_document(pattern_id, "crochet") or yarn_svc.empty_document("crochet")
    supplies = body.supplies.model_dump() if body.supplies is not None else existing.get("supplies")
    dialect = (supplies or {}).get("terminology") or body.dialect or "US"
    doc = {
        **existing,
        "title": body.title or row["title"] or existing.get("title") or "Untitled",
        "dialect": dialect,
        "lines": body.lines,
        "supplies": supplies,
    }
    return yarn_svc.save_document(pattern_id, "crochet", doc)


@router.get("/patterns/{pattern_id}/knitting")
def api_get_knitting(pattern_id: int):
    from pincushion.services import yarn_pattern as yarn_svc

    try:
        return yarn_svc.get_or_extract(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/patterns/{pattern_id}/knitting/extract")
def api_extract_knitting(pattern_id: int):
    from pincushion.services import yarn_pattern as yarn_svc

    try:
        _yarn_craft_or_404(pattern_id, "knitting")
        return yarn_svc.extract_from_pdf(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.put("/patterns/{pattern_id}/knitting")
def api_save_knitting(pattern_id: int, body: YarnSaveRequest):
    row, yarn_svc = _yarn_craft_or_404(pattern_id, "knitting")
    existing = yarn_svc.load_document(pattern_id, "knitting") or yarn_svc.empty_document("knitting")
    supplies = body.supplies.model_dump() if body.supplies is not None else existing.get("supplies")
    dialect = (supplies or {}).get("terminology") or body.dialect or "US"
    doc = {
        **existing,
        "title": body.title or row["title"] or existing.get("title") or "Untitled",
        "dialect": dialect,
        "lines": body.lines,
        "supplies": supplies,
    }
    return yarn_svc.save_document(pattern_id, "knitting", doc)


@router.get("/patterns/{pattern_id}")
def api_pattern_detail(pattern_id: int):
    detail = catalog.get_pattern_detail(pattern_id)
    if not detail:
        raise HTTPException(404, "Pattern not found")
    return detail


@router.get("/patterns/{pattern_id}/torrent")
def api_pattern_torrent(pattern_id: int):
    try:
        payload, filename, _info_hash, _total = catalog.build_pattern_torrent(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return Response(
        content=payload,
        media_type="application/x-bittorrent",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/patterns/{pattern_id}/magnet")
def api_pattern_magnet(pattern_id: int):
    try:
        return catalog.build_pattern_magnet(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/patterns/{pattern_id}/zip")
def api_pattern_zip(pattern_id: int):
    try:
        payload, filename = catalog.build_pattern_zip(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return Response(
        content=payload,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/patterns/{pattern_id}")
def api_update_pattern(pattern_id: int, body: PatternUpdate):
    try:
        return catalog.update_pattern(
            pattern_id,
            title=body.title,
            description=body.description,
            license_class=body.license_class,
            source_url=body.source_url,
        )
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/patterns/{pattern_id}/chart")
def api_save_chart(pattern_id: int, body: ChartSaveRequest):
    try:
        return catalog.save_chart(pattern_id, body)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/patterns/{pattern_id}/thumbnail")
def api_pattern_thumbnail(pattern_id: int):
    from pincushion.main import STATIC_DIR

    try:
        path = catalog.ensure_thumbnail(pattern_id)
    except KeyError:
        raise HTTPException(404, "Pattern not found")
    if path and path.is_file():
        return FileResponse(path, media_type="image/jpeg")
    # Fall back to PinCushion logo so library cards never show a broken image.
    placeholder = STATIC_DIR / "placeholder.svg"
    if placeholder.is_file():
        return FileResponse(placeholder, media_type="image/svg+xml")
    raise HTTPException(404, "No thumbnail")


@router.get("/patterns/{pattern_id}/files")
def api_pattern_files(pattern_id: int):
    catalog.ensure_chart_export(pattern_id)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, filename, mime_type, role, size_bytes FROM pattern_files WHERE pattern_id = ?",
            (pattern_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.patch("/patterns/{pattern_id}/files/{file_id}")
def api_rename_pattern_file(pattern_id: int, file_id: int, body: FileRenameRequest):
    try:
        return catalog.rename_pattern_file(pattern_id, file_id, body.filename)
    except KeyError:
        raise HTTPException(404, "File not found")
    except FileNotFoundError:
        raise HTTPException(404, "File missing on disk")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/patterns/{pattern_id}/file/{file_id}")
def api_pattern_file(pattern_id: int, file_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT path, mime_type, filename FROM pattern_files WHERE id = ? AND pattern_id = ?",
            (file_id, pattern_id),
        ).fetchone()
    if not row:
        raise HTTPException(404, "File not found")
    path = Path(row["path"])
    if not path.is_file():
        raise HTTPException(404, "File missing on disk")
    mime = row["mime_type"] or ""
    if not mime or mime == "application/octet-stream":
        mime = guess_mime(row["filename"] or path.name)
    return FileResponse(path, media_type=mime, filename=row["filename"])


@router.get("/patterns/{pattern_id}/normalized")
def api_pattern_normalized(pattern_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT normalized_path FROM patterns WHERE id = ?", (pattern_id,)
        ).fetchone()
    if not row or not row["normalized_path"]:
        raise HTTPException(404, "No normalized pattern")
    path = Path(row["normalized_path"])
    if not path.is_file():
        raise HTTPException(404, "Normalized file missing")
    from pincushion.parsers.oxs import normalized_from_dict

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(500, "Normalized file unreadable") from exc
    # Expand implied TR/BR companions (Ursa often stores only the left half of a peak).
    return JSONResponse(normalized_from_dict(raw).to_dict())


@router.get("/patterns/{pattern_id}/project")
def api_get_project(pattern_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT status, progress_json, started_at, finished_at, updated_at FROM projects WHERE pattern_id = ?",
            (pattern_id,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Project not found")
    return {
        "pattern_id": pattern_id,
        "status": row["status"],
        "progress_json": json.loads(row["progress_json"] or "{}"),
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
        "updated_at": row["updated_at"],
    }


@router.patch("/patterns/{pattern_id}/project")
def api_update_project(pattern_id: int, body: ProjectUpdate):
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT status FROM projects WHERE pattern_id = ?", (pattern_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Project not found")
        status = body.status.value if body.status else row["status"]
        progress = body.progress_json
        if progress is None:
            progress = json.loads(
                conn.execute(
                    "SELECT progress_json FROM projects WHERE pattern_id = ?", (pattern_id,)
                ).fetchone()["progress_json"]
                or "{}"
            )
        started = conn.execute(
            "SELECT started_at FROM projects WHERE pattern_id = ?", (pattern_id,)
        ).fetchone()["started_at"]
        finished_at = conn.execute(
            "SELECT finished_at FROM projects WHERE pattern_id = ?", (pattern_id,)
        ).fetchone()["finished_at"]
        if status == ProjectStatus.IN_PROGRESS.value and not started:
            started = now
        if status == ProjectStatus.FINISHED.value:
            finished_at = now
        conn.execute(
            """
            UPDATE projects SET status = ?, progress_json = ?, started_at = ?, finished_at = ?, updated_at = ?
            WHERE pattern_id = ?
            """,
            (status, json.dumps(progress), started, finished_at, now, pattern_id),
        )
    return api_get_project(pattern_id)


async def _import_upload_file(
    file: UploadFile,
    *,
    craft: str,
) -> ImportResult:
    import re
    import tempfile

    if get_craft(craft) is None:
        raise HTTPException(400, "Unknown craft")
    raw_name = file.filename or "upload"
    # Keep the original basename so WebP/PNG uploads are stored as fox.webp, not tmpXXXX.webp.
    safe_name = Path(raw_name).name
    safe_name = re.sub(r"[^\w.\- ()[\]]+", "_", safe_name).strip("._") or "upload"
    if not Path(safe_name).suffix and Path(raw_name).suffix:
        safe_name = f"{safe_name}{Path(raw_name).suffix.lower()}"
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / safe_name
        tmp_path.write_bytes(content)
        with get_conn() as conn:
            pid, dup, msg = import_local_file(
                conn,
                tmp_path,
                title=Path(safe_name).stem,
                craft=craft,
            )
    if dup:
        return ImportResult(pattern_id=None, duplicate_of=dup, message=msg)
    return ImportResult(pattern_id=pid, duplicate_of=None, message=msg)


@router.post("/import/upload", response_model=ImportResult)
async def api_upload(
    file: UploadFile = File(...),
    craft: str = Form("cross_stitch"),
):
    return await _import_upload_file(file, craft=craft)


@router.post("/import/upload-many")
async def api_upload_many(
    files: list[UploadFile] = File(...),
    craft: str = Form("cross_stitch"),
):
    if not files:
        raise HTTPException(400, "No files provided")
    results: list[ImportResult] = []
    for file in files:
        results.append(await _import_upload_file(file, craft=craft))
    return results


@router.post("/import/from-indexer", response_model=ImportResult)
async def api_import_from_indexer(body: ImportFromIndexer):
    if get_craft(body.craft) is None:
        raise HTTPException(400, "Unknown craft")
    try:
        get_indexer(body.indexer_id)
    except KeyError:
        raise HTTPException(404, "Indexer not found")
    try:
        return await import_from_indexer(body.indexer_id, body.external_id, craft=body.craft)
    except KeyError:
        raise HTTPException(404, "Pattern not found on source")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Import failed: {e}") from e


@router.post("/import/sample-oxs", response_model=ImportResult)
def api_import_sample_oxs():
    sample = settings.samples_dir / "sample.oxs"
    if not sample.is_file():
        raise HTTPException(404, "Sample OXS not bundled")
    with get_conn() as conn:
        pid, dup, msg = import_local_file(
            conn, sample, title="PinCushion Sample (OXS)", license_class=LicenseClass.UNKNOWN
        )
    if dup:
        return ImportResult(pattern_id=None, duplicate_of=dup, message=msg)
    return ImportResult(pattern_id=pid, duplicate_of=None, message=msg)
