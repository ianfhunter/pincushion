"""Shared instruction-line + supplies helpers for crochet and knitting patterns."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import fitz
import yaml

from pincushion.config import settings
from pincushion.db import get_conn

YARN_CRAFTS = frozenset({"crochet", "knitting"})
YARN_FORMAT = "pincushion_yarn_v1"

_CRAFT_META = {
    "crochet": {
        "filename": "crochet.yaml",
        "legacy_filename": "crochet.json",
        "format": YARN_FORMAT,
    },
    "knitting": {
        "filename": "knitting.yaml",
        "legacy_filename": "knitting.json",
        "format": YARN_FORMAT,
    },
}

_JUNK_LINE = re.compile(
    r"^(page\s*\d+|©|copyright|all rights reserved|www\.|https?://|\d+\s*/\s*\d+)\s*$",
    re.IGNORECASE,
)


def assert_yarn_craft(craft: str) -> str:
    craft = (craft or "").strip()
    if craft not in YARN_CRAFTS:
        raise ValueError("Instruction editor is only available for crochet and knitting")
    return craft


def pattern_filename(craft: str) -> str:
    return _CRAFT_META[assert_yarn_craft(craft)]["filename"]


def pattern_format(craft: str) -> str:
    return _CRAFT_META[assert_yarn_craft(craft)]["format"]


def yarn_path(pattern_id: int, craft: str) -> Path:
    """Preferred YAML path (may not exist yet)."""
    return settings.library_dir / str(pattern_id) / pattern_filename(craft)


def find_yarn_document_path(pattern_id: int, craft: str) -> Path | None:
    """Return existing YAML or legacy JSON path."""
    craft = assert_yarn_craft(craft)
    lib = settings.library_dir / str(pattern_id)
    yaml_path = lib / _CRAFT_META[craft]["filename"]
    if yaml_path.is_file():
        return yaml_path
    legacy = lib / _CRAFT_META[craft]["legacy_filename"]
    if legacy.is_file():
        return legacy
    return None


def empty_supplies(*, terminology: str = "US") -> dict[str, Any]:
    term = terminology if terminology in {"US", "UK", "unknown"} else "US"
    return {
        "terminology": term,
        "hook_size": "",
        "needle_size": "",
        "yarns": [],
        # Legacy single-yarn mirrors (kept in sync with yarns[0] for older docs).
        "yarn": "",
        "yarn_amount": "",
        "gauge": "",
        "notions": "",
        "notes": "",
    }


def _normalize_yarn_entries(raw: Any) -> list[dict[str, str]]:
    yarns: list[dict[str, str]] = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                name = str(item.get("name") or item.get("yarn") or "").strip()[:500]
                amount = str(item.get("amount") or item.get("yarn_amount") or "").strip()[:500]
                if name or amount:
                    yarns.append({"name": name, "amount": amount})
            elif isinstance(item, str) and item.strip():
                yarns.append({"name": item.strip()[:500], "amount": ""})
    return yarns


def normalize_supplies(raw: Any) -> dict[str, Any]:
    base = empty_supplies()
    if not isinstance(raw, dict):
        return base
    for key in ("terminology", "hook_size", "needle_size", "yarn", "yarn_amount", "gauge", "notions", "notes"):
        val = raw.get(key)
        if val is None:
            continue
        text = str(val).strip()
        if key == "terminology":
            upper = text.upper()
            if upper in {"US", "UK"}:
                base[key] = upper
            elif text.lower() == "unknown":
                base[key] = "unknown"
            else:
                base[key] = "US"
        else:
            base[key] = text[:500]
    yarns = _normalize_yarn_entries(raw.get("yarns"))
    if not yarns and (base["yarn"] or base["yarn_amount"]):
        yarns = [{"name": base["yarn"], "amount": base["yarn_amount"]}]
    base["yarns"] = yarns
    base["yarn"] = yarns[0]["name"] if yarns else ""
    base["yarn_amount"] = yarns[0]["amount"] if yarns else ""
    return base


def empty_confidence() -> dict[str, Any]:
    return {
        "global": 0,
        "level": "low",
        "by_section": {},
        "structured_steps": 0,
        "total_steps": 0,
    }


def normalize_confidence(raw: Any) -> dict[str, Any]:
    base = empty_confidence()
    if not isinstance(raw, dict):
        return base
    try:
        base["global"] = max(0, min(100, int(raw.get("global", 0))))
    except (TypeError, ValueError):
        pass
    level = str(raw.get("level") or "low").lower()
    base["level"] = level if level in {"high", "medium", "low"} else "low"
    by_sec = raw.get("by_section")
    if isinstance(by_sec, dict):
        base["by_section"] = {
            str(k)[:80]: int(v) for k, v in by_sec.items() if str(k).strip()
        }
    for key in ("structured_steps", "total_steps"):
        try:
            base[key] = max(0, int(raw.get(key, 0)))
        except (TypeError, ValueError):
            pass
    return base


def normalize_sections(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "Section").strip()[:120] or "Section"
        kind = str(item.get("kind") or "work").strip().lower()
        if kind not in {"work", "materials", "abbreviations", "gauge", "sizes", "other"}:
            kind = "work"
        steps_raw = item.get("steps") if isinstance(item.get("steps"), list) else item.get("lines")
        steps = [str(ln).strip() for ln in (steps_raw or []) if str(ln).strip()]
        out.append({"title": title, "kind": kind, "steps": steps})
    return out


def normalize_size_labels(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        text = str(item).strip()[:40]
        if text and text not in out:
            out.append(text)
    return out[:16]


def empty_document(
    craft: str,
    *,
    title: str = "Untitled",
    dialect: str = "US",
) -> dict[str, Any]:
    craft = assert_yarn_craft(craft)
    supplies = empty_supplies(terminology=dialect if dialect in {"US", "UK"} else "US")
    return {
        "format": pattern_format(craft),
        "craft": craft,
        "title": title,
        "dialect": supplies["terminology"],
        "lines": [],
        "supplies": supplies,
        "size_labels": [],
        "sections": [],
        "confidence": empty_confidence(),
        "warnings": [],
    }


def _supplies_for_yaml(supplies: dict[str, Any]) -> dict[str, Any]:
    s = normalize_supplies(supplies)
    return {
        "terminology": s["terminology"],
        "hook_size": s["hook_size"],
        "needle_size": s["needle_size"],
        "yarns": s["yarns"],
        "gauge": s["gauge"],
        "notions": s["notions"],
        "notes": s["notes"],
    }


def _read_yarn_file(path: Path) -> dict[str, Any] | None:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    data: Any
    if path.suffix.lower() in {".yaml", ".yml"}:
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError:
            return None
    else:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def load_document(pattern_id: int, craft: str) -> dict[str, Any] | None:
    craft = assert_yarn_craft(craft)
    path = find_yarn_document_path(pattern_id, craft)
    if not path:
        return None
    data = _read_yarn_file(path)
    if not data:
        return None
    data.setdefault("format", pattern_format(craft))
    data.setdefault("craft", craft)
    steps = data.get("steps")
    if not isinstance(steps, list):
        steps = data.get("lines") or []
    lines = [str(ln).strip() for ln in steps if str(ln).strip()]
    data["steps"] = lines
    data["lines"] = lines
    data.setdefault("warnings", [])
    data["size_labels"] = normalize_size_labels(data.get("size_labels"))
    data["sections"] = normalize_sections(data.get("sections"))
    data["confidence"] = normalize_confidence(data.get("confidence"))
    supplies = normalize_supplies(data.get("supplies"))
    if not data.get("supplies") and data.get("dialect") in {"US", "UK"}:
        supplies["terminology"] = str(data["dialect"])
    data["supplies"] = supplies
    data["dialect"] = supplies["terminology"]
    return data


def save_document(pattern_id: int, craft: str, doc: dict[str, Any]) -> dict[str, Any]:
    craft = assert_yarn_craft(craft)
    path = yarn_path(pattern_id, craft)
    path.parent.mkdir(parents=True, exist_ok=True)
    supplies = normalize_supplies(doc.get("supplies"))
    if doc.get("dialect") in {"US", "UK"} and not (doc.get("supplies") or {}).get("terminology"):
        supplies["terminology"] = str(doc["dialect"])
    raw_steps = doc.get("steps") if isinstance(doc.get("steps"), list) else doc.get("lines")
    lines = [str(ln).strip() for ln in (raw_steps or []) if str(ln).strip()]
    size_labels = normalize_size_labels(doc.get("size_labels"))
    sections = normalize_sections(doc.get("sections"))
    confidence = normalize_confidence(doc.get("confidence"))
    stored = {
        "format": pattern_format(craft),
        "craft": craft,
        "title": str(doc.get("title") or "Untitled"),
        "dialect": supplies["terminology"],
        "supplies": _supplies_for_yaml(supplies),
        "steps": lines,
        "size_labels": size_labels,
        "sections": sections,
        "confidence": confidence,
        "warnings": [str(w) for w in (doc.get("warnings") or []) if str(w).strip()],
    }
    path.write_text(
        yaml.safe_dump(stored, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    # Drop legacy JSON sibling after successful YAML write.
    legacy = path.with_suffix(".json")
    if legacy.name != path.name and legacy.is_file():
        try:
            legacy.unlink()
        except OSError:
            pass
    # API-facing document keeps lines (+ full normalized supplies).
    return {
        **stored,
        "lines": lines,
        "supplies": supplies,
    }


def _primary_pdf(pattern_id: int) -> Path | None:
    lib = settings.library_dir / str(pattern_id)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT path, filename, mime_type FROM pattern_files
            WHERE pattern_id = ? ORDER BY id
            """,
            (pattern_id,),
        ).fetchall()
    for row in rows:
        name = (row["filename"] or "").lower()
        mime = (row["mime_type"] or "").lower()
        if name.endswith(".pdf") or mime == "application/pdf":
            p = Path(row["path"]) if row["path"] else lib / row["filename"]
            if p.is_file():
                return p
    for p in sorted(lib.glob("*.pdf")):
        if p.is_file():
            return p
    return None


