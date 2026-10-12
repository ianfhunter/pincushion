"""Craft documentation pages served to the Documentation sidebar."""

from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Any

DOCS_ROOT = Path(__file__).resolve().parent.parent / "docs"

# Sidebar order for the Documentation section.
DOC_PAGES: list[dict[str, str]] = [
    {"id": "folder_layout", "label": "Folder Layout", "file": "folder_layout.md"},
    {"id": "craft_specifics", "label": "Craft Specifics", "file": "craft_specifics.md"},
    {"id": "materials", "label": "Materials", "file": "materials.md"},
]


def list_docs() -> list[dict[str, str]]:
    return [{"id": p["id"], "label": p["label"]} for p in DOC_PAGES]


def _page(doc_id: str) -> dict[str, str] | None:
    for p in DOC_PAGES:
        if p["id"] == doc_id:
            return p
    return None


def _inline_md(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        r'<a href="\2" target="_blank" rel="noopener">\1</a>',
        text,
    )
    text = re.sub(r"\[([^\]]+)\]\((#[^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    return text


def markdown_to_html(md: str) -> str:
    """Minimal Markdown subset for craft docs (headings, lists, code, links)."""
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    in_code = False
    code_buf: list[str] = []
    in_ul = False
    in_ol = False
    table_rows: list[list[str]] = []
    para: list[str] = []

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def flush_table() -> None:
        nonlocal table_rows
        if not table_rows:
            return
        body = table_rows[:]
        table_rows = []
        # Drop markdown separator row (|---|---|)
        if len(body) >= 2 and all(re.match(r"^:?-+:?$", c.strip()) for c in body[1]):
            header, body = body[0], body[2:]
        else:
            header, body = None, body
        out.append("<table>")
        if header:
            out.append(
                "<thead><tr>"
                + "".join(f"<th>{_inline_md(c.strip())}</th>" for c in header)
                + "</tr></thead>"
            )
        out.append("<tbody>")
        for row in body:
            out.append("<tr>" + "".join(f"<td>{_inline_md(c.strip())}</td>" for c in row) + "</tr>")
        out.append("</tbody></table>")

    def flush_para() -> None:
        nonlocal para
        flush_table()
        if para:
            out.append(f"<p>{_inline_md(' '.join(para))}</p>")
            para = []

    for raw in lines:
        if in_code:
            if raw.strip().startswith("```"):
                out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
                code_buf = []
                in_code = False
            else:
                code_buf.append(raw)
            continue
        if raw.strip().startswith("```"):
            flush_para()
            close_lists()
            in_code = True
            continue
        if not raw.strip():
            flush_para()
            close_lists()
            continue
        if "|" in raw and raw.strip().startswith("|"):
            close_lists()
            if para:
                out.append(f"<p>{_inline_md(' '.join(para))}</p>")
                para = []
            cells = [c for c in raw.strip().strip("|").split("|")]
            table_rows.append(cells)
            continue
        heading = re.match(r"^(#{1,3})\s+(.*)$", raw)
        if heading:
            flush_para()
            close_lists()
            level = len(heading.group(1))
            out.append(f"<h{level}>{_inline_md(heading.group(2))}</h{level}>")
            continue
        if re.match(r"^[-*]\s+", raw):
            flush_para()
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{_inline_md(re.sub(r'^[-*]\\s+', '', raw))}</li>")
            continue
        if re.match(r"^\d+\.\s+", raw):
            flush_para()
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{_inline_md(re.sub(r'^\\d+\\.\\s+', '', raw))}</li>")
            continue
        close_lists()
        flush_table()
        para.append(raw.strip())

    flush_para()
    close_lists()
    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
    return "\n".join(out)


def get_doc(doc_id: str) -> dict[str, Any]:
    page = _page(doc_id)
    if not page:
        raise KeyError(doc_id)
    path = DOCS_ROOT / page["file"]
    if not path.is_file():
        raise FileNotFoundError(page["file"])
    md = path.read_text(encoding="utf-8")
    title = page["label"]
    for line in md.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            break
    return {
        "id": page["id"],
        "label": page["label"],
        "title": title,
        "markdown": md,
        "html": markdown_to_html(md),
    }
