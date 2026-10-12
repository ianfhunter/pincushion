/** Temporary product focus: Projects + Materials browsing only. */
const SHOW_SEARCH = false;
const SHOW_WANTED = false;
const INTERACTIVE_TOOLS = false;

type View =
  | "search"
  | "wanted"
  | "library"
  | "project_new"
  | "materials"
  | "material_new"
  | "docs"
  | "settings_indexers"
  | "settings_file_associations"
  | "settings_supplies"
  | "settings_about"
  | "pattern"
  | "not_found";

/** Top-level materials stash categories (see Folder Layout / Materials docs). */
const MATERIAL_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: "wool", label: "Wool", icon: "fa-socks" },
  { id: "floss", label: "Floss", icon: "fa-palette" },
  { id: "tools", label: "Tools", icon: "fa-scissors" },
  { id: "fabric", label: "Fabric", icon: "fa-shirt" },
];

type ProjectSort = "title_asc" | "title_desc" | "newest" | "oldest";

function loadPinnedIds(key: string): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function savePinnedIds(key: string, ids: string[]) {
  sessionStorage.setItem(key, JSON.stringify([...new Set(ids)]));
}

function slugifyCategory(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "custom";
}

type LibrarySection =
  | "cross_stitch"
  | "crochet"
  | "knitting"
  | "diamond_painting"
  | "beading"
  | "iron_beading"
  | "embroidery"
  | "sewing"
  | "quilting"
  | "origami"
  | "other";

const SETTINGS_VIEWS: View[] = [
  "settings_file_associations",
  "settings_supplies",
  "settings_indexers",
  "settings_about",
];

const DOCS_NAV: { id: string; label: string }[] = [
  { id: "folder_layout", label: "Folder Layout" },
  { id: "craft_specifics", label: "Craft Specifics" },
  { id: "materials", label: "Materials" },
];

const DEFAULT_DOCS_PAGE = DOCS_NAV[0]!.id;

const NEEDLEWORK_CRAFTS: LibrarySection[] = ["embroidery", "cross_stitch"];
const YARNWORK_CRAFTS: LibrarySection[] = ["knitting", "crochet"];
const PIXEL_CRAFTS: LibrarySection[] = ["diamond_painting", "beading", "iron_beading"];
const FABRIC_CONSTRUCTION_CRAFTS: LibrarySection[] = ["sewing", "quilting"];
const PAPERCRAFT_CRAFTS: LibrarySection[] = ["origami"];

const LIBRARY_SECTIONS: { id: LibrarySection; label: string; slug: string }[] = [
  { id: "embroidery", label: "Embroidery", slug: "embroidery" },
  { id: "cross_stitch", label: "Cross-stitch", slug: "cross-stitch" },
  { id: "knitting", label: "Knitting", slug: "knitting" },
  { id: "crochet", label: "Crochet", slug: "crochet" },
  { id: "diamond_painting", label: "Diamond Painting", slug: "diamond-painting" },
  { id: "beading", label: "Beading", slug: "beading" },
  { id: "iron_beading", label: "Iron Beading", slug: "iron-beading" },
  { id: "sewing", label: "Sewing", slug: "sewing" },
  { id: "quilting", label: "Quilting", slug: "quilting" },
  { id: "origami", label: "Origami", slug: "origami" },
  { id: "other", label: "Other", slug: "other" },
];

/** Font Awesome Free solid class names per craft (without the fa-solid prefix). */
const CRAFT_ICONS: Record<LibrarySection, string> = {
  embroidery: "fa-shirt",
  cross_stitch: "fa-table-cells",
  knitting: "fa-socks",
  crochet: "fa-link",
  diamond_painting: "fa-gem",
  beading: "fa-ellipsis",
  iron_beading: "fa-border-all",
  sewing: "fa-scissors",
  quilting: "fa-layer-group",
  origami: "fa-paper-plane",
  other: "fa-folder",
};

function craftIconHtml(craftId: string) {
  const icon =
    CRAFT_ICONS[craftId as LibrarySection] || CRAFT_ICONS.other;
  return `<i class="fa-solid ${icon} craft-icon" aria-hidden="true"></i>`;
}

type LibraryNavGroupId =
  | "needlework"
  | "yarnwork"
  | "pixel_crafts"
  | "fabric_construction"
  | "papercraft";

type LibraryNavItem =
  | { kind: "section"; id: LibrarySection }
  | { kind: "group"; id: LibraryNavGroupId; label: string; children: LibrarySection[] };

const LIBRARY_NAV: LibraryNavItem[] = [
  { kind: "group", id: "needlework", label: "Needlework", children: NEEDLEWORK_CRAFTS },
  { kind: "group", id: "yarnwork", label: "Yarnwork", children: YARNWORK_CRAFTS },
  { kind: "group", id: "pixel_crafts", label: "Pixel Crafts", children: PIXEL_CRAFTS },
  {
    kind: "group",
    id: "fabric_construction",
    label: "Fabric Construction",
    children: FABRIC_CONSTRUCTION_CRAFTS,
  },
  { kind: "group", id: "papercraft", label: "Papercraft", children: PAPERCRAFT_CRAFTS },
  { kind: "section", id: "other" },
];

function libraryNavGroupForSection(section: LibrarySection): LibraryNavGroupId | null {
  for (const item of LIBRARY_NAV) {
    if (item.kind === "group" && item.children.includes(section)) return item.id;
  }
  return null;
}

function isSettingsView(v: View) {
  return SETTINGS_VIEWS.includes(v);
}

function isLibraryView(v: View) {
  return v === "library" || v === "project_new" || v === "pattern";
}

function isMaterialsView(v: View) {
  return v === "materials" || v === "material_new";
}

function isWantedView(v: View) {
  return v === "wanted";
}

function isDocsView(v: View) {
  return v === "docs";
}

function librarySectionFromCraft(craft: string | null | undefined): LibrarySection {
  if (LIBRARY_SECTIONS.some((s) => s.id === craft)) return craft as LibrarySection;
  return "other";
}

function librarySectionLabel(section: LibrarySection | null = librarySection) {
  if (!section) return "Projects";
  return LIBRARY_SECTIONS.find((s) => s.id === section)?.label || "Projects";
}

function craftIdForLibrarySection(section: LibrarySection | null = librarySection): string {
  return section || "cross_stitch";
}

interface CraftConfig {
  craft_id: string;
  label: string;
  extensions: string[];
  enabled: boolean;
}

interface IndexerInfo {
  id: string;
  name: string;
  capabilities: {
    status: string;
    site_url: string;
    description: string;
    search_enabled: boolean;
    can_download: boolean;
    access_method: string;
  };
  craft_enabled: Record<string, boolean>;
}

interface ExternalHit {
  indexer_id: string;
  external_id: string;
  title: string;
  designer?: string;
  description?: string;
  source_url: string;
  license_class: string;
  thumbnail_url?: string;
  metadata?: { licenseurl?: string; license?: string };
}

interface PatternSummary {
  id: number;
  title: string;
  source?: string | null;
  craft: string;
  pattern_format: string;
  thumbnail_url?: string;
  width_stitches?: number;
  height_stitches?: number;
  color_count?: number;
  license_class: string;
  description?: string;
  date_discovered?: string | null;
  date_downloaded?: string | null;
}

interface PatternDetail extends PatternSummary {
  description?: string;
  source_url?: string;
  has_normalized: boolean;
  project_status?: string;
  file_count: number;
}

interface PatternFile {
  id: number;
  filename: string;
  mime_type: string;
  role?: string;
  size_bytes?: number;
}

interface Normalized {
  format: string;
  title?: string;
  width_stitches: number;
  height_stitches: number;
  fabric_count?: number | null;
  palette: {
    index: number;
    number: string;
    name: string;
    color: string;
    symbol?: string;
    stitch_count?: number;
    strands?: number;
  }[];
  full_stitches: { x: number; y: number; palindex: number }[];
  backstitches?: { x1: number; y1: number; x2: number; y2: number; palindex: number }[];
  part_stitches?: {
    x: number;
    y: number;
    palindex1: number;
    palindex2: number;
    direction: number;
    major?: number;
  }[];
  ornaments?: { x: number; y: number; palindex: number; objecttype: string; direction?: number }[];
  recognition?: { symbol_mode?: string; [key: string]: unknown };
}

/** mismatch.co.uk / Dyer formula: stitches_per_skein = 255 * count / strands */
function stitchesPerSkein(fabricCount: number, strands: number) {
  const count = Math.max(1, Math.round(fabricCount) || 14);
  const used = Math.max(1, Math.min(6, Math.round(strands) || 2));
  return (255 * count) / used;
}

function skeinsNeeded(stitchCount: number, fabricCount: number, strands: number) {
  if (stitchCount <= 0) return 0;
  return stitchCount / stitchesPerSkein(fabricCount, strands);
}

function formatSkeins(needed: number) {
  if (needed <= 0) return "—";
  return String(Math.max(1, Math.ceil(needed - 1e-9)));
}

/** Thread-Bare style: design inches = stitches / count; fabric = design + 2 × border. */
function fabricInches(stitches: number, fabricCount: number) {
  const count = Math.max(1, fabricCount);
  return Math.max(0, stitches) / count;
}

function formatInches(inches: number) {
  if (!Number.isFinite(inches) || inches <= 0) return "—";
  const quarters = Math.round(inches * 4) / 4;
  const whole = Math.floor(quarters + 1e-9);
  const frac = Math.round((quarters - whole) * 4);
  const fracMap: Record<number, string> = { 0: "", 1: "¼", 2: "½", 3: "¾" };
  if (frac === 0) return `${whole}"`;
  if (whole === 0) return `${fracMap[frac]}"`;
  return `${whole}${fracMap[frac]}"`;
}

function formatCm(inches: number) {
  if (!Number.isFinite(inches) || inches <= 0) return "—";
  return `${(inches * 2.54).toFixed(1)} cm`;
}

const app = document.getElementById("app")!;

/** Tear down pattern-view resources (WebGL origami viewer, etc.) before remount. */
let patternViewCleanup: (() => void) | null = null;

function disposePatternView() {
  try {
    patternViewCleanup?.();
  } catch {
    /* ignore */
  }
  patternViewCleanup = null;
}
const SEARCH_CACHE_KEY = "pincushion_last_search";

interface SavedSearch {
  q: string;
  indexerId: string;
  craftId: string;
  results: ExternalHit[];
}

function loadSavedSearch(): SavedSearch | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSearch;
    if (typeof parsed.q !== "string" || !Array.isArray(parsed.results)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSavedSearch(q: string, indexerId: string, craftId: string, results: ExternalHit[]) {
  const payload: SavedSearch = { q, indexerId, craftId, results };
  sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(payload));
}

function bindEmptyCraftLink(container: HTMLElement) {
  container.querySelector("[data-view]")?.addEventListener("click", () => {
    view = "settings_file_associations";
    render();
  });
}

const VIEWS: View[] = [
  "search",
  "wanted",
  "library",
  "project_new",
  "materials",
  "material_new",
  "docs",
  "settings_indexers",
  "settings_file_associations",
  "settings_supplies",
  "settings_about",
  "pattern",
];

function normalizeHash(hash: string) {
  const raw = (hash || "").replace(/^#/, "").replace(/^\/+|\/+$/g, "");
  return raw ? `#/${raw}` : "#/projects";
}

function routeHash(nextView: View = view, patternId: number | null = selectedPatternId) {
  if (nextView === "not_found") return "#/404";
  if (nextView === "pattern" && patternId != null) return `#/pattern/${patternId}`;
  if (nextView === "pattern") {
    const slug = LIBRARY_SECTIONS.find((s) => s.id === librarySection)?.slug;
    return slug ? `#/projects/${slug}` : "#/projects";
  }
  if (nextView === "project_new") {
    const slug = LIBRARY_SECTIONS.find((s) => s.id === librarySection)?.slug;
    return slug ? `#/projects/${slug}/new` : "#/projects";
  }
  if (nextView === "library") {
    if (!librarySection) return "#/projects";
    const slug = LIBRARY_SECTIONS.find((s) => s.id === librarySection)?.slug;
    return slug ? `#/projects/${slug}` : "#/projects";
  }
  if (nextView === "material_new") {
    if (!materialsCategory) return "#/materials";
    if (editingMaterialId != null) return `#/materials/${materialsCategory}/${editingMaterialId}`;
    return `#/materials/${materialsCategory}/new`;
  }
  if (nextView === "materials") {
    if (!materialsCategory) return "#/materials";
    return `#/materials/${materialsCategory}`;
  }
  if (nextView === "wanted") {
    if (!SHOW_WANTED) return "#/projects";
    const slug = LIBRARY_SECTIONS.find((s) => s.id === wantedSection)?.slug || "cross-stitch";
    return `#/wanted/${slug}`;
  }
  if (nextView === "search" && !SHOW_SEARCH) return "#/projects";
  if (nextView === "docs") {
    const slug = DOCS_NAV.some((d) => d.id === docsPageId) ? docsPageId : DEFAULT_DOCS_PAGE;
    return `#/docs/${slug}`;
  }
  if (nextView === "settings_file_associations") return "#/settings/file-associations";
  if (nextView === "settings_supplies") return "#/settings/supplies";
  if (nextView === "settings_indexers") return "#/settings/indexers";
  if (nextView === "settings_about") return "#/settings/about";
  return `#/${nextView}`;
}

function applyRouteFromLocation() {
  const raw = normalizeHash(location.hash).slice(2);
  const parts = raw.split("/").filter(Boolean);
  const name = parts[0] || "projects";
  if (name === "404" || name === "not_found") {
    view = "not_found";
    selectedPatternId = null;
    if (!notFoundPath) notFoundPath = raw;
    return;
  }
  if (name === "pattern") {
    const id = Number(parts[1]);
    if (Number.isFinite(id) && id > 0) {
      view = "pattern";
      selectedPatternId = id;
      notFoundPath = "";
      return;
    }
    view = "not_found";
    selectedPatternId = null;
    notFoundPath = raw || "pattern";
    return;
  }
  // Projects (canonical) and legacy #/library hashes.
  if (name === "projects" || name === "library") {
    if (!parts[1]) {
      view = "library";
      selectedPatternId = null;
      librarySection = null;
      notFoundPath = "";
      return;
    }
    const slug = parts[1];
    const section = LIBRARY_SECTIONS.find((s) => s.slug === slug)?.id;
    if (!section) {
      view = "not_found";
      selectedPatternId = null;
      notFoundPath = raw;
      return;
    }
    librarySection = section;
    selectedPatternId = null;
    notFoundPath = "";
    if (parts[2] === "new") {
      view = "project_new";
      return;
    }
    view = "library";
    return;
  }
  if (name === "materials") {
    if (!parts[1]) {
      view = "materials";
      selectedPatternId = null;
      materialsCategory = null;
      notFoundPath = "";
      return;
    }
    const catId = parts[1];
    const known =
      MATERIAL_CATEGORIES.some((c) => c.id === catId) ||
      loadPinnedIds("pincushion_pinned_materials").includes(catId);
    if (!known) {
      view = "not_found";
      selectedPatternId = null;
      notFoundPath = raw;
      return;
    }
    materialsCategory = catId;
    sessionStorage.setItem("pincushion_materials_category", materialsCategory);
    selectedPatternId = null;
    notFoundPath = "";
    if (parts[2] === "new") {
      editingMaterialId = null;
      view = "material_new";
      return;
    }
    if (parts[2]) {
      const mid = Number(parts[2]);
      if (Number.isFinite(mid) && mid > 0) {
        editingMaterialId = mid;
        view = "material_new";
        return;
      }
      view = "not_found";
      notFoundPath = raw;
      return;
    }
    editingMaterialId = null;
    view = "materials";
    return;
  }
  if (name === "wanted") {
    if (!SHOW_WANTED) {
      view = "library";
      selectedPatternId = null;
      librarySection = null;
      notFoundPath = "";
      return;
    }
    const slug = parts[1] || "cross-stitch";
    const section = LIBRARY_SECTIONS.find((s) => s.slug === slug)?.id;
    if (!section && parts[1]) {
      view = "not_found";
      selectedPatternId = null;
      notFoundPath = raw;
      return;
    }
    view = "wanted";
    selectedPatternId = null;
    wantedSection = section || "cross_stitch";
    if (wantedSection === "other") wantedSection = "cross_stitch";
    selectedCraftId = craftIdForLibrarySection(wantedSection);
    sessionStorage.setItem("pincushion_wanted_section", wantedSection);
    sessionStorage.setItem("pincushion_craft", selectedCraftId);
    notFoundPath = "";
    return;
  }
  if (name === "search" && !SHOW_SEARCH) {
    view = "library";
    selectedPatternId = null;
    librarySection = null;
    notFoundPath = "";
    return;
  }
  if (name === "docs") {
    const slug = parts[1] || DEFAULT_DOCS_PAGE;
    if (parts[1] && !DOCS_NAV.some((d) => d.id === slug)) {
      view = "not_found";
      selectedPatternId = null;
      notFoundPath = raw;
      return;
    }
    view = "docs";
    selectedPatternId = null;
    docsPageId = DOCS_NAV.some((d) => d.id === slug) ? slug : DEFAULT_DOCS_PAGE;
    sessionStorage.setItem("pincushion_docs_page", docsPageId);
    notFoundPath = "";
    return;
  }
  if (name === "settings") {
    const sub = parts[1] || "file-associations";
    const known = ["about", "indexers", "supplies", "file-associations"];
    if (parts[1] && !known.includes(sub)) {
      view = "not_found";
      selectedPatternId = null;
      notFoundPath = raw;
      return;
    }
    if (sub === "about") view = "settings_about";
    else if (sub === "indexers") view = "settings_indexers";
    else if (sub === "supplies") view = "settings_supplies";
    else view = "settings_file_associations";
    selectedPatternId = null;
    notFoundPath = "";
    return;
  }
  // Back-compat hashes.
  if (name === "craft_files") {
    view = "settings_file_associations";
    selectedPatternId = null;
    notFoundPath = "";
    return;
  }
  if (name === "indexers") {
    view = "settings_indexers";
    selectedPatternId = null;
    notFoundPath = "";
    return;
  }
  if (VIEWS.includes(name as View) && name !== "pattern" && name !== "not_found") {
    view = name as View;
    selectedPatternId = null;
    notFoundPath = "";
    return;
  }
  view = "not_found";
  selectedPatternId = null;
  notFoundPath = raw || name;
}

let syncingRoute = false;
function syncRoute() {
  const next = routeHash();
  if (normalizeHash(location.hash) === next) return;
  syncingRoute = true;
  history.replaceState(null, "", next);
  syncingRoute = false;
}

let view: View = "library";
let notFoundPath = "";
let selectedPatternId: number | null = null;
let librarySection: LibrarySection | null = (() => {
  const raw = sessionStorage.getItem("pincushion_library_section");
  if (!raw || raw === "all") return null;
  return LIBRARY_SECTIONS.some((s) => s.id === raw) ? (raw as LibrarySection) : null;
})();
let materialsCategory: string | null = (() => {
  const raw = sessionStorage.getItem("pincushion_materials_category");
  if (!raw || raw === "all") return null;
  const pinned = loadPinnedIds("pincushion_pinned_materials");
  return MATERIAL_CATEGORIES.some((c) => c.id === raw) || pinned.includes(raw) ? raw : null;
})();
let pinnedProjectCrafts = loadPinnedIds("pincushion_pinned_crafts");
let pinnedMaterialCategories = loadPinnedIds("pincushion_pinned_materials");
let projectListSort: ProjectSort =
  (sessionStorage.getItem("pincushion_project_sort") as ProjectSort) || "title_asc";
let projectListFilter = sessionStorage.getItem("pincushion_project_filter") || "";
let materialListFilter = sessionStorage.getItem("pincushion_material_filter") || "";
let editingMaterialId: number | null = null;
let wantedSection: LibrarySection =
  (sessionStorage.getItem("pincushion_wanted_section") as LibrarySection) || "cross_stitch";
if (!LIBRARY_SECTIONS.some((s) => s.id === wantedSection) || wantedSection === "other") {
  wantedSection = "cross_stitch";
}
let docsPageId = sessionStorage.getItem("pincushion_docs_page") || DEFAULT_DOCS_PAGE;
if (!DOCS_NAV.some((d) => d.id === docsPageId)) docsPageId = DEFAULT_DOCS_PAGE;
let selectedIndexerId = sessionStorage.getItem("pincushion_indexer") || "all";
let selectedCraftId = sessionStorage.getItem("pincushion_craft") || "cross_stitch";
// Route apply may set selectedCraftId (Wanted) — must run after that binding exists.
applyRouteFromLocation();
let indexersCache: IndexerInfo[] = [];
type ResultSort = "title_asc" | "title_desc" | "source_asc" | "source_desc";
let searchResultHits: ExternalHit[] = [];
let searchResultsCacheNote = "";
let searchResultSourceFilter = sessionStorage.getItem("pincushion_result_source") || "all";
let searchResultSort = (sessionStorage.getItem("pincushion_result_sort") as ResultSort) || "title_asc";
/** Bumps when a new search starts so late indexer responses don't overwrite newer results. */
let searchGeneration = 0;
type SymbolMode = "none" | "alphabet" | "numbers" | "symbols" | "alt";
const SYMBOL_MODES: { id: SymbolMode; label: string }[] = [
  { id: "none", label: "No symbols" },
  { id: "alphabet", label: "Alphabet" },
  { id: "numbers", label: "Numbers" },
  { id: "symbols", label: "Symbols" },
  { id: "alt", label: "Alt symbols" },
];
const SYMBOL_SET =
  "■□▲△▼▽◆◇●○★☆♠♥♦♣$€£¥¢§†‡¶※#@&%+×÷=¤⊕⊗•◦▬▪▫◐◑✚✕▣▤▥▦▧▨▩◊⊞⊟⊠";
const ALT_SYMBOL_SET =
  "ΑΒΓΔΘΛΞΠΣΦΨΩαβγδεθλσφω←↑→↓↔↕±∞√∑∏∂∇∫≈≠≤≥☀☁☂☎☑☒♪♫☺☼♀♂☾⚡⚓⚙❖❋✳✴";

function loadSymbolMode(): SymbolMode {
  const raw = sessionStorage.getItem("pincushion_symbol_mode");
  return SYMBOL_MODES.some((m) => m.id === raw) ? (raw as SymbolMode) : "none";
}

type FabricTexture = "blank" | "aida" | "linen" | "canvas" | "pegboard";
type PreviewCellStyle = "thread" | "diamond" | "bead" | "fuse_bead";
const FABRIC_TEXTURES: { id: FabricTexture; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "aida", label: "Aida" },
  { id: "linen", label: "Linen" },
  { id: "canvas", label: "Canvas" },
  { id: "pegboard", label: "Pegboard" },
];
const NEEDLEWORK_TEXTURES: { id: FabricTexture; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "aida", label: "Aida" },
  { id: "linen", label: "Linen" },
];
const PIXEL_TEXTURES: { id: FabricTexture; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "canvas", label: "Canvas" },
];
const PEGBOARD_TEXTURES: { id: FabricTexture; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "pegboard", label: "Pegboard" },
];
const FABRIC_COLOURS = [
  { id: "cream", hex: "#f3ebe0", label: "Cream" },
  { id: "white", hex: "#f7f4ef", label: "White" },
  { id: "ivory", hex: "#efe2c8", label: "Ivory" },
  { id: "khaki", hex: "#d8c39a", label: "Khaki" },
  { id: "sage", hex: "#c5d1c0", label: "Sage" },
  { id: "sky", hex: "#d5e4ef", label: "Sky" },
  { id: "blush", hex: "#efd5d5", label: "Blush" },
  { id: "charcoal", hex: "#3a3a3a", label: "Charcoal" },
];

function loadFabricTexture(): FabricTexture {
  const raw = sessionStorage.getItem("pincushion_fabric_texture");
  return FABRIC_TEXTURES.some((t) => t.id === raw) ? (raw as FabricTexture) : "aida";
}

function previewCellStyle(craftId: string | null | undefined): PreviewCellStyle {
  if (craftId === "diamond_painting") return "diamond";
  if (craftId === "iron_beading") return "fuse_bead";
  if (craftId === "beading") return "bead";
  return "thread";
}

function texturesForCraft(craftId: string | null | undefined) {
  if (craftId === "iron_beading") return PEGBOARD_TEXTURES;
  return isPixelCraft(craftId) ? PIXEL_TEXTURES : NEEDLEWORK_TEXTURES;
}

function resolvePreviewTexture(craftId: string | null | undefined, texture: FabricTexture): FabricTexture {
  const allowed = texturesForCraft(craftId);
  if (allowed.some((t) => t.id === texture)) return texture;
  if (craftId === "iron_beading") return "pegboard";
  return isPixelCraft(craftId) ? "canvas" : "aida";
}

function defaultGridDensity(craftId: string | null | undefined) {
  if (craftId === "iron_beading") return 5; // ~5 mm Perler / Hama on pegboard
  if (isPixelCraft(craftId)) return 10;
  return 14;
}

function loadFabricColour(): string {
  const raw = (sessionStorage.getItem("pincushion_fabric_colour") || "").toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  return FABRIC_COLOURS[0].hex;
}

function loadCenterLines(): boolean {
  return sessionStorage.getItem("pincushion_center_lines") === "1";
}

const gridState = {
  zoom: 16,
  symbolMode: loadSymbolMode(),
  marked: new Set<string>(),
  fabricTexture: loadFabricTexture(),
  fabricColour: loadFabricColour(),
  centerLines: loadCenterLines(),
};

function symbolModeLabel(mode: SymbolMode = gridState.symbolMode) {
  return SYMBOL_MODES.find((m) => m.id === mode)?.label || "No symbols";
}

function cycleSymbolMode(): SymbolMode {
  const i = SYMBOL_MODES.findIndex((m) => m.id === gridState.symbolMode);
  gridState.symbolMode = SYMBOL_MODES[(i + 1) % SYMBOL_MODES.length].id;
  sessionStorage.setItem("pincushion_symbol_mode", gridState.symbolMode);
  return gridState.symbolMode;
}

function paletteOrderIndex(palette: Normalized["palette"], palindex: number) {
  const used = palette.filter((p) => p.index > 0).sort((a, b) => a.index - b.index);
  return used.findIndex((p) => p.index === palindex);
}

function symbolForPalette(palette: Normalized["palette"], palindex: number, mode = gridState.symbolMode) {
  if (mode === "none" || palindex <= 0) return "";
  const order = paletteOrderIndex(palette, palindex);
  if (order < 0) return "";
  if (mode === "alphabet") {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    if (order < letters.length) return letters[order];
    return `${letters[order % 26]}${Math.floor(order / 26)}`;
  }
  if (mode === "numbers") return String(order + 1);
  const set = mode === "symbols" ? SYMBOL_SET : ALT_SYMBOL_SET;
  return set[order % set.length] || String(order + 1);
}

function contrastInk(raw: string) {
  const h = raw.replace("#", "");
  if (h.length !== 6) return "#111";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140 ? "#fff" : "#111";
}
let chartEditKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

function clearChartEditKeys() {
  if (!chartEditKeyHandler) return;
  document.removeEventListener("keydown", chartEditKeyHandler);
  chartEditKeyHandler = null;
}

const SETTINGS_NAV: { view: View; label: string }[] = [
  { view: "settings_file_associations", label: "File Associations" },
  { view: "settings_supplies", label: "Supplies" },
  { view: "settings_about", label: "About" },
];

interface FlossBrandInfo {
  id: string;
  label: string;
  description: string;
  color_count: number;
  available: boolean;
}

interface SuppliesSettings {
  floss_brand: string;
  floss_brands: FlossBrandInfo[];
  craft_brands?: Record<string, string>;
  craft_palettes?: {
    craft_id: string;
    label: string;
    description: string;
    brand: string;
    brands: FlossBrandInfo[];
  }[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

async function loadIndexers() {
  indexersCache = await api<IndexerInfo[]>("/api/indexers");
}

function indexerName(id: string) {
  return indexersCache.find((i) => i.id === id)?.name || id;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s);
}

function statusBadge(status: string) {
  if (status === "planned") return `<span class="badge badge-planned">Planned</span>`;
  if (status === "index_only") return `<span class="badge badge-index">Index only</span>`;
  return `<span class="badge">Active</span>`;
}

function materialCategoryLabel(id: string | null = materialsCategory) {
  if (!id) return "Materials";
  const known = MATERIAL_CATEGORIES.find((c) => c.id === id);
  if (known) return known.label;
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function currentPageLabel(activeView: View) {
  if (activeView === "pattern") return `Projects · ${librarySectionLabel()}`;
  if (activeView === "project_new") return `New · ${librarySectionLabel()}`;
  if (activeView === "library") {
    return librarySection ? `Projects · ${librarySectionLabel()}` : "Projects";
  }
  if (activeView === "material_new") {
    return editingMaterialId != null
      ? `Edit · ${materialCategoryLabel()}`
      : `New · ${materialCategoryLabel()}`;
  }
  if (activeView === "materials") {
    return materialsCategory ? `Materials · ${materialCategoryLabel()}` : "Materials";
  }
  if (isWantedView(activeView)) return `Wanted · ${librarySectionLabel(wantedSection)}`;
  if (isDocsView(activeView)) {
    const page = DOCS_NAV.find((d) => d.id === docsPageId)?.label;
    return page ? `Docs · ${page}` : "Documentation";
  }
  if (isSettingsView(activeView)) {
    const sub = SETTINGS_NAV.find((n) => n.view === activeView)?.label;
    return sub ? `Settings · ${sub}` : "Settings";
  }
  if (activeView === "search") return "Search";
  if (activeView === "not_found") return "Not found";
  return "PinCushion";
}

function closeMobileNav() {
  app.querySelector(".app-shell")?.classList.remove("nav-open");
}

function craftNavSubs(
  activeView: "library" | "wanted",
  activeSection: LibrarySection,
  openGroup: LibraryNavGroupId | null
) {
  const navItems =
    activeView === "wanted" ? LIBRARY_NAV.filter((item) => item.kind !== "section" || item.id !== "other") : LIBRARY_NAV;
  return navItems.map((item) => {
    if (item.kind === "section") {
      const s = LIBRARY_SECTIONS.find((x) => x.id === item.id)!;
      return `<button type="button" data-view="${activeView}" data-${activeView}-section="${s.id}" class="nav-sub-btn${
        activeSection === s.id ? " active" : ""
      }">${s.label}</button>`;
    }
    const groupOpen = openGroup === item.id;
    const childBtns = item.children
      .map((id) => {
        const s = LIBRARY_SECTIONS.find((x) => x.id === id)!;
        return `<button type="button" data-view="${activeView}" data-${activeView}-section="${s.id}" class="nav-sub-btn nav-sub-nested${
          activeSection === s.id ? " active" : ""
        }">${s.label}</button>`;
      })
      .join("");
    return `
      <div class="nav-nested-group${groupOpen ? " is-open" : ""}" data-nav-group="${activeView}-${item.id}">
        <button type="button" class="nav-sub-btn nav-sub-group-label${
          groupOpen ? " active" : ""
        }" data-nav-group-toggle="${activeView}-${item.id}" aria-expanded="${groupOpen ? "true" : "false"}">${item.label}</button>
        <div class="nav-sub-nested-list" role="group" aria-label="${item.label}">${childBtns}</div>
      </div>`;
  }).join("");
}

function shell(content: string, activeView: View = view) {
  const settingsOpen = isSettingsView(activeView);
  const libraryOpen = isLibraryView(activeView);
  const materialsOpen = isMaterialsView(activeView);
  const docsOpen = isDocsView(activeView);
  const libraryBlock = `
    <div class="nav-group">
      <button type="button" data-view="library" data-library-root="1" class="nav-parent${
        libraryOpen ? " active" : ""
      }">Projects</button>
    </div>`;
  const materialsBlock = `
    <div class="nav-group">
      <button type="button" data-view="materials" data-materials-root="1" class="nav-parent${
        materialsOpen ? " active" : ""
      }">Materials</button>
    </div>`;
  const settingsSubs = SETTINGS_NAV.map(
    (n) =>
      `<button type="button" data-view="${n.view}" class="nav-sub-btn${
        activeView === n.view ? " active" : ""
      }">${n.label}</button>`
  ).join("");
  const settingsBlock = `
    <div class="nav-group">
      <button type="button" data-view="settings_file_associations" class="nav-parent${
        settingsOpen ? " active" : ""
      }" aria-expanded="${settingsOpen ? "true" : "false"}">Settings</button>
      ${
        settingsOpen
          ? `<div class="nav-sub" role="group" aria-label="Settings">${settingsSubs}</div>`
          : ""
      }
    </div>`;
  const docsSubs = DOCS_NAV.map(
    (d) =>
      `<button type="button" data-view="docs" data-docs-page="${d.id}" class="nav-sub-btn${
        docsOpen && docsPageId === d.id ? " active" : ""
      }">${d.label}</button>`
  ).join("");
  const docsBlock = `
    <div class="nav-group">
      <button type="button" data-view="docs" data-docs-page="${docsPageId}" class="nav-parent${
        docsOpen ? " active" : ""
      }" aria-expanded="${docsOpen ? "true" : "false"}">Documentation</button>
      ${
        docsOpen
          ? `<div class="nav-sub" role="group" aria-label="Documentation">${docsSubs}</div>`
          : ""
      }
    </div>`;
  const pageLabel = currentPageLabel(activeView);
  app.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">PinCushion</div>
        <div class="sidebar-label">Browse</div>
        <nav class="sidebar-nav">
          ${libraryBlock}
          ${materialsBlock}
          ${docsBlock}
          ${settingsBlock}
        </nav>
      </aside>
      <div class="main-column">
        <header class="mobile-topbar">
          <button type="button" class="sidebar-toggle" id="sidebarToggle" aria-label="Open navigation menu">☰</button>
          <span class="mobile-title">PinCushion</span>
          <span class="mobile-page">${escapeHtml(pageLabel)}</span>
        </header>
        <div class="content">${content}</div>
      </div>
    </div>`;

  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    app.querySelector(".app-shell")?.classList.toggle("nav-open");
  });
  document.getElementById("sidebarBackdrop")?.addEventListener("click", closeMobileNav);

  app.querySelectorAll(".sidebar-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn as HTMLButtonElement;
      const next = el.dataset.view as View;
      const docPage = el.dataset.docsPage;
      view = next;
      selectedPatternId = null;
      if (next === "library") {
        librarySection = null;
        sessionStorage.setItem("pincushion_library_section", "all");
      }
      if (next === "materials") {
        materialsCategory = null;
        sessionStorage.setItem("pincushion_materials_category", "all");
      }
      if (next === "docs") {
        docsPageId =
          docPage && DOCS_NAV.some((d) => d.id === docPage) ? docPage : docsPageId || DEFAULT_DOCS_PAGE;
        sessionStorage.setItem("pincushion_docs_page", docsPageId);
      }
      closeMobileNav();
      render();
    });
  });
}

async function loadCrafts(): Promise<CraftConfig[]> {
  return api<CraftConfig[]>("/api/craft-files");
}

function normalizeExtension(raw: string): string {
  const ext = raw.trim().toLowerCase();
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
}

function extensionChipHtml(ext: string) {
  const safe = escapeHtml(ext);
  return `<span class="ext-chip" data-ext="${safe}">${safe}<button type="button" class="ext-remove" aria-label="Remove ${safe}">×</button></span>`;
}

function extensionsListHtml(extensions: string[]) {
  return extensions.map(extensionChipHtml).join("");
}

function readExtensionsFromCard(card: HTMLElement): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  card.querySelectorAll<HTMLElement>(".ext-chip").forEach((chip) => {
    const ext = normalizeExtension(chip.dataset.ext || chip.textContent || "");
    if (ext && !seen.has(ext)) {
      seen.add(ext);
      out.push(ext);
    }
  });
  return out;
}

function appendExtensionToCard(card: HTMLElement, raw: string): boolean {
  const ext = normalizeExtension(raw);
  if (!ext) return false;
  const list = card.querySelector(".ext-list")!;
  const existing = readExtensionsFromCard(card);
  if (existing.includes(ext)) return true;
  list.insertAdjacentHTML("beforeend", extensionChipHtml(ext));
  return true;
}

function bindCraftExtensionList(card: HTMLElement) {
  const list = card.querySelector(".ext-list")!;
  list.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest(".ext-remove");
    if (!btn) return;
    const chip = btn.closest(".ext-chip");
    if (!chip) return;
    const remaining = readExtensionsFromCard(card).length;
    if (remaining <= 1) {
      alert("At least one extension is required.");
      return;
    }
    chip.remove();
  });

  const input = card.querySelector(".ext-add-input") as HTMLInputElement;
  const addBtn = card.querySelector(".btn-ext-add")!;
  const tryAdd = () => {
    const raw = input.value;
    if (!raw.trim()) return;
    if (appendExtensionToCard(card, raw)) input.value = "";
    input.focus();
  };
  addBtn.addEventListener("click", tryAdd);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      tryAdd();
    }
  });
}

function craftOptions(crafts: CraftConfig[]) {
  return crafts
    .filter((c) => c.enabled)
    .map(
      (c) =>
        `<option value="${c.craft_id}"${selectedCraftId === c.craft_id ? " selected" : ""}>${escapeHtml(c.label)}</option>`
    )
    .join("");
}

function indexerEnabledForCraft(indexer: IndexerInfo, craftId: string) {
  if (!indexer.capabilities.search_enabled) return false;
  const map = indexer.craft_enabled || {};
  if (craftId in map) return map[craftId];
  return true;
}

function searchableIndexers(craftId: string = selectedCraftId) {
  return indexersCache.filter((i) => indexerEnabledForCraft(i, craftId));
}

function fairMergeHits(batches: ExternalHit[][], limit: number): ExternalHit[] {
  const merged: ExternalHit[] = [];
  let round = 0;
  while (merged.length < limit) {
    let added = false;
    for (const batch of batches) {
      if (round < batch.length) {
        merged.push(batch[round]!);
        added = true;
        if (merged.length >= limit) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return merged;
}

function refreshIndexerPick(pick: HTMLSelectElement) {
  const prev = pick.value;
  pick.innerHTML = indexerOptions();
  const allowed = new Set(searchableIndexers().map((i) => i.id));
  if (prev !== "all" && !allowed.has(prev)) {
    selectedIndexerId = "all";
    sessionStorage.setItem("pincushion_indexer", "all");
  }
  pick.value = selectedIndexerId;
}

function indexerOptions() {
  const searchable = searchableIndexers();
  const opts = [`<option value="all"${selectedIndexerId === "all" ? " selected" : ""}>All searchable sources</option>`];
  for (const i of searchable) {
    opts.push(
      `<option value="${i.id}"${selectedIndexerId === i.id ? " selected" : ""}>${escapeHtml(i.name)}</option>`
    );
  }
  return opts.join("");
}

const CARD_PLACEHOLDER = "/placeholder.svg";

function cardThumb(src: string | null | undefined, alt = "") {
  const url = (src || "").trim() || CARD_PLACEHOLDER;
  const ph = url === CARD_PLACEHOLDER ? " is-placeholder" : "";
  // onerror swaps to the PinCushion logo once; avoids loops if the placeholder itself fails.
  return `<img class="card-thumb${ph}" src="${escapeHtml(url)}" alt="${escapeHtml(
    alt
  )}" loading="lazy" onerror="if(!this.dataset.ph){this.dataset.ph='1';this.src='${CARD_PLACEHOLDER}';this.classList.add('is-placeholder')}" />`;
}

