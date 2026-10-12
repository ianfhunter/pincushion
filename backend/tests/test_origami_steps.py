"""Tests for origami frame collection and diagram steps."""

from pathlib import Path

from pincushion.services import origami as ori
from pincushion.services import origami_steps as steps


def test_collect_fold_frames_inherits_parent():
    fold = {
        "frame_classes": ["creasePattern"],
        "vertices_coords": [[0, 0], [1, 0], [1, 1], [0, 1]],
        "edges_vertices": [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
        "edges_assignment": ["B", "B", "B", "B", "V"],
        "faces_vertices": [[0, 1, 2], [0, 2, 3]],
        "file_frames": [
            {
                "frame_parent": 0,
                "frame_classes": ["foldedForm"],
                "vertices_coords": [[0, 0, 0], [1, 0, 0], [0.5, 0.5, 0.7], [0, 1, 0]],
            }
        ],
    }
    frames = ori.collect_fold_frames(fold)
    assert len(frames) == 2
    assert frames[0]["frame_classes"] == ["creasePattern"]
    assert frames[1]["frame_classes"] == ["foldedForm"]
    # Inherited topology
    assert frames[1]["edges_vertices"] == fold["edges_vertices"]
    assert frames[1]["faces_vertices"] == fold["faces_vertices"]
    # Overridden coords
    assert frames[1]["vertices_coords"][2][2] == 0.7
    summary = ori.fold_summary(fold)
    assert summary["frame_count"] == 2


def test_origami_steps_roundtrip(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    (tmp_path / "7").mkdir()
    doc = steps.save_steps(
        7,
        {
            "steps": [
                {"title": "Fold in half", "notes": "Valley", "media": "a.png"},
                {"title": "Squash", "file_id": 3, "pdf_page": 2},
            ]
        },
    )
    assert doc["format"] == "pincushion_origami_steps_v1"
    assert len(doc["steps"]) == 2
    assert doc["steps"][0]["title"] == "Fold in half"
    assert doc["steps"][1]["file_id"] == 3
    assert doc["steps"][1]["pdf_page"] == 2
    loaded = steps.load_steps(7)
    assert loaded["steps"][0]["media"] == "a.png"
    enriched = steps.enrich_steps_for_api(7, loaded)
    assert enriched["steps"][0]["preview_url"].endswith("/origami/steps/media/a.png")
    assert "preview.jpg?page=2" in (enriched["steps"][1]["preview_url"] or "")


def test_save_step_media(tmp_path: Path, monkeypatch):
    from pincushion.config import settings

    monkeypatch.setattr(settings, "library_dir", tmp_path)
    name = steps.save_step_media(4, "diagram.PNG", b"\x89PNG\r\n")
    assert name.endswith(".png")
    path = steps.resolve_media_path(4, name)
    assert path.is_file()
    assert path.read_bytes().startswith(b"\x89PNG")
