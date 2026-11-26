import Papa from "papaparse";
import type { ReconcileTree } from "./reconcile";

export const DEVELOPER_COLUMNS = ["plot", "table", "tree", "species", "dbh_cm", "height_m", "vigor", "plot_tco2_ha"] as const;

export interface DeveloperData {
  treesByPlot: Record<string, ReconcileTree[]>;
  tco2ByPlot: Record<string, number>;
  plots: string[];
  rowCount: number;
}

export type DeveloperParse = { ok: true; data: DeveloperData } | { ok: false; errors: string[] };

const MAX_ERRORS = 8;

function num(raw: string | undefined): number | null | "bad" {
  const s = (raw ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : "bad";
}

export function parseDeveloperCsv(text: string): DeveloperParse {
  if (!text.trim()) return { ok: false, errors: ["The file is empty."] };
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const headers = parsed.meta.fields ?? [];
  const missing = DEVELOPER_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) {
    return {
      ok: false,
      errors: [
        `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
        `Expected header: ${DEVELOPER_COLUMNS.join(",")}`,
      ],
    };
  }
  if (parsed.data.length === 0) return { ok: false, errors: ["The file has a header but no tree rows."] };

  const errors: string[] = [];
  const treesByPlot: Record<string, ReconcileTree[]> = {};
  const tco2ByPlot: Record<string, number> = {};

  parsed.data.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const plot = (row.plot ?? "").trim();
    const table = (row.table ?? "").trim().toLowerCase();
    const tree = (row.tree ?? "").trim();
    const species = (row.species ?? "").trim();
    if (!plot) errors.push(`Row ${line}: plot is blank.`);
    if (table !== "large" && table !== "small") errors.push(`Row ${line}: table must be "large" or "small", got "${row.table ?? ""}".`);
    if (!tree) errors.push(`Row ${line}: tree number is blank.`);
    const dbh = num(row.dbh_cm);
    const height = num(row.height_m);
    const vigor = num(row.vigor);
    const tco2 = num(row.plot_tco2_ha);
    for (const [name, val, raw] of [
      ["dbh_cm", dbh, row.dbh_cm],
      ["height_m", height, row.height_m],
      ["vigor", vigor, row.vigor],
      ["plot_tco2_ha", tco2, row.plot_tco2_ha],
    ] as const) {
      if (val === "bad") errors.push(`Row ${line}: ${name} "${raw}" is not a number.`);
    }
    if (errors.length) return;
    const t: ReconcileTree = {
      number: tree,
      species,
      table: table as "large" | "small",
      dbhCm: dbh as number | null,
      heightM: height as number | null,
      vigor: vigor as number | null,
    };
    (treesByPlot[plot] ??= []).push(t);
    if (typeof tco2 === "number") {
      if (plot in tco2ByPlot && tco2ByPlot[plot] !== tco2) {
        errors.push(`Row ${line}: plot ${plot} has two different plot_tco2_ha values (${tco2ByPlot[plot]} and ${tco2}).`);
      } else {
        tco2ByPlot[plot] = tco2;
      }
    }
  });

  if (errors.length) {
    const shown = errors.slice(0, MAX_ERRORS);
    if (errors.length > MAX_ERRORS) shown.push(`…and ${errors.length - MAX_ERRORS} more.`);
    return { ok: false, errors: shown };
  }
  return {
    ok: true,
    data: { treesByPlot, tco2ByPlot, plots: Object.keys(treesByPlot), rowCount: parsed.data.length },
  };
}
