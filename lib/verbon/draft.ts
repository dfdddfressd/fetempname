// The field form keeps raw strings so a verifier can type "12." or "-10" without the
// value jumping around. These helpers turn the draft into a Plot for validatePlot.
import { validatePlot } from "./fieldChecks";
import type { Flag, Plot, Tree, TreeTable } from "./types";

export const TREE_NUMERIC = [
  "dbhCm",
  "heightM",
  "crownM",
  "vigor",
  "azimuthDeg",
  "distanceM",
  "increment5yMm",
  "defectUpper",
  "defectMiddle",
  "defectLower",
] as const;
export type TreeNumericField = (typeof TREE_NUMERIC)[number];
export type TreeField = "number" | "species" | TreeNumericField;

export interface DraftTree {
  id: string;
  table: TreeTable;
  number: string;
  species: string;
  values: Record<TreeNumericField, string>;
}

export interface DraftPlot {
  carId: string;
  plotNumber: string;
  date: string;
  leader: string;
  technicians: string[];
  slopePct: string;
  aspect: string;
  lat: string;
  lon: string;
  notes: string;
  trees: DraftTree[];
  tco2Ha: string;
}

export type HeaderField = "carId" | "plotNumber" | "date" | "leader" | "technicians" | "slopePct" | "coords" | "notes";