def pdf_raw_text(pdf_path: Path) -> str:
    """Plain text layer (legacy helpers + supplies extraction)."""
    from pincushion.services.yarn_pdf_extract import extract_pdf_pages, pages_to_text

    try:
        return pages_to_text(extract_pdf_pages(pdf_path))
    except Exception:  # noqa: BLE001
        chunks: list[str] = []
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text = page.get_text("text") or ""
                if text.strip():
                    chunks.append(text)
        return "\n".join(chunks)


def extract_supplies_from_text(text: str, *, craft: str = "crochet") -> dict[str, Any]:
    """Best-effort supplies fields from pattern prose."""
    craft = assert_yarn_craft(craft)
    supplies = empty_supplies(terminology="unknown")
    if not (text or "").strip():
        return supplies
    blob = text.replace("\u00ad", "")

    if re.search(r"\bUK\s+terms?\b|\bBritish\s+terms?\b", blob, re.IGNORECASE):
        supplies["terminology"] = "UK"
    elif re.search(r"\bUS\s+terms?\b|\bAmerican\s+terms?\b", blob, re.IGNORECASE):
        supplies["terminology"] = "US"

    hook = re.search(
        r"(?:crochet\s+)?hook(?:\s*size)?\s*[:\-]?\s*"
        r"((?:\d+(?:\.\d+)?\s*mm)|(?:[A-K]/?\d{0,2})|(?:\d+\s*/\s*\d+\s*mm))",
        blob,
        re.IGNORECASE,
    )
    if not hook:
        hook = re.search(r"\b(\d+(?:\.\d+)?\s*mm)\s*(?:crochet\s+)?hook\b", blob, re.IGNORECASE)
    if hook:
        supplies["hook_size"] = re.sub(r"\s+", " ", hook.group(1)).strip()

    needle = re.search(
        r"(?:knitting\s+)?needles?(?:\s*size)?\s*[:\-]?\s*"
        r"((?:\d+(?:\.\d+)?\s*mm)|(?:US\s*\d+(?:\s*/\s*\d+(?:\.\d+)?\s*mm)?)|"
        r"(?:size\s+[A-Z0-9/.\s-]{1,20}))",
        blob,
        re.IGNORECASE,
    )
    if not needle:
        needle = re.search(
            r"\b((?:\d+(?:\.\d+)?\s*mm)|(?:US\s*\d+))\s*(?:circular\s+|dpn\s+|straight\s+)?needles?\b",
            blob,
            re.IGNORECASE,
        )
    if needle:
        supplies["needle_size"] = re.sub(r"\s+", " ", needle.group(1)).strip(" .;")

    yarn = re.search(
        r"(?:yarn|wool)\s*[:\-]\s*([^\n.]{3,80})",
        blob,
        re.IGNORECASE,
    )
    if yarn:
        supplies["yarn"] = yarn.group(1).strip(" .;,-")
    else:
        weight = re.search(
            r"\b((?:lace|fingering|sock|sport|dk|light\s*worsted|worsted|aran|chunky|bulky|super\s*bulky)"
            r"(?:\s*weight)?(?:\s*yarn)?)\b",
            blob,
            re.IGNORECASE,
        )
        if weight:
            supplies["yarn"] = weight.group(1).strip()

    amount = re.search(
        r"\b(\d+(?:\.\d+)?\s*(?:g|grams?|oz|skeins?|balls?|yards?|yds?|meters?|metres?|m)\b"
        r"(?:[^.\n]{0,40})?)",
        blob,
        re.IGNORECASE,
    )
    if amount:
        supplies["yarn_amount"] = re.sub(r"\s+", " ", amount.group(1)).strip(" .;")

    gauge = re.search(
        r"(?:gauge|tension)\s*[:\-]?\s*([^\n]{3,100})",
        blob,
        re.IGNORECASE,
    )
    if gauge:
        supplies["gauge"] = gauge.group(1).strip(" .;")

    notions = re.search(
        r"(?:notions?|you(?:'ll| will)\s+also\s+need)\s*[:\-]?\s*([^\n]{3,140})",
        blob,
        re.IGNORECASE,
    )
    if notions:
        supplies["notions"] = notions.group(1).strip(" .;")

    # Prefer craft-appropriate tool; leave the other blank unless both were explicit.
    if craft == "knitting" and supplies["needle_size"] and not re.search(r"\bhook\b", blob, re.I):
        supplies["hook_size"] = ""
    if craft == "crochet" and supplies["hook_size"] and not re.search(r"\bneedles?\b", blob, re.I):
        supplies["needle_size"] = ""

    if supplies["yarn"] or supplies["yarn_amount"]:
        supplies["yarns"] = [{"name": supplies["yarn"], "amount": supplies["yarn_amount"]}]

    return supplies