function hitCard(hit: ExternalHit) {
  return `
    <article class="card" data-ext="${hit.indexer_id}|${escapeAttr(hit.external_id)}">
      ${cardThumb(hit.thumbnail_url)}
      <div class="card-body">
        <h3>${escapeHtml(hit.title)}</h3>
        <div class="meta">${escapeHtml(hit.designer || "Unknown")} · <span class="badge">${escapeHtml(indexerName(hit.indexer_id))}</span></div>
        <div style="margin-top:0.5rem;display:flex;gap:0.35rem;flex-wrap:wrap">
          <button class="secondary btn-want">Wanted</button>
          <button class="secondary btn-import">Add to Library</button>
          <a class="secondary" href="${hit.source_url}" target="_blank" rel="noopener">Open source</a>
        </div>
      </div>
    </article>`;
}

function isUserUpload(source: string | null | undefined) {
  return source === "user_import" || source === "manual";
}

function patternCard(p: PatternSummary) {
  const delBtn = isUserUpload(p.source)
    ? `<button type="button" class="secondary btn-del-pat" data-pid="${p.id}">Delete</button>`
    : "";
  const dims =
    p.width_stitches && p.height_stitches
      ? `${p.width_stitches}×${p.height_stitches}${
          p.color_count != null ? ` · ${p.color_count} colours` : ""
        }`
      : (p.pattern_format || "file").toUpperCase();
  return `
    <article class="card" data-pid="${p.id}">
      ${cardThumb(p.thumbnail_url, p.title)}
      <div class="card-body">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="meta">${escapeHtml(dims)}</div>
        ${delBtn ? `<div class="card-actions">${delBtn}</div>` : ""}
      </div>
    </article>`;
}

function normalizeResultSort(raw: string): ResultSort {
  if (raw === "title_desc" || raw === "source_asc" || raw === "source_desc") return raw;
  return "title_asc";
}

function sortSearchHits(hits: ExternalHit[], sort: ResultSort): ExternalHit[] {
  const sorted = [...hits];
  sorted.sort((a, b) => {
    if (sort === "source_asc" || sort === "source_desc") {
      const bySource = indexerName(a.indexer_id).localeCompare(indexerName(b.indexer_id), undefined, {
        sensitivity: "base",
      });
      if (bySource !== 0) return sort === "source_desc" ? -bySource : bySource;
    }
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    return sort === "title_desc" ? -byTitle : byTitle;
  });
  return sorted;
}

function filterSearchHits(hits: ExternalHit[], sourceFilter: string): ExternalHit[] {
  if (sourceFilter === "all") return hits;
  return hits.filter((h) => h.indexer_id === sourceFilter);
}

function mountResultsToolbar(hits: ExternalHit[]) {
  const toolbar = document.getElementById("resultsToolbar");
  if (!toolbar) return;
  const sourceIds = [...new Set(hits.map((h) => h.indexer_id))].sort((a, b) =>
    indexerName(a).localeCompare(indexerName(b), undefined, { sensitivity: "base" })
  );
  const filterOpts = [
    `<option value="all">All sources</option>`,
    ...sourceIds.map(
      (id) => `<option value="${escapeHtml(id)}">${escapeHtml(indexerName(id))}</option>`
    ),
  ];
  toolbar.innerHTML = `
    <div class="results-toolbar-inner">
      <label class="results-control">Source
        <select id="resultSourceFilter">${filterOpts.join("")}</select>
      </label>
      <label class="results-control">Sort
        <select id="resultSort">
          <option value="title_asc">Title A→Z</option>
          <option value="title_desc">Title Z→A</option>
          <option value="source_asc">Source A→Z</option>
          <option value="source_desc">Source Z→A</option>
        </select>
      </label>
      <span class="meta" id="resultCount"></span>
    </div>`;
  const sourcePick = document.getElementById("resultSourceFilter") as HTMLSelectElement;
  const sortPick = document.getElementById("resultSort") as HTMLSelectElement;
  sourcePick.value = sourceIds.includes(searchResultSourceFilter) || searchResultSourceFilter === "all"
    ? searchResultSourceFilter
    : "all";
  searchResultSourceFilter = sourcePick.value;
  sortPick.value = normalizeResultSort(searchResultSort);
  searchResultSort = normalizeResultSort(sortPick.value);
  sourcePick.addEventListener("change", () => {
    searchResultSourceFilter = sourcePick.value;
    sessionStorage.setItem("pincushion_result_source", searchResultSourceFilter);
    paintSearchResults(searchResultHits);
  });
  sortPick.addEventListener("change", () => {
    searchResultSort = normalizeResultSort(sortPick.value);
    sessionStorage.setItem("pincushion_result_sort", searchResultSort);
    paintSearchResults(searchResultHits);
  });
}

function paintSearchResults(hits: ExternalHit[], cacheNote?: string) {
  if (cacheNote !== undefined) searchResultsCacheNote = cacheNote;
  searchResultHits = hits;
  const sourceSet = new Set(hits.map((h) => h.indexer_id));
  if (searchResultSourceFilter !== "all" && !sourceSet.has(searchResultSourceFilter)) {
    searchResultSourceFilter = "all";
    sessionStorage.setItem("pincushion_result_source", "all");
  }
  const toolbar = document.getElementById("resultsToolbar");
  if (toolbar) {
    toolbar.classList.toggle("is-hidden", hits.length === 0);
    if (hits.length > 0) mountResultsToolbar(hits);
  }
  const filtered = filterSearchHits(hits, searchResultSourceFilter);
  const viewed = sortSearchHits(filtered, normalizeResultSort(searchResultSort));
  const resultsEl = document.getElementById("results");
  const countEl = document.getElementById("resultCount");
  if (countEl) {
    countEl.textContent =
      viewed.length === hits.length
        ? `${hits.length} result${hits.length === 1 ? "" : "s"}`
        : `${viewed.length} of ${hits.length} results`;
  }
  if (!resultsEl) return;
  const prefix = searchResultsCacheNote;
  if (!hits.length) {
    resultsEl.innerHTML = prefix;
    return;
  }
  if (!viewed.length) {
    resultsEl.innerHTML = `${prefix}<p class="empty search-filter-empty">No results for the selected source.</p>`;
    return;
  }
  resultsEl.innerHTML = `${prefix}${viewed.map(hitCard).join("")}`;
  bindHitCards(resultsEl);
}

function bindHitCards(root: HTMLElement) {
  root.querySelectorAll(".card[data-ext]").forEach((card) => {
    const ext = (card as HTMLElement).dataset.ext!;
    const pipe = ext.indexOf("|");
    const indexer_id = pipe >= 0 ? ext.slice(0, pipe) : ext;
    const external_id = pipe >= 0 ? ext.slice(pipe + 1) : "";
    const idx = indexersCache.find((i) => i.id === indexer_id);
    const importBtn = card.querySelector(".btn-import") as HTMLButtonElement | null;
    const wantBtn = card.querySelector(".btn-want") as HTMLButtonElement | null;
    if (importBtn && idx && !idx.capabilities.can_download) {
      importBtn.disabled = true;
      importBtn.title = "This source is index-only — add to Wanted instead";
    }
    card.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).closest("button, a")) return;
      showExternalDetail(indexer_id, external_id);
    });
    wantBtn?.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await addHitToWanted(indexer_id, external_id, wantBtn);
    });
    importBtn?.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await importHitToLibrary(indexer_id, external_id, importBtn);
    });
  });
}

function setSearchProgress(
  visible: boolean,
  opts: { percent?: number; indeterminate?: boolean; label?: string } = {}
) {
  const wrap = document.getElementById("searchProgress");
  const fill = document.getElementById("searchProgressFill");
  const label = document.getElementById("searchProgressLabel");
  const track = document.getElementById("searchProgressTrack");
  if (!wrap || !fill || !label || !track) return;
  wrap.classList.toggle("is-hidden", !visible);
  wrap.classList.toggle("is-indeterminate", !!opts.indeterminate);
  if (opts.label !== undefined) label.textContent = opts.label;
  const pct = opts.indeterminate ? 0 : Math.min(100, Math.max(0, opts.percent ?? 0));
  fill.style.width = `${pct}%`;
  track.setAttribute("aria-valuenow", String(pct));
}

async function emptySearchMessage(craftId: string): Promise<string> {
  const crafts = await loadCrafts();
  const craft = crafts.find((c) => c.craft_id === craftId);
  const label = craft?.label || craftId;
  const exts = craft?.extensions.join(", ") || "—";
  return `No results matched <strong>${escapeHtml(label)}</strong> extensions (${escapeHtml(exts)}). Indexers may have “${escapeHtml(label)}” items that are PDFs or images — add those types under <button type="button" class="linkish" data-view="settings_file_associations">File Associations</button> to include them.`;
}

async function runPatternSearch(
  q: string,
  indexerId: string,
  craftId: string,
  resultsEl: HTMLElement,
  limit = 24
) {
  const gen = ++searchGeneration;
  searchResultsCacheNote = "";
  resultsEl.innerHTML = "";
  document.getElementById("resultsToolbar")?.classList.add("is-hidden");
  setSearchProgress(true, { indeterminate: true, label: "Searching…", percent: 0 });

  const searchOne = (id: string) =>
    api<{ results: ExternalHit[] }>(
      `/api/search?q=${encodeURIComponent(q)}&indexer_id=${encodeURIComponent(id)}&craft=${encodeURIComponent(craftId)}&limit=${limit}`
    );

  const stillCurrent = () => gen === searchGeneration && document.getElementById("results") === resultsEl;

  try {
    let hits: ExternalHit[] = [];
    if (indexerId === "all") {
      const sources = searchableIndexers();
      const total = sources.length || 1;
      const batches: ExternalHit[][] = sources.map(() => []);
      let done = 0;
      setSearchProgress(true, {
        percent: 0,
        indeterminate: false,
        label: `Searching 0 / ${total} sources…`,
      });

      await Promise.all(
        sources.map(async (idx, i) => {
          try {
            const data = await searchOne(idx.id);
            batches[i] = data.results;
          } catch {
            batches[i] = [];
          }
          if (!stillCurrent()) return;
          done += 1;
          hits = fairMergeHits(batches, limit);
          const pct = Math.round((done / total) * 100);
          const found = hits.length;
          setSearchProgress(true, {
            percent: pct,
            indeterminate: false,
            label:
              done < total
                ? `Searching ${done} / ${total} — ${idx.name}${
                    found ? ` · ${found} result${found === 1 ? "" : "s"} so far` : ""
                  }`
                : `Done — ${found} result${found === 1 ? "" : "s"}`,
          });
          // Paint as soon as any source returns — don't wait for the rest.
          if (found) paintSearchResults(hits);
        })
      );
      if (!stillCurrent()) return;
      hits = fairMergeHits(batches, limit);
    } else {
      setSearchProgress(true, {
        indeterminate: true,
        label: `Searching ${indexerName(indexerId)}…`,
      });
      const data = await searchOne(indexerId);
      if (!stillCurrent()) return;
      hits = data.results;
      if (hits.length) paintSearchResults(hits);
      setSearchProgress(true, { percent: 100, indeterminate: false, label: "Done" });
    }

    if (!stillCurrent()) return;
    setSearchProgress(false);
    saveSavedSearch(q, indexerId, craftId, hits);
    if (!hits.length) {
      resultsEl.innerHTML = `<p class="empty">${await emptySearchMessage(craftId)}</p>`;
      bindEmptyCraftLink(resultsEl);
      return;
    }
    paintSearchResults(hits);
  } catch (e) {
    if (!stillCurrent()) return;
    setSearchProgress(false);
    resultsEl.innerHTML = `<p class="empty">${escapeHtml(String(e))}</p>`;
  }
}

async function restoreSavedSearch(
  resultsEl: HTMLElement,
  qInput: HTMLInputElement,
  pick: HTMLSelectElement,
  craftPick: HTMLSelectElement
) {
  const saved = loadSavedSearch();
  if (!saved) return;
  selectedIndexerId = saved.indexerId;
  selectedCraftId = saved.craftId;
  sessionStorage.setItem("pincushion_indexer", saved.indexerId);
  sessionStorage.setItem("pincushion_craft", saved.craftId);
  qInput.value = saved.q;
  pick.value = saved.indexerId;
  craftPick.value = saved.craftId;

  const note = `<p class="meta search-cache-note">Showing your last search (no new query). Press Search to refresh.</p>`;
  if (!saved.results.length) {
    resultsEl.innerHTML = `${note}<p class="empty">${await emptySearchMessage(saved.craftId)}</p>`;
    bindEmptyCraftLink(resultsEl);
    return;
  }
  paintSearchResults(saved.results, note);
}

async function renderSearch() {
  await loadIndexers();
  const crafts = await loadCrafts();
  const saved = loadSavedSearch();
  if (saved) {
    selectedIndexerId = saved.indexerId;
    selectedCraftId = saved.craftId;
  }
  shell(`
    <div class="panel">
      <h2 style="margin:0 0 0.75rem">Search patterns</h2>
      <div class="search-row">
        <select id="craftPick" title="Craft">${craftOptions(crafts)}</select>
        <select id="indexerPick">${indexerOptions()}</select>
        <input type="search" id="q" placeholder="e.g. dog, unicorn, heart" />
        <button class="primary" id="doSearch">Search</button>
      </div>
      <div id="searchProgress" class="search-progress is-hidden" aria-live="polite">
        <div class="search-progress-label" id="searchProgressLabel">Searching…</div>
        <div
          class="search-progress-track"
          id="searchProgressTrack"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
        >
          <div class="search-progress-fill" id="searchProgressFill"></div>
        </div>
      </div>
      <p class="meta">Results include only file types configured under Settings → File Associations for the selected craft.</p>
    </div>
    <div id="resultsToolbar" class="results-toolbar is-hidden" aria-label="Result filters"></div>
    <div id="results" class="card-grid"></div>
  `);
  const pick = document.getElementById("indexerPick") as HTMLSelectElement;
  const craftPick = document.getElementById("craftPick") as HTMLSelectElement;
  pick.value = selectedIndexerId;
  craftPick.value = selectedCraftId;
  pick.addEventListener("change", () => {
    selectedIndexerId = pick.value;
    sessionStorage.setItem("pincushion_indexer", selectedIndexerId);
  });
  craftPick.addEventListener("change", () => {
    selectedCraftId = craftPick.value;
    sessionStorage.setItem("pincushion_craft", selectedCraftId);
    refreshIndexerPick(pick);
  });

  const results = document.getElementById("results")!;
  const qInput = document.getElementById("q") as HTMLInputElement;
  const triggerSearch = () => {
    const q = qInput.value;
    selectedIndexerId = pick.value;
    selectedCraftId = craftPick.value;
    sessionStorage.setItem("pincushion_indexer", selectedIndexerId);
    sessionStorage.setItem("pincushion_craft", selectedCraftId);
    void runPatternSearch(q, selectedIndexerId, selectedCraftId, results);
  };
  document.getElementById("doSearch")!.addEventListener("click", triggerSearch);
  qInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") triggerSearch();
  });

  await restoreSavedSearch(results, qInput, pick, craftPick);
}

async function renderSupplies() {
  const supplies = await api<SuppliesSettings>("/api/supplies");
  const sections =
    supplies.craft_palettes && supplies.craft_palettes.length
      ? supplies.craft_palettes
      : [
          {
            craft_id: "cross_stitch",
            label: "Cross-stitch / embroidery floss",
            description: "Used for cross-stitch charts and embroidery colour matching.",
            brand: supplies.floss_brand,
            brands: supplies.floss_brands,
          },
        ];
  shell(`
    <div class="panel">
      <h2 style="margin:0">Supplies</h2>
      <p class="meta">Pick the colour catalogue PinCushion uses when matching chart colours for each craft. Cross-stitch uses embroidery floss; diamond painting uses DMC drill codes; iron beading and seed beading use bead brands.</p>
    </div>
    ${sections
      .map((section) => {
        const group = `paletteBrand_${section.craft_id}`;
        return `
    <div class="panel">
      <h3 style="margin-top:0">${escapeHtml(section.label)}</h3>
      <p class="meta">${escapeHtml(section.description)}</p>
      <div class="supplies-brand-list" role="radiogroup" aria-label="${escapeHtml(section.label)}">
        ${section.brands
          .map((b) => {
            const checked = b.id === section.brand;
            const disabled = !b.available;
            return `
          <label class="supplies-brand${checked ? " active" : ""}${disabled ? " disabled" : ""}">
            <input type="radio" name="${escapeHtml(group)}" value="${escapeHtml(b.id)}" data-craft="${escapeHtml(
              section.craft_id
            )}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
            <span class="supplies-brand-body">
              <strong>${escapeHtml(b.label)}</strong>
              <span class="meta">${escapeHtml(b.description)}</span>
              <span class="meta">${b.available ? `${b.color_count} colours in palette` : "Palette unavailable"}</span>
            </span>
          </label>`;
          })
          .join("")}
      </div>
    </div>`;
      })
      .join("")}
    <div class="panel">
      <div class="indexer-actions">
        <button type="button" class="primary" id="saveSupplies">Save</button>
      </div>
    </div>
  `);

  app.querySelectorAll('input[type="radio"][data-craft]').forEach((input) => {
    input.addEventListener("change", () => {
      const craft = (input as HTMLInputElement).dataset.craft;
      app.querySelectorAll(`input[data-craft="${craft}"]`).forEach((el) => {
        el.closest(".supplies-brand")?.classList.remove("active");
      });
      (input as HTMLElement).closest(".supplies-brand")?.classList.add("active");
    });
  });

  document.getElementById("saveSupplies")?.addEventListener("click", async () => {
    const craft_brands: Record<string, string> = {};
    for (const section of sections) {
      const selected = app.querySelector(
        `input[name="paletteBrand_${section.craft_id}"]:checked`
      ) as HTMLInputElement | null;
      if (!selected) {
        alert(`Pick a brand for ${section.label}`);
        return;
      }
      craft_brands[section.craft_id] = selected.value;
    }
    try {
      await api("/api/supplies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floss_brand: craft_brands.cross_stitch,
          craft_brands,
        }),
      });
      alert("Saved.");
      render();
    } catch (e) {
      alert(String(e));
    }
  });
}

async function renderFileAssociations() {
  const crafts = await loadCrafts();
  shell(`
    <div class="panel">
      <h2 style="margin:0">File Associations</h2>
      <p class="meta">Allowed file extensions per craft. Search and downloads only consider matching files (e.g. .oxs, .pdf).</p>
    </div>
    <div class="indexer-list">
      ${crafts
        .map(
          (c) => `
        <article class="indexer-card" data-craft="${c.craft_id}">
          <h3>${escapeHtml(c.label)} <span class="badge">${escapeHtml(c.craft_id)}</span></h3>
          <label class="meta"><input type="checkbox" class="craft-enabled" ${c.enabled ? "checked" : ""} /> Enabled in search dropdown</label>
          <p class="meta" style="margin-top:0.5rem">File extensions:</p>
          <div class="ext-list">${extensionsListHtml(c.extensions)}</div>
          <div class="ext-add-row">
            <input type="text" class="ext-add-input" placeholder=".zip or zip" aria-label="Add extension" />
            <button type="button" class="secondary btn-ext-add">Add</button>
          </div>
          <div class="indexer-actions">
            <button type="button" class="primary btn-save-craft">Save</button>
          </div>
        </article>`
        )
        .join("")}
    </div>
  `);

  app.querySelectorAll(".indexer-card[data-craft]").forEach((el) => bindCraftExtensionList(el as HTMLElement));

  app.querySelectorAll(".btn-save-craft").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".indexer-card") as HTMLElement;
      const craft_id = card.dataset.craft!;
      const extensions = readExtensionsFromCard(card);
      const enabled = (card.querySelector(".craft-enabled") as HTMLInputElement).checked;
      try {
        await api(`/api/craft-files/${craft_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extensions, enabled }),
        });
        alert("Saved.");
      } catch (e) {
        alert(String(e));
      }
    });
  });
}

async function renderIndexers() {
  await loadIndexers();
  const crafts = (await loadCrafts()).filter((c) => c.enabled);
  shell(`
    <div class="panel">
      <h2 style="margin:0">Indexers</h2>
      <p class="meta">Toggle which sources are included in Search for each craft. Indexers without automated search stay catalog-only.</p>
    </div>
    <div class="indexer-list">
      ${indexersCache
        .map((idx) => {
          const c = idx.capabilities;
          const craftToggles = crafts
            .map((craft) => {
              const on = idx.craft_enabled?.[craft.craft_id] ?? c.search_enabled;
              const disabled = !c.search_enabled;
              return `
              <label class="craft-toggle${disabled ? " craft-toggle-disabled" : ""}" title="${disabled ? "No automated search for this source" : `Include in ${craft.label} search`}">
                <input type="checkbox" class="idx-craft" data-craft="${craft.craft_id}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""} />
                ${escapeHtml(craft.label)}
              </label>`;
            })
            .join("");
          return `
        <article class="indexer-card" data-id="${idx.id}">
          <h3>${escapeHtml(idx.name)} ${statusBadge(c.status)}</h3>
          <p class="meta">${escapeHtml(c.description)}</p>
          <p class="meta">Access: ${escapeHtml(c.access_method)} · Search: ${c.search_enabled ? "yes" : "no"} · Download: ${c.can_download ? "yes" : "no"}</p>
          <div class="indexer-craft-toggles">${craftToggles}</div>
          <div class="indexer-actions">
            ${c.site_url ? `<a class="secondary" href="${c.site_url}" target="_blank" rel="noopener">Visit site</a>` : ""}
            ${c.search_enabled ? `<button type="button" class="primary btn-search-here">Search this source</button>` : ""}
          </div>
        </article>`;
        })
        .join("")}
    </div>
  `);

  app.querySelectorAll(".idx-craft").forEach((input) => {
    input.addEventListener("change", async () => {
      const box = input as HTMLInputElement;
      const card = box.closest(".indexer-card") as HTMLElement;
      const indexerId = card.dataset.id!;
      const craftId = box.dataset.craft!;
      try {
        await api(`/api/indexers/${indexerId}/craft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ craft_id: craftId, enabled: box.checked }),
        });
        await loadIndexers();
      } catch (e) {
        box.checked = !box.checked;
        alert(String(e));
      }
    });
  });

  app.querySelectorAll(".btn-search-here").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn.closest(".indexer-card") as HTMLElement).dataset.id!;
      selectedIndexerId = id;
      sessionStorage.setItem("pincushion_indexer", id);
      view = "search";
      render();
    });
  });
}

async function showExternalDetail(indexer_id: string, external_id: string) {
  await loadIndexers();
  const idx = indexersCache.find((i) => i.id === indexer_id);
  const d = await api<ExternalHit & { download_available?: boolean; all_files?: string[] }>(
    `/api/external/${indexer_id}/${external_id}?craft=${encodeURIComponent(selectedCraftId)}`
  );
  shell(`
    <div class="panel">
      <button class="secondary" id="back">← Back to search</button>
      <h2>${escapeHtml(d.title)}</h2>
      <p class="meta">${escapeHtml(indexerName(indexer_id))}${d.metadata?.licenseurl ? ` · <a href="${d.metadata.licenseurl}" target="_blank" rel="noopener">license</a>` : ""}</p>
      <p>${escapeHtml(d.description || "")}</p>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap">
        <button class="primary" id="addWant">Add to Wanted</button>
        <button class="secondary" id="addLib" ${idx && !idx.capabilities.can_download ? "disabled" : ""}>Add to Library</button>
        <a class="secondary" href="${d.source_url}" target="_blank" rel="noopener">Open on source site</a>
      </div>
      ${d.all_files?.length ? `<pre class="meta" style="white-space:pre-wrap;margin-top:1rem">${d.all_files.slice(0, 8).join("\n")}</pre>` : ""}
    </div>
  `, "search");
  document.getElementById("back")!.addEventListener("click", () => {
    view = "search";
    render();
  });
  document.getElementById("addWant")?.addEventListener("click", async (ev) => {
    await addHitToWanted(indexer_id, external_id, ev.currentTarget as HTMLButtonElement);
  });
  document.getElementById("addLib")?.addEventListener("click", async (ev) => {
    await importHitToLibrary(indexer_id, external_id, ev.currentTarget as HTMLButtonElement);
  });
}

async function addHitToWanted(indexer_id: string, external_id: string, btn?: HTMLButtonElement) {
  const label = btn?.textContent || "Wanted";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }
  try {
    await api("/api/wanted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexer_id, external_id, craft: selectedCraftId }),
    });
    if (btn) btn.textContent = "On Wanted ✓";
    setTimeout(() => {
      if (btn && btn.textContent === "On Wanted ✓") {
        btn.disabled = false;
        btn.textContent = label;
      }
    }, 1500);
  } catch (e) {
    alert(String(e));
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

async function importHitToLibrary(indexer_id: string, external_id: string, btn?: HTMLButtonElement) {
  const label = btn?.textContent || "Add to Library";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Adding…";
  }
  try {
    const r = await api<{ pattern_id?: number | null; duplicate_of?: number | null; message: string }>(
      "/api/import/from-indexer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexer_id, external_id, craft: selectedCraftId }),
      }
    );
    if (r.pattern_id) {
      selectedPatternId = r.pattern_id;
      view = "pattern";
      render();
      return;
    }
    if (r.duplicate_of) {
      if (confirm(`${r.message}\nOpen the existing pattern?`)) {
        selectedPatternId = r.duplicate_of;
        view = "pattern";
        render();
      }
      return;
    }
    alert(r.message || "Imported");
  } catch (e) {
    alert(String(e));
  } finally {
    if (btn && document.body.contains(btn)) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

function uploadAcceptExtensions(crafts: CraftConfig[]) {
  const seen = new Set<string>();
  for (const c of crafts) {
    for (const ext of c.extensions) {
      const e = ext.startsWith(".") ? ext : `.${ext}`;
      seen.add(e.toLowerCase());
    }
  }
  return [...seen].join(",");
}

/** Survives library re-render after upload so status is not wiped. */
let libraryUploadStatus = "";

async function uploadFilesToLibrary(files: FileList | File[], craftId: string, statusEl: HTMLElement) {
  const list = [...files];
  if (!list.length) return;
  statusEl.textContent = `Uploading ${list.length} file${list.length === 1 ? "" : "s"}…`;
  libraryUploadStatus = statusEl.textContent;
  const form = new FormData();
  form.append("craft", craftId);
  for (const f of list) form.append("files", f);
  try {
    const results = await fetch("/api/import/upload-many", { method: "POST", body: form }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text() || r.statusText);
      return r.json() as Promise<{ pattern_id?: number | null; duplicate_of?: number | null; message: string }[]>;
    });
    const imported = results.filter((r) => r.pattern_id);
    const dupes = results.filter((r) => r.duplicate_of);
    const failed = results.length - imported.length - dupes.length;
    const parts = [];
    if (imported.length) parts.push(`${imported.length} imported`);
    if (dupes.length) parts.push(`${dupes.length} already in this craft library`);
    if (failed) parts.push(`${failed} failed`);
    const notes = [
      ...imported.map((r) => r.message).filter(Boolean),
      ...dupes.map((r) => r.message).filter(Boolean),
    ];
    libraryUploadStatus = [parts.join(" · "), ...notes.slice(0, 2)].filter(Boolean).join(" — ") || "Done";
    statusEl.textContent = libraryUploadStatus;
    if (imported.length === 1 && imported[0]!.pattern_id) {
      libraryUploadStatus = "";
      selectedPatternId = imported[0]!.pattern_id!;
      view = "pattern";
      render();
      return;
    }
    render();
  } catch (e) {
    libraryUploadStatus = String(e);
    statusEl.textContent = libraryUploadStatus;
  }
}

function canCreateBlankProject(craftId: string) {
  return (
    isChartCraft(craftId) || craftId === "crochet" || craftId === "knitting"
  );
}

function isChartCraft(craftId: string | null | undefined) {
  return (
    craftId === "cross_stitch" ||
    craftId === "diamond_painting" ||
    craftId === "beading" ||
    craftId === "iron_beading"
  );
}

function isPixelCraft(craftId: string | null | undefined) {
  return (
    craftId === "diamond_painting" ||
    craftId === "beading" ||
    craftId === "iron_beading"
  );
}

