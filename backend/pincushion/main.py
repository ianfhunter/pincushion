import logging
from contextlib import asynccontextmanager
from pathlib import Path

import asyncio

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from pincushion import __version__
from pincushion.api.routes import router as api_router
from pincushion.db import init_db
from pincushion.indexers.registry import bootstrap_indexers, shutdown_indexers
from pincushion.services import catalog
from pincushion.services.craft_files import init_craft_files
from pincushion.services.indexer_craft import init_indexer_craft
from pincushion.services.supplies import init_supplies
from pincushion.services.materials import init_materials_table
from pincushion.services.wanted import init_wanted_table
from pincushion.services.wanted_worker import wanted_worker_loop

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pincushion")

STATIC_DIR = Path(__file__).resolve().parent / "static"

_FALLBACK_404_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 · PinCushion</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family:system-ui,sans-serif; background:#f4f0ea; color:#1a1a1a; padding:1.5rem; }
    .card { width:min(36rem,100%); background:#fff; border:1px solid #ddd5c8; border-radius:12px;
      padding:2.5rem 1.75rem; text-align:center; }
    .code { margin:0; font-size:4.5rem; font-weight:700; line-height:1; color:#2d4a3e; }
    h1 { margin:.25rem 0 .75rem; }
    .meta { color:#666; }
    a { color:#2d4a3e; font-weight:600; }
  </style>
</head>
<body>
  <main class="card">
    <p class="code">404</p>
    <h1>Page not found</h1>
    <p class="meta">No page at <code>__PATH__</code>.</p>
    <p><a href="/">Back to PinCushion</a></p>
  </main>
</body>
</html>
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_craft_files()
    init_supplies()
    bootstrap_indexers()
    init_indexer_craft()
    init_wanted_table()
    init_materials_table()
    catalog.seed_indexers()
    stop = asyncio.Event()
    worker = asyncio.create_task(wanted_worker_loop(stop), name="wanted-worker")
    log.info("PinCushion %s started", __version__)
    yield
    stop.set()
    await worker
    await shutdown_indexers()


app = FastAPI(title="PinCushion", version=__version__, lifespan=lifespan)
app.include_router(api_router)


def _html_404(path: str) -> HTMLResponse:
    page = STATIC_DIR / "404.html"
    if page.is_file():
        html = page.read_text(encoding="utf-8")
        # Keep the static page's client-side path script; also fine as-is.
        return HTMLResponse(html, status_code=404)
    return HTMLResponse(_FALLBACK_404_HTML.replace("__PATH__", path or "/"), status_code=404)


@app.exception_handler(StarletteHTTPException)
async def pincushion_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code != 404:
        return await http_exception_handler(request, exc)
    path = request.url.path or "/"
    if path.startswith("/api"):
        detail = exc.detail if isinstance(exc.detail, (str, dict, list)) else "Not found"
        return JSONResponse({"detail": detail}, status_code=404)
    return _html_404(path)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"message": "PinCushion API — build frontend into pincushion/static"}


def _static_file(name: str, media_type: str | None = None) -> FileResponse:
    path = STATIC_DIR / name
    if not path.is_file():
        from fastapi import HTTPException

        raise HTTPException(404, f"{name} not found")
    return FileResponse(path, media_type=media_type)


@app.get("/favicon.svg")
def favicon_svg():
    return _static_file("favicon.svg", "image/svg+xml")


@app.get("/favicon.ico")
def favicon_ico():
    return _static_file("favicon.ico", "image/x-icon")


@app.get("/apple-touch-icon.png")
def apple_touch_icon():
    return _static_file("apple-touch-icon.png", "image/png")


@app.get("/favicon-32.png")
def favicon_32():
    return _static_file("favicon-32.png", "image/png")


@app.get("/placeholder.svg")
def placeholder_svg():
    """Library card fallback when a pattern has no thumbnail."""
    return _static_file("placeholder.svg", "image/svg+xml")


@app.get("/floss-skein-thread-mask.png")
def floss_skein_thread_mask():
    """Alpha mask for the thread body of the floss library icon."""
    return _static_file("floss-skein-thread-mask.png", "image/png")


@app.get("/floss-skein-outline-mask.png")
def floss_skein_outline_mask():
    """Alpha mask for black thread outlines on the floss library icon."""
    return _static_file("floss-skein-outline-mask.png", "image/png")


@app.get("/floss-skein-paper-mask.png")
def floss_skein_paper_mask():
    """Alpha mask for the paper bands of the floss library icon."""
    return _static_file("floss-skein-paper-mask.png", "image/png")


if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
