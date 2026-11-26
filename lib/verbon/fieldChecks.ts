// Port of validate_plot (Appendix A). Rule constants and messages are identical.
import { pyFloat } from "./pyfmt";
import type { Flag, Plot } from "./types";

export const LARGE_MIN_DBH = 30.0;
export const SMALL_MIN_DBH = 5.0;
export const LARGE_RADIUS = 11.28;
export const SMALL_RADIUS = 5.64;
export const BORDERLINE_M = 0.3;
export const VIGOR: Record<number, string> = {
  1: "Very healthy",
  2: "Healthy",
  3: "Suppressed",
  4: "Dead, some decay",
  5: "Dead, advanced decay",
};
export const VIGOR_ES: Record<number, string> = {
  1: "Muy sano",
  2: "Sano",
  3: "Suprimido",
  4: "Muerto con algo de deterioro",
  5: "Muerto con deterioro avanzado",
};
export const MX_LAT: [number, number] = [14.0, 33.0];
export const MX_LON: [number, number] = [-118.5, -86.0];

const isBlank = (v: unknown) => v === null || v === undefined || v === "";

export function radiusFor(table: "large" | "small"): number {
  return table === "large" ? LARGE_RADIUS : SMALL_RADIUS;
}

export function validatePlot(p: Plot): Flag[] {
  const flags: Flag[] = [];
  const P = `Plot ${p.plotNumber}`;
  const header: Array<[string, string]> = [
    ["CAR ID", p.carId],
    ["plot number", p.plotNumber],
    ["date", p.date],
    ["group leader", p.leader],
  ];
  for (const [name, val] of header) {
    if (!String(val ?? "").trim()) flags.push({ level: "error", where: P, message: `Missing ${name}.` });
  }
  if (!p.technicians.some((t) => t.trim())) {
    flags.push({ level: "error", where: P, message: "At least one technician must be listed." });
  }
  if (p.lat === null || p.lon === null) {
    flags.push({ level: "error", where: P, message: "Missing GPS coordinates." });
  } else if (!(MX_LAT[0] <= p.lat && p.lat <= MX_LAT[1] && MX_LON[0] <= p.lon && p.lon <= MX_LON[1])) {
    if ((MX_LAT[0] <= p.lon && p.lon <= MX_LAT[1]) || (MX_LON[0] <= p.lat && p.lat <= MX_LON[1])) {
      flags.push({ level: "error", where: P, message: "Latitude and longitude look swapped." });
    } else if (p.lon > 0) {
      flags.push({ level: "error", where: P, message: "Longitude should be negative (west) in Mexico." });
    } else {
      flags.push({ level: "error", where: P, message: "Coordinates fall outside Mexico." });
    }
  }
  if (p.slopePct !== null && !(0 <= p.slopePct && p.slopePct <= 200)) {
    flags.push({ level: "warning", where: P, message: `Slope ${pyFloat(p.slopePct)}% is out of the usual range.` });
  }

  const seen = new Map<string, number>();
  for (const t of p.trees) {
    const T = `${P}, tree ${t.number}`;
    const key = `${t.table}\u0000${String(t.number)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) === 2) {
      flags.push({ level: "error", where: T, message: "Tree number is used twice in this plot." });
    }
    const required: Array<[string, unknown]> = [
      ["species", t.species],
      ["diameter", t.dbhCm],
      ["vigor", t.vigor],
    ];
    for (const [name, val] of required) {
      if (isBlank(val)) flags.push({ level: "error", where: T, message: `Missing ${name}.` });
    }
    if (t.dbhCm !== null) {
      if (t.table === "large" && t.dbhCm < LARGE_MIN_DBH) {
        flags.push({
          level: "error",
          where: T,
          message: `DBH ${pyFloat(t.dbhCm)} cm is under 30 cm: belongs in the small-tree table.`,
        });
      }
      if (t.table === "small" && !(SMALL_MIN_DBH <= t.dbhCm && t.dbhCm < LARGE_MIN_DBH)) {
        flags.push({
          level: "error",
          where: T,
          message: `DBH ${pyFloat(t.dbhCm)} cm is outside 5-30 cm: wrong table, or not measurable.`,
        });
      }
    }
    if (t.distanceM !== null) {
      const r = radiusFor(t.table);
      if (t.distanceM > r) {
        flags.push({
          level: "error",
          where: T,
          message: `Distance ${pyFloat(t.distanceM)} m is outside the ${r} m plot radius.`,
        });
      } else if (t.distanceM > r - BORDERLINE_M) {
        flags.push({
          level: "warning",
          where: T,
          message: `Borderline tree (${pyFloat(t.distanceM)} m of ${r} m): re-measure horizontal distance.`,
        });
      }
    } else {
      flags.push({ level: "error", where: T, message: "Missing distance to plot center." });
    }
    if (t.azimuthDeg !== null && !(0 <= t.azimuthDeg && t.azimuthDeg <= 360)) {
      flags.push({ level: "error", where: T, message: `Azimuth ${pyFloat(t.azimuthDeg)} is not 0-360 degrees.` });
    }
    if (t.vigor !== null && !(t.vigor in VIGOR)) {
      flags.push({ level: "error", where: T, message: `Vigor ${t.vigor} is not a valid code (1-5).` });
    }
    if (t.heightM !== null && t.crownM !== null && t.crownM > t.heightM) {
      flags.push({ level: "error", where: T, message: "Crown length is greater than total height." });
    }
    if (t.dbhCm && t.heightM) {
      const ratio = t.heightM / (t.dbhCm / 100);
      if (ratio > 150 || ratio < 10) {
        flags.push({
          level: "warning",
          where: T,
          message: `Height ${pyFloat(t.heightM)} m looks unusual for DBH ${pyFloat(t.dbhCm)} cm: check for a typo.`,
        });
      }
    }
    if ((t.vigor === 4 || t.vigor === 5) && t.increment5yMm !== null && t.increment5yMm !== undefined && t.increment5yMm !== 0) {
      flags.push({ level: "warning", where: T, message: "Dead tree has a 5-year growth increment recorded." });
    }
    const defects: Array<[string, number | null | undefined]> = [
      ["upper", t.defectUpper],
      ["middle", t.defectMiddle],
      ["lower", t.defectLower],
    ];
    for (const [name, val] of defects) {
      if (val !== null && val !== undefined && !(0 <= val && val <= 100)) {
        flags.push({ level: "error", where: T, message: `Defect (${name}) ${pyFloat(val)}% must be 0-100%.` });
      }
    }
  }
  return flags;
}