async function createBlankProject(craftId: string, statusEl: HTMLElement) {
  const title = prompt("Project title", "Untitled")?.trim();
  if (title == null) return;
  if (!canCreateBlankProject(craftId)) {
    statusEl.textContent =
      "Blank projects are only available for chart crafts (including beading), crochet, and knitting.";
    return;
  }
  statusEl.textContent = "Creating blank project…";
  try {
    const detail = await api<{ id: number }>(`/api/patterns/blank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "Untitled",
        width: 20,
        height: 20,
        craft: craftId,
      }),
    });
    selectedPatternId = detail.id;
    view = "pattern";
    render();
  } catch (e) {
    statusEl.textContent = String(e);
  }
}

function craftCard(craftId: string, label: string, count: number) {
  return `
    <article class="card craft-card" data-craft="${escapeAttr(craftId)}" role="button" tabindex="0">
      <div class="craft-card-icon" aria-hidden="true">${craftIconHtml(craftId)}</div>
      <div class="card-body">
        <h3>${escapeHtml(label)}</h3>
        <div class="meta">${count} ${count === 1 ? "project" : "projects"}</div>
      </div>
    </article>`;
}

function fabHtml(label: string) {
  return `<button type="button" class="fab" id="fabAdd" title="${escapeAttr(label)}" aria-label="${escapeAttr(
    label
  )}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>`;
}

function categoryPickerModal(opts: {
  title: string;
  inputId: string;
  listId: string;
  suggestions: { id: string; label: string }[];
  placeholder: string;
}) {
  const options = opts.suggestions
    .map((s) => `<option value="${escapeAttr(s.label)}" data-id="${escapeAttr(s.id)}"></option>`)
    .join("");
  return `
    <div class="modal-backdrop" id="categoryModal" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
      <div class="modal-card">
        <h2 id="categoryModalTitle">${escapeHtml(opts.title)}</h2>
        <label class="form-field">
          <span>Category</span>
          <input type="text" id="${opts.inputId}" list="${opts.listId}" placeholder="${escapeAttr(
            opts.placeholder
          )}" autocomplete="off" />
          <datalist id="${opts.listId}">${options}</datalist>
        </label>
        <p class="meta">Start typing to pick a known type, or enter a custom name.</p>
        <div class="modal-actions">
          <button type="button" class="secondary" id="categoryModalCancel">Cancel</button>
          <button type="button" class="primary" id="categoryModalConfirm">Add</button>
        </div>
      </div>
    </div>`;
}

function bindCategoryPicker(opts: {
  suggestions: { id: string; label: string }[];
  onConfirm: (id: string, label: string) => void;
}) {
  const backdrop = document.getElementById("categoryModal");
  const input = document.getElementById("categoryPickInput") as HTMLInputElement | null;
  const close = () => backdrop?.remove();
  document.getElementById("categoryModalCancel")?.addEventListener("click", close);
  backdrop?.addEventListener("click", (ev) => {
    if (ev.target === backdrop) close();
  });
  const confirm = () => {
    const raw = (input?.value || "").trim();
    if (!raw) {
      input?.focus();
      return;
    }
    const byLabel = opts.suggestions.find(
      (s) => s.label.toLowerCase() === raw.toLowerCase() || s.id === raw.toLowerCase()
    );
    const id = byLabel?.id || slugifyCategory(raw);
    const label = byLabel?.label || raw;
    close();
    opts.onConfirm(id, label);
  };
  document.getElementById("categoryModalConfirm")?.addEventListener("click", confirm);
  input?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      confirm();
    }
    if (ev.key === "Escape") close();
  });
  input?.focus();
}

function sortPatterns(list: PatternSummary[], sort: ProjectSort): PatternSummary[] {
  const out = [...list];
  out.sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const ta = Date.parse(a.date_downloaded || a.date_discovered || "") || 0;
      const tb = Date.parse(b.date_downloaded || b.date_discovered || "") || 0;
      return sort === "newest" ? tb - ta : ta - tb;
    }
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    return sort === "title_desc" ? -byTitle : byTitle;
  });
  return out;
}

function filterPatterns(list: PatternSummary[], q: string): PatternSummary[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      (p.pattern_format || "").toLowerCase().includes(needle) ||
      (p.description || "").toLowerCase().includes(needle)
  );
}

function craftPropertyFieldsHtml(craftId: string) {
  const title = `
    <label class="form-field">
      <span>Title</span>
      <input type="text" id="npTitle" required placeholder="e.g. Vogue V1234" />
    </label>`;
  const notes = `
    <label class="form-field">
      <span>Notes</span>
      <textarea id="npNotes" rows="3" placeholder="Optional notes"></textarea>
    </label>`;
  if (craftId === "cross_stitch" || isPixelCraft(craftId)) {
    return `${title}
      <div class="form-row">
        <label class="form-field">
          <span>Width (stitches)</span>
          <input type="number" id="npWidth" min="1" max="800" value="20" />
        </label>
        <label class="form-field">
          <span>Height (stitches)</span>
          <input type="number" id="npHeight" min="1" max="800" value="20" />
        </label>
      </div>
      <label class="form-field">
        <span>Designer / brand</span>
        <input type="text" id="npDesigner" placeholder="Optional" />
      </label>
      ${notes}`;
  }
  if (craftId === "knitting" || craftId === "crochet") {
    const tool = craftId === "knitting" ? "Needle size" : "Hook size";
    return `${title}
      <div class="form-row">
        <label class="form-field">
          <span>${tool}</span>
          <input type="text" id="npToolSize" placeholder="e.g. 3.5 mm" />
        </label>
        <label class="form-field">
          <span>Yarn</span>
          <input type="text" id="npYarn" placeholder="e.g. DK cotton" />
        </label>
      </div>
      ${notes}`;
  }
  if (craftId === "sewing" || craftId === "quilting") {
    return `${title}
      <div class="form-row">
        <label class="form-field">
          <span>Brand</span>
          <input type="text" id="npBrand" placeholder="e.g. Vogue" />
        </label>
        <label class="form-field">
          <span>Pattern number</span>
          <input type="text" id="npSku" placeholder="e.g. V1234" />
        </label>
      </div>
      ${notes}`;
  }
  if (craftId === "embroidery") {
    return `${title}
      <label class="form-field">
        <span>Hoop / size</span>
        <input type="text" id="npSize" placeholder="Optional" />
      </label>
      ${notes}`;
  }
  if (craftId === "origami") {
    return `${title}
      <label class="form-field">
        <span>Paper size</span>
        <input type="text" id="npSize" placeholder="e.g. 15 cm square" />
      </label>
      ${notes}`;
  }
  return `${title}${notes}`;
}

function bindUploadDropzone(
  input: HTMLInputElement,
  drop: HTMLElement,
  onFiles: (files: FileList | File[]) => void
) {
  input.addEventListener("change", () => {
    if (input.files?.length) onFiles(input.files);
    input.value = "";
  });
  drop.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    drop.classList.add("upload-dropzone-active");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("upload-dropzone-active"));
  drop.addEventListener("drop", (ev) => {
    ev.preventDefault();
    drop.classList.remove("upload-dropzone-active");
    if (ev.dataTransfer?.files?.length) onFiles(ev.dataTransfer.files);
  });
  drop.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") input.click();
  });
  drop.addEventListener("click", () => input.click());
}

function bindPatternCardClicks() {
  app.querySelectorAll(".card[data-pid]").forEach((card) => {
    card.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).closest(".btn-del-pat")) return;
      selectedPatternId = Number((card as HTMLElement).dataset.pid);
      view = "pattern";
      render();
    });
  });
  app.querySelectorAll(".btn-del-pat").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = Number((btn as HTMLElement).dataset.pid);
      if (!confirm("Delete this project?")) return;
      try {
        await api(`/api/patterns/${id}`, { method: "DELETE" });
        render();
      } catch (e) {
        alert(String(e));
      }
    });
  });
}

async function renderLibraryOverview() {
  const [patterns, crafts] = await Promise.all([
    api<PatternSummary[]>("/api/patterns?downloaded=true&limit=5000"),
    loadCrafts(),
  ]);
  const counts = new Map<string, number>();
  for (const p of patterns) {
    const craft = librarySectionFromCraft(p.craft);
    counts.set(craft, (counts.get(craft) || 0) + 1);
  }
  const visibleIds = new Set<string>([
    ...LIBRARY_SECTIONS.filter((s) => (counts.get(s.id) || 0) > 0).map((s) => s.id),
    ...pinnedProjectCrafts.filter((id) => LIBRARY_SECTIONS.some((s) => s.id === id)),
  ]);
  const craftRows = LIBRARY_SECTIONS.filter((s) => visibleIds.has(s.id)).map((s) => {
    const cfg = crafts.find((c) => c.craft_id === s.id);
    return craftCard(s.id, cfg?.label || s.label, counts.get(s.id) || 0);
  });

  shell(
    `
    <h1 class="library-title">Projects</h1>
    <div class="card-grid">${
      craftRows.length ? craftRows.join("") : `<p class="empty">No craft categories yet — tap + to add one.</p>`
    }</div>
    ${fabHtml("Add craft category")}
  `,
    "library"
  );

  const openCraft = (craftId: string) => {
    if (!LIBRARY_SECTIONS.some((s) => s.id === craftId)) return;
    librarySection = craftId as LibrarySection;
    sessionStorage.setItem("pincushion_library_section", librarySection);
    selectedCraftId = craftId;
    sessionStorage.setItem("pincushion_craft", selectedCraftId);
    render();
  };

  app.querySelectorAll<HTMLElement>(".craft-card[data-craft]").forEach((card) => {
    const craftId = card.dataset.craft || "";
    card.addEventListener("click", () => openCraft(craftId));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openCraft(craftId);
      }
    });
  });

  document.getElementById("fabAdd")?.addEventListener("click", () => {
    const suggestions = LIBRARY_SECTIONS.map((s) => ({ id: s.id, label: s.label }));
    app.insertAdjacentHTML(
      "beforeend",
      categoryPickerModal({
        title: "Add craft category",
        inputId: "categoryPickInput",
        listId: "craftSuggestions",
        suggestions,
        placeholder: "Cross-stitch, Knitting, …",
      })
    );
    bindCategoryPicker({
      suggestions,
      onConfirm: (id) => {
        if (!LIBRARY_SECTIONS.some((s) => s.id === id)) {
          alert("Pick a known craft type from the suggestions.");
          return;
        }
        pinnedProjectCrafts = [...pinnedProjectCrafts, id];
        savePinnedIds("pincushion_pinned_crafts", pinnedProjectCrafts);
        openCraft(id);
      },
    });
  });
}

async function renderLibraryCraft() {
  const section = librarySection;
  if (!section) return renderLibraryOverview();
  const sectionLabel = librarySectionLabel(section);
  const craftParam = encodeURIComponent(section);
  const patterns = await api<PatternSummary[]>(
    `/api/patterns?downloaded=true&craft=${craftParam}`
  );
  selectedCraftId = craftIdForLibrarySection(section);
  sessionStorage.setItem("pincushion_craft", selectedCraftId);

  const filtered = filterPatterns(patterns, projectListFilter);
  const sorted = sortPatterns(filtered, projectListSort);

  shell(
    `
    <div class="craft-toolbar">
      <button type="button" class="secondary toolbar-back" id="backCrafts" aria-label="Back to Projects">←</button>
      <h1 class="craft-toolbar-title">${craftIconHtml(section)} <span>${escapeHtml(sectionLabel)}</span></h1>
      <input type="search" id="projectFilter" placeholder="Filter…" value="${escapeAttr(
        projectListFilter
      )}" aria-label="Filter projects" />
      <select id="projectSort" aria-label="Sort projects">
        <option value="title_asc"${projectListSort === "title_asc" ? " selected" : ""}>Title A–Z</option>
        <option value="title_desc"${projectListSort === "title_desc" ? " selected" : ""}>Title Z–A</option>
        <option value="newest"${projectListSort === "newest" ? " selected" : ""}>Newest</option>
        <option value="oldest"${projectListSort === "oldest" ? " selected" : ""}>Oldest</option>
      </select>
      <button type="button" class="primary" id="addProject">Add project</button>
    </div>
    <p class="meta toolbar-meta">${sorted.length} of ${patterns.length} ${
      patterns.length === 1 ? "project" : "projects"
    }</p>
    <div class="card-grid">${
      sorted.length
        ? sorted.map(patternCard).join("")
        : `<p class="empty">No ${escapeHtml(
            sectionLabel.toLowerCase()
          )} projects yet — use Add project.</p>`
    }</div>
  `,
    "library"
  );

  document.getElementById("backCrafts")?.addEventListener("click", () => {
    librarySection = null;
    sessionStorage.setItem("pincushion_library_section", "all");
    render();
  });
  document.getElementById("addProject")?.addEventListener("click", () => {
    view = "project_new";
    render();
  });
  const filterEl = document.getElementById("projectFilter") as HTMLInputElement;
  const sortEl = document.getElementById("projectSort") as HTMLSelectElement;
  let filterTimer = 0;
  filterEl.addEventListener("input", () => {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      projectListFilter = filterEl.value;
      sessionStorage.setItem("pincushion_project_filter", projectListFilter);
      render();
    }, 180);
  });
  sortEl.addEventListener("change", () => {
    projectListSort = sortEl.value as ProjectSort;
    sessionStorage.setItem("pincushion_project_sort", projectListSort);
    render();
  });
  bindPatternCardClicks();
}

async function renderProjectNew() {
  const section = librarySection;
  if (!section) {
    view = "library";
    return renderLibraryOverview();
  }
  const sectionLabel = librarySectionLabel(section);
  const crafts = await loadCrafts();
  const sectionCrafts = crafts.filter((c) => c.craft_id === section);
  selectedCraftId = craftIdForLibrarySection(section);
  const accept = uploadAcceptExtensions(sectionCrafts.length ? sectionCrafts : crafts);
  let pendingFiles: File[] = [];

  shell(
    `
    <div class="craft-toolbar">
      <button type="button" class="secondary toolbar-back" id="backToCraft" aria-label="Back">←</button>
      <h1 class="craft-toolbar-title">${craftIconHtml(section)} <span>New ${escapeHtml(
        sectionLabel
      )} project</span></h1>
    </div>
    <form class="panel add-entity-form" id="newProjectForm">
      ${craftPropertyFieldsHtml(section)}
      <div class="form-field">
        <span>Files</span>
        <label class="primary upload-btn">
          Choose files
          <input type="file" id="uploadInput" multiple accept="${escapeHtml(accept)}" hidden />
        </label>
        <div class="upload-dropzone" id="uploadDropzone" tabindex="0">
          <p>Drop pattern files here or use Choose files</p>
          <p class="meta">Optional if you create a blank chart / yarn project.</p>
        </div>
        <ul class="file-pending-list" id="pendingFiles"></ul>
      </div>
      <p class="meta" id="uploadStatus" aria-live="polite"></p>
      <div class="form-actions">
        <button type="button" class="secondary" id="cancelNewProject">Cancel</button>
        <button type="submit" class="primary">Create project</button>
      </div>
    </form>
  `,
    "project_new"
  );

  const statusEl = document.getElementById("uploadStatus")!;
  const pendingEl = document.getElementById("pendingFiles")!;
  const refreshPending = () => {
    pendingEl.innerHTML = pendingFiles
      .map((f, i) => `<li>${escapeHtml(f.name)} <button type="button" data-rm="${i}" class="linkish">Remove</button></li>`)
      .join("");
    pendingEl.querySelectorAll<HTMLButtonElement>("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingFiles.splice(Number(btn.dataset.rm), 1);
        refreshPending();
      });
    });
  };

  const goBack = () => {
    view = "library";
    render();
  };
  document.getElementById("backToCraft")?.addEventListener("click", goBack);
  document.getElementById("cancelNewProject")?.addEventListener("click", goBack);

  bindUploadDropzone(
    document.getElementById("uploadInput") as HTMLInputElement,
    document.getElementById("uploadDropzone")!,
    (files) => {
      pendingFiles = [...pendingFiles, ...files];
      refreshPending();
    }
  );

  document.getElementById("newProjectForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const title = (document.getElementById("npTitle") as HTMLInputElement).value.trim();
    if (!title) {
      statusEl.textContent = "Title is required.";
      return;
    }
    const notes = (document.getElementById("npNotes") as HTMLTextAreaElement | null)?.value.trim() || "";
    const designer = (document.getElementById("npDesigner") as HTMLInputElement | null)?.value.trim();
    const brand = (document.getElementById("npBrand") as HTMLInputElement | null)?.value.trim();
    const sku = (document.getElementById("npSku") as HTMLInputElement | null)?.value.trim();
    const toolSize = (document.getElementById("npToolSize") as HTMLInputElement | null)?.value.trim();
    const yarn = (document.getElementById("npYarn") as HTMLInputElement | null)?.value.trim();
    const size = (document.getElementById("npSize") as HTMLInputElement | null)?.value.trim();
    const width = Number((document.getElementById("npWidth") as HTMLInputElement | null)?.value || 20);
    const height = Number((document.getElementById("npHeight") as HTMLInputElement | null)?.value || 20);

    const descParts = [
      designer && `Designer: ${designer}`,
      brand && `Brand: ${brand}`,
      sku && `Pattern #: ${sku}`,
      toolSize && `${section === "knitting" ? "Needles" : "Hook"}: ${toolSize}`,
      yarn && `Yarn: ${yarn}`,
      size && `Size: ${size}`,
      notes,
    ].filter(Boolean);
    const description = descParts.join("\n");

    statusEl.textContent = "Creating…";
    try {
      let patternId: number | null = null;
      if (pendingFiles.length) {
        const form = new FormData();
        form.append("craft", section);
        for (const f of pendingFiles) form.append("files", f);
        const results = await fetch("/api/import/upload-many", { method: "POST", body: form }).then(
          async (r) => {
            if (!r.ok) throw new Error((await r.text()) || r.statusText);
            return r.json() as Promise<
              { pattern_id?: number | null; duplicate_of?: number | null; message: string }[]
            >;
          }
        );
        const imported = results.find((r) => r.pattern_id);
        patternId = imported?.pattern_id || results.find((r) => r.duplicate_of)?.duplicate_of || null;
        if (!patternId) throw new Error(results.map((r) => r.message).join("; ") || "Upload failed");
        await api(`/api/patterns/${patternId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: description || null }),
        });
      } else if (canCreateBlankProject(section)) {
        const detail = await api<{ id: number }>(`/api/patterns/blank`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            width: Number.isFinite(width) ? width : 20,
            height: Number.isFinite(height) ? height : 20,
            craft: section,
          }),
        });
        patternId = detail.id;
        if (description) {
          await api(`/api/patterns/${patternId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
          });
        }
      } else {
        statusEl.textContent = "Add at least one file for this craft, or pick a craft that supports blank projects.";
        return;
      }
      selectedPatternId = patternId;
      view = "pattern";
      render();
    } catch (e) {
      statusEl.textContent = String(e);
    }
  });
}

async function renderLibrary() {
  if (!librarySection) return renderLibraryOverview();
  return renderLibraryCraft();
}

function materialCard(id: string, label: string, icon: string, count = 0) {
  return `
    <article class="card craft-card" data-material="${escapeAttr(id)}" role="button" tabindex="0">
      <div class="craft-card-icon" aria-hidden="true"><i class="fa-solid ${icon} craft-icon" aria-hidden="true"></i></div>
      <div class="card-body">
        <h3>${escapeHtml(label)}</h3>
        <div class="meta">${count} ${count === 1 ? "item" : "items"}</div>
      </div>
    </article>`;
}

function allMaterialCategories() {
  const extras = pinnedMaterialCategories
    .filter((id) => !MATERIAL_CATEGORIES.some((c) => c.id === id))
    .map((id) => ({ id, label: materialCategoryLabel(id), icon: "fa-box" }));
  return [...MATERIAL_CATEGORIES, ...extras];
}

async function renderMaterialsOverview() {
  let counts: Record<string, number> = {};
  try {
    const res = await api<{ counts: Record<string, number> }>("/api/materials");
    counts = res.counts || {};
    for (const id of Object.keys(counts)) {
      if (!MATERIAL_CATEGORIES.some((c) => c.id === id) && !pinnedMaterialCategories.includes(id)) {
        pinnedMaterialCategories = [...pinnedMaterialCategories, id];
      }
    }
    savePinnedIds("pincushion_pinned_materials", pinnedMaterialCategories);
  } catch {
    /* empty overview still works */
  }
  const rows = allMaterialCategories().map((c) =>
    materialCard(c.id, c.label, c.icon, counts[c.id] || 0)
  );
  shell(
    `
    <h1 class="library-title">Materials</h1>
    <div class="card-grid">${rows.join("")}</div>
    ${fabHtml("Add material category")}
  `,
    "materials"
  );

  const openCategory = (id: string) => {
    materialsCategory = id;
    sessionStorage.setItem("pincushion_materials_category", materialsCategory);
    render();
  };

  app.querySelectorAll<HTMLElement>(".craft-card[data-material]").forEach((card) => {
    const id = card.dataset.material || "";
    card.addEventListener("click", () => openCategory(id));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openCategory(id);
      }
    });
  });

  document.getElementById("fabAdd")?.addEventListener("click", () => {
    const suggestions = allMaterialCategories().map((c) => ({ id: c.id, label: c.label }));
    app.insertAdjacentHTML(
      "beforeend",
      categoryPickerModal({
        title: "Add material category",
        inputId: "categoryPickInput",
        listId: "materialSuggestions",
        suggestions,
        placeholder: "Wool, Floss, Tools, …",
      })
    );
    bindCategoryPicker({
      suggestions,
      onConfirm: (id) => {
        pinnedMaterialCategories = [...pinnedMaterialCategories, id];
        savePinnedIds("pincushion_pinned_materials", pinnedMaterialCategories);
        openCategory(id);
      },
    });
  });
}

async function renderMaterialsCategory() {
  if (!materialsCategory) return renderMaterialsOverview();
  const cat = allMaterialCategories().find((c) => c.id === materialsCategory) || {
    id: materialsCategory,
    label: materialCategoryLabel(materialsCategory),
    icon: "fa-box",
  };
  let items: MaterialSummary[] = [];
  let loadError = "";
  try {
    const res = await api<{ materials: MaterialSummary[] }>(
      `/api/materials?category=${encodeURIComponent(materialsCategory)}${
        materialListFilter.trim()
          ? `&q=${encodeURIComponent(materialListFilter.trim())}`
          : ""
      }`
    );
    items = res.materials || [];
  } catch (e) {
    loadError = String(e);
  }

  shell(
    `
    <div class="craft-toolbar">
      <button type="button" class="secondary toolbar-back" id="backMaterials" aria-label="Back to Materials">←</button>
      <h1 class="craft-toolbar-title"><i class="fa-solid ${cat.icon} craft-icon" aria-hidden="true"></i> <span>${escapeHtml(
        cat.label
      )}</span></h1>
      <input type="search" id="materialFilter" placeholder="Filter…" value="${escapeAttr(
        materialListFilter
      )}" aria-label="Filter materials" />
      <button type="button" class="primary" id="addMaterial">Add material</button>
    </div>
    <p class="meta toolbar-meta">${items.length} ${items.length === 1 ? "item" : "items"}</p>
    ${
      loadError
        ? `<p class="empty">${escapeHtml(loadError)}</p>`
        : items.length
          ? `<div class="card-grid">${items.map(materialCardHtml).join("")}</div>`
          : `<p class="empty">No ${escapeHtml(cat.label.toLowerCase())} materials yet — use Add material.</p>`
    }
  `,
    "materials"
  );

  document.getElementById("backMaterials")?.addEventListener("click", () => {
    materialsCategory = null;
    sessionStorage.setItem("pincushion_materials_category", "all");
    editingMaterialId = null;
    render();
  });
  document.getElementById("addMaterial")?.addEventListener("click", () => {
    editingMaterialId = null;
    view = "material_new";
    render();
  });
  const filterEl = document.getElementById("materialFilter") as HTMLInputElement;
  let filterTimer = 0;
  filterEl.addEventListener("input", () => {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      materialListFilter = filterEl.value;
      sessionStorage.setItem("pincushion_material_filter", materialListFilter);
      render();
    }, 180);
  });

  const openEdit = (id: number) => {
    editingMaterialId = id;
    view = "material_new";
    render();
  };
  app.querySelectorAll<HTMLElement>(".material-card[data-mid]").forEach((card) => {
    const id = Number(card.dataset.mid);
    if (!id) return;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).closest(".btn-del-mat")) return;
      openEdit(id);
    });
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openEdit(id);
      }
    });
  });

  app.querySelectorAll(".btn-del-mat").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = Number((btn as HTMLElement).dataset.mid);
      if (!confirm("Delete this material from your stash?")) return;
      try {
        await api(`/api/materials/${id}`, { method: "DELETE" });
        if (editingMaterialId === id) editingMaterialId = null;
        render();
      } catch (e) {
        alert(String(e));
      }
    });
  });
}

const KNOWN_FLOSS_BRANDS: { id: string; label: string }[] = [
  { id: "dmc", label: "DMC" },
  { id: "anchor", label: "Anchor" },
  { id: "madeira", label: "Madeira" },
  { id: "cosmo", label: "Cosmo" },
  { id: "sullivans", label: "Sullivans" },
  { id: "jp_coats", label: "J&P Coats" },
  { id: "cxc", label: "CXC" },
  { id: "hatchette", label: "Hatchette" },
];

const CUSTOM_FLOSS_BRANDS_KEY = "pincushion_custom_floss_brands";

function loadLocalCustomFlossBrands(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_FLOSS_BRANDS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return [
      ...new Set(
        raw
          .filter((x) => typeof x === "string")
          .map((x: string) => x.trim())
          .filter(Boolean)
      ),
    ];
  } catch {
    return [];
  }
}

function saveCustomFlossBrand(name: string) {
  const clean = name.trim();
  if (!clean) return;
  const known = KNOWN_FLOSS_BRANDS.some((b) => b.label.toLowerCase() === clean.toLowerCase());
  if (known || clean.toLowerCase() === "other") return;
  const next = [
    ...loadLocalCustomFlossBrands().filter((b) => b.toLowerCase() !== clean.toLowerCase()),
    clean,
  ];
  next.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  localStorage.setItem(CUSTOM_FLOSS_BRANDS_KEY, JSON.stringify(next));
}

async function loadCustomFlossBrands(): Promise<string[]> {
  const local = loadLocalCustomFlossBrands();
  try {
    const res = await api<{ brands: string[] }>("/api/materials/brands?category=floss");
    const merged = [...new Set([...local, ...(res.brands || [])])];
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    localStorage.setItem(CUSTOM_FLOSS_BRANDS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return [...local].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
}

function flossBrandOptionsHtml(custom: string[]) {
  const known = KNOWN_FLOSS_BRANDS.map(
    (b) => `<option value="${escapeAttr(b.id)}">${escapeHtml(b.label)}</option>`
  ).join("");
  const saved =
    custom.length === 0
      ? ""
      : `<optgroup label="Saved brands">${custom
          .map((name) => `<option value="custom:${escapeAttr(name)}">${escapeHtml(name)}</option>`)
          .join("")}</optgroup>`;
  return `${known}${saved}<option value="other">Other</option>`;
}

interface MaterialSummary {
  id: number;
  category: string;
  name: string;
  brand?: string | null;
  colour_code?: string | null;
  colour_rgb?: string | null;
  colour_hex?: string | null;
  modifiers?: string[];
  quantity?: string;
  length_per_skein?: string;
  notes?: string;
  thumbnail_url?: string | null;
}

function materialInventoryFieldsHtml(init?: {
  quantity?: string;
  length_per_skein?: string;
  notes?: string;
}) {
  const qty = init?.quantity != null && init.quantity !== "" ? init.quantity : "1";
  const len =
    init?.length_per_skein != null && init.length_per_skein !== "" ? init.length_per_skein : "8";
  const notes = init?.notes || "";
  return `
      <div class="form-row">
        <label class="form-field">
          <span>Quantity</span>
          <input type="text" id="nmQuantity" value="${escapeAttr(qty)}" placeholder="e.g. 2 skeins" autocomplete="off" />
        </label>
        <label class="form-field">
          <span>Length (per Skein)</span>
          <input type="text" id="nmLength" value="${escapeAttr(len)}" placeholder="e.g. 8 m" autocomplete="off" />
        </label>
      </div>
      <label class="form-field">
        <span>Notes</span>
        <textarea id="nmNotes" rows="3" placeholder="Dye lot, stash location, …">${escapeHtml(notes)}</textarea>
      </label>`;
}

/** Label / band colour for a floss brand (paper part of the skein icon). */
function flossBrandPaperColor(brand: string | null | undefined): string {
  const key = (brand || "").trim().toLowerCase().replace(/&/g, "and").replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    dmc: "#E8C547",
    anchor: "#2F6B4F",
    madeira: "#1F5FA8",
    cosmo: "#D9488B",
    lecien: "#D9488B",
    lecien_cosmo: "#D9488B",
    sullivans: "#6B4C9A",
    sullivan: "#6B4C9A",
    jp_coats: "#C0392B",
    j_and_p_coats: "#C0392B",
    jandp_coats: "#C0392B",
    coats: "#C0392B",
    cxc: "#0E8F7A",
    hatchette: "#C45C86",
    hachette: "#C45C86",
  };
  if (map[key]) return map[key];
  for (const [id, color] of Object.entries(map)) {
    if (key.includes(id) || id.includes(key)) return color;
  }
  // Stable pastel from brand name for unknown / custom brands.
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 42% 52%)`;
}

function flossBrandInitial(brand: string | null | undefined): string {
  const raw = (brand || "").trim();
  if (!raw) return "?";
  // Prefer first letter of a word (skip J&P → J, etc.)
  const letter = raw.replace(/^[^A-Za-z]+/, "").charAt(0);
  return (letter || raw.charAt(0)).toUpperCase();
}

function flossSkeinHtml(m: MaterialSummary) {
  const thread = m.colour_hex ? `#${m.colour_hex}` : "#888888";
  const paper = flossBrandPaperColor(m.brand);
  const initial = flossBrandInitial(m.brand);
  return `<div class="floss-skein" style="--floss-thread:${escapeAttr(thread)};--floss-paper:${escapeAttr(
    paper
  )}" aria-hidden="true" title="${escapeAttr([m.brand, m.colour_code].filter(Boolean).join(" · "))}">
    <span class="floss-skein-thread"></span>
    <span class="floss-skein-outline"></span>
    <span class="floss-skein-paper"></span>
    <span class="floss-skein-initial">${escapeHtml(initial)}</span>
  </div>`;
}

function materialCardHtml(m: MaterialSummary) {
  const isFloss = (m.category || materialsCategory) === "floss";
  const swatch = isFloss
    ? flossSkeinHtml(m)
    : m.colour_hex
      ? `<div class="material-swatch" style="background:#${escapeAttr(m.colour_hex)}" aria-hidden="true"></div>`
      : m.thumbnail_url
        ? `<img class="card-thumb" src="${escapeAttr(m.thumbnail_url)}" alt="" />`
        : `<div class="craft-card-icon" aria-hidden="true"><i class="fa-solid fa-box craft-icon"></i></div>`;
  const mods = (m.modifiers || []).length
    ? `<div class="meta">${escapeHtml(m.modifiers!.map((id) => id.replace(/_/g, " ")).join(" · "))}</div>`
    : "";
  const sub = [m.brand, m.colour_code].filter(Boolean).join(" · ");
  const inventory = [
    m.quantity ? `Qty ${m.quantity}` : "",
    m.length_per_skein ? `${m.length_per_skein}/skein` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <article class="card craft-card material-card${isFloss ? " is-floss" : ""}" data-mid="${m.id}">
      ${swatch}
      <div class="card-body">
        <h3>${escapeHtml(m.name)}</h3>
        ${sub ? `<div class="meta">${escapeHtml(sub)}</div>` : ""}
        ${mods}
        ${inventory ? `<div class="meta">${escapeHtml(inventory)}</div>` : ""}
        <div class="card-actions">
          <button type="button" class="secondary btn-del-mat" data-mid="${m.id}">Delete</button>
        </div>
      </div>
    </article>`;
}

const FLOSS_MODIFIERS: { id: string; label: string }[] = [
  { id: "metallic", label: "Metallic" },
  { id: "light_effects", label: "Light Effects" },
  { id: "satin", label: "Satin" },
  { id: "variegated", label: "Variegated" },
  { id: "etoile", label: "Étoile" },
  { id: "glow", label: "Glow-in-the-dark" },
];

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

function materialNewFieldsHtml(
  categoryId: string,
  customFlossBrands: string[] = [],
  existing?: MaterialSummary | null
) {
  const inv = materialInventoryFieldsHtml({
    quantity: existing?.quantity,
    length_per_skein: existing?.length_per_skein,
    notes: existing?.notes,
  });
  if (categoryId === "floss") {
    const activeMods = new Set(existing?.modifiers || []);
    const mods = FLOSS_MODIFIERS.map(
      (m) =>
        `<label class="toggle-chip"><input type="checkbox" id="nmMod_${m.id}" value="${escapeAttr(
          m.id
        )}"${activeMods.has(m.id) ? " checked" : ""} /> ${escapeHtml(m.label)}</label>`
    ).join("");
    const code = existing?.colour_code || "";
    const rgb = existing?.colour_rgb || "204,204,204";
    const hex = existing?.colour_hex ? `#${existing.colour_hex}` : "#cccccc";
    return `
      <label class="form-field">
        <span>Brand</span>
        <select id="nmBrand">${flossBrandOptionsHtml(customFlossBrands)}</select>
      </label>
      <label class="form-field is-hidden" id="nmOtherBrandWrap">
        <span>Brand name</span>
        <input type="text" id="nmOtherBrand" placeholder="e.g. Venus, Aliexpress lot" autocomplete="off" value="" />
      </label>
      <label class="form-field">
        <span>Color Code / Description</span>
        <div class="floss-code-row">
          <div class="ac-field floss-code-ac">
            <input type="text" id="nmColour" required placeholder="e.g. 310 or Blanc" autocomplete="off" value="${escapeAttr(
              code
            )}" />
            <ul class="ac-list is-hidden" id="nmColourSuggest" role="listbox" aria-label="Colour code suggestions"></ul>
          </div>
          <button type="button" class="floss-color-btn" id="nmColorBtn" title="Pick colour" aria-label="Pick colour">
            <span class="floss-color-swatch" id="nmColorSwatch" aria-hidden="true"></span>
            <input type="color" id="nmColorWheel" value="${escapeAttr(hex)}" tabindex="-1" />
          </button>
        </div>
        <input type="hidden" id="nmColorRgb" value="${escapeAttr(rgb)}" />
        <p class="meta" id="nmColourHint" aria-live="polite"></p>
      </label>
      <div class="form-field">
        <span>Modifiers</span>
        <div class="toggle-row" role="group" aria-label="Floss modifiers">${mods}</div>
      </div>
      ${inv}`;
  }
  return `
      <label class="form-field">
        <span>Name</span>
        <input type="text" id="nmName" required placeholder="e.g. Cascade 220" value="${escapeAttr(
          existing?.name || ""
        )}" />
      </label>
      <label class="form-field">
        <span>Brand</span>
        <input type="text" id="nmBrand" placeholder="Optional" value="${escapeAttr(existing?.brand || "")}" />
      </label>
      <label class="form-field">
        <span>Colour / colourway</span>
        <input type="text" id="nmColour" placeholder="Optional" value="${escapeAttr(
          existing?.colour_code || ""
        )}" />
      </label>
      ${inv}`;
}