def _looks_like_step(line: str) -> bool:
    from pincushion.services.yarn_pdf_extract import ROW_START_RE

    return bool(ROW_START_RE.match(line) or line.startswith("*"))


def extract_instruction_steps(text: str) -> tuple[list[str], list[str]]:
    """Parse instruction steps from plain pattern text (PDF text layer or paste)."""
    from pincushion.services.yarn_pdf_extract import lines_to_steps

    warnings: list[str] = []
    if not (text or "").strip():
        return [], ["No text to extract."]

    combined = text.replace("\u00ad", "").replace("\r\n", "\n").replace("\r", "\n")
    rough = [ln.strip() for ln in combined.split("\n") if ln.strip()]
    rough = [ln for ln in rough if not _JUNK_LINE.match(ln) and len(ln) > 1]

    steps = lines_to_steps(rough, kind="work")
    if not steps:
        warnings.append("Could not find instruction-like lines; showing raw extracted text.")
        return rough[:200], warnings
    if sum(1 for ln in steps if _looks_like_step(ln)) < 3:
        warnings.append(
            "Few round/row markers found — showing extracted lines. Edit as needed."
        )
    if len(steps) > 400:
        warnings.append(f"Truncated to 400 lines (had {len(steps)}).")
        steps = steps[:400]
    return steps, warnings


