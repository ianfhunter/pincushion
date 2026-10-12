"""Manual / imported origami diagram steps (images or PDF pages)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

import yaml

from pincushion.config import settings
from pincushion.db import get_conn

STEPS_FORMAT = "pincushion_origami_steps_v1"
STEPS_FILENAME = "origami_steps.yaml"
STEPS_DIRNAME = "steps"

_SAFE_MEDIA = re.compile(r"^[A-Za-z0-9._-]{1,120}$")


def steps_path(pattern_id: int) -> Path:
    return settings.library_dir / str(pattern_id) / STEPS_FILENAME


def steps_media_dir(pattern_id: int) -> Path:
    return settings.library_dir / str(pattern_id) / STEPS_DIRNAME


def empty_steps_doc() -> dict[str, Any]:
    return {"format": STEPS_FORMAT, "steps": []}


def _normalize_step(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    sid = str(raw.get("id") or uuid.uuid4().hex[:10]).strip()[:40] or uuid.uuid4().hex[:10]
    title = str(raw.get("title") or "").strip()[:200]
    notes = str(raw.get("notes") or "").strip()[:4000]
    media = str(raw.get("media") or "").strip()
    if media and not _SAFE_MEDIA.match(media):
        media = ""
    file_id = raw.get("file_id")
    try:
        file_id_i = int(file_id) if file_id is not None and str(file_id).strip() != "" else None
    except (TypeError, ValueError):
        file_id_i = None
    pdf_page = raw.get("pdf_page")
    try:
        pdf_page_i = int(pdf_page) if pdf_page is not None and str(pdf_page).strip() != "" else None
    except (TypeError, ValueError):
        pdf_page_i = None
    if pdf_page_i is not None and pdf_page_i < 1:
        pdf_page_i = 1
    return {
        "id": sid,
        "title": title,
        "notes": notes,
        "media": media,
        "file_id": file_id_i,
        "pdf_page": pdf_page_i,
    }


def normalize_steps_doc(raw: Any) -> dict[str, Any]:
    doc = empty_steps_doc()
    if not isinstance(raw, dict):
        return doc
    steps_in = raw.get("steps")
    if not isinstance(steps_in, list):
        return doc
    out: list[dict[str, Any]] = []
    for item in steps_in:
        step = _normalize_step(item)
        if step:
            out.append(step)
    doc["steps"] = out
    return doc


def load_steps(pattern_id: int) -> dict[str, Any]:
    path = steps_path(pattern_id)
    if not path.is_file():
        return empty_steps_doc()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError):
        return empty_steps_doc()
    return normalize_steps_doc(data)


def save_steps(pattern_id: int, doc: dict[str, Any]) -> dict[str, Any]:
    stored = normalize_steps_doc(doc)
    path = steps_path(pattern_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(stored, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    return stored


def step_preview_url(pattern_id: int, step: dict[str, Any]) -> str | None:
    media = step.get("media") or ""
    if media:
        return f"/api/patterns/{pattern_id}/origami/steps/media/{media}"
    file_id = step.get("file_id")
    if file_id is not None:
        page = step.get("pdf_page")
        if page:
            return f"/api/patterns/{pattern_id}/file/{int(file_id)}/preview.jpg?page={int(page)}"
        return f"/api/patterns/{pattern_id}/file/{int(file_id)}"
    return None


def enrich_steps_for_api(pattern_id: int, doc: dict[str, Any]) -> dict[str, Any]:
    steps = []
    for s in doc.get("steps") or []:
        row = dict(s)
        row["preview_url"] = step_preview_url(pattern_id, s)
        steps.append(row)
    return {"format": STEPS_FORMAT, "steps": steps}


def save_step_media(pattern_id: int, filename: str, data: bytes) -> str:
    """Save uploaded bytes under steps/; return safe filename."""
    name = Path(filename or "step.bin").name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).stem)[:60] or "step"
    suf = Path(name).suffix.lower()
    if suf not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"}:
        suf = ".bin"
    out_name = f"{stem}-{uuid.uuid4().hex[:8]}{suf}"
    if not _SAFE_MEDIA.match(out_name):
        out_name = f"step-{uuid.uuid4().hex[:8]}{suf}"
    dest_dir = steps_media_dir(pattern_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / out_name
    dest.write_bytes(data)
    return out_name


def resolve_media_path(pattern_id: int, name: str) -> Path:
    if not _SAFE_MEDIA.match(name):
        raise FileNotFoundError("Invalid media name")
    path = steps_media_dir(pattern_id) / name
    if not path.is_file():
        raise FileNotFoundError(name)
    # Stay inside steps dir.
    if path.resolve().parent != steps_media_dir(pattern_id).resolve():
        raise FileNotFoundError(name)
    return path


def assert_origami_pattern(pattern_id: int) -> None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, craft FROM patterns WHERE id = ?", (pattern_id,)
        ).fetchone()
    if not row:
        raise KeyError(pattern_id)
    if row["craft"] != "origami":
        raise ValueError("Steps editor is only available for origami patterns")
