import { describe, expect, it } from "vitest";
import { parseDeveloperCsv } from "./developerCsv";
import { blankTree, checkDraft, plotToDraft } from "./draft";
import { validatePlot } from "./fieldChecks";
import { findingsCsv } from "./findings";
import { compareTrees } from "./reconcile";
import { confidenceDeduction, SequentialSampling } from "./sampling";
import {
  DEMO_AREA,
  DEMO_COMPLETED,
  DEMO_DEVELOPER_CSV,
  DEMO_DEVELOPER_TCO2,
  DEMO_PLOT_047_FINAL_TREES,
  DEMO_PLOT_047_START,
} from "./seed";
import type { Plot, Tree, TreeTable } from "./types";

// Appendix B helper: tree(num, sp, dbh, h, crown, vigor, az, dist, table="large", inc=None)
function tree(
  num: string, sp: string, dbh: number, h: number, crown: number, vigor: number, az: number, dist: number,
  table: TreeTable = "large", inc: number | null = null,
): Tree {
  return {
    number: num, species: sp, dbhCm: dbh, heightM: h, crownM: crown, vigor, azimuthDeg: az, distanceM: dist,
    increment5yMm: inc, defectUpper: 0, defectMiddle: 0, defectLower: 0, table,
  };
}

function plot(
  carId: string, plotNumber: string, date: string, leader: string, technicians: string[],
  slopePct: number | null, aspect: string | null, lat: number | null, lon: number | null, trees: Tree[] = [],
): Plot {
  return { carId, plotNumber, date, leader, technicians, slopePct, aspect, lat, lon, trees, notes: "" };
}

describe("Appendix B 1: field form", () => {
  it("finds exactly 5 errors and 1 warning", () => {
    const p = plot("CAR-0000", "047", "2026-11-20", "JV", ["AB", ""], 22, "NE", 19.43, -101.95, [
      tree("1", "Pinus", 34.2, 21.0, 8.0, 2, 120, 6.1),
      tree("2", "Pinus", 23.0, 18.0, 7.0, 2, 200, 9.0), // under 30 in large table
      tree("3", "Quercus", 41.0, 15.0, 17.0, 1, 75, 12.4), // outside radius; crown > height
      tree("A", "Pinus", 12.5, 9.0, 4.0, 5, 30, 3.2, "small", 4), // dead with increment (warning)
      tree("A", "Arbutus", 8.0, 6.0, 3.0, 2, 400, 2.0, "small"), // duplicate number; bad azimuth
    ]);
    const flags = validatePlot(p);
    expect(flags.filter((f) => f.level === "error")).toHaveLength(5);
    expect(flags.filter((f) => f.level === "warning")).toHaveLength(1);
  });

  it("detects swapped latitude and longitude", () => {
    const swapped = plot("CAR-0000", "048", "2026-11-20", "JV", ["AB"], 10, "N", -101.95, 19.43);
    expect(validatePlot(swapped).some((f) => f.message.includes("swapped"))).toBe(true);
  });
});

describe("Appendix B 2: reconciliation", () => {
  it("flags the transcription error, missing tree and species mismatch only", () => {
    const dev = [
      tree("1", "Pinus", 34.2, 21.0, 8, 2, 120, 6.1),
      tree("2", "Pinus", 13.0, 18.0, 7, 2, 200, 4.0, "small"),
      tree("3", "Pinus", 41.0, 15.0, 6, 1, 75, 10.0),
      tree("4", "Quercus", 30.5, 14.0, 5, 2, 10, 3.0),
    ];
    const ver = [
      tree("1", "Pinus", 34.0, 21.5, 8, 2, 120, 6.1),
      tree("2", "Pinus", 23.0, 18.0, 7, 2, 200, 4.0, "small"),
      tree("3", "Quercus", 41.0, 15.0, 6, 1, 75, 10.0),
    ];
    const rec = compareTrees("047", dev, ver);
    expect(rec.some((f) => f.message.includes("transcription"))).toBe(true);
    expect(rec.some((f) => f.message.includes("not found in the field"))).toBe(true);
    expect(rec.some((f) => f.message.includes("Species mismatch"))).toBe(true);
    expect(rec).toHaveLength(3);
  });
});

describe("Appendix B 3: sequential sampling", () => {
  it("passes at n = 8 for 1 stratum, 1,500 ha", () => {
    const ss = new SequentialSampling(180.0, 1, 1500);
    expect(ss.minPlots).toBe(8);
    expect(Math.abs(ss.k - 11.91)).toBeLessThan(0.01);
    const data: Array<[number, number, number]> = [
      [12, 182, 178], [33, 175, 180], [7, 190, 186], [51, 168, 171], [20, 185, 181],
      [44, 177, 179], [3, 181, 184], [61, 179, 176],
    ];
    data.forEach(([num, p, v], i) => {
      const r = ss.addPlot(String(num), p, v);
      expect(r.test).toBe("Pass");
      expect(r.passesInSequence).toBe(i + 1);
      expect(ss.passed).toBe(i === 7);
    });
  });

  it("resets the run on a non-passing plot", () => {
    const ss2 = new SequentialSampling(180.0, 1, 1500);
    let r = ss2.addPlot("1", 182, 178);
    for (const [num, p, v] of [[2, 175, 180], [3, 230, 160]] as const) r = ss2.addPlot(String(num), p, v);
    expect(r.test).not.toBe("Pass");
    expect(r.passesInSequence).toBe(0);
    expect(ss2.passed).toBe(false);
    expect(ss2.plotsStillNeeded()).toBe(8);
  });
});

