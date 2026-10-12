export type YarnCraft = "crochet" | "knitting";

export interface YarnEntry {
  name: string;
  amount: string;
}

export interface YarnSupplies {
  terminology: string;
  hook_size: string;
  needle_size: string;
  yarns: YarnEntry[];
  /** @deprecated mirrored from yarns[0] */
  yarn: string;
  /** @deprecated mirrored from yarns[0] */
  yarn_amount: string;
  gauge: string;
  notions: string;
  notes: string;
}

export interface YarnSection {
  title: string;
  kind: string;
  steps: string[];
}

export interface YarnConfidence {
  global: number;
  level: "high" | "medium" | "low" | string;
  by_section?: Record<string, number>;
  structured_steps?: number;
  total_steps?: number;
}

export interface YarnDoc {
  format: string;
  craft?: string;
  title: string;
  dialect: string;
  lines: string[];
  supplies?: YarnSupplies | (Partial<YarnSupplies> & { yarns?: YarnEntry[] });
  size_labels?: string[];
  sections?: YarnSection[];
  confidence?: YarnConfidence | null;
  warnings: string[];
}

function addLineControl(): string {
  return `
    <div class="yarn-add-line-wrap">
      <button type="button" class="yarn-add-line-btn" id="yarnAddLine" title="Add line" aria-label="Add line">+</button>
    </div>`;
}

export function emptySupplies(terminology = "US"): YarnSupplies {
  return {
    terminology,
    hook_size: "",
    needle_size: "",
    yarns: [],
    yarn: "",
    yarn_amount: "",
    gauge: "",
    notions: "",
    notes: "",
  };
}

function normalizeYarnEntries(raw: unknown): YarnEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: YarnEntry[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? row.yarn ?? "").trim();
      const amount = String(row.amount ?? row.yarn_amount ?? "").trim();
      if (name || amount) out.push({ name, amount });
    } else if (typeof item === "string" && item.trim()) {
      out.push({ name: item.trim(), amount: "" });
    }
  }
  return out;
}

export function normalizeSupplies(raw?: Partial<YarnSupplies> | null, dialect?: string): YarnSupplies {
  const base = emptySupplies(dialect === "UK" ? "UK" : dialect === "unknown" ? "unknown" : "US");
  if (!raw) return base;
  let yarns = normalizeYarnEntries(raw.yarns);
  const legacyYarn = String(raw.yarn || "").trim();
  const legacyAmount = String(raw.yarn_amount || "").trim();
  if (!yarns.length && (legacyYarn || legacyAmount)) {
    yarns = [{ name: legacyYarn, amount: legacyAmount }];
  }
  return {
    terminology: raw.terminology || base.terminology,
    hook_size: raw.hook_size || "",
    needle_size: raw.needle_size || "",
    yarns,
    yarn: yarns[0]?.name || "",
    yarn_amount: yarns[0]?.amount || "",
    gauge: raw.gauge || "",
    notions: raw.notions || "",
    notes: raw.notes || "",
  };
}

export function renderLineEditors(lines: string[], editable: boolean): string {
  if (!lines.length) {
    return `<p class="meta yarn-empty">No instruction lines yet. Extract from PDF or add a line below.</p>${addLineControl()}`;
  }
  if (!editable) {
    return (
      lines
        .map(
          (line, i) => `
    <div class="yarn-line yarn-line-view">
      <span class="yarn-line-num">${i + 1}</span>
      <p class="yarn-line-text">${escapeHtml(line)}</p>
    </div>`
        )
        .join("") + addLineControl()
    );
  }
  return (
    lines
      .map(
        (line, i) => `
    <div class="yarn-line yarn-line-edit" data-line-row="${i}">
      <span class="yarn-line-num">${i + 1}</span>
      <textarea class="yarn-line-input" data-line="${i}" rows="2">${escapeAttr(line)}</textarea>
    </div>`
      )
      .join("") + addLineControl()
  );
}

