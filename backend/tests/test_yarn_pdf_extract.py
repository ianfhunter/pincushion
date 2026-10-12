"""Tests for geometry-aware yarn PDF extraction."""

from pathlib import Path

import fitz

from pincushion.services import yarn_pdf_extract as ypx
from pincushion.services import yarn_pattern as yarn_svc


def _make_pdf(path: Path, pages: list[list[tuple[str, float]]]) -> Path:
    doc = fitz.open()
    for page_lines in pages:
        page = doc.new_page()
        y = 72.0
        for text, size in page_lines:
            page.insert_text((72, y), text, fontsize=size)
            y += size * 1.6
    doc.save(path)
    doc.close()
    return path


def test_detect_scanned_rejection(tmp_path: Path):
    pdf = tmp_path / "scan.pdf"
    # Image-only page: no text spans → scanned.
    doc = fitz.open()
    doc.new_page()
    doc.save(pdf)
    doc.close()
    result = ypx.extract_from_pdf_path(pdf)
    assert result.rejected == "scanned"
    assert result.confidence["level"] == "low"
    assert any("scanned" in w.lower() or "text layer" in w.lower() for w in result.warnings)


def test_multilingual_row_heads():
    text = """
    Anleitung
    Reihe 1: rechts
    Reihe 2: links
    Rang 3: 1 m end.
    Vuelta 4: 6 pb
    """
    lines, _ = yarn_svc.extract_instruction_steps(text)
    assert any("Row 1" in ln or "Reihe 1" in ln or ln.startswith("Row") for ln in lines)
    assert any("4" in ln for ln in lines)


def test_extract_with_sections_and_sizes(tmp_path: Path):
    pdf = tmp_path / "cardigan.pdf"
    _make_pdf(
        pdf,
        [
            [
                ("Mia Cardigan", 18),
                ("Sizes: S, M, L, XL", 11),
                ("Materials", 14),
                ("Yarn: DK wool", 11),
                ("Needles: 4 mm", 11),
                ("Body", 14),
                ("Cast on 80 sts", 11),
                ("Row 1: knit", 11),
                ("Row 2: purl", 11),
                ("Row 3: knit", 11),
                ("Sleeves", 14),
                ("Cast on 40 sts", 11),
                ("Row 1: k1, p1", 11),
                ("Row 2: work in rib", 11),
                ("Row 3: continue", 11),
            ]
        ],
    )
    result = ypx.extract_from_pdf_path(pdf)
    assert result.rejected is None
    assert result.size_labels[:4] == ["S", "M", "L", "XL"] or set(result.size_labels) >= {
        "S",
        "M",
        "L",
        "XL",
    }
    assert any("Row 1" in ln for ln in result.lines)
    assert result.confidence["global"] > 0
    assert result.confidence["level"] in {"high", "medium", "low"}
    work = [s for s in result.sections if s["kind"] == "work"]
    assert len(work) >= 1


def test_save_document_keeps_extract_metadata(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    out = yarn_svc.save_document(
        3,
        "knitting",
        {
            "title": "Cardigan",
            "lines": ["## Body", "Row 1: knit", "Row 2: purl"],
            "size_labels": ["S", "M", "L"],
            "sections": [
                {"title": "Body", "kind": "work", "steps": ["Row 1: knit", "Row 2: purl"]},
                {"title": "Materials", "kind": "materials", "steps": []},
            ],
            "confidence": {"global": 72, "level": "high", "structured_steps": 2, "total_steps": 2},
            "supplies": yarn_svc.empty_supplies(),
        },
    )
    assert out["size_labels"] == ["S", "M", "L"]
    assert out["confidence"]["level"] == "high"
    assert out["confidence"]["global"] == 72
    assert len(out["sections"]) == 2
    loaded = yarn_svc.load_document(3, "knitting")
    assert loaded is not None
    assert loaded["size_labels"] == ["S", "M", "L"]
    assert loaded["confidence"]["global"] == 72


def test_not_pattern_rejection(tmp_path: Path):
    pdf = tmp_path / "invoice.pdf"
    _make_pdf(
        pdf,
        [
            [
                ("Invoice #123", 14),
                ("Thank you for your purchase of office supplies.", 11),
                ("Total due: 42.00", 11),
                ("Payment terms net 30.", 11),
            ]
        ],
    )
    result = ypx.extract_from_pdf_path(pdf)
    assert result.rejected == "notPattern"
