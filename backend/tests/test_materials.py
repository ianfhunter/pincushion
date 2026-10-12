"""Materials stash storage under library/materials/."""

from pathlib import Path

from pincushion.config import settings
from pincushion.services import materials as mat_svc


def test_create_list_delete_floss(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(settings, "db_path", tmp_path / "test.db")
    monkeypatch.setattr(settings, "library_dir", tmp_path / "library")
    from pincushion.db import init_db

    init_db()
    mat_svc.init_materials_table()

    created = mat_svc.create_material(
        category="floss",
        brand="DMC",
        colour_code="310",
        colour_rgb="0,0,0",
        modifiers=["metallic"],
        quantity="2",
        length_per_skein="8 m",
        notes="dye lot A",
        files=[("label.jpg", b"not-a-real-jpeg")],
    )
    assert created["id"] > 0
    assert created["name"] == "DMC 310"
    assert created["colour_hex"] == "000000"
    assert created["modifiers"] == ["metallic"]
    assert created["quantity"] == "2"
    assert created["length_per_skein"] == "8 m"
    assert created["notes"] == "dye lot A"
    folder = Path(created["folder"])
    assert folder.is_dir()
    assert (folder / "material.json").is_file()
    assert (folder / "label.jpg").is_file()

    listed = mat_svc.list_materials(category="floss")
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]

    patched = mat_svc.update_material(
        created["id"],
        brand="DMC",
        colour_code="310",
        colour_rgb="0,0,0",
        modifiers=["metallic"],
        quantity="1",
        length_per_skein="8",
        notes="updated",
    )
    assert patched["quantity"] == "1"
    assert patched["length_per_skein"] == "8"
    assert patched["notes"] == "updated"
    assert patched["name"] == "DMC 310"

    mat_svc.delete_material(created["id"])
    assert mat_svc.list_materials(category="floss") == []
    assert not folder.exists()
