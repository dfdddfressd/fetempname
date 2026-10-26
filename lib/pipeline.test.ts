import { describe, expect, it } from "vitest";
import {
  DEMO_FIELDSTONE_FILENAME,
  DEMO_HELIO_FILENAME,
  DEMO_LABS,
  DEMO_MANIFEST,
  DEMO_MANIFEST_FILENAME,
  DEMO_NORTHLINE_FILENAME,
} from "./demoData";
import { buildExports } from "./export";
import { parseLabFile } from "./labs";
import { runPipeline } from "./pipeline";
import { TI_FRACTION_OF_TIO2 } from "./schema";
import { toCanonical } from "./units";

function demoResult() {
  return runPipeline({
    manifestFilename: DEMO_MANIFEST_FILENAME,
    manifestText: DEMO_MANIFEST,
    labs: DEMO_LABS,
  });
}

describe("unit conversion", () => {
  it("treats ppm as mg/kg and percent as a mass fraction", () => {
    expect(toCanonical("Ca", 9050, "ppm")).toEqual({ value: 9050, unit: "mg/kg" });
    expect(toCanonical("Al", 4.9, "%")).toEqual({ value: 49000, unit: "mg/kg" });
  });

  it("converts TiO2 percent to elemental titanium", () => {
    const converted = toCanonical("Ti", 0.59, "TiO2 %", true);
    expect(converted).toEqual({ value: (0.59 / 100) * TI_FRACTION_OF_TIO2 * 1_000_000, unit: "mg/kg" });
  });

  it("rejects solution units on a soil result", () => {
    expect(toCanonical("K", 12.4, "mg/L")).toMatchObject({ error: expect.stringContaining("mg/L") });
  });
});

describe("lab layouts", () => {
  it("recognizes the three example files", () => {
    const formats = DEMO_LABS.map((file) => parseLabFile(file.text, file.filename).formatId);
    expect(formats).toEqual(["northline", "helio", "fieldstone"]);
  });
});

describe("demo project", () => {
  const result = demoResult();

  it("keeps eight manifest samples and the orphan lab id", () => {
    expect(result.uniqueManifestSamples).toBe(8);
    expect(result.manifestRowCount).toBe(9);
    expect(result.samples.map((sample) => sample.sampleId)).toEqual([
      "NF-001",
      "NF-002",
      "NF-003",
      "NF-004",
      "NF-005",
      "NF-006",
      "NF-007",
      "NF-008",
      "HX-999",
    ]);
  });

  it("flags the planted problems and no others", () => {
    const summarized = result.issues.map((item) => `${item.severity}:${item.kind}:${item.sampleId ?? "-"}`);
    expect(summarized).toEqual([
      "error:missing_sample:NF-007",
      "error:cross_lab:NF-001",
      "error:format:NF-006",
      "error:format:NF-006",
      "error:custody:NF-008",
      "warning:orphan_result:HX-999",
      "warning:duplicate:NF-003",
      "warning:outlier:NF-004",
      "warning:custody:NF-004",
    ]);
    const calcium = result.issues.find((item) => item.kind === "cross_lab");
    expect(calcium?.detail).toContain("Northline Analytical reported 4,120 mg/kg");
    expect(calcium?.detail).toContain("9050 ppm (9,050 mg/kg)");
    expect(result.issues.find((item) => item.kind === "outlier")?.detail).toContain("6 samples");
  });

  it("converts agreeing titanium values from percent and from TiO2", () => {
    const nf001 = result.samples.find((sample) => sample.sampleId === "NF-001");
    const titanium = nf001?.readings.Ti;
    expect(titanium?.conflict).toBe(false);
    expect(titanium?.included).toBeCloseTo((3680 + 3700) / 2, 5);

    const nf002 = result.samples.find((sample) => sample.sampleId === "NF-002");
    expect(nf002?.readings.Ti?.conflict).toBe(false);
    expect(nf002?.readings.Ti?.included).toBeCloseTo((3510 + (0.59 / 100) * TI_FRACTION_OF_TIO2 * 1_000_000) / 2, 4);
  });

  it("leaves conflicting calcium out of the registry-shaped export and keeps the audit trail", () => {
    const exports = buildExports(result);
    const certify = exports.find((file) => file.id === "certify")?.csv ?? "";
    const audit = exports.find((file) => file.id === "audit")?.csv ?? "";
    const harmonized = exports.find((file) => file.id === "harmonized")?.csv ?? "";

    expect(certify.split("\n")[0]).toBe(
      "supplier_reference_id,measurement_location_reference_id,measurement_date,quantity_kind,qualifier,value,unit",
    );
    expect(certify).not.toMatch(/NF-001,LOC-A1-01,2026-03-02,MASS_FRACTION,ELEMENT_CA,/);
    expect(certify).toMatch(/NF-004,LOC-A2-02,2026-03-03,MASS_FRACTION,ELEMENT_CA,85000,mg\/kg/);
    expect(certify).not.toContain("HX-999");

    expect(audit).toContain("NF-001,yes,Northline Analytical,MASS_FRACTION,ELEMENT_CA,4120,mg/kg,4120,mg/kg,withheld_conflict");
    expect(audit).toContain("NF-001,yes,Helio Labs,MASS_FRACTION,ELEMENT_CA,9050,mg/kg,9050,ppm,withheld_conflict");
    expect(harmonized).toContain("NF-001,yes,North Farm,A1,treatment");
    const nf001 = harmonized.split("\n").find((line) => line.startsWith("NF-001,"));
    const cells = nf001?.split(",") ?? [];
    expect(cells[13]).toBe("");
    expect(cells[21]).toBe("Ca");
  });

  it("exports each measurement location once, with the public column names", () => {
    const locations = buildExports(result).find((file) => file.id === "locations")?.csv ?? "";
    expect(locations.split("\n")[0]).toBe("name,reference_id,latitude,longitude");
    const references = locations
      .split("\n")
      .slice(1)
      .map((line) => line.split(",")[1]);
    expect(references).toEqual(["LOC-A1-01", "LOC-A2-01", "LOC-A2-02", "LOC-B1-01", "LOC-B2-01", "LOC-B2-02"]);
  });

  it("names the files the checks ran on", () => {
    expect(result.labs.map((lab) => lab.filename)).toEqual([
      DEMO_NORTHLINE_FILENAME,
      DEMO_HELIO_FILENAME,
      DEMO_FIELDSTONE_FILENAME,
    ]);
  });
});

describe("manifest conflicts", () => {
  it("treats disagreeing duplicate rows as an error and keeps the first", () => {
    const result = runPipeline({
      manifestFilename: "manifest.csv",
      manifestText: `sample_id,farm,plot,plot_type,collected_date,collector
S-1,North,A,treatment,2026-04-01,Ada
S-1,South,A,control,2026-04-02,Bea
`,
      labs: [
        {
          filename: "lab.csv",
          text: `Client Sample ID,Date Received,Ca (mg/kg),pH
S-1,2026-04-03,1000,6.2
`,
        },
      ],
    });
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].farm).toBe("North");
    expect(result.issues.some((item) => item.kind === "duplicate" && item.severity === "error")).toBe(true);
  });
});
