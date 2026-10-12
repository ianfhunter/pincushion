"""Geometry-aware PDF extraction for yarn patterns.

Inspired by Rowtine's offline PDF import (Apache-2.0): layout-aware lines,
early rejection, multilingual row heads, section segmentation, size labels,
and a simple confidence score. PinCushion keeps a flatter storage model
(pincushion_yarn_v1) and uses PyMuPDF instead of pdf.js.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import fitz

# --- Tunables (Rowtine uses 50 chars/page for scanned) ---
SCANNED_CHARS_PER_PAGE = 50

# Multilingual row / round / tour openers (EN/FR/DE/ES + common abbr).
# Kept in sync between step detection and section "has rows" checks.
_ROW_WORD = (
    r"(?:rangs?|rgs?|rows?|rounds?|tours?|trs?|rnds?|runde?n?|rd\.?|reihen?|"
    r"r[æe]kker?|vueltas?|rondas?|vts?|filas?|giro|giri|hilera|r\.?)"
)

ROW_START_RE = re.compile(
    rf"^\s*(?:"
    rf"(?:{_ROW_WORD})\s*\d+"
    rf"|\d{{1,3}}\.\s*(?:reihen?|runde?n?|rd\.?)"
    rf"|\d+(?:st|nd|rd|th)\s*(?:row|round)\b"
    rf"|step\s*\d+"
    rf"|cast\s+on\b|bind\s+off\b|cast\s+off\b"
    rf"|chain\s+\d+\b|ch\s*\d+\b|make\s+\d+\b"
    rf"|magic\s+ring\b|\bmr\b"
    rf"|finishing\b|assembly\b"
    rf"|\*"
    rf")",
    re.IGNORECASE,
)

_ROUND_HEAD = re.compile(
    rf"^(?:{_ROW_WORD})\s*"
    r"(\d+(?:\s*[-–—to]+\s*\d+)?)\s*[:.\-)]?\s*(.*)$",
    re.IGNORECASE,
)

_SPLIT_STEPS = re.compile(
    rf"(?=(?:(?:{_ROW_WORD})\s*\d+\s*[:.]))",
    re.IGNORECASE,
)

_SECTION_TITLE_RE = re.compile(
    r"^(?:"
    r"pattern|instructions?|directions?|method|anleitung|instructions?|"
    r"materi(?:al|el|aux)|materials?|fournitures|supplies|yarn|wool|"
    r"hook|needles?|aiguilles?|gauge|tension|echantillon|échantillon|"
    r"abbreviations?|abr[eé]viations?|notions?|notes?|"
    r"size(?:s)?|tailles?|größen?|finished\s+size|schematic|"
    r"body|front|back|sleeve(?:s)?|collar|neck|brim|band|"
    r"head|arms?|legs?|hat|scarf|blanket|finishing|assembly|"
    r"part\s+\d+|section\s+[a-z0-9]+|"
    r"corps|manche(?:s)?|empi[eè]cement|bordure"
    r")\s*:?\s*$",
    re.IGNORECASE,
)

_SECTION_SKIP = re.compile(
    r"^(?:materials?|materi(?:al|el|aux)|fournitures|supplies|yarn|wool|"
    r"hook|needles?|aiguilles?|gauge|tension|abbreviations?|abr[eé]viations?|"
    r"notions?|notes?|size(?:s)?|tailles?|finished\s+size|contents?|"
    r"you\s+will\s+need|tools?)\b",
    re.IGNORECASE,
)

_REF_KIND_RE = re.compile(
    r"^(?:materials?|materi(?:al|el|aux)|fournitures|supplies|yarn|wool|"
    r"hook|needles?|aiguilles?|gauge|tension|echantillon|échantillon|"
    r"abbreviations?|abr[eé]viations?|notions?|notes?|"
    r"size(?:s)?|tailles?|größen?|finished\s+size)\b",
    re.IGNORECASE,
)

_JUNK_LINE = re.compile(
    r"^(page\s*\d+|©|copyright|all rights reserved|tous droits réservés|"
    r"alle rechte vorbehalten|www\.|https?://|\d+\s*/\s*\d+)\s*$",
    re.IGNORECASE,
)

_CRAFT_SIGNAL_RE = re.compile(
    r"\b(?:knit|knitting|crochet|amigurumi|cast\s+on|bind\s+off|"
    r"single\s+crochet|\bsc\b|\bdc\b|\btr\b|purl|stockinette|garter|"
    r"tricot|crocheter|maille|jet[eé]|rang|tour|"
    r"stricken|h[aä]keln|masche|reihe|runde|"
    r"tejer|ganchillo|punto|vuelta|ronda)\b",
    re.IGNORECASE,
)

_SIZE_LABEL_LINE_RE = re.compile(
    r"(?:sizes?|tailles?|größen?|tallas?)\s*[:\-–]?\s*(.+)$",
    re.IGNORECASE,
)

_SIZE_TOKEN_RE = re.compile(
    r"\b(?:XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|"
    r"to\s+fit|one\s+size|taille\s+unique|"
    r"\d{1,2}(?:/\d{1,2})?(?:\s*[-–]\s*\d{1,2})?)\b",
    re.IGNORECASE,
)

_SIZE_VECTOR_RE = re.compile(
    r"\b(\d+(?:[.,]\d+)?)\s*\(\s*(\d+(?:[.,]\d+)?(?:\s*[,;/]\s*\d+(?:[.,]\d+)?){1,12})\s*\)"
)


@dataclass
class PdfLine:
    text: str
    size: float = 11.0
    bold: bool = False
    page: int = 1
    y0: float = 0.0
    y1: float = 0.0
    x0: float = 0.0
    x1: float = 0.0


@dataclass
class ExtractResult:
    lines: list[str] = field(default_factory=list)
    sections: list[dict[str, Any]] = field(default_factory=list)
    size_labels: list[str] = field(default_factory=list)
    confidence: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    rejected: str | None = None
    raw_text: str = ""


def extract_pdf_pages(pdf_path: Path) -> list[list[PdfLine]]:
    """Extract layout-aware text lines via PyMuPDF dict mode."""
    pages: list[list[PdfLine]] = []
    with fitz.open(pdf_path) as doc:
        for page_idx, page in enumerate(doc):
            data = page.get_text("dict") or {}
            page_lines: list[PdfLine] = []
            for block in data.get("blocks") or []:
                if block.get("type", 0) != 0:
                    continue
                for line in block.get("lines") or []:
                    spans = line.get("spans") or []
                    if not spans:
                        continue
                    parts: list[str] = []
                    sizes: list[float] = []
                    flags = 0
                    x0 = y0 = x1 = y1 = None
                    for sp in spans:
                        t = (sp.get("text") or "").replace("\u00ad", "")
                        if not t.strip():
                            continue
                        parts.append(t)
                        sizes.append(float(sp.get("size") or 11.0))
                        flags |= int(sp.get("flags") or 0)
                        bx = sp.get("bbox") or line.get("bbox")
                        if bx and len(bx) >= 4:
                            x0 = bx[0] if x0 is None else min(x0, bx[0])
                            y0 = bx[1] if y0 is None else min(y0, bx[1])
                            x1 = bx[2] if x1 is None else max(x1, bx[2])
                            y1 = bx[3] if y1 is None else max(y1, bx[3])
                    text = "".join(parts).strip()
                    if not text:
                        continue
                    bbox = line.get("bbox") or (0, 0, 0, 0)
                    page_lines.append(
                        PdfLine(
                            text=text,
                            size=statistics.median(sizes) if sizes else 11.0,
                            bold=bool(flags & 2**4),  # bit 4 = bold in MuPDF
                            page=page_idx + 1,
                            y0=float(y0 if y0 is not None else bbox[1]),
                            y1=float(y1 if y1 is not None else bbox[3]),
                            x0=float(x0 if x0 is not None else bbox[0]),
                            x1=float(x1 if x1 is not None else bbox[2]),
                        )
                    )
            # Reading order: top-to-bottom, then left-to-right.
            page_lines.sort(key=lambda ln: (round(ln.y0, 1), ln.x0))
            pages.append(_reflow_page_lines(page_lines))
    return pages


def _reflow_page_lines(lines: list[PdfLine]) -> list[PdfLine]:
    """Join soft-wrapped continuations using geometry + punctuation cues."""
    if not lines:
        return []
    out: list[PdfLine] = [lines[0]]
    for ln in lines[1:]:
        prev = out[-1]
        same_block = abs(prev.x0 - ln.x0) < 8 and (ln.y0 - prev.y1) < prev.size * 1.4
        soft = prev.text.endswith((",", ";", ":", "-", "–", "—", "(", "/"))
        cont = (
            same_block
            and not ROW_START_RE.match(ln.text)
            and not _SECTION_TITLE_RE.match(ln.text)
            and (soft or (not ln.text[:1].isupper() and len(ln.text) < 100))
        )
        if cont:
            prev.text = f"{prev.text} {ln.text}".strip()
            prev.y1 = ln.y1
            prev.x1 = max(prev.x1, ln.x1)
            prev.size = max(prev.size, ln.size)
            prev.bold = prev.bold or ln.bold
        else:
            out.append(ln)
    return out


def pages_to_text(pages: list[list[PdfLine]]) -> str:
    chunks: list[str] = []
    for page in pages:
        texts = [ln.text for ln in page if ln.text.strip()]
        if texts:
            chunks.append("\n".join(texts))
    return "\n".join(chunks)


def is_scanned_pages(pages: list[list[PdfLine]]) -> bool:
    if not pages:
        return True
    chars = sum(len(ln.text) for page in pages for ln in page)
    return (chars / max(len(pages), 1)) < SCANNED_CHARS_PER_PAGE


def detect_rejection(pages: list[list[PdfLine]]) -> str | None:
    """Return a stable reject code, or None if import should proceed."""
    if is_scanned_pages(pages):
        return "scanned"
    blob = pages_to_text(pages)
    rowish = sum(1 for page in pages for ln in page if ROW_START_RE.match(ln.text))
    # Tiny docs without row markers are treated as empty/scanned.
    if len(blob) < 40 and rowish == 0:
        return "scanned"
    # Weak craft signal and almost no row markers → likely not a pattern.
    if rowish == 0 and not _CRAFT_SIGNAL_RE.search(blob):
        return "notPattern"
    return None


def _body_median_size(pages: list[list[PdfLine]]) -> float:
    sizes = [ln.size for page in pages for ln in page if len(ln.text) > 20]
    if not sizes:
        sizes = [ln.size for page in pages for ln in page]
    return float(statistics.median(sizes)) if sizes else 11.0


def is_title_line(line: PdfLine, body_size: float) -> bool:
    t = line.text.strip()
    if not t or len(t) > 80:
        return False
    if _JUNK_LINE.match(t) or ROW_START_RE.match(t):
        return False
    if _SECTION_TITLE_RE.match(t):
        return True
    larger = line.size >= body_size * 1.25
    upper = t == t.upper() and any(c.isalpha() for c in t) and len(t) < 60
    return bool((larger or line.bold or upper) and len(t.split()) <= 8)


def section_kind(title: str) -> str:
    if _REF_KIND_RE.match(title.strip()):
        low = title.lower()
        if re.search(r"abbrev|abr[eé]v", low):
            return "abbreviations"
        if re.search(r"gauge|tension|echantillon|échantillon", low):
            return "gauge"
        if re.search(r"size|taille|größe|talla", low):
            return "sizes"
        return "materials"
    return "work"


def detect_size_labels(pages: list[list[PdfLine]]) -> list[str]:
    """Best-effort size labels from a Sizes: line or a compact size token row."""
    for page in pages[:3]:
        for ln in page:
            m = _SIZE_LABEL_LINE_RE.search(ln.text)
            if not m:
                continue
            rest = m.group(1)
            tokens = _SIZE_TOKEN_RE.findall(rest)
            cleaned: list[str] = []
            for tok in tokens:
                t = re.sub(r"\s+", " ", tok).strip(" ,;")
                if not t:
                    continue
                if re.search(r"to\s+fit|one\s+size|taille\s+unique", t, re.I):
                    return ["One size"]
                if t.upper() not in {c.upper() for c in cleaned}:
                    cleaned.append(t.upper() if len(t) <= 4 else t)
            if len(cleaned) >= 2:
                return cleaned[:12]
    # Fallback: a short line that is mostly size tokens.
    for page in pages[:2]:
        for ln in page:
            if len(ln.text) > 60:
                continue
            tokens = _SIZE_TOKEN_RE.findall(ln.text)
            letters = [t.upper() for t in tokens if re.fullmatch(r"(?:XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)", t, re.I)]
            if len(letters) >= 3:
                return letters[:12]
    return []


def segment_sections(pages: list[list[PdfLine]]) -> list[dict[str, Any]]:
    body_size = _body_median_size(pages)
    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def start(title: str) -> None:
        nonlocal current
        current = {
            "title": title,
            "kind": section_kind(title),
            "lines": [],
        }
        sections.append(current)

    for page in pages:
        for ln in page:
            t = ln.text.strip()
            if not t or _JUNK_LINE.match(t):
                continue
            if is_title_line(ln, body_size) or _SECTION_TITLE_RE.match(t):
                start(t.rstrip(":").strip())
                continue
            if current is None:
                start("Pattern")
            current["lines"].append(t)

    # Drop empty / pure-junk sections.
    return [s for s in sections if s["lines"]]


def _normalize_row_label(line: str) -> str:
    m = _ROUND_HEAD.match(line)
    if not m:
        return line
    num, rest = m.group(1).strip(), (m.group(2) or "").strip()
    head_m = re.match(rf"^({_ROW_WORD})\b", line, re.IGNORECASE)
    head = (head_m.group(1) if head_m else "Rnd").lower()
    ranged = bool(re.search(r"[-–—]|to", num, re.I))
    if head.startswith("row") or head.startswith("reihe") or head.startswith("fila"):
        label = "Rows" if ranged or head.endswith("s") else "Row"
    elif head.startswith("round") or head.startswith("rond") or head.startswith("vuelta"):
        label = "Rounds" if ranged or head.endswith("s") else "Round"
    elif head.startswith("rnd") or head.startswith("rd") or head.startswith("rg"):
        label = "Rnds" if ranged or head.endswith("s") else "Rnd"
    elif head.startswith("rang") or head.startswith("tour") or head.startswith("tr"):
        label = "Rangs" if ranged or head.endswith("s") else "Rang"
    else:
        label = head[:1].upper() + head[1:]
    return f"{label} {num}: {rest}" if rest else f"{label} {num}"


def lines_to_steps(raw_lines: list[str], *, kind: str = "work") -> list[str]:
    """Turn section prose into instruction step strings."""
    if kind in {"materials", "abbreviations", "gauge", "sizes"}:
        return []

    rough = [ln.strip() for ln in raw_lines if ln.strip() and not _JUNK_LINE.match(ln)]
    if not rough:
        return []

    # Skip materials-ish preface inside a work section.
    start = 0
    for i, ln in enumerate(rough):
        if ROW_START_RE.match(ln):
            start = i
            break
        if _SECTION_SKIP.match(ln) and i == 0:
            continue
    body = rough[start:] if start else rough

    steps: list[str] = []
    skipping = False
    for ln in body:
        if _SECTION_SKIP.match(ln) and not ROW_START_RE.match(ln):
            skipping = True
            continue
        if skipping:
            if ROW_START_RE.match(ln):
                skipping = False
            else:
                continue
        pieces = [p.strip() for p in _SPLIT_STEPS.split(ln) if p and p.strip()]
        if len(pieces) <= 1:
            pieces = [ln]
        for piece in pieces:
            if not steps:
                steps.append(piece)
                continue
            if ROW_START_RE.match(piece):
                steps.append(piece)
            elif steps[-1].endswith((",", ";", ":", "-", "–", "—", "*", "(")) or (
                not ROW_START_RE.match(piece) and len(piece) < 100 and piece and not piece[0].isupper()
            ):
                steps[-1] = f"{steps[-1]} {piece}".strip()
            elif ROW_START_RE.match(steps[-1]) and not ROW_START_RE.match(piece) and len(piece) < 160:
                steps[-1] = f"{steps[-1]} {piece}".strip()
            else:
                steps.append(piece)

    preferred = [ln for ln in steps if ROW_START_RE.match(ln)]
    if len(preferred) >= 3:
        steps = preferred
    return [_normalize_row_label(ln) for ln in steps]


def apply_size_vectors(text: str, n_sizes: int) -> str:
    """Annotate multi-size vectors when count matches detected sizes.

    Leaves text mostly verbatim; adds a trailing hint only when useful.
    Full {{i}} templating (Rowtine-style) is left for a later reader upgrade.
    """
    if n_sizes < 2:
        return text
    m = _SIZE_VECTOR_RE.search(text)
    if not m:
        return text
    rest = re.split(r"\s*[,;/]\s*", m.group(2))
    values = [m.group(1), *rest]
    if len(values) != n_sizes:
        return text
    return text  # detection used for confidence/metadata; keep verbatim for editor


def compute_confidence(
    *,
    sections: list[dict[str, Any]],
    flat_steps: list[str],
    warnings: list[str],
    size_labels: list[str],
) -> dict[str, Any]:
    known = sum(1 for s in sections if s.get("kind") != "work" or s.get("title"))
    work = [s for s in sections if s.get("kind") == "work"]
    sec_score = (known / len(sections)) if sections else 0.0
    structured = sum(1 for ln in flat_steps if ROW_START_RE.match(ln))
    step_score = (structured / len(flat_steps)) if flat_steps else 0.0
    size_score = 1.0 if size_labels else 0.5
    valid_score = max(0.0, 1.0 - len(warnings) / 10.0)
    # Weight structured steps heavily — they drive the editor experience.
    global_score = round(
        100
        * (
            0.25 * sec_score
            + 0.45 * step_score
            + 0.15 * size_score
            + 0.15 * valid_score
        )
    )
    if step_score == 0:
        level = "low"
    elif global_score >= 70:
        level = "high"
    elif global_score >= 40:
        level = "medium"
    else:
        level = "low"
    by_section = {
        (s.get("title") or f"sec{i}"): sum(1 for ln in (s.get("steps") or []) if ROW_START_RE.match(ln))
        for i, s in enumerate(work)
    }
    return {
        "global": global_score,
        "level": level,
        "by_section": by_section,
        "structured_steps": structured,
        "total_steps": len(flat_steps),
    }


def flatten_sections(sections: list[dict[str, Any]]) -> list[str]:
    """Flatten work sections into editor lines, with section titles as markers."""
    work = [s for s in sections if s.get("kind") == "work" and s.get("steps")]
    if not work:
        # Fall back: any section that somehow has steps.
        work = [s for s in sections if s.get("steps")]
    if len(work) <= 1:
        return list(work[0]["steps"]) if work else []
    out: list[str] = []
    for s in work:
        title = str(s.get("title") or "Section").strip()
        out.append(f"## {title}")
        out.extend(s["steps"])
    return out


def extract_from_pdf_path(pdf_path: Path) -> ExtractResult:
    """Full PDF → yarn extract pipeline."""
    result = ExtractResult()
    try:
        pages = extract_pdf_pages(pdf_path)
    except Exception as exc:  # noqa: BLE001 — best-effort import path
        result.warnings.append(f"PDF extract failed: {exc}")
        result.rejected = "scanned"
        result.confidence = {"global": 0, "level": "low", "by_section": {}}
        return result

    result.raw_text = pages_to_text(pages)
    rejected = detect_rejection(pages)
    if rejected:
        result.rejected = rejected
        if rejected == "scanned":
            result.warnings.append(
                "No extractable text layer found. This PDF may be scanned — paste instructions manually."
            )
        elif rejected == "notPattern":
            result.warnings.append(
                "This PDF does not look like a knitting or crochet pattern. Add lines manually if needed."
            )
        result.confidence = {"global": 0, "level": "low", "by_section": {}}
        return result

    size_labels = detect_size_labels(pages)
    result.size_labels = size_labels

    sections = segment_sections(pages)
    built: list[dict[str, Any]] = []
    for sec in sections:
        steps = lines_to_steps(sec["lines"], kind=sec["kind"])
        if size_labels:
            steps = [apply_size_vectors(s, len(size_labels)) for s in steps]
        built.append(
            {
                "title": sec["title"],
                "kind": sec["kind"],
                "steps": steps,
            }
        )

    flat = flatten_sections(built)
    warnings: list[str] = []
    if not flat:
        # Fall back to whole-document step extraction (no section titles).
        all_lines = [ln.text for page in pages for ln in page]
        flat = lines_to_steps(all_lines, kind="work")
        if flat:
            built = [{"title": "Pattern", "kind": "work", "steps": flat}]
            warnings.append("Could not segment sections — used whole-document steps.")
        else:
            rough = [ln for ln in all_lines if ln.strip() and not _JUNK_LINE.match(ln)][:200]
            flat = rough
            built = [{"title": "Pattern", "kind": "work", "steps": flat}]
            warnings.append("Could not find instruction-like lines; showing raw extracted text.")
    else:
        structured = sum(1 for ln in flat if ROW_START_RE.match(ln) or ln.startswith("## "))
        if structured < 3:
            warnings.append("Few round/row markers found — showing extracted lines. Edit as needed.")

    if len(flat) > 400:
        warnings.append(f"Truncated to 400 lines (had {len(flat)}).")
        flat = flat[:400]

    if size_labels:
        warnings.append(f"Detected sizes: {', '.join(size_labels)}.")

    result.lines = flat
    result.sections = built
    result.warnings = warnings
    result.confidence = compute_confidence(
        sections=built,
        flat_steps=[ln for ln in flat if not ln.startswith("## ")],
        warnings=warnings,
        size_labels=size_labels,
    )
    return result