async function renderMaterialNew() {
  if (!materialsCategory) {
    view = "materials";
    editingMaterialId = null;
    return renderMaterialsOverview();
  }
  const label = materialCategoryLabel();
  const isFloss = materialsCategory === "floss";
  const isEdit = editingMaterialId != null;
  let existing: MaterialSummary | null = null;
  if (isEdit) {
    try {
      existing = await api<MaterialSummary>(`/api/materials/${editingMaterialId}`);
      if (existing.category && existing.category !== materialsCategory) {
        materialsCategory = existing.category;
        sessionStorage.setItem("pincushion_materials_category", materialsCategory);
      }
    } catch (e) {
      editingMaterialId = null;
      alert(String(e));
      view = "materials";
      return renderMaterialsCategory();
    }
  }
  const customFlossBrands = isFloss ? await loadCustomFlossBrands() : [];
  shell(
    `
    <div class="craft-toolbar">
      <button type="button" class="secondary toolbar-back" id="backMaterialCat" aria-label="Back">←</button>
      <h1 class="craft-toolbar-title"><span>${isEdit ? "Edit" : "New"} ${escapeHtml(label)}</span></h1>
    </div>
    <form class="panel add-entity-form" id="newMaterialForm">
      ${materialNewFieldsHtml(materialsCategory, customFlossBrands, existing)}
      <div class="form-field">
        <span>Photos / files</span>
        <label class="primary upload-btn">
          Choose files
          <input type="file" id="uploadInput" multiple accept="image/*,.pdf" hidden />
        </label>
        <div class="upload-dropzone" id="uploadDropzone" tabindex="0">
          <p>Drop photos or PDFs here</p>
          <p class="meta">Saved under /data/library/materials/${escapeHtml(materialsCategory)}/.</p>
        </div>
        <ul class="file-pending-list" id="pendingFiles"></ul>
      </div>
      <p class="meta" id="uploadStatus" aria-live="polite"></p>
      <div class="form-actions">
        <button type="button" class="secondary" id="cancelNewMaterial">Cancel</button>
        <button type="submit" class="primary">${isEdit ? "Save changes" : "Save material"}</button>
      </div>
    </form>
  `,
    "material_new"
  );

  let pendingFiles: File[] = [];
  const pendingEl = document.getElementById("pendingFiles")!;
  const statusEl = document.getElementById("uploadStatus")!;
  const refreshPending = () => {
    pendingEl.innerHTML = pendingFiles
      .map((f, i) => `<li>${escapeHtml(f.name)} <button type="button" data-rm="${i}" class="linkish">Remove</button></li>`)
      .join("");
    pendingEl.querySelectorAll<HTMLButtonElement>("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingFiles.splice(Number(btn.dataset.rm), 1);
        refreshPending();
      });
    });
  };
  const goBack = () => {
    editingMaterialId = null;
    view = "materials";
    render();
  };
  document.getElementById("backMaterialCat")?.addEventListener("click", goBack);
  document.getElementById("cancelNewMaterial")?.addEventListener("click", goBack);
  bindUploadDropzone(
    document.getElementById("uploadInput") as HTMLInputElement,
    document.getElementById("uploadDropzone")!,
    (files) => {
      pendingFiles = [...pendingFiles, ...files];
      refreshPending();
    }
  );

  if (isFloss) {
    const brandEl = document.getElementById("nmBrand") as HTMLSelectElement;
    const otherWrap = document.getElementById("nmOtherBrandWrap")!;
    const otherBrandEl = document.getElementById("nmOtherBrand") as HTMLInputElement;
    const codeEl = document.getElementById("nmColour") as HTMLInputElement;
    const hintEl = document.getElementById("nmColourHint")!;
    const suggestEl = document.getElementById("nmColourSuggest")!;
    const colorBtn = document.getElementById("nmColorBtn") as HTMLButtonElement;
    const wheelEl = document.getElementById("nmColorWheel") as HTMLInputElement;
    const swatchEl = document.getElementById("nmColorSwatch")!;
    const rgbEl = document.getElementById("nmColorRgb") as HTMLInputElement;
    let lookupGen = 0;
    let suggestGen = 0;
    let activeSuggest = -1;
    type FlossSuggest = { number: string; name: string; hex: string; rgb: number[] };
    let suggestItems: FlossSuggest[] = [];

    const brandSelection = () => {
      const v = brandEl.value;
      if (v === "other") return { kind: "other" as const, id: "other", label: otherBrandEl.value.trim() };
      if (v.startsWith("custom:")) {
        const label = v.slice("custom:".length);
        return { kind: "custom" as const, id: "other", label };
      }
      return { kind: "known" as const, id: v, label: KNOWN_FLOSS_BRANDS.find((b) => b.id === v)?.label || v };
    };

    const syncOtherBrandField = () => {
      const isOther = brandEl.value === "other";
      otherWrap.classList.toggle("is-hidden", !isOther);
      if (isOther) otherBrandEl.focus();
    };

    const applyColour = (hex: string) => {
      const normalized = (hex.startsWith("#") ? hex : `#${hex}`).toLowerCase();
      const rgb = hexToRgbTuple(normalized);
      wheelEl.value = rgb ? normalized : "#cccccc";
      swatchEl.style.background = wheelEl.value;
      colorBtn.style.setProperty("--floss-swatch", wheelEl.value);
      if (rgb) rgbEl.value = rgb.join(",");
      else rgbEl.value = "204,204,204";
    };
    if (existing?.colour_hex) applyColour(`#${existing.colour_hex}`);
    else if (existing?.colour_rgb) {
      const parts = String(existing.colour_rgb)
        .split(",")
        .map((n) => Number(n.trim()));
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        applyColour(
          `#${parts.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`
        );
      } else applyColour("#cccccc");
    } else applyColour("#cccccc");

    colorBtn.addEventListener("click", (ev) => {
      if (ev.target === wheelEl) return;
      wheelEl.click();
    });
    wheelEl.addEventListener("input", () => applyColour(wheelEl.value));
    wheelEl.addEventListener("change", () => applyColour(wheelEl.value));

    const hideSuggest = () => {
      suggestEl.classList.add("is-hidden");
      suggestEl.innerHTML = "";
      suggestItems = [];
      activeSuggest = -1;
    };

    const selectSuggest = (item: FlossSuggest) => {
      codeEl.value = item.number;
      applyColour(`#${item.hex}`);
      hintEl.textContent = item.name
        ? `Known: ${item.number} — ${item.name} · RGB ${rgbEl.value}`
        : `Known catalogue colour ${item.number} · RGB ${rgbEl.value}`;
      hideSuggest();
      codeEl.focus();
    };

    const paintSuggest = () => {
      if (!suggestItems.length) {
        hideSuggest();
        return;
      }
      suggestEl.innerHTML = suggestItems
        .map((item, idx) => {
          const swatch = `#${item.hex}`;
          return `<li role="option" data-idx="${idx}" class="${
            idx === activeSuggest ? "is-active" : ""
          }"><span class="floss-suggest-main"><span class="floss-suggest-swatch" style="background:${escapeAttr(
            swatch
          )}"></span><strong>${escapeHtml(item.number)}</strong>${
            item.name ? ` · ${escapeHtml(item.name)}` : ""
          }</span><span class="meta">${escapeHtml(swatch)}</span></li>`;
        })
        .join("");
      suggestEl.classList.remove("is-hidden");
      suggestEl.querySelectorAll("li").forEach((li) => {
        li.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          const idx = Number((li as HTMLElement).dataset.idx);
          const item = suggestItems[idx];
          if (item) selectSuggest(item);
        });
      });
    };

    const runSuggest = async () => {
      const q = codeEl.value.trim();
      const sel = brandSelection();
      const gen = ++suggestGen;
      if (!q || sel.kind !== "known") {
        hideSuggest();
        return;
      }
      try {
        const res = await api<{ suggestions: FlossSuggest[] }>(
          `/api/floss/suggest?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(sel.id)}&limit=12`
        );
        if (gen !== suggestGen) return;
        suggestItems = res.suggestions || [];
        activeSuggest = suggestItems.length ? 0 : -1;
        paintSuggest();
      } catch {
        if (gen !== suggestGen) return;
        hideSuggest();
      }
    };

    const runLookup = async () => {
      const code = codeEl.value.trim();
      const sel = brandSelection();
      const gen = ++lookupGen;
      if (!code) {
        hintEl.textContent = "";
        return;
      }
      if (sel.kind !== "known") {
        hintEl.textContent = "Custom brand — set colour with the swatch button.";
        return;
      }
      try {
        const hit = await api<{
          known: boolean;
          number?: string;
          name?: string;
          hex?: string;
          brand?: string;
        }>(`/api/floss/by-number?number=${encodeURIComponent(code)}&brand=${encodeURIComponent(sel.id)}`);
        if (gen !== lookupGen) return;
        if (hit.known && hit.hex) {
          applyColour(`#${hit.hex}`);
          hintEl.textContent = hit.name
            ? `Known: ${hit.number} — ${hit.name} · RGB ${rgbEl.value}`
            : `Known catalogue colour ${hit.number} · RGB ${rgbEl.value}`;
        } else {
          hintEl.textContent = "Not in catalogue — pick a colour with the swatch button.";
        }
      } catch {
        if (gen !== lookupGen) return;
        hintEl.textContent = "Lookup failed — pick a colour with the swatch button.";
      }
    };

    let timer = 0;
    const scheduleCodeAssist = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void runSuggest();
        void runLookup();
      }, 180);
    };
    codeEl.addEventListener("input", scheduleCodeAssist);
    codeEl.addEventListener("change", () => void runLookup());
    codeEl.addEventListener("keydown", (ev) => {
      if (suggestEl.classList.contains("is-hidden") || !suggestItems.length) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        activeSuggest = (activeSuggest + 1) % suggestItems.length;
        paintSuggest();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        activeSuggest = (activeSuggest - 1 + suggestItems.length) % suggestItems.length;
        paintSuggest();
      } else if (ev.key === "Enter" && activeSuggest >= 0) {
        ev.preventDefault();
        const item = suggestItems[activeSuggest];
        if (item) selectSuggest(item);
      } else if (ev.key === "Escape") {
        hideSuggest();
      }
    });
    codeEl.addEventListener("blur", () => {
      window.setTimeout(hideSuggest, 120);
    });
    brandEl.addEventListener("change", () => {
      syncOtherBrandField();
      hideSuggest();
      void runLookup();
      void runSuggest();
    });
    syncOtherBrandField();

    if (existing?.brand) {
      const brandName = existing.brand.trim();
      const known = KNOWN_FLOSS_BRANDS.find(
        (b) =>
          b.label.toLowerCase() === brandName.toLowerCase() ||
          b.id === brandName.toLowerCase()
      );
      if (known && [...brandEl.options].some((o) => o.value === known.id)) {
        brandEl.value = known.id;
      } else {
        const customVal = `custom:${brandName}`;
        if ([...brandEl.options].some((o) => o.value === customVal)) {
          brandEl.value = customVal;
        } else {
          brandEl.value = "other";
          otherBrandEl.value = brandName;
        }
      }
      syncOtherBrandField();
      if (codeEl.value.trim()) void runLookup();
    } else {
      void api<{ floss_brand?: string }>("/api/supplies")
        .then((s) => {
          if (s.floss_brand && [...brandEl.options].some((o) => o.value === s.floss_brand)) {
            brandEl.value = s.floss_brand;
            syncOtherBrandField();
          }
        })
        .catch(() => undefined);
    }
  }

  document.getElementById("newMaterialForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = new FormData();
    form.append("category", materialsCategory!);
    if (isFloss) {
      const code = (document.getElementById("nmColour") as HTMLInputElement).value.trim();
      if (!code) {
        statusEl.textContent = "Color Code / Description is required.";
        return;
      }
      const brandEl = document.getElementById("nmBrand") as HTMLSelectElement;
      const otherBrandEl = document.getElementById("nmOtherBrand") as HTMLInputElement;
      let brandValue = brandEl.value;
      let customBrand = "";
      if (brandEl.value === "other") {
        customBrand = otherBrandEl.value.trim();
        if (!customBrand) {
          statusEl.textContent = "Enter a brand name for Other.";
          otherBrandEl.focus();
          return;
        }
        brandValue = customBrand;
      } else if (brandEl.value.startsWith("custom:")) {
        customBrand = brandEl.value.slice("custom:".length);
        brandValue = customBrand;
      } else {
        brandValue =
          KNOWN_FLOSS_BRANDS.find((b) => b.id === brandEl.value)?.label || brandEl.value;
      }
      const rgbRaw = (document.getElementById("nmColorRgb") as HTMLInputElement).value.trim();
      const rgbParts = rgbRaw.split(",").map((n) => Number(n.trim()));
      if (rgbParts.length !== 3 || rgbParts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
        statusEl.textContent = "Pick a colour so an RGB code can be saved.";
        return;
      }
      const modifiers = FLOSS_MODIFIERS.filter(
        (m) => (document.getElementById(`nmMod_${m.id}`) as HTMLInputElement | null)?.checked
      ).map((m) => m.id);
      form.append("colour_code", code);
      form.append("brand", brandValue);
      form.append("colour_rgb", rgbParts.join(","));
      form.append("modifiers", JSON.stringify(modifiers));
      if (customBrand) saveCustomFlossBrand(customBrand);
    } else {
      const name = (document.getElementById("nmName") as HTMLInputElement).value.trim();
      if (!name) {
        statusEl.textContent = "Name is required.";
        return;
      }
      form.append("name", name);
      form.append(
        "brand",
        (document.getElementById("nmBrand") as HTMLInputElement).value.trim()
      );
      form.append(
        "colour_code",
        (document.getElementById("nmColour") as HTMLInputElement).value.trim()
      );
    }
    form.append(
      "quantity",
      (document.getElementById("nmQuantity") as HTMLInputElement).value.trim()
    );
    form.append(
      "length_per_skein",
      (document.getElementById("nmLength") as HTMLInputElement).value.trim()
    );
    form.append(
      "notes",
      (document.getElementById("nmNotes") as HTMLTextAreaElement).value.trim()
    );
    for (const f of pendingFiles) form.append("files", f);

    statusEl.textContent = "Saving…";
    try {
      const url =
        isEdit && editingMaterialId != null
          ? `/api/materials/${editingMaterialId}`
          : "/api/materials";
      const method = isEdit ? "PATCH" : "POST";
      await fetch(url, { method, body: form }).then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || r.statusText);
        return r.json();
      });
      editingMaterialId = null;
      view = "materials";
      render();
    } catch (e) {
      statusEl.textContent = String(e);
    }
  });
}

async function renderMaterials() {
  if (!materialsCategory) return renderMaterialsOverview();
  return renderMaterialsCategory();
}

function hexColor(raw: string) {
  const h = raw.replace("#", "");
  return h.length === 6 ? `#${h}` : "#cccccc";
}

function shadeHex(raw: string, amount: number) {
  const h = raw.replace("#", "");
  if (h.length !== 6) return hexColor(raw);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(h.slice(0, 2), 16) * (1 + amount));
  const g = clamp(parseInt(h.slice(2, 4), 16) * (1 + amount));
  const b = clamp(parseInt(h.slice(4, 6), 16) * (1 + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

type PartHalf = "bl" | "tr" | "tl" | "br";

/**
 * Ursa partstitch:
 * - direction 1: \\ split — palindex1 = bottom-left, palindex2 = top-right
 * - direction 2: / split — palindex1 = top-left, palindex2 = bottom-right
 * - direction 3/4: tent/gobelin half-stitches (diagonal stroke), not triangles
 */
function partHalfFor(direction: number, which: 1 | 2): PartHalf {
  if (direction === 2 || direction === 4) return which === 1 ? "tl" : "br";
  return which === 1 ? "bl" : "tr";
}

function partTrianglePath(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, half: PartHalf) {
  const x0 = x * cell;
  const y0 = y * cell;
  const x1 = x0 + cell;
  const y1 = y0 + cell;
  ctx.beginPath();
  if (half === "bl") {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x1, y1);
  } else if (half === "tr") {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
  } else if (half === "tl") {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x0, y1);
  } else {
    ctx.moveTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
  }
  ctx.closePath();
}

function drawTentStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  direction: number,
  color: string,
  opts?: { preview?: boolean }
) {
  const pad = Math.max(0.8, cell * 0.18);
  const x0 = x * cell + pad;
  const y0 = y * cell + pad;
  const x1 = x * cell + cell - pad;
  const y1 = y * cell + cell - pad;
  const from = direction === 3 ? { x: x0, y: y0 } : { x: x1, y: y0 };
  const to = direction === 3 ? { x: x1, y: y1 } : { x: x0, y: y1 };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (opts?.preview) {
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = Math.max(1.2, cell * 0.34);
    ctx.beginPath();
    ctx.moveTo(from.x + 0.4, from.y + 0.6);
    ctx.lineTo(to.x + 0.4, to.y + 0.6);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.1, cell * 0.28);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = shadeHex(color, 0.28);
    ctx.lineWidth = Math.max(0.6, cell * 0.1);
    ctx.beginPath();
    ctx.moveTo(from.x + cell * 0.04, from.y + cell * 0.02);
    ctx.lineTo(to.x - cell * 0.02, to.y - cell * 0.04);
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, cell * 0.28);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawPartStitches(
  ctx: CanvasRenderingContext2D,
  norm: Normalized,
  cell: number,
  palMap: Map<number, Normalized["palette"][number]>,
  opts?: { onlyPal?: number | null; forceColor?: string; preview?: boolean }
) {
  for (const ps of norm.part_stitches || []) {
    const dir = ps.direction || 1;
    const p1 = ps.palindex1 || 0;
    const p2 = ps.palindex2 || 0;
    if (dir === 3 || dir === 4) {
      const palindex = p1 > 0 ? p1 : p2;
      if (!palindex) continue;
      if (opts?.onlyPal != null && palindex !== opts.onlyPal) continue;
      const pal = palMap.get(palindex);
      drawTentStroke(
        ctx,
        ps.x,
        ps.y,
        cell,
        dir,
        opts?.forceColor || (pal ? hexColor(pal.color) : "#888"),
        { preview: opts?.preview }
      );
      continue;
    }
    for (const which of [1, 2] as const) {
      const palindex = which === 1 ? p1 : p2;
      if (!palindex || palindex <= 0) continue;
      if (opts?.onlyPal != null && palindex !== opts.onlyPal) continue;
      const pal = palMap.get(palindex);
      const color = opts?.forceColor || (pal ? hexColor(pal.color) : "#ccc");
      const half = partHalfFor(dir, which);
      if (opts?.preview) {
        // Clip a full faux cross to the half-triangle so partials read as thread, not blocks.
        ctx.save();
        partTrianglePath(ctx, ps.x, ps.y, cell, half);
        ctx.clip();
        drawFauxThreadX(ctx, ps.x, ps.y, cell, color);
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        partTrianglePath(ctx, ps.x, ps.y, cell, half);
        ctx.fill();
      }
    }
  }
}

function drawOrnaments(
  ctx: CanvasRenderingContext2D,
  norm: Normalized,
  cell: number,
  palMap: Map<number, Normalized["palette"][number]>,
  opts?: { onlyPal?: number | null; forceColor?: string; preview?: boolean }
) {
  for (const o of norm.ornaments || []) {
    if (opts?.onlyPal != null && o.palindex !== opts.onlyPal) continue;
    const pal = palMap.get(o.palindex);
    const color = opts?.forceColor || (pal ? hexColor(pal.color) : "#444");
    const cx = o.x * cell;
    const cy = o.y * cell;
    const bead = (o.objecttype || "").toLowerCase().startsWith("bead");
    const r = Math.max(1.4, cell * (bead ? 0.22 : 0.16));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (opts?.preview || bead) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(0.8, cell * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = Math.max(0.8, cell * 0.05);
      ctx.stroke();
    }
  }
}

function drawFauxThreadX(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string
) {
  const pad = Math.max(0.8, cell * 0.14);
  const x0 = x * cell + pad;
  const y0 = y * cell + pad;
  const x1 = x * cell + cell - pad;
  const y1 = y * cell + cell - pad;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Soft shadow under-thread
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(1.2, cell * 0.34);
  ctx.beginPath();
  ctx.moveTo(x0 + 0.4, y0 + 0.6);
  ctx.lineTo(x1 + 0.4, y1 + 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 + 0.4, y0 + 0.6);
  ctx.lineTo(x0 + 0.4, y1 + 0.6);
  ctx.stroke();
  // Main floss
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.1, cell * 0.28);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
  // Light sheen on top arm
  ctx.strokeStyle = shadeHex(color, 0.28);
  ctx.lineWidth = Math.max(0.6, cell * 0.1);
  ctx.beginPath();
  ctx.moveTo(x0 + cell * 0.05, y0 + cell * 0.02);
  ctx.lineTo(x1 - cell * 0.02, y1 - cell * 0.05);
  ctx.stroke();
}

/** Square resin drill with gem facets — not an X-stitch. */
function drawFauxDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string
) {
  const pad = Math.max(0.55, cell * 0.1);
  const x0 = x * cell + pad;
  const y0 = y * cell + pad;
  const size = cell - pad * 2;
  const r = Math.max(0.6, size * 0.12);
  const cx = x0 + size / 2;
  const cy = y0 + size / 2;

  ctx.save();
  // Soft drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  roundRectPath(ctx, x0 + size * 0.06, y0 + size * 0.1, size, size, r);
  ctx.fill();

  // Drill body
  roundRectPath(ctx, x0, y0, size, size, r);
  ctx.fillStyle = color;
  ctx.fill();

  // Bevel / edge darkening
  ctx.strokeStyle = shadeHex(color, -0.28);
  ctx.lineWidth = Math.max(0.6, cell * 0.05);
  ctx.stroke();

  // Facet diamond (rhombus) on top of the square drill
  const inset = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx, y0 + inset);
  ctx.lineTo(x0 + size - inset, cy);
  ctx.lineTo(cx, y0 + size - inset);
  ctx.lineTo(x0 + inset, cy);
  ctx.closePath();
  ctx.fillStyle = shadeHex(color, 0.12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(0.5, cell * 0.035);
  ctx.stroke();

  // Specular sparkle
  ctx.beginPath();
  ctx.moveTo(cx, y0 + inset);
  ctx.lineTo(x0 + size - inset, cy);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x0 + size * 0.32, y0 + size * 0.3, Math.max(0.7, size * 0.1), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.restore();
}

/** Round seed bead with a small centre hole. */
function drawFauxBead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string
) {
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell / 2;
  const r = Math.max(1.4, cell * 0.38);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx + cell * 0.04, cy + cell * 0.06, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -0.3);
  ctx.lineWidth = Math.max(0.7, cell * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.8, r * 0.22), 0, Math.PI * 2);
  ctx.fillStyle = shadeHex(color, -0.35);
  ctx.fill();
  ctx.restore();
}

/** Perler / Hama fuse bead — thick plastic cylinder with a large hollow core. */
function drawFauxFuseBead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string
) {
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell / 2;
  const outer = Math.max(2, cell * 0.44);
  const inner = Math.max(1, outer * 0.38);
  ctx.save();
  // Drop shadow
  ctx.beginPath();
  ctx.arc(cx + cell * 0.05, cy + cell * 0.07, outer, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fill();
  // Outer cylinder
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -0.32);
  ctx.lineWidth = Math.max(0.8, cell * 0.055);
  ctx.stroke();
  // Rim highlight (matte plastic edge)
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 0.88, 0, Math.PI * 2);
  ctx.strokeStyle = shadeHex(color, 0.18);
  ctx.lineWidth = Math.max(0.6, cell * 0.045);
  ctx.stroke();
  // Specular
  ctx.beginPath();
  ctx.arc(cx - outer * 0.28, cy - outer * 0.3, outer * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fill();
  // Hollow core (peg shows through)
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = shadeHex(color, -0.45);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, inner * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,40,40,0.55)";
  ctx.fill();
  // Peg tip in the hole
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.6, inner * 0.35), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(220,220,220,0.85)";
  ctx.fill();
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPreviewCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string,
  style: PreviewCellStyle
) {
  if (style === "diamond") drawFauxDiamond(ctx, x, y, cell, color);
  else if (style === "fuse_bead") drawFauxFuseBead(ctx, x, y, cell, color);
  else if (style === "bead") drawFauxBead(ctx, x, y, cell, color);
  else drawFauxThreadX(ctx, x, y, cell, color);
}