def extract_pdf_lines(pdf_path: Path) -> tuple[list[str], list[str]]:
    """Return (instruction_lines, warnings) from a digital PDF text layer."""
    from pincushion.services.yarn_pdf_extract import extract_from_pdf_path

    result = extract_from_pdf_path(pdf_path)
    return result.lines, result.warnings


def _pattern_craft(pattern_id: int) -> tuple[Any, str]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, craft FROM patterns WHERE id = ?", (pattern_id,)
        ).fetchone()
    if not row:
        raise KeyError(pattern_id)
    craft = assert_yarn_craft(row["craft"])
    return row, craft


def extract_from_pdf(pattern_id: int) -> dict[str, Any]:
    from pincushion.services.yarn_pdf_extract import extract_from_pdf_path

    row, craft = _pattern_craft(pattern_id)
    existing = load_document(pattern_id, craft) or empty_document(
        craft, title=row["title"] or "Untitled"
    )
    pdf = _primary_pdf(pattern_id)
    if not pdf:
        doc = empty_document(craft, title=row["title"] or "Untitled")
        doc["supplies"] = existing.get("supplies") or empty_supplies()
        doc["warnings"] = ["No PDF found — add instruction lines and supplies manually."]
        doc["confidence"] = empty_confidence()
        return save_document(pattern_id, craft, doc)

    extracted = extract_from_pdf_path(pdf)
    raw = extracted.raw_text or pdf_raw_text(pdf)
    supplies = extract_supplies_from_text(raw, craft=craft)
    prev = normalize_supplies(existing.get("supplies"))
    for key, val in supplies.items():
        if key == "yarns":
            if not val and prev.get("yarns"):
                supplies[key] = prev[key]
            continue
        if not val and prev.get(key):
            supplies[key] = prev[key]
    supplies = normalize_supplies(supplies)

    warnings = list(extracted.warnings)
    if extracted.rejected == "scanned" and not any("scanned" in w.lower() for w in warnings):
        warnings.insert(
            0,
            "No extractable text layer found. This PDF may be scanned — paste instructions manually.",
        )

    doc = {
        "title": row["title"] or "Untitled",
        "dialect": supplies["terminology"],
        "lines": extracted.lines,
        "supplies": supplies,
        "size_labels": extracted.size_labels,
        "sections": extracted.sections,
        "confidence": extracted.confidence or empty_confidence(),
        "warnings": warnings,
    }
    return save_document(pattern_id, craft, doc)


def get_or_extract(pattern_id: int) -> dict[str, Any]:
    row, craft = _pattern_craft(pattern_id)
    existing = load_document(pattern_id, craft)
    if existing is not None:
        return existing
    _ = row
    return extract_from_pdf(pattern_id)