export function readLinesFromDom(root: ParentNode): string[] {
  const inputs = [...root.querySelectorAll<HTMLTextAreaElement>(".yarn-line-input")];
  if (inputs.length) {
    return inputs
      .sort((a, b) => Number(a.dataset.line) - Number(b.dataset.line))
      .map((el) => el.value.trim())
      .filter(Boolean);
  }
  return [...root.querySelectorAll<HTMLElement>(".yarn-line-text")]
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean);
}

function renderYarnRows(yarns: YarnEntry[]): string {
  const rows = yarns.length ? yarns : [{ name: "", amount: "" }];
  return rows
    .map(
      (y, i) => `
      <div class="yarn-yarn-row" data-yarn-idx="${i}">
        <label class="yarn-supply-field yarn-yarn-name">
          <span class="yarn-supply-label">Yarn ${rows.length > 1 ? i + 1 : "/ wool"}</span>
          <input type="text" class="yarn-yarn-name-input" data-yarn-name="${i}" placeholder="e.g. DK weight wool" value="${escapeAttr(
            y.name
          )}" />
        </label>
        <label class="yarn-supply-field yarn-yarn-amount">
          <span class="yarn-supply-label">Amount</span>
          <input type="text" class="yarn-yarn-amount-input" data-yarn-amount="${i}" placeholder="e.g. 100 g / 2 skeins" value="${escapeAttr(
            y.amount
          )}" />
        </label>
        <button type="button" class="secondary yarn-remove-yarn" data-yarn-remove="${i}" title="Remove yarn" aria-label="Remove yarn"${
          rows.length <= 1 && !y.name && !y.amount ? " disabled" : ""
        }>×</button>
      </div>`
    )
    .join("");
}

export function renderSupplies(supplies: YarnSupplies, craft: YarnCraft): string {
  const term = supplies.terminology || "US";
  const toolField =
    craft === "knitting"
      ? `<label class="yarn-supply-field">
        <span class="yarn-supply-label">Needle size</span>
        <input type="text" id="yarnSupplyNeedles" placeholder="e.g. 4.0 mm / US 6" value="${escapeAttr(
          supplies.needle_size
        )}" />
      </label>`
      : `<label class="yarn-supply-field">
        <span class="yarn-supply-label">Hook size</span>
        <input type="text" id="yarnSupplyHook" placeholder="e.g. 4.0 mm / G-6" value="${escapeAttr(
          supplies.hook_size
        )}" />
      </label>`;
  const gaugePh =
    craft === "knitting" ? "e.g. 22 sts × 30 rows = 10 cm" : "e.g. 16 sc × 18 rows = 10 cm";
  return `
    <div class="yarn-supplies-fields">
      <label class="yarn-supply-field">
        <span class="yarn-supply-label">Terminology</span>
        <select id="yarnSupplyTerminology">
          <option value="US"${term === "US" ? " selected" : ""}>US</option>
          <option value="UK"${term === "UK" ? " selected" : ""}>UK</option>
          <option value="unknown"${term === "unknown" ? " selected" : ""}>Unknown</option>
        </select>
      </label>
      ${toolField}
      <div class="yarn-yarns-block">
        <div class="yarn-yarns-list" id="yarnYarnsList">${renderYarnRows(supplies.yarns)}</div>
        <button type="button" class="secondary yarn-add-yarn" id="yarnAddYarn">Add yarn</button>
      </div>
      <label class="yarn-supply-field">
        <span class="yarn-supply-label">Gauge / tension</span>
        <input type="text" id="yarnSupplyGauge" placeholder="${escapeAttr(gaugePh)}" value="${escapeAttr(
          supplies.gauge
        )}" />
      </label>
      <label class="yarn-supply-field">
        <span class="yarn-supply-label">Notions</span>
        <input type="text" id="yarnSupplyNotions" placeholder="e.g. stitch markers, tapestry needle" value="${escapeAttr(
          supplies.notions
        )}" />
      </label>
      <label class="yarn-supply-field">
        <span class="yarn-supply-label">Notes</span>
        <textarea id="yarnSupplyNotes" rows="3" placeholder="Other materials or notes">${escapeAttr(
          supplies.notes
        )}</textarea>
      </label>
    </div>`;
}