function drawPreviewFabric(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  cell: number,
  colour: string,
  texture: FabricTexture
) {
  const base = hexColor(colour);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, widthPx, heightPx);
  if (texture === "blank") return;

  if (texture === "pegboard") {
    // Plastic Perler / Hama pegboard — pale board with peg stubs in each cell.
    const dark = shadeHex(base, -0.16);
    const mid = shadeHex(base, -0.06);
    const light = shadeHex(base, 0.1);
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, widthPx, heightPx);
    for (let y = 0; y < heightPx; y += cell) {
      for (let x = 0; x < widthPx; x += cell) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const peg = Math.max(1, cell * 0.14);
        ctx.beginPath();
        ctx.arc(cx, cy, peg, 0, Math.PI * 2);
        ctx.fillStyle = light;
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(0.5, cell * 0.035);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - peg * 0.25, cy - peg * 0.25, peg * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }
    }
    ctx.strokeStyle = shadeHex(base, -0.2);
    ctx.lineWidth = Math.max(0.4, cell * 0.03);
    for (let x = 0; x <= widthPx; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y <= heightPx; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(widthPx, y + 0.5);
      ctx.stroke();
    }
    return;
  }

  if (texture === "canvas") {
    // Adhesive diamond-painting / bead canvas — flat plastic with a printed square grid.
    const dark = shadeHex(base, -0.14);
    const light = shadeHex(base, 0.06);
    const inset = Math.max(0.4, cell * 0.08);
    for (let y = 0; y < heightPx; y += cell) {
      for (let x = 0; x < widthPx; x += cell) {
        ctx.fillStyle = light;
        ctx.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(0.5, cell * 0.04);
        ctx.strokeRect(x + inset + 0.25, y + inset + 0.25, cell - inset * 2 - 0.5, cell - inset * 2 - 0.5);
      }
    }
    ctx.strokeStyle = shadeHex(base, -0.22);
    ctx.lineWidth = Math.max(0.45, cell * 0.035);
    for (let x = 0; x <= widthPx; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y <= heightPx; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(widthPx, y + 0.5);
      ctx.stroke();
    }
    return;
  }

  if (texture === "aida") {
    const hole = Math.max(0.7, cell * 0.16);
    const gap = Math.max(0.35, cell * 0.05);
    const dark = shadeHex(base, -0.12);
    const light = shadeHex(base, 0.08);
    // Soft weave blocks
    for (let y = 0; y < heightPx; y += cell) {
      for (let x = 0; x < widthPx; x += cell) {
        ctx.fillStyle = light;
        ctx.fillRect(x + gap, y + gap, cell - gap * 2, cell - gap * 2);
        ctx.fillStyle = dark;
        const hx = x + cell / 2 - hole / 2;
        const hy = y + cell / 2 - hole / 2;
        ctx.fillRect(hx, hy, hole, hole);
        // corner pinholes typical of aida
        const pin = Math.max(0.5, hole * 0.45);
        for (const [px, py] of [
          [x + gap, y + gap],
          [x + cell - gap - pin, y + gap],
          [x + gap, y + cell - gap - pin],
          [x + cell - gap - pin, y + cell - gap - pin],
        ] as const) {
          ctx.fillRect(px, py, pin, pin);
        }
      }
    }
    ctx.strokeStyle = shadeHex(base, -0.18);
    ctx.lineWidth = Math.max(0.4, cell * 0.03);
    for (let x = 0; x <= widthPx; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y <= heightPx; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(widthPx, y + 0.5);
      ctx.stroke();
    }
    return;
  }

  // linen — finer irregular weave
  const thread = Math.max(0.6, cell * 0.08);
  const dark = shadeHex(base, -0.1);
  const mid = shadeHex(base, -0.04);
  const light = shadeHex(base, 0.07);
  ctx.lineCap = "butt";
  for (let y = 0; y < heightPx; y += thread * 2) {
    ctx.strokeStyle = y % (thread * 4) < thread * 2 ? dark : mid;
    ctx.lineWidth = thread * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.3);
    // slight wobble for organic linen feel
    for (let x = 0; x <= widthPx; x += cell) {
      const wobble = ((x * 13 + y * 7) % 5) - 2;
      ctx.lineTo(x, y + wobble * 0.15);
    }
    ctx.stroke();
  }
  for (let x = 0; x < widthPx; x += thread * 2) {
    ctx.strokeStyle = x % (thread * 4) < thread * 2 ? mid : light;
    ctx.lineWidth = thread * 0.7;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x + 0.3, 0);
    for (let y = 0; y <= heightPx; y += cell) {
      const wobble = ((x * 11 + y * 17) % 5) - 2;
      ctx.lineTo(x + wobble * 0.12, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCenterLines(
  ctx: CanvasRenderingContext2D,
  widthStitches: number,
  heightStitches: number,
  cell: number
) {
  if (!gridState.centerLines) return;
  const w = widthStitches * cell;
  const h = heightStitches * cell;
  const cx = (widthStitches / 2) * cell;
  const cy = (heightStitches / 2) * cell;
  ctx.save();
  ctx.strokeStyle = "#e11d2e";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(
  canvas: HTMLCanvasElement,
  norm: Normalized,
  extras?: {
    pendingBack?: { x: number; y: number } | null;
    editMode?: boolean;
    highlightPal?: number | null;
    previewMode?: boolean;
    craft?: string | null;
  }
) {
  const cell = gridState.zoom;
  const w = norm.width_stitches * cell;
  const h = norm.height_stitches * cell;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const palMap = new Map(norm.palette.map((p) => [p.index, p]));
  const highlightPal = extras?.highlightPal ?? null;
  const highlighting = highlightPal != null && highlightPal > 0;
  const previewMode = !!extras?.previewMode;
  const craft = extras?.craft ?? null;
  const cellStyle = previewCellStyle(craft);
  const isPixel = isPixelCraft(craft);

  if (previewMode) {
    const texture = resolvePreviewTexture(craft, gridState.fabricTexture);
    drawPreviewFabric(ctx, w, h, cell, gridState.fabricColour, texture);
    for (const s of norm.full_stitches) {
      const pal = palMap.get(s.palindex);
      drawPreviewCell(ctx, s.x, s.y, cell, pal ? hexColor(pal.color) : "#888", cellStyle);
    }
    if (!isPixel) {
      drawPartStitches(ctx, norm, cell, palMap, { preview: true });
      ctx.lineCap = "round";
      for (const b of norm.backstitches || []) {
        const pal = palMap.get(b.palindex);
        ctx.strokeStyle = pal ? hexColor(pal.color) : "#222";
        ctx.lineWidth = Math.max(1.4, cell * 0.16);
        ctx.beginPath();
        ctx.moveTo(b.x1 * cell, b.y1 * cell);
        ctx.lineTo(b.x2 * cell, b.y2 * cell);
        ctx.stroke();
      }
      drawOrnaments(ctx, norm, cell, palMap, { preview: true });
    }
    if (highlighting) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, w, h);
      for (const s of norm.full_stitches) {
        if (s.palindex !== highlightPal) continue;
        drawPreviewCell(ctx, s.x, s.y, cell, "#00e5ff", cellStyle);
      }
      if (!isPixel) {
        drawPartStitches(ctx, norm, cell, palMap, {
          onlyPal: highlightPal,
          forceColor: "#00e5ff",
          preview: true,
        });
        for (const b of norm.backstitches || []) {
          if (b.palindex !== highlightPal) continue;
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = Math.max(1.8, cell * 0.2);
          ctx.beginPath();
          ctx.moveTo(b.x1 * cell, b.y1 * cell);
          ctx.lineTo(b.x2 * cell, b.y2 * cell);
          ctx.stroke();
        }
        drawOrnaments(ctx, norm, cell, palMap, { onlyPal: highlightPal, forceColor: "#00e5ff", preview: true });
      }
    }
    drawCenterLines(ctx, norm.width_stitches, norm.height_stitches, cell);
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (const s of norm.full_stitches) {
    const pal = palMap.get(s.palindex);
    ctx.fillStyle = pal ? hexColor(pal.color) : "#ccc";
    ctx.fillRect(s.x * cell, s.y * cell, cell, cell);
    const mark = symbolForPalette(norm.palette, s.palindex);
    if (mark) {
      ctx.fillStyle = contrastInk(pal?.color || "#ccc");
      const shrink = mark.length > 1 ? 0.55 : 0.7;
      ctx.font = `600 ${Math.max(8, Math.floor(cell * shrink))}px "Segoe UI Symbol","Noto Sans Symbols","DejaVu Sans",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mark, s.x * cell + cell / 2, s.y * cell + cell / 2);
    }
    const key = `${s.x},${s.y}`;
    if (gridState.marked.has(key)) {
      ctx.strokeStyle = "rgba(0,128,0,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    }
  }
  drawPartStitches(ctx, norm, cell, palMap);
  ctx.strokeStyle = "#e0e0e0";
  for (let x = 0; x <= norm.width_stitches; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell, 0);
    ctx.lineTo(x * cell, h);
    ctx.stroke();
  }
  for (let y = 0; y <= norm.height_stitches; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell);
    ctx.lineTo(w, y * cell);
    ctx.stroke();
  }
  ctx.lineCap = "round";
  for (const b of norm.backstitches || []) {
    const pal = palMap.get(b.palindex);
    ctx.strokeStyle = pal ? hexColor(pal.color) : "#222";
    ctx.lineWidth = Math.max(1.5, cell * 0.18);
    ctx.beginPath();
    ctx.moveTo(b.x1 * cell, b.y1 * cell);
    ctx.lineTo(b.x2 * cell, b.y2 * cell);
    ctx.stroke();
  }
  drawOrnaments(ctx, norm, cell, palMap);
  if (highlighting) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, w, h);
    for (const s of norm.full_stitches) {
      if (s.palindex !== highlightPal) continue;
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(s.x * cell, s.y * cell, cell, cell);
      const mark = symbolForPalette(norm.palette, s.palindex);
      if (mark) {
        ctx.fillStyle = "#003840";
        const shrink = mark.length > 1 ? 0.55 : 0.7;
        ctx.font = `600 ${Math.max(8, Math.floor(cell * shrink))}px "Segoe UI Symbol","Noto Sans Symbols","DejaVu Sans",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mark, s.x * cell + cell / 2, s.y * cell + cell / 2);
      }
    }
    drawPartStitches(ctx, norm, cell, palMap, { onlyPal: highlightPal, forceColor: "#00e5ff" });
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    for (let x = 0; x <= norm.width_stitches; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, h);
      ctx.stroke();
    }
    for (let y = 0; y <= norm.height_stitches; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(w, y * cell);
      ctx.stroke();
    }
    for (const b of norm.backstitches || []) {
      if (b.palindex !== highlightPal) continue;
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = Math.max(2, cell * 0.22);
      ctx.beginPath();
      ctx.moveTo(b.x1 * cell, b.y1 * cell);
      ctx.lineTo(b.x2 * cell, b.y2 * cell);
      ctx.stroke();
    }
    drawOrnaments(ctx, norm, cell, palMap, { onlyPal: highlightPal, forceColor: "#00e5ff" });
  }
  if (extras?.pendingBack) {
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(extras.pendingBack.x * cell, extras.pendingBack.y * cell, Math.max(3, cell * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  drawCenterLines(ctx, norm.width_stitches, norm.height_stitches, cell);
}

type NormCrop = { x: number; y: number; w: number; h: number };

const PATTERN_CROP_KEY = "pincushion_pattern_crop";

interface PatternCropState {
  pdfPage: number;
  crop: NormCrop;
}

function clampNormCrop(c: NormCrop): NormCrop {
  const minN = 0.04;
  const x = Math.max(0, Math.min(1, c.x));
  const y = Math.max(0, Math.min(1, c.y));
  const w = Math.max(minN, Math.min(1 - x, c.w));
  const h = Math.max(minN, Math.min(1 - y, c.h));
  return { x, y, w, h };
}

function loadPatternCropState(patternId: number): PatternCropState | null {
  try {
    const raw = sessionStorage.getItem(`${PATTERN_CROP_KEY}_${patternId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PatternCropState;
    if (!parsed?.crop || typeof parsed.pdfPage !== "number") return null;
    return { pdfPage: parsed.pdfPage, crop: clampNormCrop(parsed.crop) };
  } catch {
    return null;
  }
}

function savePatternCropState(patternId: number, pdfPage: number, crop: NormCrop) {
  const payload: PatternCropState = { pdfPage, crop: clampNormCrop(crop) };
  sessionStorage.setItem(`${PATTERN_CROP_KEY}_${patternId}`, JSON.stringify(payload));
}

function pdfRasterPreviewUrl(patternId: number, page: number) {
  return `/api/patterns/${patternId}/raster-preview?page=${page}`;
}

function pdfPageBarHtml(prefix: string, pageCount: number) {
  if (pageCount <= 1) return "";
  return `
    <div class="pdf-page-bar" data-pdf-bar="${prefix}">
      <button type="button" class="secondary" data-pdf-prev="${prefix}">Prev</button>
      <span class="pdf-page-label" data-pdf-page-label="${prefix}">Page 1 of ${pageCount}</span>
      <button type="button" class="secondary" data-pdf-next="${prefix}">Next</button>
    </div>`;
}

type CropEditorApi = { getCrop: () => NormCrop; reset: () => void; sync: () => void };

function mountCropEditor(
  container: HTMLElement,
  imageUrl: string,
  initialCrop?: NormCrop,
  onCropChange?: (crop: NormCrop) => void
): Promise<CropEditorApi> {
  return new Promise((resolve, reject) => {
    container.innerHTML = `
      <div class="crop-editor">
        <img class="crop-img" alt="Crop preview" draggable="false" />
        <div class="crop-layer">
          <div class="crop-box">
            <span class="crop-handle" data-handle="nw"></span>
            <span class="crop-handle" data-handle="n"></span>
            <span class="crop-handle" data-handle="ne"></span>
            <span class="crop-handle" data-handle="w"></span>
            <span class="crop-handle" data-handle="e"></span>
            <span class="crop-handle" data-handle="sw"></span>
            <span class="crop-handle" data-handle="s"></span>
            <span class="crop-handle" data-handle="se"></span>
          </div>
        </div>
      </div>
      <button type="button" class="secondary crop-reset" style="margin-top:0.5rem">Reset crop</button>`;

    const editor = container.querySelector(".crop-editor") as HTMLElement;
    const img = container.querySelector(".crop-img") as HTMLImageElement;
    const layer = container.querySelector(".crop-layer") as HTMLElement;
    const box = container.querySelector(".crop-box") as HTMLElement;
    const resetBtn = container.querySelector(".crop-reset") as HTMLButtonElement;

    const setCropActive = (on: boolean) => {
      editor.classList.toggle("crop-active", on);
    };

    let crop: NormCrop = initialCrop ? clampNormCrop(initialCrop) : { x: 0, y: 0, w: 1, h: 1 };
    const minN = 0.04;

    const notifyCrop = () => onCropChange?.({ ...crop });

    const imgSize = () => ({ w: img.clientWidth, h: img.clientHeight });

    const syncBox = () => {
      const { w, h } = imgSize();
      if (!w || !h) return;
      box.style.left = `${crop.x * w}px`;
      box.style.top = `${crop.y * h}px`;
      box.style.width = `${crop.w * w}px`;
      box.style.height = `${crop.h * h}px`;
      layer.style.width = `${w}px`;
      layer.style.height = `${h}px`;
    };

    const reset = () => {
      crop = { x: 0, y: 0, w: 1, h: 1 };
      syncBox();
      notifyCrop();
    };

    resetBtn.addEventListener("click", reset);

    type DragMode =
      | { kind: "move"; startX: number; startY: number; startCrop: NormCrop }
      | { kind: "resize"; handle: string; startX: number; startY: number; startCrop: NormCrop };

    let drag: DragMode | null = null;
    let captureEl: HTMLElement | null = null;

    const applyDrag = (clientX: number, clientY: number) => {
      if (!drag) return;
      const { w, h } = imgSize();
      if (!w || !h) return;
      const dx = (clientX - drag.startX) / w;
      const dy = (clientY - drag.startY) / h;
      const s = drag.startCrop;
      if (drag.kind === "move") {
        const nx = Math.max(0, Math.min(1 - s.w, s.x + dx));
        const ny = Math.max(0, Math.min(1 - s.h, s.y + dy));
        crop = { x: nx, y: ny, w: s.w, h: s.h };
      } else {
        const hnd = drag.handle;
        let x1 = s.x;
        let y1 = s.y;
        let x2 = s.x + s.w;
        let y2 = s.y + s.h;
        if (hnd.includes("n")) y1 = Math.min(y2 - minN, Math.max(0, s.y + dy));
        if (hnd.includes("s")) y2 = Math.max(y1 + minN, Math.min(1, s.y + s.h + dy));
        if (hnd.includes("w")) x1 = Math.min(x2 - minN, Math.max(0, s.x + dx));
        if (hnd.includes("e")) x2 = Math.max(x1 + minN, Math.min(1, s.x + s.w + dx));
        crop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      syncBox();
    };

    const endDrag = (ev: PointerEvent) => {
      const hadDrag = drag !== null;
      drag = null;
      setCropActive(false);
      if (captureEl?.hasPointerCapture(ev.pointerId)) {
        captureEl.releasePointerCapture(ev.pointerId);
      }
      captureEl = null;
      if (hadDrag) notifyCrop();
    };

    const bindPointerDrag = (
      el: HTMLElement,
      start: (ev: PointerEvent) => DragMode | null,
      stopBubble?: boolean
    ) => {
      el.addEventListener("pointerdown", (ev) => {
        if (ev.pointerType === "mouse" && ev.button !== 0) return;
        if (stopBubble) ev.stopPropagation();
        const mode = start(ev);
        if (!mode) return;
        drag = mode;
        setCropActive(true);
        captureEl = el;
        el.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      });
      el.addEventListener("pointermove", (ev) => {
        if (!drag || !el.hasPointerCapture(ev.pointerId)) return;
        applyDrag(ev.clientX, ev.clientY);
        ev.preventDefault();
      });
      el.addEventListener("pointerup", endDrag);
      el.addEventListener("pointercancel", endDrag);
    };

    bindPointerDrag(box, (ev) => {
      if ((ev.target as HTMLElement).classList.contains("crop-handle")) return null;
      return { kind: "move", startX: ev.clientX, startY: ev.clientY, startCrop: { ...crop } };
    });

    container.querySelectorAll(".crop-handle").forEach((node) => {
      const handleEl = node as HTMLElement;
      bindPointerDrag(
        handleEl,
        (ev) => ({
          kind: "resize",
          handle: handleEl.dataset.handle!,
          startX: ev.clientX,
          startY: ev.clientY,
          startCrop: { ...crop },
        }),
        true
      );
    });

    const onResize = () => syncBox();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncBox()) : null;
    ro?.observe(img);

    let settled = false;
    const api: CropEditorApi = {
      getCrop: () => ({ ...crop }),
      reset,
      sync: syncBox,
    };
    const finish = () => {
      syncBox();
      if (settled) return;
      settled = true;
      window.addEventListener("resize", onResize);
      notifyCrop();
      resolve(api);
    };
    img.onload = () => finish();
    img.onerror = () => {
      ro?.disconnect();
      reject(new Error("Could not load preview"));
    };
    img.src = imageUrl;
    // Cached images may already be complete before onload is assigned.
    if (img.complete && img.naturalWidth) finish();
  });
}

async function renderPatternSimple() {
  disposePatternView();
  if (!selectedPatternId) {
    view = "library";
    return render();
  }
  const p = await api<PatternDetail>(`/api/patterns/${selectedPatternId}`);
  librarySection = librarySectionFromCraft(p.craft);
  sessionStorage.setItem("pincushion_library_section", librarySection);
  const files = await api<PatternFile[]>(`/api/patterns/${selectedPatternId}/files`);
  const originalFiles = files.filter((f) => (f.role || "original") !== "derived");
  const derivedFiles = files.filter((f) => f.role === "derived");
  const fileRowHtml = (f: PatternFile) => `
          <div class="file-row">
            <a href="/api/patterns/${p.id}/file/${f.id}" target="_blank" rel="noopener">${escapeHtml(f.filename)}</a>
          </div>`;
  const fileGroupHtml = (title: string, list: PatternFile[], empty: string) => `
        <section class="file-group">
          <h4 class="file-group-title">${escapeHtml(title)}</h4>
          ${
            list.length
              ? list.map(fileRowHtml).join("")
              : `<p class="meta">${escapeHtml(empty)}</p>`
          }
        </section>`;
  const thumb = p.thumbnail_url
    ? `<div class="pattern-thumb-preview"><img src="${escapeAttr(p.thumbnail_url)}" alt="" /></div>`
    : "";

  shell(
    `
    <div class="panel">
      <button class="secondary" id="backLib">← ${escapeHtml(librarySectionLabel())}</button>
      <div class="title-row">
        <h2 id="patternTitle">${escapeHtml(p.title)}</h2>
      </div>
      <p class="meta">${escapeHtml((p.pattern_format || "").toUpperCase())} · ${escapeHtml(
        librarySectionLabel(librarySection)
      )}${p.file_count ? ` · ${p.file_count} files` : ""}</p>
      ${thumb}
      <p>${
        p.description?.trim()
          ? escapeHtml(p.description)
          : `<span class="meta">No description.</span>`
      }</p>
      ${
        isUserUpload(p.source)
          ? `<div class="pattern-actions"><button type="button" class="secondary" id="deletePat">Delete</button></div>`
          : ""
      }
      <div class="file-share-actions" aria-label="Export pattern files" style="margin-top:1rem">
        <span class="file-export-label">Export:</span>
        <button type="button" class="secondary" id="exportTorrent">Torrent</button>
        <button type="button" class="secondary" id="exportMagnet">Magnet</button>
        <button type="button" class="secondary" id="exportZip">ZIP</button>
      </div>
      ${fileGroupHtml("Original files", originalFiles, "No original file stored.")}
      ${fileGroupHtml("Derived files", derivedFiles, "No derived files yet.")}
      <p class="meta is-hidden" id="magnetStatus" aria-live="polite"></p>
    </div>
  `,
    "pattern"
  );

  document.getElementById("backLib")?.addEventListener("click", () => {
    view = "library";
    selectedPatternId = null;
    render();
  });
  document.getElementById("deletePat")?.addEventListener("click", async () => {
    if (!confirm("Delete this pattern from your library?")) return;
    try {
      await api(`/api/patterns/${p.id}`, { method: "DELETE" });
      view = "library";
      selectedPatternId = null;
      render();
    } catch (e) {
      alert(String(e));
    }
  });
  document.getElementById("exportTorrent")?.addEventListener("click", () => {
    window.location.href = `/api/patterns/${p.id}/torrent`;
  });
  document.getElementById("exportZip")?.addEventListener("click", () => {
    window.location.href = `/api/patterns/${p.id}/zip`;
  });
  document.getElementById("exportMagnet")?.addEventListener("click", async () => {
    const status = document.getElementById("magnetStatus");
    try {
      const res = await api<{ magnet: string; title: string }>(`/api/patterns/${p.id}/magnet`);
      await navigator.clipboard.writeText(res.magnet);
      if (status) {
        status.classList.remove("is-hidden");
        status.textContent = `Magnet copied for “${res.title}”.`;
      }
    } catch (e) {
      if (status) {
        status.classList.remove("is-hidden");
        status.textContent = String(e);
      }
    }
  });
}

async function renderPattern() {
  if (!INTERACTIVE_TOOLS) return renderPatternSimple();
  disposePatternView();
  clearChartEditKeys();
  if (!selectedPatternId) {
    view = "library";
    return render();
  }
  const p = await api<PatternDetail>(`/api/patterns/${selectedPatternId}`);
  librarySection = librarySectionFromCraft(p.craft);
  sessionStorage.setItem("pincushion_library_section", librarySection);
  const files = await api<PatternFile[]>(`/api/patterns/${selectedPatternId}/files`);
  const imgs = files.filter((f) => {
    const n = f.filename.toLowerCase();
    return (
      !!f.mime_type?.startsWith("image/") ||
      n.endsWith(".png") ||
      n.endsWith(".jpg") ||
      n.endsWith(".jpeg") ||
      n.endsWith(".webp") ||
      n.endsWith(".gif") ||
      n.endsWith(".bmp")
    );
  });
  const pagedFile = files.find((f) => {
    const name = f.filename.toLowerCase();
    return (
      f.mime_type === "application/pdf" ||
      f.mime_type === "application/vnd.ms-xpsdocument" ||
      f.mime_type === "application/oxps" ||
      name.endsWith(".pdf") ||
      name.endsWith(".xps") ||
      name.endsWith(".oxps")
    );
  });
  const sagaFile = files.find((f) => f.filename.toLowerCase().endsWith(".saga"));
  const xspFile = files.find((f) => f.filename.toLowerCase().endsWith(".xsp"));
  const pagedKind = pagedFile?.filename.toLowerCase().endsWith(".pdf") ? "PDF" : "XPS";
  let pdfPageCount = 1;
  if (pagedFile) {
    try {
      const pdfMeta = await api<{ is_pdf: boolean; is_paged?: boolean; page_count: number }>(
        `/api/patterns/${p.id}/pdf-info`
      );
      if (pdfMeta.is_paged || pdfMeta.is_pdf) pdfPageCount = Math.max(1, pdfMeta.page_count);
    } catch {
      /* ignore */
    }
  }
  const savedCropState = loadPatternCropState(p.id);
  let selectedPdfPage = savedCropState?.pdfPage ?? 1;
  const isDiamond = p.craft === "diamond_painting";
  const isIronBeading = p.craft === "iron_beading";
  const isSeedBeading = p.craft === "beading";
  const isBeading = isSeedBeading || isIronBeading;
  const isPixel = isPixelCraft(p.craft);
  const chartCraft = isChartCraft(p.craft);
  const isEmbroideryCraft = p.craft === "embroidery" || p.craft === "quilting";
  const isOrigami = p.craft === "origami";
  const canRasterConvert =
    isUserUpload(p.source) &&
    chartCraft &&
    (p.pattern_format === "image" ||
      p.pattern_format === "pdf" ||
      p.pattern_format === "xps" ||
      imgs.length > 0 ||
      !!pagedFile);
  const canStructuredConvert =
    isUserUpload(p.source) &&
    p.craft === "cross_stitch" &&
    (!!sagaFile || !!xspFile || p.pattern_format === "saga" || p.pattern_format === "xsp");
  const canConvert = canRasterConvert || canStructuredConvert;
  const convertLabel = p.has_normalized
    ? isPixel
      ? isIronBeading
        ? "Reprocess fuse-bead chart"
        : isSeedBeading
          ? "Reprocess bead chart"
          : "Reprocess drill chart"
      : "Reprocess Stitch Chart"
    : isPixel
      ? isIronBeading
        ? "Generate fuse-bead chart"
        : isSeedBeading
          ? "Generate bead chart"
          : "Generate drill chart"
      : "Generate stitch chart";
  const cellWord = isDiamond ? "drill" : isIronBeading ? "fuse bead" : isSeedBeading ? "bead" : "stitch";
  const cellWordPlural = isDiamond
    ? "drills"
    : isIronBeading
      ? "fuse beads"
      : isSeedBeading
        ? "beads"
        : "stitches";
  const defaultFabricCount = defaultGridDensity(p.craft);

  const iconGrid = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>`;
  const iconEdit = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
  const iconEye = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 .001 6.001A3 3 0 0 0 12 9z"/></svg>`;
  // Stitch = cell with cross; diamond/bead/fuse = craft-shaped place tool; erase = plain X.
  const iconStitch = isDiamond
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 4h16v16H4z"/><path fill="currentColor" d="M12 5.5L18.5 12 12 18.5 5.5 12z"/><path fill="#fff" fill-opacity="0.35" d="M12 5.5L18.5 12 12 12z"/></svg>`
    : isIronBeading
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 4h16v16H4z"/><circle cx="12" cy="12" r="6" fill="currentColor"/><circle cx="12" cy="12" r="2.4" fill="#1a1a1a"/><circle cx="12" cy="12" r="1.1" fill="#ddd"/></svg>`
      : isSeedBeading
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 4h16v16H4z"/><circle cx="12" cy="12" r="5.2" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M4 4h16v16H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8 8l8 8M16 8l-8 8"/></svg>`;
  const iconErase = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>`;
  const iconFill = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.56 8.94 7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a2 2 0 0 0 0 2.83l6.36 6.36c.78.78 2.05.78 2.83 0l7.07-7.07-3.14-2.12zM5.21 10.36 9.7 5.87l4.95 4.95-4.49 4.49-5-4.95zM19 11s-2 2.17-2 3.5a2 2 0 1 0 4 0C21 13.17 19 11 19 11z"/></svg>`;
  const iconBackstitch = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4 18l7-7M13 9l7-7"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>`;
  const iconPart = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v16H4V4zm2 2v12h12L6 6z"/></svg>`;
  const iconKnot = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.2" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  const iconUndo = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62A7.46 7.46 0 0 1 12.5 11c3.31 0 6.13 2.13 7.14 5.1l2.3-.76C20.63 11.14 16.92 8 12.5 8z"/></svg>`;
  const iconRedo = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.4 10.6A8.47 8.47 0 0 0 11.5 8C7.08 8 3.37 11.14 2.06 15.34l2.3.76A7.46 7.46 0 0 1 11.5 11c1.86 0 3.55.68 4.87 1.8L12.75 16H22V7l-3.6 3.6z"/></svg>`;
  const iconSave = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>`;
  const iconPlus = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
  const iconCrosshair = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
  const previewTextures = texturesForCraft(p.craft);
  const surfaceWord = isIronBeading ? "Pegboard" : isPixel ? "Canvas" : "Fabric";
  const previewLabel = isIronBeading
    ? "Fuse-bead preview"
    : isSeedBeading
      ? "Bead preview"
      : isDiamond
        ? "Drill preview"
        : "Thread preview";
  const placeLabel = isIronBeading
    ? "Place fuse bead"
    : isSeedBeading
      ? "Place bead"
      : isDiamond
        ? "Place drill"
        : "Stitch";
  const densityLabel = isIronBeading
    ? "Pegboard density"
    : isSeedBeading
      ? "Bead density"
      : isDiamond
        ? "Drill density"
        : "Fabric count";
  const densityTitle = isIronBeading
    ? "Fuse beads per inch (≈5 for standard Perler/Hama pegboard)"
    : isSeedBeading
      ? "Beads per inch (chart grid)"
      : isDiamond
        ? "Drills per inch (≈10 for standard canvas)"
        : "Stitches per inch";
  const estimateLabel = isIronBeading
    ? "Fuse bead estimate"
    : isSeedBeading
      ? "Bead estimate"
      : isDiamond
        ? "Drill estimate"
        : "Skein estimate";
  const sizeLabel = isIronBeading ? "Pegboard size" : isPixel ? "Canvas size" : "Fabric size";
  const areaLabel = isBeading ? "Bead area" : isDiamond ? "Drill area" : "Stitched image";
  const countColLabel = isIronBeading
    ? "Fuse beads"
    : isSeedBeading
      ? "Beads"
      : isDiamond
        ? "Drills"
        : "Count";
  if (isIronBeading && (gridState.fabricTexture === "aida" || gridState.fabricTexture === "linen" || gridState.fabricTexture === "canvas")) {
    gridState.fabricTexture = "pegboard";
  } else if (isPixel && !isIronBeading && (gridState.fabricTexture === "aida" || gridState.fabricTexture === "linen" || gridState.fabricTexture === "pegboard")) {
    gridState.fabricTexture = "canvas";
  } else if (!isPixel && (gridState.fabricTexture === "canvas" || gridState.fabricTexture === "pegboard")) {
    gridState.fabricTexture = "aida";
  }

  const chartViewer = `
      <div class="chart-panel">
        <div class="chart-toolbar">
          <div class="chart-toolbar-left">
            <div class="icon-group" role="group" aria-label="Zoom">
              <button type="button" class="icon-btn" id="zoomOut" title="Zoom out" aria-label="Zoom out">−</button>
              <button type="button" class="icon-btn" id="zoomIn" title="Zoom in" aria-label="Zoom in">+</button>
            </div>
            <button type="button" class="icon-btn${
              gridState.centerLines ? " active" : ""
            }" id="toggleCenterLines" title="Center lines" aria-label="Toggle center lines" aria-pressed="${
              gridState.centerLines ? "true" : "false"
            }">${iconCrosshair}</button>
            <button type="button" class="chip-btn" id="toggleSym" title="Cycle symbol mode">${escapeHtml(symbolModeLabel())}</button>
            <div class="mode-slider" role="tablist" aria-label="Chart mode">
              <button type="button" class="mode-btn active" data-mode="chart" title="Chart view" aria-label="Chart view">${iconGrid}<span>Chart</span></button>
              <button type="button" class="mode-btn" data-mode="edit" title="Edit" aria-label="Edit">${iconEdit}</button>
              <button type="button" class="mode-btn" data-mode="preview" title="${previewLabel}" aria-label="Preview">${iconEye}</button>
            </div>
          </div>
          <div class="chart-toolbar-right">
            <button type="button" class="icon-btn save-btn is-hidden" id="saveChart" title="Save chart" aria-label="Save chart">${iconSave}</button>
          </div>
        </div>
        <div class="edit-tools is-hidden" id="editTools">
          <div class="icon-group tool-group" role="group" aria-label="Edit tools">
            <button type="button" class="icon-btn tool-btn active" data-tool="stitch" title="${placeLabel}" aria-label="${placeLabel}">${iconStitch}</button>
            <button type="button" class="icon-btn tool-btn" data-tool="erase" title="Erase ${cellWord}" aria-label="Erase">${iconErase}</button>
            <button type="button" class="icon-btn tool-btn" data-tool="fill" title="Bucket fill" aria-label="Bucket fill">${iconFill}</button>
            ${
              isPixel
                ? ""
                : `<button type="button" class="icon-btn tool-btn" data-tool="backstitch" title="Backstitch" aria-label="Backstitch">${iconBackstitch}</button>
            <button type="button" class="icon-btn tool-btn" data-tool="part" title="Partial stitch" aria-label="Partial stitch">${iconPart}</button>
            <button type="button" class="icon-btn tool-btn" data-tool="knot" title="French knot" aria-label="French knot">${iconKnot}</button>`
            }
          </div>
          <div class="icon-group" role="group" aria-label="History">
            <button type="button" class="icon-btn" id="undoEdit" disabled title="Undo (Ctrl+Z)" aria-label="Undo">${iconUndo}</button>
            <button type="button" class="icon-btn" id="redoEdit" disabled title="Redo (Ctrl+Y)" aria-label="Redo">${iconRedo}</button>
          </div>
          <div class="chart-size-fields" role="group" aria-label="Chart size">
            <label class="size-field">W
              <input type="number" id="chartWidth" min="1" max="800" step="1" value="${
                p.width_stitches || 20
              }" title="Width in ${cellWordPlural}" aria-label="Width in ${cellWordPlural}" />
            </label>
            <label class="size-field">H
              <input type="number" id="chartHeight" min="1" max="800" step="1" value="${
                p.height_stitches || 20
              }" title="Height in ${cellWordPlural}" aria-label="Height in ${cellWordPlural}" />
            </label>
          </div>
          <span class="meta edit-hint" id="editHint">Click a legend colour, then paint.</span>
        </div>
        <div class="preview-tools is-hidden" id="previewTools">
          <div class="icon-group fabric-swatches" role="group" aria-label="${surfaceWord} colour">
            ${FABRIC_COLOURS.map(
              (c) =>
                `<button type="button" class="fabric-swatch${
                  c.hex.toLowerCase() === gridState.fabricColour.toLowerCase() ? " active" : ""
                }" data-colour="${c.hex}" title="${c.label}" aria-label="${c.label}" style="--swatch:${c.hex}"></button>`
            ).join("")}
            <label class="fabric-custom" title="Custom ${surfaceWord.toLowerCase()} colour">
              <input type="color" id="fabricColourCustom" value="${gridState.fabricColour}" aria-label="Custom ${surfaceWord.toLowerCase()} colour" />
            </label>
          </div>
          <div class="icon-group texture-group" role="group" aria-label="${surfaceWord} texture">
            ${previewTextures
              .map(
                (t) =>
                  `<button type="button" class="chip-btn texture-btn${
                    t.id === gridState.fabricTexture ? " active" : ""
                  }" data-texture="${t.id}">${t.label}</button>`
              )
              .join("")}
          </div>
        </div>
        <div class="viewer-layout">
          <div class="chart-canvas-wrap"><canvas id="gridCanvas"></canvas></div>
          <div class="legend panel">
            <div class="legend-header">
              <h3>Legend</h3>
              <button type="button" class="icon-btn is-hidden" id="addColor" title="Add colour" aria-label="Add colour">${iconPlus}</button>
            </div>
            <label class="legend-fabric-count">${densityLabel}
              <input type="number" id="legendFabricCount" min="${
                isIronBeading ? 4 : 6
              }" max="40" step="1" value="${defaultFabricCount}" title="${densityTitle}" aria-label="${densityLabel}" />
            </label>
            <div id="legendBody"></div>
            <div class="skein-estimate" id="skeinEstimate">
              <h4>${estimateLabel}</h4>
              <p class="meta">${
                isPixel
                  ? `One ${cellWord} per chart cell. Bag counts match the colour totals below.`
                  : `Based on ~8&nbsp;m skeins and the <a href="https://www.mismatch.co.uk/cross.htm#floss_amt" target="_blank" rel="noopener">mismatch.co.uk</a> floss-amount guide. Buy counts round up.`
              }</p>
              <div id="skeinEstimateBody"></div>
            </div>
            <div class="fabric-size-estimate" id="fabricSizeEstimate">
              <h4>${sizeLabel}</h4>
              <p class="meta">${
                isPixel
                  ? `Finished ${cellWord} area and suggested ${
                      isIronBeading ? "pegboard" : "canvas"
                    } with border, using grid density.`
                  : `Stitched image and suggested cut size with border, following the <a href="https://www.thread-bare.com/tools/cross-stitch-fabric-size-calculator" target="_blank" rel="noopener">Thread-Bare</a> calculator.`
              }</p>
              <label class="legend-fabric-count">Border each side
                <input type="number" id="legendFabricBorder" min="0" max="12" step="0.5" value="3" title="Extra ${
                  isIronBeading ? "pegboard" : isPixel ? "canvas" : "fabric"
                } per side (inches)" aria-label="Border each side in inches" />
                <span class="meta">in</span>
              </label>
              <div id="fabricSizeEstimateBody"></div>
            </div>
          </div>
        </div>
      </div>`;

  let originalViewer = "";
  if (!p.has_normalized && pagedFile) {
    originalViewer = `
        ${pdfPageBarHtml("orig", pdfPageCount)}
        <div class="image-viewer" id="imgBox">
          <img data-pdf-page-img="orig" src="${pdfRasterPreviewUrl(p.id, 1)}" alt="${pagedKind} page" />
        </div>
        <p class="meta"><a href="/api/patterns/${selectedPatternId}/file/${pagedFile.id}" target="_blank" rel="noopener">Open full ${pagedKind}</a></p>`;
  } else if (!p.has_normalized && imgs.length) {
    originalViewer = `
        <div class="toolbar">
          <button class="secondary" id="imgOut">Zoom out</button>
          <button class="secondary" id="imgIn">Zoom in</button>
        </div>
        <div class="image-viewer" id="imgBox">
          ${imgs.map((f) => `<img src="/api/patterns/${selectedPatternId}/file/${f.id}" alt="page" />`).join("")}
        </div>`;
  }

  let viewerHtml = "";
  if (p.has_normalized) {
    viewerHtml = chartViewer;
  } else if (originalViewer) {
    viewerHtml = originalViewer;
  }

  const uploadActions = isUserUpload(p.source)
    ? `<div class="pattern-actions">
        ${
          p.has_normalized
            ? `<button type="button" class="secondary" id="regeneratePackage" title="Rebuild chart preview, thumbnail, and Chart Export.pdf">Regenerate File Package</button>`
            : ""
        }
        <button type="button" class="secondary" id="deletePat">Delete</button>
      </div>`
    : p.has_normalized
      ? `<div class="pattern-actions">
          <button type="button" class="secondary" id="regeneratePackage" title="Rebuild chart preview, thumbnail, and Chart Export.pdf">Regenerate File Package</button>
        </div>`
      : "";

  const yarnCraft = p.craft === "crochet" || p.craft === "knitting" ? p.craft : null;

  // Chart / pixel crafts get crop + convert; yarn crafts show the PDF in the right-side tabs.
  const showOriginalFile = canRasterConvert || (!!pagedFile && !yarnCraft);
  const originalPanelOpen = canRasterConvert && !p.has_normalized;
  const cropPanel = showOriginalFile
    ? `<details class="panel collapsible-panel" id="cropPanel"${originalPanelOpen ? " open" : ""}>
        <summary><h3>${
          canRasterConvert ? "Show Original File + Crop" : "Show Original File"
        }</h3></summary>
        ${
          canRasterConvert
            ? `<p class="meta">Drag the box or handles to focus on the pattern area${
                p.has_normalized
                  ? isPixel
                    ? `, then reprocess the ${cellWord} chart`
                    : ", then reprocess the stitch chart"
                  : ""
              }.</p>
        ${pagedFile ? pdfPageBarHtml("crop", pdfPageCount) : ""}
        <div id="cropMount"></div>
        ${
          canConvert
            ? `<div class="pattern-actions" style="margin-top:0.75rem">
                <button type="button" class="primary" id="convertChart">${convertLabel}</button>
              </div>`
            : ""
        }`
            : `<p class="meta">Page preview of the original ${pagedKind}.</p>
        ${pdfPageBarHtml("orig", pdfPageCount)}
        <div class="image-viewer" id="origFileBox">
          <img data-pdf-page-img="orig" src="${pdfRasterPreviewUrl(p.id, selectedPdfPage)}" alt="${pagedKind} page" />
        </div>
        <p class="meta"><a href="/api/patterns/${p.id}/file/${pagedFile!.id}" target="_blank" rel="noopener">Open full ${pagedKind}</a></p>`
        }
      </details>`
    : canConvert && !canRasterConvert
      ? `<div class="panel">
          <button type="button" class="primary" id="convertChart">${convertLabel}</button>
        </div>`
      : "";
  type YarnDoc = import("./instructions").YarnDoc;
  let yarnDoc: YarnDoc | null = null;
  let yarnUi: typeof import("./instructions") | null = null;
  if (yarnCraft) {
    yarnUi = await import("./instructions");
    const apiSeg = yarnUi.apiBase(yarnCraft);
    try {
      yarnDoc = await api<YarnDoc>(`/api/patterns/${p.id}/${apiSeg}`);
    } catch (e) {
      yarnDoc = {
        format: "pincushion_yarn_v1",
        craft: yarnCraft,
        title: p.title,
        dialect: "US",
        lines: [],
        supplies: yarnUi.emptySupplies("US"),
        warnings: [String(e)],
      };
    }
  }

  const yarnSupplies = yarnUi
    ? yarnUi.normalizeSupplies(yarnDoc?.supplies, yarnDoc?.dialect)
    : null;
  const suppliesBlurb =
    yarnCraft === "knitting"
      ? "Needles, yarn, terminology, and other materials. Filled from the PDF when possible."
      : "Hook, yarn, terminology, and other materials. Filled from the PDF when possible.";

  const yarnOriginalSide =
    yarnCraft && pagedFile
      ? `<p class="meta">Page preview of the original ${pagedKind}.</p>
        ${pdfPageBarHtml("orig", pdfPageCount)}
        <div class="image-viewer yarn-orig-viewer" id="origFileBox">
          <img data-pdf-page-img="orig" src="${pdfRasterPreviewUrl(p.id, selectedPdfPage)}" alt="${pagedKind} page" />
        </div>
        <p class="meta"><a href="/api/patterns/${p.id}/file/${pagedFile.id}" target="_blank" rel="noopener">Open full ${pagedKind}</a></p>`
      : "";

  const yarnRightPane =
    yarnCraft && yarnUi && yarnSupplies
      ? yarnOriginalSide
        ? `<section class="yarn-right" aria-label="Supplies and original file">
            <div class="yarn-right-tabs tab-strip" role="tablist" aria-label="Right panel">
              <button type="button" class="viewer-tab active" role="tab" aria-selected="true" data-yarn-side-tab="supplies">Supplies</button>
              <button type="button" class="viewer-tab" role="tab" aria-selected="false" data-yarn-side-tab="original">Original File</button>
            </div>
            <div class="yarn-side-panel" data-yarn-side-panel="supplies" role="tabpanel">
              <p class="meta">${suppliesBlurb}</p>
              <div id="yarnSupplies">${yarnUi.renderSupplies(yarnSupplies, yarnCraft)}</div>
            </div>
            <div class="yarn-side-panel is-hidden" data-yarn-side-panel="original" role="tabpanel">
              ${yarnOriginalSide}
            </div>
          </section>`
        : `<section class="yarn-right" aria-label="Pattern supplies">
            <h3>Supplies</h3>
            <p class="meta">${suppliesBlurb}</p>
            <div id="yarnSupplies">${yarnUi.renderSupplies(yarnSupplies, yarnCraft)}</div>
          </section>`
      : "";

  const yarnViewer =
    yarnCraft && yarnUi && yarnSupplies
      ? `<div class="panel yarn-panel">
        <div class="yarn-toolbar">
          <div class="mode-slider" role="tablist" aria-label="${escapeHtml(yarnCraft)} mode">
            <button type="button" class="mode-btn active" data-yarn-mode="view" title="View">View</button>
            <button type="button" class="mode-btn" data-yarn-mode="edit" title="Edit instructions">Edit</button>
          </div>
          <div class="yarn-toolbar-actions">
            ${yarnUi.renderConfidenceBadge(yarnDoc)}
            <button type="button" class="secondary" id="yarnExtract">Extract from PDF</button>
            <button type="button" class="primary" id="yarnSave">Save</button>
          </div>
        </div>
        <p class="meta" id="yarnStatus" aria-live="polite">${
          yarnDoc ? escapeHtml(yarnUi.formatExtractStatus(yarnDoc)) : ""
        }</p>
        <div class="yarn-split">
          <section class="yarn-left" aria-label="Instruction lines">
            <h3>Instructions</h3>
            <div class="yarn-lines" id="yarnLines">${yarnUi.renderLineEditors(yarnDoc?.lines || [], false)}</div>
          </section>
          ${yarnRightPane}
        </div>
      </div>`
      : "";

  type MachineMeta = {
    stitch_count?: number;
    color_count?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    threads?: { hex: string; description: string }[];
    source_filename?: string;
    source_suffix?: string;
    preview_png_url?: string | null;
    preview_svg_url?: string | null;
  };
  type OrigamiStep = {
    id: string;
    title: string;
    notes: string;
    media?: string;
    file_id?: number | null;
    pdf_page?: number | null;
    preview_url?: string | null;
  };

  type OrigamiView = {
    meta: {
      vertex_count?: number;
      edge_count?: number;
      face_count?: number;
      assignment_counts?: Record<string, number>;
      frame_title?: string;
      source_filename?: string;
      file_spec?: string | null;
      frame_count?: number;
    };
    fold?: {
      vertices_coords?: number[][];
      edges_vertices?: number[][];
      edges_assignment?: string[];
      edges_foldAngle?: (number | null)[];
      faces_vertices?: number[][];
      file_frames?: unknown[];
      [key: string]: unknown;
    } | null;
    frames?: {
      vertices_coords?: number[][];
      edges_vertices?: number[][];
      edges_assignment?: string[];
      faces_vertices?: number[][];
      frame_title?: string;
      frame_classes?: string[];
      [key: string]: unknown;
    }[];
    steps?: { format?: string; steps?: OrigamiStep[] };
    preview_svg_url?: string;
  };

  let machineMeta: MachineMeta | null = null;
  let origamiView: OrigamiView | null = null;
  if (isEmbroideryCraft) {
    try {
      machineMeta = await api<MachineMeta>(`/api/patterns/${p.id}/embroidery`);
    } catch {
      machineMeta = null;
    }
  } else if (isOrigami) {
    try {
      origamiView = await api<OrigamiView>(`/api/patterns/${p.id}/origami`);
    } catch {
      origamiView = null;
    }
  }

  const machineViewer = isEmbroideryCraft
    ? `<div class="panel machine-panel">
        <div class="yarn-toolbar">
          <h3 class="machine-heading">Machine design</h3>
          <div class="yarn-toolbar-actions">
            <button type="button" class="secondary" id="machineExtract">Re-parse file</button>
          </div>
        </div>
        ${
          machineMeta
            ? `<div class="machine-meta">
                <p class="meta">${escapeHtml(machineMeta.source_filename || "Machine file")}${
                  machineMeta.source_suffix
                    ? ` · ${escapeHtml(machineMeta.source_suffix.toUpperCase())}`
                    : ""
                }${
                  machineMeta.stitch_count != null
                    ? ` · ${machineMeta.stitch_count.toLocaleString()} stitches`
                    : ""
                }${
                  machineMeta.width_mm != null && machineMeta.height_mm != null
                    ? ` · ${machineMeta.width_mm}×${machineMeta.height_mm} mm`
                    : ""
                }</p>
                ${
                  machineMeta.preview_png_url || machineMeta.preview_svg_url
                    ? `<div class="image-viewer machine-preview">
                        <img src="${
                          machineMeta.preview_png_url || machineMeta.preview_svg_url
                        }" alt="Stitch preview" />
                      </div>`
                    : `<p class="meta">Parsed, but no preview image was generated for this format.</p>`
                }
                ${
                  machineMeta.threads?.length
                    ? `<div class="machine-threads">
                        <h4>Threads</h4>
                        <div class="thread-swatches">${machineMeta.threads
                          .map(
                            (t, i) =>
                              `<span class="thread-swatch" style="--swatch:${escapeHtml(
                                t.hex
                              )}" title="${escapeHtml(t.description || `Thread ${i + 1}`)}"></span>`
                          )
                          .join("")}</div>
                      </div>`
                    : ""
                }
              </div>`
            : `<p class="empty">No machine file parsed yet. Upload DST, PES, JEF, EXP, CSQ, VP3, or similar, then Re-parse.</p>`
        }
      </div>`
    : "";

  const origamiFrameCount = Math.max(
    1,
    origamiView?.meta?.frame_count || origamiView?.frames?.length || 1
  );
  const origamiStepsList: OrigamiStep[] = origamiView?.steps?.steps || [];
  const origamiDiagramFiles = files.filter((f) => {
    const n = f.filename.toLowerCase();
    return (
      f.mime_type?.startsWith("image/") ||
      f.mime_type === "application/pdf" ||
      n.endsWith(".png") ||
      n.endsWith(".jpg") ||
      n.endsWith(".jpeg") ||
      n.endsWith(".webp") ||
      n.endsWith(".gif") ||
      n.endsWith(".pdf")
    );
  });

  const origamiViewerHtml = isOrigami
    ? `<div class="panel origami-panel">
        <div class="yarn-toolbar">
          <h3 class="machine-heading">Origami</h3>
          <div class="yarn-toolbar-actions">
            <button type="button" class="secondary" id="origamiExtract">Re-parse FOLD</button>
          </div>
        </div>
        ${
          origamiView
            ? `<p class="meta">${escapeHtml(
                origamiView.meta.frame_title || origamiView.meta.source_filename || "FOLD"
              )}${
                origamiView.meta.vertex_count != null
                  ? ` · ${origamiView.meta.vertex_count} vertices`
                  : ""
              }${
                origamiView.meta.edge_count != null
                  ? ` · ${origamiView.meta.edge_count} edges`
                  : ""
              }${
                origamiView.meta.face_count != null
                  ? ` · ${origamiView.meta.face_count} faces`
                  : ""
              }${
                origamiFrameCount > 1 ? ` · ${origamiFrameCount} frames` : ""
              }</p>
              <div class="mode-slider origami-tabs" role="tablist" aria-label="Origami view">
                <button type="button" class="mode-btn active" role="tab" aria-selected="true" data-origami-tab="crease">Crease pattern</button>
                <button type="button" class="mode-btn" role="tab" aria-selected="false" data-origami-tab="fold3d">3D model</button>
                <button type="button" class="mode-btn" role="tab" aria-selected="false" data-origami-tab="steps">Steps${
                  origamiStepsList.length ? ` (${origamiStepsList.length})` : ""
                }</button>
              </div>
              <div class="origami-tab-panel" data-origami-panel="crease" role="tabpanel">
                <div class="image-viewer origami-preview">
                  <img src="${
                    origamiView.preview_svg_url || `/api/patterns/${p.id}/origami/preview.svg`
                  }" alt="Crease pattern" />
                </div>
                <p class="meta">Mountain (red dashed) · Valley (blue dotted) · Border (black).</p>
              </div>
              <div class="origami-tab-panel is-hidden" data-origami-panel="fold3d" role="tabpanel">
                ${
                  origamiFrameCount > 1
                    ? `<div class="origami-frame-bar" id="origamiFrameBar">
                        <button type="button" class="secondary" id="origamiFramePrev">Prev</button>
                        <label class="origami-frame-label">
                          Frame
                          <input type="range" id="origamiFrameSlider" min="0" max="${
                            origamiFrameCount - 1
                          }" value="0" step="1" />
                          <span id="origamiFrameLabel">1 / ${origamiFrameCount}</span>
                        </label>
                        <button type="button" class="secondary" id="origamiFrameNext">Next</button>
                      </div>`
                    : ""
                }
                <div class="origami-3d-host" id="origami3dHost" aria-live="polite"></div>
                <p class="meta" id="origami3dStatus">${
                  origamiFrameCount > 1
                    ? "Scrub frames from the FOLD file · drag to orbit · scroll to zoom."
                    : "Drag to orbit · scroll to zoom. Shows FOLD geometry as stored."
                }</p>
              </div>
              <div class="origami-tab-panel is-hidden" data-origami-panel="steps" role="tabpanel">
                <div class="origami-steps-toolbar">
                  <button type="button" class="secondary" id="origamiStepAdd">Add step</button>
                  <button type="button" class="primary" id="origamiStepsSave">Save steps</button>
                  <input type="file" id="origamiStepFile" accept="image/*,.pdf,application/pdf" hidden />
                </div>
                <p class="meta" id="origamiStepsStatus">Upload diagram images or link a library PDF/image page. Use Prev/Next to walk through.</p>
                <div class="origami-steps-viewer" id="origamiStepsViewer"></div>
                <div class="origami-steps-list" id="origamiStepsList"></div>
              </div>`
            : `<p class="empty">No FOLD crease pattern found. Upload a .fold (or FOLD JSON) file, then Re-parse.</p>`
        }
        ${
          !origamiView && originalViewer
            ? `<div class="origami-fallback">${originalViewer}</div>`
            : ""
        }
      </div>`
    : "";

  const craftViewer = yarnCraft
    ? yarnViewer
    : isEmbroideryCraft
      ? machineViewer
      : isOrigami
        ? origamiViewerHtml
        : `<div class="panel">${viewerHtml || `<p class="empty">No viewer for this format.</p>`}</div>`;

  const fileRowHtml = (f: PatternFile) => `
          <div class="file-row">
            <a href="/api/patterns/${p.id}/file/${f.id}" target="_blank" rel="noopener">${escapeHtml(f.filename)}</a>
            <button type="button" class="secondary btn-rename-file" data-fid="${f.id}" data-name="${escapeHtml(f.filename)}">Rename</button>
          </div>`;
  const originalFiles = files.filter((f) => (f.role || "original") !== "derived");
  const derivedFiles = files.filter((f) => f.role === "derived");
  const fileGroupHtml = (title: string, list: PatternFile[], empty: string) => `
        <section class="file-group">
          <h4 class="file-group-title">${escapeHtml(title)}</h4>
          ${
            list.length
              ? list.map(fileRowHtml).join("")
              : `<p class="meta">${escapeHtml(empty)}</p>`
          }
        </section>`;

  shell(`
    <div class="panel">
      <button class="secondary" id="backLib">← ${escapeHtml(librarySectionLabel())}</button>
      <div class="title-row">
        <h2 id="patternTitle">${escapeHtml(p.title)}</h2>
        <button type="button" class="secondary" id="renameTitle">Rename</button>
      </div>
      <div class="pattern-meta-tabs tab-strip" role="tablist" aria-label="Pattern details">
        <button type="button" class="viewer-tab active" role="tab" aria-selected="true" data-pattern-tab="info">Info</button>
        <button type="button" class="viewer-tab" role="tab" aria-selected="false" data-pattern-tab="provenance">Data Provenance</button>
        <button type="button" class="viewer-tab" role="tab" aria-selected="false" data-pattern-tab="files">Files${
          files.length ? ` (${files.length})` : ""
        }</button>
      </div>
      <div class="pattern-tab-panel" data-pattern-panel="info" role="tabpanel">
        <p class="meta">${p.pattern_format.toUpperCase()} · ${escapeHtml(p.craft)}</p>
        ${uploadActions}
        <p>${
          p.description?.trim()
            ? escapeHtml(p.description)
            : `<span class="meta">No description.</span>`
        }</p>
      </div>
      <div class="pattern-tab-panel is-hidden" data-pattern-panel="provenance" role="tabpanel">
        <div class="provenance-fields">
          <label class="provenance-field">
            <span class="provenance-label">License</span>
            <select id="provenanceLicense">
              ${[
                ["UNKNOWN", "Unknown"],
                ["PUBLIC_DOMAIN", "Public domain"],
                ["CC0", "CC0"],
                ["CREATIVE_COMMONS", "Creative Commons"],
                ["FREE_WITH_RESTRICTIONS", "Free with restrictions"],
                ["FREE_DOWNLOAD_NONREDISTRIBUTABLE", "Free download (non-redistributable)"],
                ["PURCHASE_REQUIRED", "Purchase required"],
              ]
                .map(([id, label]) => {
                  const current =
                    !p.license_class || p.license_class === "USER_OWNED" ? "UNKNOWN" : p.license_class;
                  return `<option value="${id}"${current === id ? " selected" : ""}>${label}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label class="provenance-field">
            <span class="provenance-label">Link</span>
            <div class="provenance-link-row">
              <input type="url" id="provenanceLink" placeholder="https://…" value="${escapeHtml(
                p.source_url || ""
              )}" />
              <a class="secondary provenance-open-link${
                p.source_url ? "" : " is-hidden"
              }" id="provenanceOpenLink" href="${escapeHtml(
                p.source_url || "#"
              )}" target="_blank" rel="noopener">Open</a>
            </div>
          </label>
          <div class="provenance-actions">
            <button type="button" class="secondary" id="provenanceSave">Save provenance</button>
            <span class="meta" id="provenanceStatus" aria-live="polite"></span>
          </div>
        </div>
      </div>
      <div class="pattern-tab-panel is-hidden" data-pattern-panel="files" role="tabpanel">
        <div class="file-share-actions" aria-label="Export pattern files">
          <span class="file-export-label">Export:</span>
          <button type="button" class="secondary" id="exportTorrent" title="Download a .torrent of this pattern's files">Torrent</button>
          <button type="button" class="secondary" id="exportMagnet" title="Copy a magnet link for this pattern">Magnet</button>
          <button type="button" class="secondary" id="exportZip" title="Download a ZIP of this pattern's files">ZIP</button>
        </div>
        ${fileGroupHtml("Original File", originalFiles, "No original file stored.")}
        ${fileGroupHtml("Derived Files", derivedFiles, "No derived files yet.")}
        <p class="meta is-hidden" id="magnetStatus" aria-live="polite"></p>
      </div>
    </div>
    ${cropPanel}
    ${craftViewer}
  `, "pattern");

  app.querySelectorAll<HTMLButtonElement>("[data-pattern-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.patternTab;
      if (!tab) return;
      app.querySelectorAll<HTMLButtonElement>("[data-pattern-tab]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      app.querySelectorAll<HTMLElement>("[data-pattern-panel]").forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.dataset.patternPanel !== tab);
      });
    });
  });

  let cropApi: CropEditorApi | null = null;
  let liveCropState: PatternCropState | null = savedCropState;

  const persistCrop = (crop: NormCrop) => {
    liveCropState = { pdfPage: selectedPdfPage, crop: clampNormCrop(crop) };
    savePatternCropState(p.id, selectedPdfPage, liveCropState.crop);
  };

  const cropForCurrentView = () =>
    liveCropState && liveCropState.pdfPage === selectedPdfPage ? liveCropState.crop : undefined;

  const syncPdfPageUi = () => {
    document.querySelectorAll("[data-pdf-page-label]").forEach((el) => {
      el.textContent = `Page ${selectedPdfPage} of ${pdfPageCount}`;
    });
    document.querySelectorAll("[data-pdf-page-img]").forEach((el) => {
      (el as HTMLImageElement).src = pdfRasterPreviewUrl(p.id, selectedPdfPage);
    });
  };

  const setPdfPage = async (page: number) => {
    if (cropApi) persistCrop(cropApi.getCrop());
    selectedPdfPage = Math.max(1, Math.min(pdfPageCount, page));
    syncPdfPageUi();
    const mount = document.getElementById("cropMount");
    if (mount && canRasterConvert) {
      try {
        cropApi = await mountCropEditor(
          mount,
          pdfRasterPreviewUrl(p.id, selectedPdfPage),
          cropForCurrentView(),
          persistCrop
        );
        // Panel may still be closed; sync once layout is available.
        requestAnimationFrame(() => cropApi?.sync());
      } catch {
        mount.innerHTML = `<p class="meta">Preview unavailable for cropping.</p>`;
        cropApi = null;
      }
    }
  };

  const wirePdfPageBar = (prefix: string) => {
    document.querySelector(`[data-pdf-prev="${prefix}"]`)?.addEventListener("click", () => {
      void setPdfPage(selectedPdfPage - 1);
    });
    document.querySelector(`[data-pdf-next="${prefix}"]`)?.addEventListener("click", () => {
      void setPdfPage(selectedPdfPage + 1);
    });
  };

  if (pagedFile) syncPdfPageUi();

  if (canRasterConvert) {
    const mount = document.getElementById("cropMount");
    if (mount) {
      try {
        cropApi = await mountCropEditor(
          mount,
          pdfRasterPreviewUrl(p.id, selectedPdfPage),
          cropForCurrentView(),
          persistCrop
        );
        requestAnimationFrame(() => cropApi?.sync());
      } catch {
        mount.innerHTML = `<p class="meta">Preview unavailable for cropping.</p>`;
      }
    }
  }

  // Crop mounts while the <details> panel may be closed (common after auto-convert
  // on image/WebP upload). Re-measure when the user opens it.
  document.getElementById("cropPanel")?.addEventListener("toggle", (ev) => {
    const panel = ev.currentTarget as HTMLDetailsElement;
    if (panel.open) {
      requestAnimationFrame(() => cropApi?.sync());
    }
  });
  if (pagedFile && pdfPageCount > 1) {
    wirePdfPageBar("crop");
    if (document.querySelector('[data-pdf-bar="orig"]')) wirePdfPageBar("orig");
  }

  document.getElementById("machineExtract")?.addEventListener("click", async () => {
    try {
      await api(`/api/patterns/${p.id}/embroidery/extract`, { method: "POST" });
      selectedPatternId = p.id;
      render();
    } catch (e) {
      alert(String(e));
    }
  });

  document.getElementById("origamiExtract")?.addEventListener("click", async () => {
    try {
      await api(`/api/patterns/${p.id}/origami/extract`, { method: "POST" });
      selectedPatternId = p.id;
      render();
    } catch (e) {
      alert(String(e));
    }
  });

  if (isOrigami && origamiView) {
    let origami3d: import("./origami3d").Origami3dHandle | null = null;
    let frameIdx = 0;
    const host = document.getElementById("origami3dHost");
    const statusEl = document.getElementById("origami3dStatus");
    const foldData = origamiView.fold;
    const frames = origamiView.frames || [];
    const frameSlider = document.getElementById("origamiFrameSlider") as HTMLInputElement | null;
    const frameLabel = document.getElementById("origamiFrameLabel");

    const updateFrameLabel = () => {
      if (frameLabel) frameLabel.textContent = `${frameIdx + 1} / ${origamiFrameCount}`;
      if (frameSlider) frameSlider.value = String(frameIdx);
    };

    patternViewCleanup = () => {
      origami3d?.dispose();
      origami3d = null;
    };

    const setOrigamiTab = (tab: string) => {
      app.querySelectorAll<HTMLButtonElement>("[data-origami-tab]").forEach((btn) => {
        const on = btn.dataset.origamiTab === tab;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      app.querySelectorAll<HTMLElement>("[data-origami-panel]").forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.dataset.origamiPanel !== tab);
      });
      if (tab === "fold3d" && host && !origami3d) {
        if (!foldData) {
          host.innerHTML = `<p class="empty">No FOLD geometry to display. Upload a .fold file, then Re-parse.</p>`;
          if (statusEl) statusEl.textContent = "3D needs a FOLD file.";
          return;
        }
        void (async () => {
          if (statusEl) statusEl.textContent = "Loading 3D model…";
          try {
            const { mountOrigami3d } = await import("./origami3d");
            origami3d = mountOrigami3d(host, foldData, {
              frames: frames.length ? frames : undefined,
              frameIndex: frameIdx,
            });
            if (statusEl) {
              statusEl.textContent =
                host.dataset.origamiDesc ||
                (origamiFrameCount > 1
                  ? "Scrub frames from the FOLD file · drag to orbit · scroll to zoom."
                  : "Drag to orbit · scroll to zoom. Shows FOLD geometry as stored.");
            }
          } catch (e) {
            if (statusEl) statusEl.textContent = String(e);
            host.innerHTML = `<p class="empty">${escapeHtml(String(e))}</p>`;
          }
        })();
      }
      origami3d?.setActive(tab === "fold3d");
    };

    app.querySelectorAll<HTMLButtonElement>("[data-origami-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.origamiTab;
        if (tab) setOrigamiTab(tab);
      });
    });

    const goFrame = (next: number) => {
      frameIdx = Math.max(0, Math.min(origamiFrameCount - 1, next));
      updateFrameLabel();
      origami3d?.setFrameIndex(frameIdx);
      if (statusEl && host?.dataset.origamiDesc) statusEl.textContent = host.dataset.origamiDesc;
    };
    document.getElementById("origamiFramePrev")?.addEventListener("click", () => goFrame(frameIdx - 1));
    document.getElementById("origamiFrameNext")?.addEventListener("click", () => goFrame(frameIdx + 1));
    frameSlider?.addEventListener("input", () => goFrame(Number(frameSlider.value)));

    // --- Manual diagram steps ---
    let steps: OrigamiStep[] = origamiStepsList.map((s) => ({ ...s }));
    let viewStep = 0;
    const stepsListEl = document.getElementById("origamiStepsList");
    const stepsViewerEl = document.getElementById("origamiStepsViewer");
    const stepsStatus = document.getElementById("origamiStepsStatus");
    const stepFileInput = document.getElementById("origamiStepFile") as HTMLInputElement | null;

    const renderStepsUi = () => {
      if (!stepsViewerEl || !stepsListEl) return;
      if (!steps.length) {
        stepsViewerEl.innerHTML = `<p class="empty">No steps yet. Add a diagram image or link a PDF/image from Files.</p>`;
        stepsListEl.innerHTML = "";
        return;
      }
      viewStep = Math.max(0, Math.min(steps.length - 1, viewStep));
      const cur = steps[viewStep]!;
      const preview = cur.preview_url
        ? `<div class="image-viewer origami-step-preview"><img src="${escapeAttr(
            cur.preview_url
          )}" alt="Step diagram" /></div>`
        : `<p class="meta">No diagram attached to this step.</p>`;
      stepsViewerEl.innerHTML = `
        <div class="origami-step-nav">
          <button type="button" class="secondary" id="origamiStepPrev" ${
            viewStep <= 0 ? "disabled" : ""
          }>Prev</button>
          <span class="meta">Step ${viewStep + 1} / ${steps.length}</span>
          <button type="button" class="secondary" id="origamiStepNext" ${
            viewStep >= steps.length - 1 ? "disabled" : ""
          }>Next</button>
        </div>
        <h4 class="origami-step-title">${escapeHtml(cur.title || `Step ${viewStep + 1}`)}</h4>
        ${preview}
        ${cur.notes ? `<p class="origami-step-notes">${escapeHtml(cur.notes)}</p>` : ""}`;

      stepsListEl.innerHTML = steps
        .map((s, i) => {
          const fileOpts = origamiDiagramFiles
            .map(
              (f) =>
                `<option value="${f.id}" ${
                  s.file_id === f.id ? "selected" : ""
                }>${escapeHtml(f.filename)}</option>`
            )
            .join("");
          return `
          <div class="origami-step-card" data-step-idx="${i}">
            <div class="origami-step-card-head">
              <strong>#${i + 1}</strong>
              <div class="origami-step-card-actions">
                <button type="button" class="secondary" data-step-up="${i}" ${
                  i === 0 ? "disabled" : ""
                }>↑</button>
                <button type="button" class="secondary" data-step-down="${i}" ${
                  i >= steps.length - 1 ? "disabled" : ""
                }>↓</button>
                <button type="button" class="secondary" data-step-upload="${i}">Upload</button>
                <button type="button" class="secondary" data-step-del="${i}">Delete</button>
              </div>
            </div>
            <label class="yarn-supply-field">
              <span class="yarn-supply-label">Title</span>
              <input type="text" data-step-title="${i}" value="${escapeAttr(s.title || "")}" placeholder="e.g. Valley fold in half" />
            </label>
            <label class="yarn-supply-field">
              <span class="yarn-supply-label">Notes</span>
              <textarea data-step-notes="${i}" rows="2" placeholder="Optional instructions">${escapeAttr(
                s.notes || ""
              )}</textarea>
            </label>
            <div class="origami-step-link-row">
              <label class="yarn-supply-field">
                <span class="yarn-supply-label">Library file</span>
                <select data-step-file="${i}">
                  <option value="">— none / use upload —</option>
                  ${fileOpts}
                </select>
              </label>
              <label class="yarn-supply-field origami-step-page">
                <span class="yarn-supply-label">PDF page</span>
                <input type="number" min="1" data-step-page="${i}" value="${
                  s.pdf_page ?? ""
                }" placeholder="—" />
              </label>
            </div>
            ${
              s.preview_url
                ? `<img class="origami-step-thumb" src="${escapeAttr(s.preview_url)}" alt="" />`
                : s.media
                  ? `<p class="meta">Media: ${escapeHtml(s.media)}</p>`
                  : ""
            }
          </div>`;
        })
        .join("");

      document.getElementById("origamiStepPrev")?.addEventListener("click", () => {
        viewStep -= 1;
        renderStepsUi();
      });
      document.getElementById("origamiStepNext")?.addEventListener("click", () => {
        viewStep += 1;
        renderStepsUi();
      });

      stepsListEl.querySelectorAll<HTMLInputElement>("[data-step-title]").forEach((el) => {
        el.addEventListener("input", () => {
          const i = Number(el.dataset.stepTitle);
          if (steps[i]) steps[i]!.title = el.value;
        });
      });
      stepsListEl.querySelectorAll<HTMLTextAreaElement>("[data-step-notes]").forEach((el) => {
        el.addEventListener("input", () => {
          const i = Number(el.dataset.stepNotes);
          if (steps[i]) steps[i]!.notes = el.value;
        });
      });
      stepsListEl.querySelectorAll<HTMLSelectElement>("[data-step-file]").forEach((el) => {
        el.addEventListener("change", () => {
          const i = Number(el.dataset.stepFile);
          const step = steps[i];
          if (!step) return;
          const fid = el.value ? Number(el.value) : null;
          step.file_id = fid;
          if (fid) {
            step.media = "";
            const f = origamiDiagramFiles.find((x) => x.id === fid);
            const isPdf =
              (f?.mime_type === "application/pdf" || f?.filename.toLowerCase().endsWith(".pdf")) ??
              false;
            if (isPdf && !step.pdf_page) step.pdf_page = 1;
            if (!isPdf) step.pdf_page = null;
            step.preview_url = isPdf
              ? `/api/patterns/${p.id}/file/${fid}/preview.jpg?page=${step.pdf_page || 1}`
              : `/api/patterns/${p.id}/file/${fid}`;
          } else {
            step.preview_url = step.media
              ? `/api/patterns/${p.id}/origami/steps/media/${step.media}`
              : null;
          }
          renderStepsUi();
        });
      });
      stepsListEl.querySelectorAll<HTMLInputElement>("[data-step-page]").forEach((el) => {
        el.addEventListener("change", () => {
          const i = Number(el.dataset.stepPage);
          const step = steps[i];
          if (!step) return;
          const page = el.value ? Math.max(1, Number(el.value) || 1) : null;
          step.pdf_page = page;
          if (step.file_id && page) {
            step.preview_url = `/api/patterns/${p.id}/file/${step.file_id}/preview.jpg?page=${page}`;
          }
          renderStepsUi();
        });
      });
      stepsListEl.querySelectorAll<HTMLButtonElement>("[data-step-up]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.stepUp);
          if (i <= 0) return;
          [steps[i - 1], steps[i]] = [steps[i]!, steps[i - 1]!];
          renderStepsUi();
        });
      });
      stepsListEl.querySelectorAll<HTMLButtonElement>("[data-step-down]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.stepDown);
          if (i >= steps.length - 1) return;
          [steps[i], steps[i + 1]] = [steps[i + 1]!, steps[i]!];
          renderStepsUi();
        });
      });
      stepsListEl.querySelectorAll<HTMLButtonElement>("[data-step-del]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.stepDel);
          steps.splice(i, 1);
          renderStepsUi();
        });
      });
      stepsListEl.querySelectorAll<HTMLButtonElement>("[data-step-upload]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.stepUpload);
          stepFileInput?.setAttribute("data-target-idx", String(i));
          stepFileInput?.click();
        });
      });
    };

    document.getElementById("origamiStepAdd")?.addEventListener("click", () => {
      steps.push({
        id: Math.random().toString(36).slice(2, 10),
        title: "",
        notes: "",
        media: "",
        file_id: null,
        pdf_page: null,
        preview_url: null,
      });
      viewStep = steps.length - 1;
      renderStepsUi();
    });

    stepFileInput?.addEventListener("change", async () => {
      const file = stepFileInput.files?.[0];
      const idx = Number(stepFileInput.getAttribute("data-target-idx") || "-1");
      stepFileInput.value = "";
      if (!file || !steps[idx]) return;
      if (stepsStatus) stepsStatus.textContent = "Uploading…";
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/patterns/${p.id}/origami/steps/media`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        const body = (await res.json()) as { media: string; preview_url: string };
        steps[idx]!.media = body.media;
        steps[idx]!.file_id = null;
        steps[idx]!.pdf_page = null;
        steps[idx]!.preview_url = body.preview_url;
        if (stepsStatus) stepsStatus.textContent = "Diagram uploaded — Save steps to keep.";
        renderStepsUi();
      } catch (e) {
        if (stepsStatus) stepsStatus.textContent = String(e);
      }
    });

    document.getElementById("origamiStepsSave")?.addEventListener("click", async () => {
      if (stepsStatus) stepsStatus.textContent = "Saving…";
      try {
        const saved = await api<{ steps: OrigamiStep[] }>(`/api/patterns/${p.id}/origami/steps`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps: steps.map((s) => ({
              id: s.id,
              title: s.title,
              notes: s.notes,
              media: s.media || "",
              file_id: s.file_id ?? null,
              pdf_page: s.pdf_page ?? null,
            })),
          }),
        });
        steps = (saved.steps || []).map((s) => ({ ...s }));
        if (stepsStatus) stepsStatus.textContent = `Saved ${steps.length} step(s).`;
        renderStepsUi();
      } catch (e) {
        if (stepsStatus) stepsStatus.textContent = String(e);
      }
    });

    renderStepsUi();
  }

  document.getElementById("renameTitle")?.addEventListener("click", async () => {
    const next = prompt("Rename pattern", p.title);
    if (next == null) return;
    const title = next.trim();
    if (!title) return;
    try {
      await api(`/api/patterns/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      selectedPatternId = p.id;
      render();
    } catch (e) {
      alert(String(e));
    }
  });

  document.getElementById("provenanceSave")?.addEventListener("click", async () => {
    const status = document.getElementById("provenanceStatus");
    const license = (document.getElementById("provenanceLicense") as HTMLSelectElement | null)
      ?.value;
    const link = (document.getElementById("provenanceLink") as HTMLInputElement | null)?.value ?? "";
    if (status) status.textContent = "Saving…";
    try {
      await api(`/api/patterns/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_class: license || "UNKNOWN",
          source_url: link.trim(),
        }),
      });
      selectedPatternId = p.id;
      render();
    } catch (e) {
      if (status) status.textContent = String(e);
      else alert(String(e));
    }
  });

  document.getElementById("provenanceLink")?.addEventListener("input", () => {
    const input = document.getElementById("provenanceLink") as HTMLInputElement;
    const open = document.getElementById("provenanceOpenLink") as HTMLAnchorElement | null;
    if (!open) return;
    const v = input.value.trim();
    if (v) {
      open.href = v;
      open.classList.remove("is-hidden");
    } else {
      open.href = "#";
      open.classList.add("is-hidden");
    }
  });

  document.querySelectorAll(".btn-rename-file").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const el = btn as HTMLElement;
      const fid = Number(el.dataset.fid);
      const current = el.dataset.name || "";
      const next = prompt("Rename file", current);
      if (next == null) return;
      const filename = next.trim();
      if (!filename) return;
      try {
        await api(`/api/patterns/${p.id}/files/${fid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename }),
        });
        selectedPatternId = p.id;
        render();
      } catch (e) {
        alert(String(e));
      }
    });
  });

  document.getElementById("deletePat")?.addEventListener("click", async () => {
    if (!confirm("Delete this pattern from your library?")) return;
    try {
      await api(`/api/patterns/${p.id}`, { method: "DELETE" });
      librarySection = librarySectionFromCraft(p.craft);
      sessionStorage.setItem("pincushion_library_section", librarySection);
      view = "library";
      selectedPatternId = null;
      render();
    } catch (e) {
      alert(String(e));
    }
  });

  document.getElementById("exportTorrent")?.addEventListener("click", () => {
    window.location.href = `/api/patterns/${p.id}/torrent`;
  });

  document.getElementById("exportZip")?.addEventListener("click", () => {
    window.location.href = `/api/patterns/${p.id}/zip`;
  });

  document.getElementById("exportMagnet")?.addEventListener("click", async () => {
    const status = document.getElementById("magnetStatus");
    if (status) {
      status.classList.remove("is-hidden");
      status.textContent = "Creating magnet link…";
    }
    try {
      const res = await api<{ magnet: string; title: string }>(`/api/patterns/${p.id}/magnet`);
      try {
        await navigator.clipboard.writeText(res.magnet);
        if (status) status.textContent = `Magnet copied for “${res.title}”.`;
      } catch {
        if (status) status.textContent = res.magnet;
        prompt("Magnet link (copy):", res.magnet);
      }
    } catch (e) {
      if (status) status.textContent = String(e);
      else alert(String(e));
    }
  });

  document.getElementById("convertChart")?.addEventListener("click", async () => {
    try {
      const crop = cropApi?.getCrop();
      if (crop) persistCrop(crop);
      const body: { crop?: NormCrop; pdf_page?: number; symbol_mode?: string } = {
        symbol_mode: gridState.symbolMode,
      };
      if (crop) body.crop = crop;
      if (pagedFile) body.pdf_page = selectedPdfPage;
      const r = await api<{ message: string }>(`/api/patterns/${p.id}/convert-chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      alert(r.message);
      selectedPatternId = p.id;
      render();
    } catch (e) {
      alert(String(e));
    }
  });

  document.getElementById("regeneratePackage")?.addEventListener("click", async () => {
    const btn = document.getElementById("regeneratePackage") as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Regenerating…";
    }
    try {
      const r = await api<{ message: string }>(`/api/patterns/${p.id}/regenerate-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol_mode: gridState.symbolMode }),
      });
      alert(r.message);
      selectedPatternId = p.id;
      render();
    } catch (e) {
      alert(String(e));
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Regenerate File Package";
      }
    }
  });

  document.getElementById("backLib")!.addEventListener("click", () => {
    librarySection = librarySectionFromCraft(p.craft);
    sessionStorage.setItem("pincushion_library_section", librarySection);
    view = "library";
    selectedPatternId = null;
    render();
  });

  if (yarnCraft && yarnDoc && yarnUi) {
    const ui = yarnUi;
    const craft = yarnCraft;
    const apiSeg = ui.apiBase(craft);
    let yarnEditMode = false;
    const linesEl = document.getElementById("yarnLines")!;
    const suppliesEl = document.getElementById("yarnSupplies")!;
    const statusEl = document.getElementById("yarnStatus")!;
    const saveBtn = document.getElementById("yarnSave")!;

    const wireAddLine = () => {
      document.getElementById("yarnAddLine")?.addEventListener("click", () => {
        yarnEditMode = true;
        document.querySelectorAll("[data-yarn-mode]").forEach((b) => {
          b.classList.toggle("active", (b as HTMLElement).dataset.yarnMode === "edit");
        });
        const current = ui.readLinesFromDom(linesEl);
        current.push("");
        renderYarnLines(current, true);
        const last = linesEl.querySelector<HTMLTextAreaElement>("textarea:last-of-type");
        last?.focus();
      });
    };

    const renderYarnLines = (lines: string[], editable: boolean) => {
      linesEl.innerHTML = ui.renderLineEditors(lines, editable);
      wireAddLine();
    };

    const renderYarnSupplies = (supplies: import("./instructions").YarnSupplies) => {
      suppliesEl.innerHTML = ui.renderSupplies(supplies, craft);
      ui.wireYarnListControls(suppliesEl, craft, renderYarnSupplies);
    };

    const applyYarnDoc = (doc: YarnDoc) => {
      yarnDoc = doc;
      renderYarnLines(doc.lines || [], yarnEditMode);
      renderYarnSupplies(ui.normalizeSupplies(doc.supplies, doc.dialect));
      const badgeHost = document.querySelector(".yarn-toolbar-actions");
      const existingBadge = badgeHost?.querySelector(".yarn-confidence");
      existingBadge?.remove();
      if (badgeHost) {
        const wrap = document.createElement("span");
        wrap.innerHTML = ui.renderConfidenceBadge(doc);
        const node = wrap.firstElementChild;
        if (node) badgeHost.insertBefore(node, badgeHost.firstChild);
      }
      statusEl.textContent = ui.formatExtractStatus(doc);
    };

    applyYarnDoc(yarnDoc);

    app.querySelectorAll<HTMLButtonElement>("[data-yarn-side-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.yarnSideTab;
        if (!tab) return;
        app.querySelectorAll<HTMLButtonElement>("[data-yarn-side-tab]").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        app.querySelectorAll<HTMLElement>("[data-yarn-side-panel]").forEach((panel) => {
          panel.classList.toggle("is-hidden", panel.dataset.yarnSidePanel !== tab);
        });
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-yarn-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        yarnEditMode = btn.dataset.yarnMode === "edit";
        document.querySelectorAll("[data-yarn-mode]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const current = ui.readLinesFromDom(linesEl);
        renderYarnLines(current.length ? current : yarnDoc?.lines || [], yarnEditMode);
      });
    });

    document.getElementById("yarnExtract")?.addEventListener("click", async () => {
      statusEl.textContent = "Extracting instructions from PDF…";
      try {
        const doc = await api<YarnDoc>(`/api/patterns/${p.id}/${apiSeg}/extract`, { method: "POST" });
        applyYarnDoc(doc);
        statusEl.textContent = ui.formatExtractStatus(doc) || "Extracted.";
      } catch (e) {
        statusEl.textContent = String(e);
      }
    });

    saveBtn.addEventListener("click", async () => {
      statusEl.textContent = "Saving…";
      try {
        const supplies = ui.readSuppliesFromDom(craft);
        const doc = await api<YarnDoc>(`/api/patterns/${p.id}/${apiSeg}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: ui.readLinesFromDom(linesEl),
            dialect: supplies.terminology || "US",
            supplies,
            title: p.title,
          }),
        });
        applyYarnDoc(doc);
        statusEl.textContent = ui.formatExtractStatus(doc) || "Saved.";
      } catch (e) {
        statusEl.textContent = String(e);
      }
    });
  }

  if (p.has_normalized) {
    const loaded = await api<Normalized>(`/api/patterns/${selectedPatternId}/normalized`);
    if (!loaded.backstitches) loaded.backstitches = [];
    if (!loaded.part_stitches) loaded.part_stitches = [];
    if (!loaded.ornaments) loaded.ornaments = [];
    if (!loaded.fabric_count || loaded.fabric_count < 6) {
      loaded.fabric_count = defaultGridDensity(p.craft);
    }
    for (const pal of loaded.palette) {
      const s = Number(pal.strands);
      pal.strands = Number.isFinite(s) ? Math.max(1, Math.min(6, Math.round(s))) : 2;
    }
    const savedMode = loaded.recognition?.symbol_mode;
    if (typeof savedMode === "string" && SYMBOL_MODES.some((m) => m.id === savedMode)) {
      gridState.symbolMode = savedMode as SymbolMode;
      sessionStorage.setItem("pincushion_symbol_mode", gridState.symbolMode);
    }
    let working: Normalized = structuredClone(loaded);
    let proj = { status: "not_started", progress_json: { marked: [] as string[] } };
    try {
      proj = await api<{ status: string; progress_json: { marked?: string[] } }>(
        `/api/patterns/${selectedPatternId}/project`
      );
    } catch {
      /* older imports may not have a project row */
    }
    gridState.marked = new Set(proj.progress_json?.marked || []);
    const canvas = document.getElementById("gridCanvas") as HTMLCanvasElement;
    const legend = document.getElementById("legendBody")!;
    const editTools = document.getElementById("editTools")!;
    let editMode = false;
    let previewMode = false;
    let tool: "stitch" | "erase" | "fill" | "backstitch" | "part" | "knot" = "stitch";
    let partDirection: 1 | 2 | 3 | 4 = 1;
    let selectedPal = working.palette.find((x) => x.index > 0)?.index || 1;
    let hoverPal: number | null = null;
    let pendingBack: { x: number; y: number } | null = null;
    let painting = false;
    const MAX_HISTORY = 80;
    let undoStack: Normalized[] = [];
    let redoStack: Normalized[] = [];
    let strokeSnapshot: Normalized | null = null;

    const syncSizeInputs = () => {
      const wEl = document.getElementById("chartWidth") as HTMLInputElement | null;
      const hEl = document.getElementById("chartHeight") as HTMLInputElement | null;
      if (wEl) wEl.value = String(working.width_stitches);
      if (hEl) hEl.value = String(working.height_stitches);
    };

    const applyChartSize = (nextW: number, nextH: number) => {
      const w = Math.max(1, Math.min(800, Math.floor(nextW)));
      const h = Math.max(1, Math.min(800, Math.floor(nextH)));
      if (w === working.width_stitches && h === working.height_stitches) {
        syncSizeInputs();
        return;
      }
      const before = structuredClone(working);
      working.width_stitches = w;
      working.height_stitches = h;
      working.full_stitches = working.full_stitches.filter((s) => s.x < w && s.y < h);
      working.part_stitches = (working.part_stitches || []).filter((s) => s.x < w && s.y < h);
      working.backstitches = (working.backstitches || []).filter(
        (b) => b.x1 <= w && b.x2 <= w && b.y1 <= h && b.y2 <= h
      );
      working.ornaments = (working.ornaments || []).filter(
        (o) => o.x >= -1 && o.y >= -1 && o.x <= w + 1 && o.y <= h + 1
      );
      pushHistory(before);
      syncSizeInputs();
      setHint(`Chart size set to ${w}×${h}. Stitches outside the new bounds were removed.`);
      renderSupplyEstimates();
      redraw();
    };

    const chartFingerprint = (n: Normalized) =>
      [
        `${n.width_stitches}x${n.height_stitches}`,
        `fc:${n.fabric_count || 14}`,
        n.palette.map((p) => `${p.index}:${p.number}:${p.color}:${p.name}:${p.strands || 2}`).join(";"),
        [...n.full_stitches]
          .map((s) => `${s.x},${s.y},${s.palindex}`)
          .sort()
          .join(";"),
        [...(n.backstitches || [])]
          .map((b) => `${b.x1},${b.y1},${b.x2},${b.y2},${b.palindex}`)
          .sort()
          .join(";"),
        [...(n.part_stitches || [])]
          .map((s) => `${s.x},${s.y},${s.palindex1},${s.palindex2},${s.direction}`)
          .sort()
          .join(";"),
        [...(n.ornaments || [])]
          .map((o) => `${o.x},${o.y},${o.palindex},${o.objecttype}`)
          .sort()
          .join(";"),
      ].join("|");

    const updateUndoRedoButtons = () => {
      const undoBtn = document.getElementById("undoEdit") as HTMLButtonElement | null;
      const redoBtn = document.getElementById("redoEdit") as HTMLButtonElement | null;
      if (undoBtn) undoBtn.disabled = undoStack.length === 0;
      if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    };

    const pushHistory = (prev: Normalized) => {
      if (chartFingerprint(prev) === chartFingerprint(working)) return;
      undoStack.push(prev);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
      updateUndoRedoButtons();
    };

    const beginStroke = () => {
      if (!strokeSnapshot) strokeSnapshot = structuredClone(working);
    };

    const endStroke = () => {
      if (!strokeSnapshot) return;
      pushHistory(strokeSnapshot);
      strokeSnapshot = null;
    };

    const applyHistoryState = (next: Normalized) => {
      working = next;
      pendingBack = null;
      strokeSnapshot = null;
      painting = false;
      syncSizeInputs();
      renderLegend();
      redraw();
      updateUndoRedoButtons();
    };

    const undoEdit = () => {
      endStroke();
      const prev = undoStack.pop();
      if (!prev) return;
      redoStack.push(structuredClone(working));
      applyHistoryState(prev);
    };

    const redoEdit = () => {
      strokeSnapshot = null;
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(structuredClone(working));
      applyHistoryState(next);
    };

    const recount = () => {
      const counts = new Map<number, number>();
      for (const s of working.full_stitches) counts.set(s.palindex, (counts.get(s.palindex) || 0) + 1);
      for (const s of working.part_stitches || []) {
        if (s.palindex1 > 0) counts.set(s.palindex1, (counts.get(s.palindex1) || 0) + 1);
        if (s.palindex2 > 0) counts.set(s.palindex2, (counts.get(s.palindex2) || 0) + 1);
      }
      for (const o of working.ornaments || []) {
        if (o.palindex > 0) counts.set(o.palindex, (counts.get(o.palindex) || 0) + 1);
      }
      for (const b of working.backstitches || []) {
        if (b.palindex > 0) counts.set(b.palindex, (counts.get(b.palindex) || 0) + 1);
      }
      for (const pal of working.palette) pal.stitch_count = counts.get(pal.index) || 0;
    };

    const resolvePaintColor = async (hexRaw: string, fallbackLabel: string) => {
      const color = hexRaw.replace("#", "").toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(color)) {
        alert("Use a 6-digit hex colour");
        return null;
      }
      try {
        return await api<{ number: string; name: string; color: string }>(
          `/api/palette/nearest?hex=${encodeURIComponent(color)}&craft=${encodeURIComponent(p.craft || "cross_stitch")}`
        );
      } catch {
        return { number: fallbackLabel, name: fallbackLabel, color };
      }
    };

    const pickHex = async (current: string) => {
      const input = document.createElement("input");
      input.type = "color";
      input.value = hexColor(current);
      input.style.cssText = "position:fixed;left:12px;top:12px;width:1px;height:1px;opacity:0;border:0;padding:0";
      document.body.appendChild(input);
      const picked = await new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          input.remove();
          resolve(value);
        };
        input.addEventListener("change", () => finish(input.value));
        input.addEventListener("cancel", () => finish(null));
        window.addEventListener("focus", () => window.setTimeout(() => finish(null), 250), { once: true });
        try {
          if (typeof input.showPicker === "function") input.showPicker();
          else input.click();
        } catch {
          finish(prompt("Colour hex (e.g. #310000)", hexColor(current)));
        }
      });
      return picked;
    };

    const applyPaletteColor = async (palIndex: number) => {
      const pal = working.palette.find((x) => x.index === palIndex);
      if (!pal) return;
      const picked = await pickHex(pal.color);
      if (!picked) return;
      const match = await resolvePaintColor(picked, pal.number || `Colour ${palIndex}`);
      if (!match) return;
      if (
        pal.color.replace("#", "").toUpperCase() === match.color.toUpperCase() &&
        pal.number === match.number &&
        pal.name === match.name
      ) {
        return;
      }
      const before = structuredClone(working);
      pal.number = match.number;
      pal.name = match.name;
      pal.color = match.color;
      selectedPal = palIndex;
      pushHistory(before);
      setHint(`Updated to ${match.number} ${match.name}`);
      renderLegend();
      redraw();
    };

    const deletePaletteColor = (palIndex: number) => {
      if (palIndex <= 0) return;
      const usable = working.palette.filter((p) => p.index > 0);
      if (usable.length <= 1) {
        alert("Keep at least one colour in the legend.");
        return;
      }
      const pal = working.palette.find((x) => x.index === palIndex);
      if (!pal) return;
      recount();
      const stitchCount = pal.stitch_count || 0;
      const backCount = (working.backstitches || []).filter((b) => b.palindex === palIndex).length;
      const label = pal.number || pal.name || `Colour ${palIndex}`;
      const detail =
        stitchCount || backCount
          ? ` This removes ${stitchCount} stitch${stitchCount === 1 ? "" : "es"}${
              backCount ? ` and ${backCount} backstitch${backCount === 1 ? "" : "es"}` : ""
            }.`
          : "";
      if (!confirm(`Delete ${label} from the legend?${detail}`)) return;
      const before = structuredClone(working);
      working.palette = working.palette.filter((p) => p.index !== palIndex);
      working.full_stitches = working.full_stitches.filter((s) => s.palindex !== palIndex);
      working.backstitches = (working.backstitches || []).filter((b) => b.palindex !== palIndex);
      working.part_stitches = (working.part_stitches || []).filter(
        (s) => s.palindex1 !== palIndex && s.palindex2 !== palIndex
      );
      working.ornaments = (working.ornaments || []).filter((o) => o.palindex !== palIndex);
      if (selectedPal === palIndex) {
        selectedPal = working.palette.find((p) => p.index > 0)?.index || 1;
      }
      if (hoverPal === palIndex) hoverPal = null;
      pushHistory(before);
      setHint(`Deleted ${label}`);
      renderLegend();
      redraw();
    };

    const fabricCountInput = document.getElementById("legendFabricCount") as HTMLInputElement | null;
    const fabricBorderInput = document.getElementById("legendFabricBorder") as HTMLInputElement | null;
    if (fabricCountInput) fabricCountInput.value = String(working.fabric_count || 14);
    let fabricBorderIn = 3;

    const renderSkeinEstimate = () => {
      const body = document.getElementById("skeinEstimateBody");
      if (!body) return;
      const densityMin = isIronBeading ? 4 : 6;
      const fabricCount = Math.max(densityMin, Math.min(40, Number(working.fabric_count) || defaultFabricCount));
      const rows = working.palette
        .filter((x) => x.index > 0 && (x.stitch_count || 0) > 0)
        .map((pal) => {
          const count = pal.stitch_count || 0;
          const strands = Math.max(1, Math.min(6, Number(pal.strands) || 2));
          const needed = isPixel ? count : skeinsNeeded(count, fabricCount, strands);
          const label = pal.name && pal.name !== pal.number ? `${pal.number} ${pal.name}` : pal.number || pal.name;
          return `<tr>
              <td><span class="swatch" style="background:${hexColor(pal.color)}"></span></td>
              <td>${escapeHtml(label)}</td>
              <td class="num">${isPixel ? String(count) : formatSkeins(needed)}</td>
            </tr>`;
        });
      if (!rows.length) {
        body.innerHTML = `<p class="meta">No ${cellWordPlural} yet — estimates appear as you ${
          isPixel ? `place ${cellWordPlural}` : "stitch"
        }.</p>`;
        return;
      }
      body.innerHTML = `<table class="skein-table">
          <tr><th></th><th>Colour</th><th>${isPixel ? countColLabel : "Skeins"}</th></tr>
          ${rows.join("")}
        </table>`;
    };

    const renderFabricSizeEstimate = () => {
      const body = document.getElementById("fabricSizeEstimateBody");
      if (!body) return;
      const wSt = working.width_stitches || 0;
      const hSt = working.height_stitches || 0;
      const densityMin = isIronBeading ? 4 : 6;
      const currentCount = Math.max(densityMin, Math.min(40, Number(working.fabric_count) || defaultFabricCount));
      const border = Math.max(0, Math.min(12, fabricBorderIn));
      if (fabricBorderInput) fabricBorderInput.value = String(border);
      if (wSt < 1 || hSt < 1) {
        body.innerHTML = `<p class="meta">Set a chart size to see ${
          isIronBeading ? "pegboard" : isPixel ? "canvas" : "fabric"
        } dimensions.</p>`;
        return;
      }
      const curW = fabricInches(wSt, currentCount);
      const curH = fabricInches(hSt, currentCount);
      const fabW = curW + 2 * border;
      const fabH = curH + 2 * border;
      body.innerHTML = `
        <p class="fabric-size-summary"><strong>${wSt} × ${hSt}</strong> ${cellWordPlural} on <strong>${currentCount}-count</strong></p>
        <table class="skein-table fabric-size-table">
          <tr><th></th><th>Width</th><th>Height</th></tr>
          <tr><td>${areaLabel}</td><td class="num">${formatInches(curW)} (${formatCm(curW)})</td><td class="num">${formatInches(curH)} (${formatCm(curH)})</td></tr>
          <tr><td>${
            isIronBeading ? "Suggested pegboard" : isPixel ? "Suggested canvas" : "Suggested fabric"
          }</td><td class="num">${formatInches(fabW)} (${formatCm(fabW)})</td><td class="num">${formatInches(fabH)} (${formatCm(fabH)})</td></tr>
        </table>`;
    };

    const renderSupplyEstimates = () => {
      renderSkeinEstimate();
      renderFabricSizeEstimate();
    };

    const renderLegend = () => {
      recount();
      const showSymCol = gridState.symbolMode !== "none";
      if (fabricCountInput) fabricCountInput.value = String(working.fabric_count || defaultFabricCount);
      legend.innerHTML = `<table class="legend-table"><tr><th></th>${
        showSymCol ? "<th>Sym</th>" : ""
      }<th>Code</th>${isPixel ? "" : "<th>Strands</th>"}<th>${
        isPixel ? countColLabel : "Count"
      }</th></tr>${working.palette
        .filter((x) => x.index > 0)
        .map((pal) => {
          const mark = symbolForPalette(working.palette, pal.index);
          const strands = Math.max(1, Math.min(6, Number(pal.strands) || 2));
          return `<tr class="legend-row${editMode && pal.index === selectedPal ? " is-selected" : ""}" data-pal="${pal.index}">
              <td class="legend-swatch-cell">
                <span class="swatch" style="background:${hexColor(pal.color)}"></span>
                ${
                  editMode
                    ? `<button type="button" class="legend-edit" data-pal="${pal.index}" title="Edit colour" aria-label="Edit colour">✎</button>
                       <button type="button" class="legend-delete" data-pal="${pal.index}" title="Delete colour" aria-label="Delete colour">✕</button>`
                    : ""
                }
              </td>
              ${showSymCol ? `<td class="legend-sym">${escapeHtml(mark)}</td>` : ""}
              <td>${escapeHtml(pal.name && pal.name !== pal.number ? `${pal.number} ${pal.name}` : pal.number || pal.name)}</td>
              ${
                isPixel
                  ? ""
                  : `<td class="legend-strands-cell">
                <input type="number" class="legend-strands" data-pal="${pal.index}" min="1" max="6" step="1" value="${strands}" title="Strands for this colour" aria-label="Strands for ${escapeHtml(pal.number || pal.name || "colour")}" />
              </td>`
              }
              <td>${pal.stitch_count ?? ""}</td>
            </tr>`;
        })
        .join("")}</table>`;
      legend.querySelectorAll(".legend-row").forEach((row) => {
        const el = row as HTMLElement;
        row.addEventListener("click", (ev) => {
          if ((ev.target as HTMLElement).closest("input,button")) return;
          selectedPal = Number(el.dataset.pal);
          renderLegend();
        });
        row.addEventListener("mouseenter", () => {
          hoverPal = Number(el.dataset.pal);
          el.classList.add("is-hover");
          redraw();
        });
        row.addEventListener("mouseleave", () => {
          if (hoverPal === Number(el.dataset.pal)) hoverPal = null;
          el.classList.remove("is-hover");
          redraw();
        });
      });
      legend.querySelectorAll(".legend-strands").forEach((input) => {
        input.addEventListener("click", (ev) => ev.stopPropagation());
        input.addEventListener("change", () => {
          const el = input as HTMLInputElement;
          const palIndex = Number(el.dataset.pal);
          const pal = working.palette.find((x) => x.index === palIndex);
          if (!pal) return;
          const next = Math.max(1, Math.min(6, Math.round(Number(el.value) || 2)));
          if (pal.strands === next) {
            el.value = String(next);
            return;
          }
          const before = structuredClone(working);
          pal.strands = next;
          el.value = String(next);
          pushHistory(before);
          setHint(`${pal.number || pal.name}: ${next} strand${next === 1 ? "" : "s"}`);
          renderSupplyEstimates();
        });
      });
      legend.querySelectorAll(".legend-edit").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const palIndex = Number((btn as HTMLElement).dataset.pal);
          selectedPal = palIndex;
          void applyPaletteColor(palIndex);
        });
      });
      legend.querySelectorAll(".legend-delete").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          deletePaletteColor(Number((btn as HTMLElement).dataset.pal));
        });
      });
      renderSupplyEstimates();
    };

    fabricCountInput?.addEventListener("change", () => {
      const densityMin = isIronBeading ? 4 : 6;
      const next = Math.max(densityMin, Math.min(40, Math.round(Number(fabricCountInput.value) || defaultFabricCount)));
      if ((working.fabric_count || defaultFabricCount) === next) {
        fabricCountInput.value = String(next);
        return;
      }
      const before = structuredClone(working);
      working.fabric_count = next;
      fabricCountInput.value = String(next);
      pushHistory(before);
      setHint(`Fabric count set to ${next}`);
      renderSupplyEstimates();
    });

    fabricBorderInput?.addEventListener("change", () => {
      const next = Math.max(0, Math.min(12, Number(fabricBorderInput.value) || 0));
      fabricBorderIn = Math.round(next * 2) / 2;
      fabricBorderInput.value = String(fabricBorderIn);
      renderFabricSizeEstimate();
    });

    type ChartMode = "chart" | "edit" | "preview";
    let chartMode: ChartMode = "chart";

    const syncFabricUi = () => {
      document.querySelectorAll(".fabric-swatch").forEach((btn) => {
        const hex = ((btn as HTMLElement).dataset.colour || "").toLowerCase();
        btn.classList.toggle("active", hex === gridState.fabricColour.toLowerCase());
      });
      document.querySelectorAll(".texture-btn").forEach((btn) => {
        const id = (btn as HTMLElement).dataset.texture as FabricTexture;
        btn.classList.toggle("active", id === gridState.fabricTexture);
        btn.classList.toggle("is-hidden", !previewTextures.some((t) => t.id === id));
      });
      const custom = document.getElementById("fabricColourCustom") as HTMLInputElement | null;
      if (custom) custom.value = gridState.fabricColour;
    };

    const syncModeUi = () => {
      document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.mode === chartMode);
      });
      editTools.classList.toggle("is-hidden", chartMode !== "edit");
      document.getElementById("previewTools")?.classList.toggle("is-hidden", chartMode !== "preview");
      document.getElementById("saveChart")?.classList.toggle("is-hidden", chartMode !== "edit");
      document.getElementById("addColor")?.classList.toggle("is-hidden", chartMode !== "edit");
      canvas.classList.toggle("preview-mode", chartMode === "preview");
      document.getElementById("toggleSym")?.classList.toggle("is-disabled", chartMode === "preview");
      document.querySelector(".chart-panel")?.classList.toggle("is-editing", chartMode === "edit");
      if (chartMode === "preview") syncFabricUi();
    };

    const leaveEditMode = (discard: boolean) => {
      if (discard) {
        working = structuredClone(loaded);
        pendingBack = null;
        undoStack = [];
        redoStack = [];
        strokeSnapshot = null;
      }
      editMode = false;
      updateUndoRedoButtons();
    };

    const setChartMode = (mode: ChartMode) => {
      if (mode === chartMode) return;
      if (chartMode === "edit" && mode !== "edit") {
        const dirty = chartFingerprint(working) !== chartFingerprint(loaded);
        if (dirty && !confirm("Leave edit mode and discard unsaved changes?")) return;
        leaveEditMode(true);
      }
      if (mode === "edit") {
        previewMode = false;
        editMode = true;
        undoStack = [];
        redoStack = [];
        strokeSnapshot = null;
        updateUndoRedoButtons();
        setTool("stitch");
      } else if (mode === "preview") {
        previewMode = true;
        editMode = false;
      } else {
        previewMode = false;
        editMode = false;
      }
      chartMode = mode;
      syncModeUi();
      renderLegend();
      redraw();
    };

    const redraw = () =>
      drawGrid(canvas, working, { pendingBack, editMode, highlightPal: hoverPal, previewMode, craft: p.craft });
    const setHint = (text: string) => {
      const hint = document.getElementById("editHint");
      if (hint) hint.textContent = text;
    };

    const canvasPos = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
    };
    const cellAt = (ev: PointerEvent) => {
      const pos = canvasPos(ev);
      return { x: Math.floor(pos.x / gridState.zoom), y: Math.floor(pos.y / gridState.zoom) };
    };
    const cornerAt = (ev: PointerEvent) => {
      const pos = canvasPos(ev);
      return { x: Math.round(pos.x / gridState.zoom), y: Math.round(pos.y / gridState.zoom) };
    };

    const stitchKey = (x: number, y: number) => `${x},${y}`;
    const clearPartAt = (x: number, y: number) => {
      working.part_stitches = (working.part_stitches || []).filter((s) => !(s.x === x && s.y === y));
    };
    const setStitch = (x: number, y: number, palindex: number | null) => {
      if (x < 0 || y < 0 || x >= working.width_stitches || y >= working.height_stitches) return;
      working.full_stitches = working.full_stitches.filter((s) => !(s.x === x && s.y === y));
      clearPartAt(x, y);
      if (palindex && palindex > 0) working.full_stitches.push({ x, y, palindex });
    };
    /** Encode one of 4 half-cell triangle placements in Ursa OXS fields. */
    const encodeHalf = (colour: number, half: 0 | 1 | 2 | 3) => {
      // 0 BL, 1 TL, 2 TR, 3 BR
      if (half === 0) return { direction: 1 as const, palindex1: colour, palindex2: 0 };
      if (half === 1) return { direction: 2 as const, palindex1: colour, palindex2: 0 };
      if (half === 2) return { direction: 1 as const, palindex1: 0, palindex2: colour };
      return { direction: 2 as const, palindex1: 0, palindex2: colour };
    };
    const decodeHalf = (ps: { direction: number; palindex1: number; palindex2: number }, colour: number) => {
      const dir = ps.direction || 1;
      if (ps.palindex1 === colour && (!ps.palindex2 || ps.palindex2 <= 0)) return dir === 2 ? 1 : 0;
      if (ps.palindex2 === colour && (!ps.palindex1 || ps.palindex1 <= 0)) return dir === 2 ? 3 : 2;
      return null;
    };
    const nextPartDirection = (dir: number) => ((((dir || 1) % 4) + 1) as 1 | 2 | 3 | 4);
    const setPartStitch = (
      x: number,
      y: number,
      palindex: number,
      opts?: { rotateIfSame?: boolean; direction?: 1 | 2 | 3 | 4 }
    ) => {
      if (x < 0 || y < 0 || x >= working.width_stitches || y >= working.height_stitches) return;
      if (palindex <= 0) return;
      const rotateIfSame = opts?.rotateIfSame ?? true;
      const direction = opts?.direction ?? partDirection;
      working.full_stitches = working.full_stitches.filter((s) => !(s.x === x && s.y === y));
      working.part_stitches = working.part_stitches || [];
      const atCell = working.part_stitches.filter((s) => s.x === x && s.y === y);

      // Dual-colour cell: (A,B,\) → (A,B,/) → (B,A,\) → (B,A,/) → …
      const dual = atCell.find(
        (s) =>
          (s.direction === 1 || s.direction === 2) &&
          s.palindex1 > 0 &&
          s.palindex2 > 0 &&
          (s.palindex1 === palindex || s.palindex2 === palindex)
      );
      if (dual) {
        if (!rotateIfSame) return;
        if (dual.direction === 1) {
          dual.direction = 2;
        } else {
          const tmp = dual.palindex1;
          dual.palindex1 = dual.palindex2;
          dual.palindex2 = tmp;
          dual.direction = 1;
        }
        return;
      }

      // Single-colour half: cycle BL→TL→TR→BR via OXS left/right slots.
      const owned = atCell.find((s) => {
        if (s.direction === 3 || s.direction === 4) return s.palindex1 === palindex || s.palindex2 === palindex;
        return decodeHalf(s, palindex) != null;
      });
      if (owned) {
        if (!rotateIfSame) return;
        if (owned.direction === 3 || owned.direction === 4) {
          owned.direction = owned.direction === 3 ? 4 : 3;
          return;
        }
        const half = decodeHalf(owned, palindex);
        if (half == null) return;
        const next = encodeHalf(palindex, ((half + 1) % 4) as 0 | 1 | 2 | 3);
        owned.direction = next.direction;
        owned.palindex1 = next.palindex1;
        owned.palindex2 = next.palindex2;
        return;
      }

      // Add second colour into the complementary half of an existing single-colour triangle.
      const open = atCell.find((s) => {
        if (s.direction !== 1 && s.direction !== 2) return false;
        const only1 = s.palindex1 > 0 && (!s.palindex2 || s.palindex2 <= 0) && s.palindex1 !== palindex;
        const only2 = s.palindex2 > 0 && (!s.palindex1 || s.palindex1 <= 0) && s.palindex2 !== palindex;
        return only1 || only2;
      });
      if (open) {
        if (open.palindex1 > 0 && (!open.palindex2 || open.palindex2 <= 0)) open.palindex2 = palindex;
        else open.palindex1 = palindex;
        return;
      }

      // Fresh placement: map tool direction 1–4 onto the four triangle halves.
      const half = ((((direction || 1) - 1) % 4) as 0 | 1 | 2 | 3);
      const enc = encodeHalf(palindex, half);
      working.part_stitches.push({
        x,
        y,
        palindex1: enc.palindex1,
        palindex2: enc.palindex2,
        direction: enc.direction,
      });
    };
    const eraseOrnamentNear = (fx: number, fy: number) => {
      working.ornaments = (working.ornaments || []).filter((o) => Math.hypot(o.x - fx, o.y - fy) > 0.35);
    };
    const addKnotAt = (fx: number, fy: number) => {
      if (selectedPal <= 0) return;
      working.ornaments = working.ornaments || [];
      const dup = working.ornaments.some(
        (o) => o.objecttype === "knot" && Math.hypot(o.x - fx, o.y - fy) < 0.2 && o.palindex === selectedPal
      );
      if (!dup) working.ornaments.push({ x: fx, y: fy, palindex: selectedPal, objecttype: "knot" });
    };
    const palAt = (grid: Map<string, number>, x: number, y: number) => grid.get(stitchKey(x, y)) || 0;
    const bucketFill = (sx: number, sy: number, fillPal: number) => {
      const w = working.width_stitches;
      const h = working.height_stitches;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h || fillPal <= 0) return 0;
      const grid = new Map<string, number>();
      for (const s of working.full_stitches) grid.set(stitchKey(s.x, s.y), s.palindex);
      const target = palAt(grid, sx, sy);
      if (target === fillPal) return 0;
      const stack: Array<[number, number]> = [[sx, sy]];
      const filled: Array<[number, number]> = [];
      const seen = new Set<string>();
      while (stack.length) {
        const [x, y] = stack.pop()!;
        const key = stitchKey(x, y);
        if (seen.has(key)) continue;
        seen.add(key);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (palAt(grid, x, y) !== target) continue;
        filled.push([x, y]);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      if (!filled.length) return 0;
      const replace = new Set(filled.map(([x, y]) => stitchKey(x, y)));
      working.part_stitches = (working.part_stitches || []).filter(
        (s) => !replace.has(stitchKey(s.x, s.y))
      );
      if (target === 0) {
        for (const [x, y] of filled) working.full_stitches.push({ x, y, palindex: fillPal });
      } else {
        for (const s of working.full_stitches) {
          if (replace.has(stitchKey(s.x, s.y))) s.palindex = fillPal;
        }
      }
      return filled.length;
    };
    const addBackstitch = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      if (a.x === b.x && a.y === b.y) return;
      if (
        a.x < 0 ||
        b.x < 0 ||
        a.y < 0 ||
        b.y < 0 ||
        a.x > working.width_stitches ||
        b.x > working.width_stitches ||
        a.y > working.height_stitches ||
        b.y > working.height_stitches
      ) {
        return;
      }
      working.backstitches = working.backstitches || [];
      const dup = working.backstitches.some(
        (s) =>
          s.palindex === selectedPal &&
          ((s.x1 === a.x && s.y1 === a.y && s.x2 === b.x && s.y2 === b.y) ||
            (s.x1 === b.x && s.y1 === b.y && s.x2 === a.x && s.y2 === a.y))
      );
      if (!dup) working.backstitches.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, palindex: selectedPal });
    };
    const eraseBackNear = (c: { x: number; y: number }) => {
      working.backstitches = (working.backstitches || []).filter((s) => {
        const nearStart = Math.abs(s.x1 - c.x) + Math.abs(s.y1 - c.y) <= 0;
        const nearEnd = Math.abs(s.x2 - c.x) + Math.abs(s.y2 - c.y) <= 0;
        return !(nearStart || nearEnd);
      });
    };

    const setTool = (next: typeof tool) => {
      if (next === "part" && tool === "part") {
        partDirection = nextPartDirection(partDirection);
      } else {
        tool = next;
      }
      pendingBack = null;
      editTools.querySelectorAll(".tool-btn").forEach((b) => {
        b.classList.toggle("active", (b as HTMLElement).dataset.tool === tool);
      });
      if (tool === "fill") {
        setHint("Bucket fill: click a region to fill connected cells with the selected legend colour.");
      } else if (tool === "backstitch") {
        setHint("Backstitch snaps to grid corners.");
      } else if (tool === "part") {
        const corners = { 1: "BL", 2: "TL", 3: "TR", 4: "BR" } as const;
        setHint(
          `Partial stitch (start ${corners[partDirection]}). Click again to rotate (4 ways); a second colour fills the other half.`
        );
      } else if (tool === "knot") {
        setHint("French knot: click to place a knot in the selected colour.");
      } else if (tool === "erase") {
        setHint("Erase stitches, partials, knots, or click near a corner to remove backstitches.");
      } else {
        setHint("Click a legend colour, then paint.");
      }
      redraw();
    };

    renderLegend();
    syncModeUi();
    redraw();

    canvas.addEventListener("pointerdown", (ev) => {
      if (!editMode) {
        if (previewMode) return;
        const { x, y } = cellAt(ev);
        const key = stitchKey(x, y);
        if (gridState.marked.has(key)) gridState.marked.delete(key);
        else gridState.marked.add(key);
        redraw();
        void saveProgress(p.id, proj.status === "not_started" ? "in_progress" : proj.status);
        return;
      }
      if (tool === "backstitch") {
        painting = true;
        canvas.setPointerCapture(ev.pointerId);
        const c = cornerAt(ev);
        if (!pendingBack) {
          pendingBack = c;
          setHint("Click the other grid corner to finish the backstitch.");
        } else {
          const before = structuredClone(working);
          addBackstitch(pendingBack, c);
          pushHistory(before);
          pendingBack = null;
          setHint("Backstitch added. Click another start corner, or Erase stitch then a corner to remove lines.");
        }
        renderLegend();
        redraw();
        return;
      }
      if (tool === "fill") {
        const { x, y } = cellAt(ev);
        const before = structuredClone(working);
        const n = bucketFill(x, y, selectedPal);
        if (n > 0) {
          pushHistory(before);
          setHint(`Filled ${n} cell${n === 1 ? "" : "s"} with selected colour.`);
          renderLegend();
          redraw();
        } else {
          setHint("Nothing to fill — same colour already, or click a cell.");
        }
        return;
      }
      if (tool === "knot") {
        const pos = canvasPos(ev);
        const before = structuredClone(working);
        addKnotAt(pos.x / gridState.zoom, pos.y / gridState.zoom);
        pushHistory(before);
        renderLegend();
        redraw();
        return;
      }
      painting = true;
      canvas.setPointerCapture(ev.pointerId);
      beginStroke();
      const { x, y } = cellAt(ev);
      if (tool === "erase") {
        setStitch(x, y, null);
        const pos = canvasPos(ev);
        eraseOrnamentNear(pos.x / gridState.zoom, pos.y / gridState.zoom);
        const c = cornerAt(ev);
        const near =
          Math.hypot(pos.x / gridState.zoom - c.x, pos.y / gridState.zoom - c.y) < 0.28;
        if (near) eraseBackNear(c);
      } else if (tool === "part") {
        setPartStitch(x, y, selectedPal, { rotateIfSame: true, direction: partDirection });
      } else {
        setStitch(x, y, selectedPal);
      }
      renderLegend();
      redraw();
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!editMode || !painting || tool === "backstitch" || tool === "fill" || tool === "knot") return;
      const { x, y } = cellAt(ev);
      if (tool === "erase") {
        setStitch(x, y, null);
        const pos = canvasPos(ev);
        eraseOrnamentNear(pos.x / gridState.zoom, pos.y / gridState.zoom);
      } else if (tool === "part") {
        // Drag places without spinning; click rotates.
        setPartStitch(x, y, selectedPal, { rotateIfSame: false, direction: partDirection });
      } else {
        setStitch(x, y, selectedPal);
      }
      redraw();
    });
    canvas.addEventListener("pointerup", () => {
      if (painting && editMode && tool !== "backstitch" && tool !== "fill" && tool !== "knot") {
        endStroke();
        renderLegend();
      }
      painting = false;
    });
    canvas.addEventListener("pointercancel", () => {
      if (painting && editMode && tool !== "backstitch" && tool !== "fill" && tool !== "knot") endStroke();
      painting = false;
    });

    async function saveProgress(id: number, status: string) {
      await api(`/api/patterns/${id}/project`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, progress_json: { marked: [...gridState.marked] } }),
      });
    }
    document.getElementById("zoomIn")!.addEventListener("click", () => {
      gridState.zoom = Math.min(32, gridState.zoom + 2);
      redraw();
    });
    document.getElementById("zoomOut")!.addEventListener("click", () => {
      gridState.zoom = Math.max(6, gridState.zoom - 2);
      redraw();
    });
    document.getElementById("toggleSym")!.addEventListener("click", () => {
      if (previewMode) return;
      cycleSymbolMode();
      const btn = document.getElementById("toggleSym");
      if (btn) btn.textContent = symbolModeLabel();
      renderLegend();
      redraw();
    });
    document.getElementById("toggleCenterLines")?.addEventListener("click", () => {
      gridState.centerLines = !gridState.centerLines;
      sessionStorage.setItem("pincushion_center_lines", gridState.centerLines ? "1" : "0");
      const btn = document.getElementById("toggleCenterLines");
      if (btn) {
        btn.classList.toggle("active", gridState.centerLines);
        btn.setAttribute("aria-pressed", gridState.centerLines ? "true" : "false");
      }
      redraw();
    });
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = (btn as HTMLElement).dataset.mode as ChartMode;
        if (mode) setChartMode(mode);
      });
    });
    const setFabricColour = (hex: string) => {
      const next = hexColor(hex).toLowerCase();
      gridState.fabricColour = next;
      sessionStorage.setItem("pincushion_fabric_colour", next);
      syncFabricUi();
      if (previewMode) redraw();
    };
    document.querySelectorAll(".fabric-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hex = (btn as HTMLElement).dataset.colour;
        if (hex) setFabricColour(hex);
      });
    });
    document.getElementById("fabricColourCustom")?.addEventListener("input", (ev) => {
      setFabricColour((ev.target as HTMLInputElement).value);
    });
    document.querySelectorAll(".texture-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.texture as FabricTexture;
        if (!previewTextures.some((t) => t.id === id)) return;
        gridState.fabricTexture = id;
        sessionStorage.setItem("pincushion_fabric_texture", id);
        syncFabricUi();
        if (previewMode) redraw();
      });
    });
    document.getElementById("undoEdit")?.addEventListener("click", () => undoEdit());
    document.getElementById("redoEdit")?.addEventListener("click", () => redoEdit());
    const onSizeCommit = () => {
      const wEl = document.getElementById("chartWidth") as HTMLInputElement | null;
      const hEl = document.getElementById("chartHeight") as HTMLInputElement | null;
      if (!wEl || !hEl) return;
      applyChartSize(Number(wEl.value), Number(hEl.value));
    };
    document.getElementById("chartWidth")?.addEventListener("change", onSizeCommit);
    document.getElementById("chartHeight")?.addEventListener("change", onSizeCommit);
    syncSizeInputs();
    chartEditKeyHandler = (ev: KeyboardEvent) => {
      if (!editMode) return;
      const key = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && key === "z") {
        ev.preventDefault();
        if (ev.shiftKey) redoEdit();
        else undoEdit();
      } else if ((ev.ctrlKey || ev.metaKey) && key === "y") {
        ev.preventDefault();
        redoEdit();
      }
    };
    document.addEventListener("keydown", chartEditKeyHandler);
    editTools.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => setTool((btn as HTMLElement).dataset.tool as typeof tool));
    });
    document.getElementById("addColor")?.addEventListener("click", async () => {
      const hex = prompt("New colour hex (e.g. 310000 or #310000)", "#222222");
      if (!hex) return;
      const nextIndex = Math.max(0, ...working.palette.map((x) => x.index)) + 1;
      const match = await resolvePaintColor(hex, `Colour ${nextIndex}`);
      if (!match) return;
      const number = match.number;
      const name = match.name;
      const stored = match.color;
      if (working.palette.some((p) => p.number === number || p.color.toUpperCase() === stored)) {
        const existing = working.palette.find((p) => p.number === number || p.color.toUpperCase() === stored);
        if (existing) selectedPal = existing.index;
        setHint(`Already have ${number} ${name}`);
        renderLegend();
        return;
      }
      const before = structuredClone(working);
      working.palette.push({
        index: nextIndex,
        number,
        name,
        color: stored,
        symbol: String.fromCharCode(33 + (nextIndex % 90)),
        stitch_count: 0,
        strands: 2,
      });
      selectedPal = nextIndex;
      pushHistory(before);
      setHint(`Added ${number} ${name}`);
      renderLegend();
    });
    document.getElementById("saveChart")?.addEventListener("click", async () => {
      try {
        await api(`/api/patterns/${p.id}/chart`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: p.title,
            width_stitches: working.width_stitches,
            height_stitches: working.height_stitches,
            fabric_count: working.fabric_count || 14,
            palette: working.palette,
            full_stitches: working.full_stitches,
            backstitches: working.backstitches || [],
            part_stitches: working.part_stitches || [],
            ornaments: working.ornaments || [],
            symbol_mode: gridState.symbolMode,
          }),
        });
        loaded.full_stitches = structuredClone(working.full_stitches);
        loaded.backstitches = structuredClone(working.backstitches || []);
        loaded.part_stitches = structuredClone(working.part_stitches || []);
        loaded.ornaments = structuredClone(working.ornaments || []);
        loaded.palette = structuredClone(working.palette);
        loaded.width_stitches = working.width_stitches;
        loaded.height_stitches = working.height_stitches;
        loaded.fabric_count = working.fabric_count || 14;
        pendingBack = null;
        undoStack = [];
        redoStack = [];
        strokeSnapshot = null;
        leaveEditMode(false);
        chartMode = "chart";
        previewMode = false;
        syncModeUi();
        renderLegend();
        redraw();
      } catch (e) {
        alert(String(e));
      }
    });
  }

  let imgScale = 1;
  document.getElementById("imgIn")?.addEventListener("click", () => {
    imgScale *= 1.2;
    document.querySelectorAll("#imgBox img").forEach((img) => {
      (img as HTMLImageElement).style.transform = `scale(${imgScale})`;
    });
  });
  document.getElementById("imgOut")?.addEventListener("click", () => {
    imgScale = Math.max(0.3, imgScale / 1.2);
    document.querySelectorAll("#imgBox img").forEach((img) => {
      (img as HTMLImageElement).style.transform = `scale(${imgScale})`;
    });
  });
}

async function renderAbout() {
  shell(`
    <div class="panel about-panel">
      <h2 style="margin:0">About PinCushion</h2>
      <p class="meta" id="aboutBlurb">Loading…</p>
      <dl class="about-meta">
        <div><dt>Version</dt><dd id="aboutVersion">…</dd></div>
        <div><dt>Updates</dt><dd id="aboutUpdates">Checking…</dd></div>
      </dl>
      <p class="meta is-hidden" id="aboutLatestNote"></p>
      <p id="aboutDownload" class="about-download is-hidden"></p>
    </div>
  `);

  const blurb = document.getElementById("aboutBlurb");
  const verEl = document.getElementById("aboutVersion");
  const updEl = document.getElementById("aboutUpdates");
  const noteEl = document.getElementById("aboutLatestNote");
  const dlEl = document.getElementById("aboutDownload");

  try {
    type AboutInfo = {
      name: string;
      version: string;
      description: string;
      github_repo?: string | null;
      update_available: boolean;
      release_check: string;
      latest?: {
        version: string;
        name?: string;
        url?: string;
        published_at?: string | null;
        note?: string;
      } | null;
    };
    const info = await api<AboutInfo>("/api/about");
    if (blurb) blurb.textContent = info.description;
    if (verEl) verEl.textContent = info.version;
    if (!updEl || !dlEl || !noteEl) return;

    if (info.release_check === "unconfigured") {
      updEl.textContent = "Release channel not configured.";
      noteEl.classList.remove("is-hidden");
      noteEl.textContent =
        "Set PINCUSHION_GITHUB_REPO (owner/repo) to check GitHub for newer PinCushion releases.";
      return;
    }
    if (info.release_check === "unavailable" || !info.latest) {
      updEl.textContent = "Could not check for updates right now.";
      return;
    }
    if (info.latest.note) {
      noteEl.classList.remove("is-hidden");
      noteEl.textContent = info.latest.note;
    }
    if (info.update_available) {
      updEl.innerHTML = `Newer release available: <strong>${escapeHtml(info.latest.version)}</strong>`;
      if (info.latest.url) {
        dlEl.classList.remove("is-hidden");
        dlEl.innerHTML = `<a class="primary-link" href="${escapeHtml(
          info.latest.url
        )}" target="_blank" rel="noopener">Download ${escapeHtml(info.latest.version)}</a>`;
      }
    } else {
      updEl.textContent = `You’re up to date (latest: ${info.latest.version}).`;
    }
  } catch (e) {
    if (blurb) blurb.textContent = "PinCushion is a self-hosted cross-stitch pattern library.";
    if (verEl) verEl.textContent = "unknown";
    if (updEl) updEl.textContent = String(e);
  }
}