let counter = 0;
export function newTreeId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter}`;
}

export function parseNum(raw: string): number | null | "bad" {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return "bad";
  return Number(s);
}

const asNum = (raw: string) => {
  const v = parseNum(raw);
  return v === "bad" ? null : v;
};

export function draftToPlot(d: DraftPlot): Plot {
  const tco2 = asNum(d.tco2Ha);
  return {
    carId: d.carId,
    plotNumber: d.plotNumber,
    date: d.date,
    leader: d.leader,
    technicians: d.technicians,
    slopePct: asNum(d.slopePct),
    aspect: d.aspect || null,
    lat: asNum(d.lat),
    lon: asNum(d.lon),
    notes: d.notes,
    trees: d.trees.map(draftTreeToTree),
    ...(tco2 !== null ? { verifierTco2Ha: tco2 } : {}),
  };
}

export function draftTreeToTree(t: DraftTree): Tree {
  const v = t.values;
  return {
    number: t.number.trim(),
    species: t.species.trim(),
    table: t.table,
    dbhCm: asNum(v.dbhCm),
    heightM: asNum(v.heightM),
    crownM: asNum(v.crownM),
    vigor: asNum(v.vigor),
    azimuthDeg: asNum(v.azimuthDeg),
    distanceM: asNum(v.distanceM),
    increment5yMm: asNum(v.increment5yMm),
    defectUpper: asNum(v.defectUpper),
    defectMiddle: asNum(v.defectMiddle),
    defectLower: asNum(v.defectLower),
  };
}

export function treeToDraft(t: Tree, id = newTreeId()): DraftTree {
  const s = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  return {
    id,
    table: t.table,
    number: t.number,
    species: t.species,
    values: {
      dbhCm: s(t.dbhCm),
      heightM: s(t.heightM),
      crownM: s(t.crownM),
      vigor: s(t.vigor),
      azimuthDeg: s(t.azimuthDeg),
      distanceM: s(t.distanceM),
      increment5yMm: s(t.increment5yMm),
      defectUpper: s(t.defectUpper),
      defectMiddle: s(t.defectMiddle),
      defectLower: s(t.defectLower),
    },
  };
}

export function plotToDraft(p: Plot): DraftPlot {
  const s = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  const techs = [...p.technicians, "", "", "", ""].slice(0, 4);
  return {
    carId: p.carId,
    plotNumber: p.plotNumber,
    date: p.date,
    leader: p.leader,
    technicians: techs,
    slopePct: s(p.slopePct),
    aspect: p.aspect ?? "",
    lat: s(p.lat),
    lon: s(p.lon),
    notes: p.notes,
    trees: p.trees.map((t) => treeToDraft(t)),
    tco2Ha: s(p.verifierTco2Ha),
  };
}

export function blankTree(table: TreeTable, existing: DraftTree[]): DraftTree {
  const used = new Set(existing.filter((t) => t.table === table).map((t) => t.number.trim().toUpperCase()));
  let number = "";
  if (table === "large") {
    for (let i = 1; ; i++) if (!used.has(String(i))) { number = String(i); break; }
  } else {
    for (let i = 0; i < 26 * 27; i++) {
      const label = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
      if (!used.has(label)) { number = label; break; }
    }
  }
  const values = Object.fromEntries(TREE_NUMERIC.map((k) => [k, ""])) as Record<TreeNumericField, string>;
  return { id: newTreeId(), table, number, species: "", values };
}

export const FIELD_LABEL: Record<TreeNumericField, string> = {
  dbhCm: "DBH",
  heightM: "Height",
  crownM: "Crown length",
  vigor: "Vigor",
  azimuthDeg: "Azimuth",
  distanceM: "Distance",
  increment5yMm: "5-year increment",
  defectUpper: "Defect upper",
  defectMiddle: "Defect middle",
  defectLower: "Defect lower",
};

export interface FieldFlag extends Flag {
  field: string;
}

// Values that are typed but are not numbers. validatePlot only sees numbers, so the
// form reports these itself. They block "Finish plot" like any other error.
export function inputErrors(d: DraftPlot): { header: FieldFlag[]; trees: Record<string, FieldFlag[]> } {
  const P = `Plot ${d.plotNumber}`;
  const header: FieldFlag[] = [];
  const bad = (raw: string) => parseNum(raw) === "bad";
  if (bad(d.slopePct)) header.push({ level: "error", where: P, field: "slopePct", message: `Slope "${d.slopePct}" is not a number.` });
  if (bad(d.lat)) header.push({ level: "error", where: P, field: "coords", message: `Latitude "${d.lat}" is not a number.` });
  if (bad(d.lon)) header.push({ level: "error", where: P, field: "coords", message: `Longitude "${d.lon}" is not a number.` });
  const trees: Record<string, FieldFlag[]> = {};
  for (const t of d.trees) {
    const list: FieldFlag[] = [];
    for (const k of TREE_NUMERIC) {
      if (bad(t.values[k])) {
        list.push({ level: "error", where: `${P}, tree ${t.number.trim()}`, field: k, message: `${FIELD_LABEL[k]} "${t.values[k]}" is not a number.` });
      }
    }
    trees[t.id] = list;
  }
  return { header, trees };
}

// Which input a validatePlot message belongs to, so it can be shown inline.
export function headerFieldFor(message: string): HeaderField {
  if (message.startsWith("Missing CAR ID")) return "carId";
  if (message.startsWith("Missing plot number")) return "plotNumber";
  if (message.startsWith("Missing date")) return "date";
  if (message.startsWith("Missing group leader")) return "leader";
  if (message.includes("technician")) return "technicians";
  if (message.startsWith("Slope")) return "slopePct";
  return "coords";
}

export function treeFieldFor(message: string): TreeField {
  if (message.startsWith("Tree number")) return "number";
  if (message.startsWith("Missing species")) return "species";
  if (message.startsWith("Missing diameter") || message.startsWith("DBH")) return "dbhCm";
  if (message.startsWith("Missing vigor") || message.startsWith("Vigor")) return "vigor";
  if (message.startsWith("Distance") || message.startsWith("Borderline") || message.startsWith("Missing distance")) return "distanceM";
  if (message.startsWith("Azimuth")) return "azimuthDeg";
  if (message.startsWith("Crown")) return "crownM";
  if (message.startsWith("Height")) return "heightM";
  if (message.startsWith("Dead tree")) return "increment5yMm";
  if (message.startsWith("Defect (upper)")) return "defectUpper";
  if (message.startsWith("Defect (middle)")) return "defectMiddle";
  if (message.startsWith("Defect (lower)")) return "defectLower";
  return "number";
}

export interface DraftCheck {
  plot: Plot;
  all: FieldFlag[];
  header: FieldFlag[];
  byTree: Record<string, FieldFlag[]>;
  errors: number;
  warnings: number;
}

// validatePlot emits header flags first, then each tree's flags in order, so
// validating growing prefixes of the tree list attributes every flag to its tree
// (including "used twice", which belongs to the second tree with that number).
export function checkDraft(d: DraftPlot): DraftCheck {
  const plot = draftToPlot(d);
  const input = inputErrors(d);
  const headerFlags = validatePlot({ ...plot, trees: [] });
  const header: FieldFlag[] = [...input.header, ...headerFlags.map((f) => ({ ...f, field: headerFieldFor(f.message) }))];
  const byTree: Record<string, FieldFlag[]> = {};
  let prev = validatePlot({ ...plot, trees: [] }).length;
  plot.trees.forEach((_, i) => {
    const flags = validatePlot({ ...plot, trees: plot.trees.slice(0, i + 1) });
    const id = d.trees[i].id;
    byTree[id] = [...input.trees[id], ...flags.slice(prev).map((f) => ({ ...f, field: treeFieldFor(f.message) }))];
    prev = flags.length;
  });
  const all = [...header, ...d.trees.flatMap((t) => byTree[t.id] ?? [])];
  return {
    plot,
    all,
    header,
    byTree,
    errors: all.filter((f) => f.level === "error").length,
    warnings: all.filter((f) => f.level === "warning").length,
  };
}
