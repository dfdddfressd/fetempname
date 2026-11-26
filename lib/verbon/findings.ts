import Papa from "papaparse";
import type { Flag } from "./types";

// "Plot 047, tree B" -> { plot: "047", tree: "B" }
export function splitWhere(where: string): { plot: string; tree: string } {
  const m = /^Plot (.*?)(?:, tree (.*))?$/.exec(where);
  return { plot: m?.[1] ?? where, tree: m?.[2] ?? "" };
}

export function findingsCsv(flags: Flag[]): string {
  return Papa.unparse({
    fields: ["plot", "tree", "level", "message"],
    data: flags.map((f) => {
      const { plot, tree } = splitWhere(f.where);
      return [plot, tree, f.level, f.message];
    }),
  });
}

export function findingsText(flags: Flag[], title: string): string {
  const lines = flags.map((f, i) => `${i + 1}. [${f.level === "error" ? "Error" : "Check"}] ${f.where}: ${f.message}`);
  return [`Draft findings: ${title}`, "", ...lines].join("\n");
}