async function renderWanted() {
  await loadIndexers();
  const wantedFilter = wantedSection;
  const catalogueCraft = wantedSection;
  type Vendor = { id: string; name: string; site_url?: string };
  type Catalogue = {
    id: string;
    name: string;
    notes?: string;
    pattern_lookup?: boolean;
    vendors: Vendor[];
  };
  type WantedItem = {
    id: number;
    title: string;
    craft: string;
    status: string;
    catalogue_id?: string | null;
    vendor_id?: string | null;
    vendor_name?: string | null;
    catalog_ref?: string | null;
    xref_id?: string | null;
    source_url?: string;
    thumbnail_url?: string | null;
    indexer_id: string;
    can_download: boolean;
    download_mode: string;
    error?: string | null;
    pattern_id?: number | null;
  };
  type PatternLookupHit = {
    vendor_id: string;
    vendor_name: string;
    sku: string;
    title: string;
    description?: string;
    images?: string[];
    thumbnail_url?: string;
    source_url?: string;
    source?: string;
    xref_id?: string;
  };
  const [items, catResp] = await Promise.all([
    api<WantedItem[]>(`/api/wanted?craft=${encodeURIComponent(wantedFilter)}`),
    api<{ catalogues: Catalogue[] }>(
      `/api/catalogues?craft=${encodeURIComponent(catalogueCraft)}`
    ),
  ]);

  const statusClass = (s: string) => {
    if (s === "imported") return "badge-ok";
    if (s === "failed") return "badge-warn";
    if (s === "downloading" || s === "queued") return "badge-index";
    return "badge";
  };

  const cat = (catResp.catalogues || [])[0] as Catalogue | undefined;
  const lookupSupported = !!cat?.pattern_lookup;
  let selectedHit: PatternLookupHit | null = null;
  const skuPlaceholder = cat?.id === "sewing" ? "V2193 or 2193" : "PAT1630";

  let lookupVendors: Vendor[] = [];
  if (lookupSupported && cat) {
    try {
      const vr = await api<{ results: Vendor[] }>(
        `/api/catalogues/${encodeURIComponent(cat.id)}/vendors?q=&limit=20`
      );
      lookupVendors = (vr.results || []).filter((v) => v.id && v.name);
    } catch {
      lookupVendors = [];
    }
  }

  const rows = items.length
    ? items
        .map((w) => {
          const openSrc = w.source_url
            ? `<a class="secondary" href="${escapeAttr(w.source_url)}" target="_blank" rel="noopener">Source</a>`
            : "";
          const openPat =
            w.pattern_id != null
              ? `<button type="button" class="secondary btn-open-pat" data-pid="${w.pattern_id}">Open pattern</button>`
              : "";
          const fetchBtn =
            w.can_download && w.status !== "imported"
              ? `<button type="button" class="secondary btn-fetch" data-id="${w.id}">Fetch now</button>`
              : "";
          const markBtn =
            w.status !== "imported"
              ? `<button type="button" class="secondary btn-mark" data-id="${w.id}">Mark imported</button>`
              : "";
          const xref = w.xref_id
            ? `<code class="xref-id">${escapeHtml(w.xref_id)}</code>`
            : w.vendor_name
              ? escapeHtml(`${w.vendor_name} ${w.catalog_ref || ""}`.trim())
              : "";
          const thumb = w.thumbnail_url
            ? `<img class="wanted-thumb" src="${escapeAttr(w.thumbnail_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
            : "";
          return `
          <article class="card wanted-card${w.thumbnail_url ? " has-thumb" : ""}" data-wid="${w.id}">
            ${thumb}
            <div class="card-body">
              <h3>${escapeHtml(w.title)}</h3>
              <div class="meta">
                <span class="badge ${statusClass(w.status)}">${escapeHtml(w.status)}</span>
                ${xref ? ` · ${xref}` : ""}
                · ${w.download_mode === "auto" ? "auto-download" : "manual"}
              </div>
              ${w.error ? `<p class="meta wanted-error">${escapeHtml(w.error)}</p>` : ""}
              <div class="card-actions" style="margin-top:0.5rem;display:flex;gap:0.35rem;flex-wrap:wrap">
                ${fetchBtn}${markBtn}${openPat}${openSrc}
                <button type="button" class="secondary btn-del-want" data-id="${w.id}">Remove</button>
              </div>
            </div>
          </article>`;
        })
        .join("")
    : `<p class="empty">No Wanted items for <strong>${escapeHtml(
        librarySectionLabel(wantedSection)
      )}</strong>.${
        lookupSupported
          ? " Pick a brand and pattern number, then look up."
          : " Add items from Search, or switch to Sewing for catalogue lookup."
      }</p>`;

  const brandOptions = lookupVendors.length
    ? lookupVendors
        .map((v) => `<option value="${escapeAttr(v.id)}">${escapeHtml(v.name)}</option>`)
        .join("")
    : cat?.id === "sewing"
      ? `<option value="vogue">Vogue</option>
            <option value="butterick">Butterick</option>
            <option value="simplicity">Simplicity</option>
            <option value="mccalls">McCall's</option>
            <option value="new_look">New Look</option>`
      : `<option value="dmc">DMC</option>`;

  const addPanel = lookupSupported
    ? `<h2 style="margin-top:0">Add to Wanted</h2>
        <p class="meta">${escapeHtml(cat!.name)} — look up by brand + pattern number</p>
        <div class="wanted-manual-form">
          <div class="lookup-fields">
            <label>Brand
              <select id="lookupBrand">${brandOptions}</select>
            </label>
            <label>Pattern number
              <div class="lookup-row">
                <input type="text" id="lookupSku" placeholder="${escapeAttr(skuPlaceholder)}" autocomplete="off" />
                <button type="button" class="secondary" id="manualLookupBtn">Look up</button>
              </div>
            </label>
          </div>
          <span class="meta">Pick a result to add title, SKU, and images</span>
          <div id="manualLookupResults" class="lookup-results is-hidden" aria-live="polite"></div>
          <div id="manualImagePreview" class="lookup-images is-hidden"></div>
          <button type="button" class="primary" id="manualSave" disabled>Add to Wanted</button>
          <p class="meta" id="manualStatus" aria-live="polite"></p>
        </div>`
    : `<h2 style="margin-top:0">Add to Wanted</h2>
        <p class="meta">${
          cat
            ? escapeHtml(cat.notes || "No brand+SKU catalogue lookup for this craft. Add items from Search.")
            : "No catalogue for this craft."
        }</p>`;

  shell(
    `
    <div class="wanted-layout">
      <div class="panel">
        <div class="toolbar" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <h2 style="margin:0">Wanted · ${escapeHtml(librarySectionLabel(wantedSection))}</h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button type="button" class="secondary" id="runWantedProcess">Process queue</button>
            <button type="button" class="secondary" id="refreshWanted">Refresh</button>
          </div>
        </div>
        <div class="card-grid" style="margin-top:1rem">${rows}</div>
      </div>
      <div class="panel">
        ${addPanel}
      </div>
    </div>
  `,
    "wanted"
  );

  const brandSelect = document.getElementById("lookupBrand") as HTMLSelectElement | null;
  const skuInput = document.getElementById("lookupSku") as HTMLInputElement | null;
  const lookupResultsEl = document.getElementById("manualLookupResults");
  const imagePreviewEl = document.getElementById("manualImagePreview");
  const saveBtn = document.getElementById("manualSave") as HTMLButtonElement | null;

  const paintImagePreview = (images: string[]) => {
    if (!imagePreviewEl) return;
    if (!images.length) {
      imagePreviewEl.classList.add("is-hidden");
      imagePreviewEl.innerHTML = "";
      return;
    }
    imagePreviewEl.innerHTML = images
      .slice(0, 6)
      .map(
        (src) =>
          `<img src="${escapeAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      )
      .join("");
    imagePreviewEl.classList.remove("is-hidden");
  };

  const selectLookupHit = (hit: PatternLookupHit, idx: number) => {
    selectedHit = hit;
    if (saveBtn) saveBtn.disabled = false;
    paintImagePreview(hit.images || (hit.thumbnail_url ? [hit.thumbnail_url] : []));
    lookupResultsEl?.querySelectorAll(".lookup-hit").forEach((btn) => {
      btn.classList.toggle("is-selected", Number((btn as HTMLElement).dataset.idx) === idx);
    });
    const status = document.getElementById("manualStatus");
    if (status) {
      status.textContent = hit.xref_id
        ? `Selected ${hit.xref_id}${hit.source ? ` · ${hit.source}` : ""}`
        : "Selected";
    }
  };

  const paintLookupResults = (results: PatternLookupHit[]) => {
    selectedHit = null;
    if (saveBtn) saveBtn.disabled = true;
    paintImagePreview([]);
    if (!lookupResultsEl) return;
    if (!results.length) {
      lookupResultsEl.innerHTML = `<p class="meta">No catalogue match found.</p>`;
      lookupResultsEl.classList.remove("is-hidden");
      return;
    }
    lookupResultsEl.innerHTML = results
      .map((hit, idx) => {
        const img = hit.thumbnail_url || (hit.images && hit.images[0]) || "";
        return `<button type="button" class="lookup-hit" data-idx="${idx}">
          ${img ? `<img src="${escapeAttr(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="lookup-hit-ph"></span>`}
          <span>
            <strong>${escapeHtml(hit.title || hit.sku)}</strong>
            <span class="meta">${escapeHtml(hit.vendor_name)} ${escapeHtml(hit.sku)}${
              hit.source ? ` · ${escapeHtml(hit.source)}` : ""
            }</span>
          </span>
        </button>`;
      })
      .join("");
    lookupResultsEl.classList.remove("is-hidden");
    lookupResultsEl.querySelectorAll(".lookup-hit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).dataset.idx);
        const hit = results[idx];
        if (hit) selectLookupHit(hit, idx);
      });
    });
    selectLookupHit(results[0]!, 0);
  };

  const runPatternLookup = async () => {
    if (!cat || !lookupSupported) return;
    const status = document.getElementById("manualStatus");
    const vendor = brandSelect?.value.trim() || "";
    const sku = skuInput?.value.trim() || "";
    if (!vendor || !sku) {
      if (status) status.textContent = "Choose a brand and enter a pattern number.";
      return;
    }
    if (status) status.textContent = "Looking up…";
    try {
      const params = new URLSearchParams({ vendor, sku, limit: "5" });
      const r = await api<{ results: PatternLookupHit[] }>(
        `/api/catalogues/${encodeURIComponent(cat.id)}/lookup?${params}`
      );
      paintLookupResults(r.results || []);
      if (!(r.results || []).length && status) status.textContent = "No match found.";
    } catch (e) {
      if (status) status.textContent = String(e);
      paintLookupResults([]);
    }
  };

  document.getElementById("manualLookupBtn")?.addEventListener("click", () => {
    void runPatternLookup();
  });
  skuInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void runPatternLookup();
    }
  });
  brandSelect?.addEventListener("change", () => {
    selectedHit = null;
    if (saveBtn) saveBtn.disabled = true;
    lookupResultsEl?.classList.add("is-hidden");
    paintImagePreview([]);
    const status = document.getElementById("manualStatus");
    if (status) status.textContent = "";
  });

  document.getElementById("refreshWanted")?.addEventListener("click", () => renderWanted());
  document.getElementById("runWantedProcess")?.addEventListener("click", async () => {
    await api("/api/wanted/process?limit=5", { method: "POST" });
    await renderWanted();
  });
  document.getElementById("manualSave")?.addEventListener("click", async () => {
    const status = document.getElementById("manualStatus");
    if (!cat || !selectedHit) {
      if (status) status.textContent = "Look up a pattern and select a result first.";
      return;
    }
    const hit = selectedHit;
    try {
      const r = await api<{ xref_id?: string }>("/api/wanted/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          craft: catalogueCraft,
          catalogue_id: cat.id,
          vendor_id: hit.vendor_id || undefined,
          vendor_query: hit.vendor_name || hit.vendor_id,
          catalog_ref: hit.sku,
          title: hit.title,
          source_url: hit.source_url || "",
          thumbnail_url: hit.thumbnail_url || (hit.images && hit.images[0]) || null,
          image_urls: hit.images?.length ? hit.images : null,
        }),
      });
      if (status) status.textContent = r.xref_id ? `Added ${r.xref_id}` : "Added.";
      await renderWanted();
    } catch (e) {
      if (status) status.textContent = String(e);
    }
  });

  app.querySelectorAll(".btn-del-want").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number((btn as HTMLElement).dataset.id);
      if (!confirm("Remove from Wanted?")) return;
      await api(`/api/wanted/${id}`, { method: "DELETE" });
      await renderWanted();
    });
  });
  app.querySelectorAll(".btn-fetch").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number((btn as HTMLElement).dataset.id);
      (btn as HTMLButtonElement).disabled = true;
      try {
        await api(`/api/wanted/${id}/fetch`, { method: "POST" });
      } catch (e) {
        alert(String(e));
      }
      await renderWanted();
    });
  });
  app.querySelectorAll(".btn-mark").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number((btn as HTMLElement).dataset.id);
      await api(`/api/wanted/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "imported" }),
      });
      await renderWanted();
    });
  });
  app.querySelectorAll(".btn-open-pat").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPatternId = Number((btn as HTMLElement).dataset.pid);
      view = "pattern";
      render();
    });
  });
}

