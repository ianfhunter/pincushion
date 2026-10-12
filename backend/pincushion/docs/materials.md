# Materials

Materials are stash items that sit beside your projects: yarns, floss, tools, fabric, and other consumables or equipment. They live under `/data/library/materials/` and may span several crafts.

See **Folder Layout** for the on-disk tree.

## Top-level categories

Typical top-level folders:

| Folder | Examples |
|--------|----------|
| `wool/` | Yarn cakes, skeins, leftover balls |
| `floss/` | Embroidery / cross-stitch thread |
| `tools/` | Needles, hooks, scissors, and other hardware |
| `fabric/` | Aida, linen, and other yardage |

Nested folders are fine when it helps you browse — e.g. `tools/needles/`, `tools/hooks/`, `fabric/aida/`.

## How materials relate to crafts

A material is not owned by a single craft. The same wool may appear in knitting and crochet notes; the same scissors may serve embroidery and sewing. Craft docs under **Craft Specifics** list materials that craft commonly uses; the Materials library is where those physical items are catalogued.

## What goes in a material folder

Each material folder can hold whatever helps you track that stash item:

- Photos of labels, dye lots, or colour cards
- Purchase receipts or order confirmations
- Inventory notes (length remaining, brand, colour id)
- Spec sheets or care instructions

PinCushion does not require a fixed file format inside material folders yet — organise them in a way you can recognise later.

## Projects vs materials

- **Projects** (`/data/library/patterns/…`) — designs and pattern packages you are collecting or making
- **Materials** (`/data/library/materials/…`) — the physical stash those projects draw from
