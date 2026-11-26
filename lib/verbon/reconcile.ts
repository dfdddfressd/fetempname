// Port of compare_trees (Appendix A).
import { pyFloat } from "./pyfmt";
import type { Flag, Tree } from "./types";

// Placeholder tolerances from the spec. Configurable, not registry rules.
export const DBH_TOLERANCE_CM = 1.0;
export const HEIGHT_TOLERANCE_PCT = 10.0;

export type ReconcileTree = Pick<Tree, "number" | "species" | "dbhCm" | "heightM" | "vigor" | "table">;

export function oneDigitApart(a: number, b: number): boolean {
  const sa = a.toFixed(1);
  const sb = b.toFixed(1);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) diff++;
  return diff === 1;
}

// Python sorts (table, number) tuples by code point; compare the same way.
function cmpKey(a: [string, string], b: [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

export function compareTrees(
  plotNumber: string,
  developer: ReconcileTree[],
  verifier: ReconcileTree[],
  dbhTolCm = DBH_TOLERANCE_CM,
  heightTolPct = HEIGHT_TOLERANCE_PCT,
): Flag[] {
  const flags: Flag[] = [];
  const keyOf = (t: ReconcileTree) => `${t.table}\u0000${String(t.number)}`;
  const dev = new Map(developer.map((t) => [keyOf(t), t]));
  const ver = new Map(verifier.map((t) => [keyOf(t), t]));
  const keys = [...new Set([...dev.keys(), ...ver.keys()])]
    .map((k) => k.split("\u0000") as [string, string])
    .sort(cmpKey);

  for (const key of keys) {
    const T = `Plot ${plotNumber}, tree ${key[1]}`;
    const d = dev.get(key.join("\u0000"));
    const v = ver.get(key.join("\u0000"));
    if (d && !v) {
      flags.push({ level: "error", where: T, message: "In developer data but not found in the field." });
      continue;
    }
    if (v && !d) {
      flags.push({ level: "error", where: T, message: "Found in the field but missing from developer data." });
      continue;
    }
    if (!d || !v) continue;
    if (d.species.trim().toLowerCase() !== v.species.trim().toLowerCase()) {
      flags.push({ level: "error", where: T, message: `Species mismatch: developer ${d.species}, verifier ${v.species}.` });
    }
    if (d.dbhCm !== null && v.dbhCm !== null && Math.abs(d.dbhCm - v.dbhCm) > dbhTolCm) {
      let msg = `DBH mismatch: developer ${pyFloat(d.dbhCm)} cm, verifier ${pyFloat(v.dbhCm)} cm.`;
      if (oneDigitApart(d.dbhCm, v.dbhCm)) msg += " Differs by one digit: likely transcription error.";
      flags.push({ level: "error", where: T, message: msg });
    }
    if (d.heightM && v.heightM) {
      const pct = (Math.abs(d.heightM - v.heightM) / v.heightM) * 100;
      if (pct > heightTolPct) {
        flags.push({
          level: "warning",
          where: T,
          message: `Height differs ${pct.toFixed(0)}%: developer ${pyFloat(d.heightM)} m, verifier ${pyFloat(v.heightM)} m.`,
        });
      }
    }
    if (d.vigor && v.vigor && d.vigor >= 4 !== v.vigor >= 4) {
      flags.push({ level: "error", where: T, message: "Live/dead status differs between developer and verifier." });
    }
  }
  return flags;
}