export function readYarnEntriesFromDom(root: ParentNode = document): YarnEntry[] {
  const rows = [...root.querySelectorAll<HTMLElement>(".yarn-yarn-row")];
  if (!rows.length) return [];
  return rows
    .map((row) => {
      const name =
        (row.querySelector(".yarn-yarn-name-input") as HTMLInputElement | null)?.value.trim() || "";
      const amount =
        (row.querySelector(".yarn-yarn-amount-input") as HTMLInputElement | null)?.value.trim() || "";
      return { name, amount };
    })
    .filter((y) => y.name || y.amount);
}

export function readSuppliesFromDom(craft: YarnCraft, root: ParentNode = document): YarnSupplies {
  const val = (id: string) =>
    (root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)
      ?.value?.trim() || "";
  const yarns = readYarnEntriesFromDom(root);
  return {
    terminology: val("yarnSupplyTerminology") || "US",
    hook_size: craft === "crochet" ? val("yarnSupplyHook") : "",
    needle_size: craft === "knitting" ? val("yarnSupplyNeedles") : "",
    yarns,
    yarn: yarns[0]?.name || "",
    yarn_amount: yarns[0]?.amount || "",
    gauge: val("yarnSupplyGauge"),
    notions: val("yarnSupplyNotions"),
    notes: val("yarnSupplyNotes"),
  };
}

function readYarnRowsRaw(root: ParentNode): YarnEntry[] {
  return [...root.querySelectorAll<HTMLElement>(".yarn-yarn-row")].map((row) => ({
    name:
      (row.querySelector(".yarn-yarn-name-input") as HTMLInputElement | null)?.value.trim() || "",
    amount:
      (row.querySelector(".yarn-yarn-amount-input") as HTMLInputElement | null)?.value.trim() || "",
  }));
}

/** Wire add/remove yarn buttons; keeps other supply fields intact via reread. */
export function wireYarnListControls(
  root: ParentNode,
  craft: YarnCraft,
  onRerender: (supplies: YarnSupplies) => void
) {
  root.querySelector("#yarnAddYarn")?.addEventListener("click", () => {
    const supplies = readSuppliesFromDom(craft, root);
    supplies.yarns = [...readYarnRowsRaw(root), { name: "", amount: "" }];
    onRerender(supplies);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-yarn-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.yarnRemove);
      const supplies = readSuppliesFromDom(craft, root);
      const rows = readYarnRowsRaw(root);
      rows.splice(idx, 1);
      supplies.yarns = rows;
      onRerender(supplies);
    });
  });
}

export function apiBase(craft: YarnCraft): string {
  return craft === "knitting" ? "knitting" : "crochet";
}

export function formatExtractStatus(doc: YarnDoc | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const conf = doc.confidence;
  if (conf && typeof conf.global === "number" && (conf.total_steps || conf.global > 0 || doc.lines?.length)) {
    const level = String(conf.level || "low");
    parts.push(`Confidence: ${level} (${conf.global}%)`);
  }
  if (doc.size_labels?.length) {
    parts.push(`Sizes: ${doc.size_labels.join(", ")}`);
  }
  const workSecs = (doc.sections || []).filter((s) => s.kind === "work" && (s.steps?.length || 0) > 0);
  if (workSecs.length > 1) {
    parts.push(`${workSecs.length} sections`);
  }
  if (doc.warnings?.length) {
    parts.push(doc.warnings.join(" · "));
  }
  return parts.join(" · ");
}

export function renderConfidenceBadge(doc: YarnDoc | null | undefined): string {
  const conf = doc?.confidence;
  if (!conf || typeof conf.global !== "number") return "";
  if (!doc?.lines?.length && !(conf.total_steps || 0) && conf.global === 0) return "";
  const level = String(conf.level || "low");
  return `<span class="yarn-confidence yarn-confidence-${escapeAttr(level)}" title="Extraction confidence">
    ${escapeHtml(level)} · ${conf.global}%
  </span>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s);
}
