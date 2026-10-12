# Craft Specifics

Patterns are organised by craft under **Projects**. Extension associations are configurable under **Settings → File Associations**.

## Craft groups

- **Needlework** — Embroidery, Cross-stitch
- **Yarnwork** — Knitting, Crochet
- **Pixel Crafts** — Diamond Painting, Beading, Iron Beading
- **Fabric Construction** — Sewing, Quilting
- **Papercraft** — Origami
- **Other** — catch-all

---

## Embroidery

### Patterns

Default Supported Formats: DST, PES/PEC, JEF, EXP, VP3, XXX, CSQ

### Materials

- Embroidery Floss
- Embroidery Needles
- Embroidery Hoop
- Embroidery Scissors



---

## Cross-stitch

### Patterns

The preferred format for Cross-stitch is the open **OXS** interchange format [Reference](https://www.ursasoftware.com/OXSFormat/).

However it also accepts PDF, XPS, Image formats, Saga, XSP, PAT, XSD

### Materials

---

## Knitting & crochet

Yarnwork patterns use PinCushion’s **Yarn YAML** instruction files (`knitting.yaml` / `crochet.yaml`).

Default associations include PDF, images, craft-specific extensions (e.g. `.knt`, `.skp`, `.fcjson`, `.md`), and the YAML instruction file.

---

## Diamond Painting

Pixel-grid charts with drill-oriented defaults (~10 drills per inch). Colours map to **DMC drill codes** (Settings → Supplies). Storage is PinCushion’s normalized chart grid plus PDF/images as originals.

---

## Beading

Seed-bead pixel-grid patterns. Colours match **Miyuki Delica** or **Toho** (Settings → Supplies). Same normalized chart family as other pixel crafts; PDF/images by default.

---

## Iron Beading

Perler / Hama / fuse-bead grids (~5 beads per inch). Colours match **Perler**, **Hama**, or **Artkal** (Settings → Supplies). Editable storage is the normalized chart grid.

---

## Sewing

Primarily document patterns (PDF/images). Originals are listed under the pattern’s files; there is no PinCushion-native sewing CAD format yet.

---

## Quilting

PDF documents or machine quilting / embroidery-related files. Machine formats that overlap embroidery (e.g. DST, EXP, CSQ, HQF where supported) use the machine preview path; documents stay as originals.

---

## Origami

Digital crease patterns use the **FOLD** JSON format (`.fold` or FOLD-shaped `.json`).

Typical on-disk companions: `origami.json`, `origami_preview.svg`, optional `origami_steps.yaml` and a `steps/` media folder. Prefer FOLD files that include `faces_vertices` for a solid mesh; edge-only files still describe the crease wireframe.

---

## Other

Catch-all for patterns that do not fit a dedicated category. Use a more specific craft when possible so file associations stay meaningful.