describe("Appendix B 4: confidence deduction", () => {
  it("matches the carbon spreadsheet row 15", () => {
    expect(confidenceDeduction(0.0438, 1)).toBe(0.0);
    expect(Math.abs(confidenceDeduction(0.08, 1) - 0.03)).toBeLessThan(1e-9);
    expect(confidenceDeduction(0.25, 1)).toBe(1.0);
  });
});

describe("demo script", () => {
  const base = { ...DEMO_PLOT_047_START };

  it("opens plot 047 with no errors", () => {
    expect(validatePlot(base)).toEqual([]);
  });

  it("flags tree B in the large table, and tree 3 outside the radius", () => {
    const typed = {
      ...base,
      trees: [
        base.trees[0],
        { ...DEMO_PLOT_047_FINAL_TREES[2], table: "large" as const },
        { ...DEMO_PLOT_047_FINAL_TREES[1], distanceM: 12.4 },
      ],
    };
    const messages = validatePlot(typed).map((f) => `${f.where}: ${f.message}`);
    expect(messages).toEqual([
      "Plot 047, tree B: DBH 23.0 cm is under 30 cm: belongs in the small-tree table.",
      "Plot 047, tree 3: Distance 12.4 m is outside the 11.28 m plot radius.",
    ]);
  });

  it("ends with a clean plot 047", () => {
    expect(validatePlot({ ...base, trees: DEMO_PLOT_047_FINAL_TREES })).toEqual([]);
  });

  it("passes sequential sampling when plot 047 is the 8th plot", () => {
    const ss = new SequentialSampling(DEMO_AREA.developerMeanTco2Ha, DEMO_AREA.strata, DEMO_AREA.hectares);
    for (const c of DEMO_COMPLETED) ss.addPlot(c.plotNumber, DEMO_DEVELOPER_TCO2[c.plotNumber], c.verifierTco2Ha);
    expect(ss.passed).toBe(false);
    expect(ss.plotsStillNeeded()).toBe(1);
    const r = ss.addPlot("047", DEMO_DEVELOPER_TCO2["047"], 176);
    expect(r.n).toBe(8);
    expect(r.passesInSequence).toBe(8);
    expect(ss.passed).toBe(true);
    expect(ss.plotsStillNeeded()).toBe(0);
  });

  it("reconciles the seeded developer CSV against the final plot 047", () => {
    const parsed = parseDeveloperCsv(DEMO_DEVELOPER_CSV);
    if (!parsed.ok) throw new Error(parsed.errors.join(" "));
    expect(parsed.data.tco2ByPlot["047"]).toBe(179);
    const rec = compareTrees("047", parsed.data.treesByPlot["047"], DEMO_PLOT_047_FINAL_TREES);
    expect(rec.map((f) => `${f.where}: ${f.message}`)).toEqual([
      "Plot 047, tree 3: Species mismatch: developer Pinus, verifier Quercus.",
      "Plot 047, tree 4: In developer data but not found in the field.",
      "Plot 047, tree B: DBH mismatch: developer 13.0 cm, verifier 23.0 cm. Differs by one digit: likely transcription error.",
    ]);
    expect(findingsCsv(rec).split("\r\n")[0]).toBe("plot,tree,level,message");
  });
});

describe("developer CSV import", () => {
  it("reports missing columns readably", () => {
    const r = parseDeveloperCsv("plot,tree,species\n047,1,Pinus\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toBe("Missing columns: table, dbh_cm, height_m, vigor, plot_tco2_ha.");
  });

  it("reports non-numeric values with the row number", () => {
    const r = parseDeveloperCsv("plot,table,tree,species,dbh_cm,height_m,vigor,plot_tco2_ha\n047,large,1,Pinus,abc,21,2,180\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('Row 2: dbh_cm "abc" is not a number.');
  });

  it("rejects an empty file and a bad table name", () => {
    expect(parseDeveloperCsv("").ok).toBe(false);
    const r = parseDeveloperCsv("plot,table,tree,species,dbh_cm,height_m,vigor,plot_tco2_ha\n047,medium,1,Pinus,34,21,2,180\n");
    expect(r.ok).toBe(false);
  });
});

describe("field form draft", () => {
  it("attributes every validatePlot flag to the header or to its tree", () => {
    const d = plotToDraft({
      ...DEMO_PLOT_047_START,
      lat: null,
      trees: [
        ...DEMO_PLOT_047_FINAL_TREES,
        { ...DEMO_PLOT_047_FINAL_TREES[2], dbhCm: 40 }, // second small "B": duplicate + wrong table
      ],
    });
    const check = checkDraft(d);
    expect(check.all.map((f) => f.message).sort()).toEqual(validatePlot(check.plot).map((f) => f.message).sort());
    expect(check.header.map((f) => f.field)).toEqual(["coords"]);
    const last = d.trees[3].id;
    expect(check.byTree[last].map((f) => f.field)).toEqual(["number", "dbhCm"]);
    expect(check.byTree[d.trees[2].id]).toEqual([]);
  });

  it("reports typed values that are not numbers, and accepts a decimal comma", () => {
    const d = plotToDraft(DEMO_PLOT_047_START);
    d.trees[0].values.dbhCm = "3x";
    d.trees[0].values.heightM = "21,5";
    const check = checkDraft(d);
    expect(check.byTree[d.trees[0].id].map((f) => f.message)).toContain('DBH "3x" is not a number.');
    expect(check.plot.trees[0].heightM).toBe(21.5);
    expect(check.errors).toBeGreaterThan(0);
  });

  it("suggests the next free tree number per table", () => {
    const trees = plotToDraft({ ...DEMO_PLOT_047_START, trees: DEMO_PLOT_047_FINAL_TREES }).trees;
    expect(blankTree("large", trees).number).toBe("2");
    expect(blankTree("small", trees).number).toBe("A");
  });
});
