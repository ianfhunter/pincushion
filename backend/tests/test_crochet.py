from pathlib import Path

import fitz

from pincushion.services.crochet import (
    extract_pdf_lines,
    extract_supplies_from_text,
    normalize_supplies,
    save_crochet,
)
from pincushion.services import yarn_pattern as yarn_svc


def test_extract_supplies_from_text():
    text = """
    Cute Bear
    Materials
    Yarn: DK weight cotton
    Hook size: 3.5 mm
    You will also need: stitch markers, tapestry needle
    Gauge: 20 sc = 10 cm
    Pattern uses US terms.
    100g / 2 skeins needed
    Rnd 1: 6 sc in mr (6)
    """
    supplies = extract_supplies_from_text(text)
    assert supplies["terminology"] == "US"
    assert "3.5" in supplies["hook_size"]
    assert "DK" in supplies["yarn"] or "dk" in supplies["yarn"].lower()
    assert supplies["yarn_amount"]
    assert supplies["gauge"]
    assert "stitch markers" in supplies["notions"].lower()


def test_extract_supplies_uk_terms():
    supplies = extract_supplies_from_text("This pattern is written in UK terms. Use a 4mm hook.")
    assert supplies["terminology"] == "UK"
    assert "4" in supplies["hook_size"]


def test_normalize_supplies_defaults():
    assert normalize_supplies(None)["terminology"] == "US"
    assert normalize_supplies({"terminology": "uk", "hook_size": " G "})["terminology"] == "UK"
    assert normalize_supplies({"terminology": "uk", "hook_size": " G "})["hook_size"] == "G"


def test_normalize_supplies_yarns_list_and_legacy():
    legacy = normalize_supplies({"yarn": "DK", "yarn_amount": "50g"})
    assert legacy["yarns"] == [{"name": "DK", "amount": "50g"}]
    multi = normalize_supplies(
        {
            "yarns": [
                {"name": "MC", "amount": "100g"},
                {"name": "CC", "amount": "50g"},
            ]
        }
    )
    assert len(multi["yarns"]) == 2
    assert multi["yarn"] == "MC"
    assert multi["yarn_amount"] == "100g"


def test_extract_pdf_lines(tmp_path: Path):
    pdf = tmp_path / "sample.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "Materials\nYarn: DK\nPattern\nRnd 1: 6 sc in mr (6)\nRnd 2: 6 inc (12)\n",
        fontsize=11,
    )
    doc.save(pdf)
    doc.close()
    lines, warnings = extract_pdf_lines(pdf)
    assert any("Rnd 1" in ln for ln in lines)
    assert any("Rnd 2" in ln for ln in lines)
    assert not any(ln.lower().startswith("yarn:") for ln in lines)


def test_extract_instruction_steps_ranges_and_split():
    text = """
    Abbreviations
    sc - single crochet
    Instructions
    Rnds 1-3: sc around
    Rnd 4: 6 sc in mr (6) Rnd 5: 6 inc (12)
    """
    lines, _ = yarn_svc.extract_instruction_steps(text)
    assert any("1-3" in ln or "1–3" in ln for ln in lines)
    assert any(ln.startswith("Rnd 4") for ln in lines)
    assert any(ln.startswith("Rnd 5") for ln in lines)


def test_save_crochet_keeps_supplies(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    out = save_crochet(
        1,
        {
            "title": "Hat",
            "lines": ["Rnd 1: 6 sc (6)", "Rnd 2: 6 inc (12)"],
            "supplies": {
                "terminology": "UK",
                "hook_size": "4 mm",
                "needle_size": "",
                "yarn": "DK",
                "yarn_amount": "50g",
                "gauge": "",
                "notions": "",
                "notes": "soft",
            },
        },
    )
    assert out["lines"] == ["Rnd 1: 6 sc (6)", "Rnd 2: 6 inc (12)"]
    assert out["supplies"]["terminology"] == "UK"
    assert out["supplies"]["hook_size"] == "4 mm"
    assert out["dialect"] == "UK"
    assert "mesh" not in out


def test_knitting_supplies_extract_needles():
    text = """
    Cosy Scarf
    Needles: 4.5 mm
    Yarn: Aran wool
    UK terms
    Cast on 40 sts
    Row 1: k1, p1 across
    """
    supplies = yarn_svc.extract_supplies_from_text(text, craft="knitting")
    assert supplies["terminology"] == "UK"
    assert "4.5" in supplies["needle_size"]
    assert supplies["hook_size"] == ""
    assert "Aran" in supplies["yarn"] or "aran" in supplies["yarn"].lower()


def test_save_knitting_document(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    out = yarn_svc.save_document(
        2,
        "knitting",
        {
            "title": "Scarf",
            "lines": ["Cast on 40", "Row 1: knit"],
            "supplies": {
                "terminology": "US",
                "hook_size": "",
                "needle_size": "5 mm",
                "yarn": "worsted",
                "yarn_amount": "200g",
                "gauge": "",
                "notions": "",
                "notes": "",
            },
        },
    )
    assert out["format"] == "pincushion_yarn_v1"
    assert out["craft"] == "knitting"
    assert out["supplies"]["needle_size"] == "5 mm"
    assert out["steps"] == ["Cast on 40", "Row 1: knit"]
    assert (tmp_path / "2" / "knitting.yaml").is_file()
    assert not (tmp_path / "2" / "knitting.json").is_file()


def test_load_legacy_json_migrates_on_save(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    legacy = tmp_path / "9"
    legacy.mkdir()
    (legacy / "crochet.json").write_text(
        '{"format":"pincushion_crochet_v1","craft":"crochet","title":"Old","lines":["Rnd 1: sc"],'
        '"supplies":{"terminology":"US","hook_size":"4mm","needle_size":"","yarn":"DK",'
        '"yarn_amount":"","gauge":"","notions":"","notes":""},"warnings":[]}',
        encoding="utf-8",
    )
    loaded = yarn_svc.load_document(9, "crochet")
    assert loaded is not None
    assert loaded["lines"] == ["Rnd 1: sc"]
    yarn_svc.save_document(9, "crochet", loaded)
    assert (legacy / "crochet.yaml").is_file()
    assert not (legacy / "crochet.json").is_file()