async function renderDocs() {
  const pageMeta = DOCS_NAV.find((d) => d.id === docsPageId) || DOCS_NAV[0]!;
  shell(
    `<div class="panel docs-panel">
      <p class="meta">Loading…</p>
    </div>`,
    "docs"
  );
  try {
    const doc = await api<{ id: string; title: string; html: string }>(
      `/api/docs/${encodeURIComponent(pageMeta.id)}`
    );
    shell(
      `<div class="panel docs-panel">
        <article class="docs-article">${doc.html}</article>
      </div>`,
      "docs"
    );
    app.querySelectorAll<HTMLAnchorElement>(".docs-article a[href^='#/docs/']").forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const href = a.getAttribute("href") || "";
        const id = href.replace(/^#\/docs\//, "").split("/")[0];
        if (id && DOCS_NAV.some((d) => d.id === id)) {
          docsPageId = id;
          sessionStorage.setItem("pincushion_docs_page", docsPageId);
          view = "docs";
          render();
        }
      });
    });
  } catch (e) {
    shell(
      `<div class="panel docs-panel">
        <h2>${escapeHtml(pageMeta.label)}</h2>
        <p class="empty">${escapeHtml(String(e))}</p>
      </div>`,
      "docs"
    );
  }
}

function renderNotFound() {
  const attempted = notFoundPath || "404";
  shell(
    `
    <div class="panel not-found-panel">
      <p class="not-found-code">404</p>
      <h1>Page not found</h1>
      <p class="meta">No page at <code>${escapeHtml(attempted)}</code>.</p>
      <div class="not-found-actions">
        <button type="button" class="primary" id="nfLibrary">Projects</button>
        <button type="button" class="secondary" id="nfDocs">Docs</button>
      </div>
    </div>
  `,
    "not_found"
  );
  document.getElementById("nfLibrary")?.addEventListener("click", () => {
    view = "library";
    librarySection = null;
    notFoundPath = "";
    render();
  });
  document.getElementById("nfDocs")?.addEventListener("click", () => {
    view = "docs";
    docsPageId = DEFAULT_DOCS_PAGE;
    notFoundPath = "";
    render();
  });
}

function render() {
  if (view !== "pattern") disposePatternView();
  syncRoute();
  if (view === "pattern") return renderPattern();
  if (view === "library") return renderLibrary();
  if (view === "project_new") return renderProjectNew();
  if (view === "materials") return renderMaterials();
  if (view === "material_new") return renderMaterialNew();
  if (view === "wanted") {
    if (!SHOW_WANTED) {
      view = "library";
      librarySection = null;
      return renderLibrary();
    }
    return renderWanted();
  }
  if (view === "docs") return renderDocs();
  if (view === "settings_indexers") return renderIndexers();
  if (view === "settings_file_associations") return renderFileAssociations();
  if (view === "settings_supplies") return renderSupplies();
  if (view === "settings_about") return renderAbout();
  if (view === "not_found") return renderNotFound();
  if (!SHOW_SEARCH) {
    view = "library";
    librarySection = null;
    return renderLibrary();
  }
  return renderSearch();
}

window.addEventListener("hashchange", () => {
  if (syncingRoute) return;
  const before = `${view}:${selectedPatternId ?? ""}:${librarySection}:${materialsCategory}:${wantedSection}:${docsPageId}:${notFoundPath}`;
  applyRouteFromLocation();
  const after = `${view}:${selectedPatternId ?? ""}:${librarySection}:${materialsCategory}:${wantedSection}:${docsPageId}:${notFoundPath}`;
  if (before !== after) render();
});

render();
