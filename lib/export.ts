import { csvNumber } from "./format";
import { toCsv } from "./grid";
import { DEPTH_MAX, DEPTH_MIN, SOIL_PROPERTIES } from "./schema";
import type { AnalyteCode, ExportFile, HarmonizedSample, PipelineResult } from "./types";
import { ANALYTES } from "./types";

const MASS_COLUMNS: AnalyteCode[] = ["Ca", "Mg", "Na", "K", "Ti", "Al", "Fe"];

function blank(value: string | number | null | undefined): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function withheld(sample: HarmonizedSample): string {
  return ANALYTES.filter((analyte) => {
    const reading = sample.readings[analyte];
    return reading && reading.included === null;
  }).join(" ");
}

function issueKinds(result: PipelineResult, sampleId: string): string {
  return result.issues
    .filter((item) => item.sampleId === sampleId)
    .map((item) => item.kind)
    .join(" ");
}

export function buildExports(result: PipelineResult): ExportFile[] {
  return [
    {
      id: "harmonized",
      filename: "harmonized-samples.csv",
      label: "Harmonized dataset",
      description: "One row per sample. Conflicting analytes are blank instead of averaged.",
      csv: harmonizedCsv(result),
    },
    {
      id: "certify",
      filename: "certify-oriented-soil.csv",
      label: "Registry-shaped measurements",
      description:
        "One row per measurement, using public Certify soil quantity kinds. Not a project template upload.",
      csv: certifyCsv(result),
    },
    {
      id: "locations",
      filename: "measurement-locations.csv",
      label: "Measurement locations",
      description: "name, reference_id, latitude, longitude, matching the public Certify location CSV.",
      csv: locationsCsv(result),
    },
    {
      id: "audit",
      filename: "lab-measurements.csv",
      label: "Lab audit trail",
      description: "Every lab value, with its original unit and whether it was included.",
      csv: auditCsv(result),
    },
    {
      id: "issues",
      filename: "quality-report.csv",
      label: "Quality report",
      description: "The same findings as the on-screen report.",
      csv: issuesCsv(result),
    },
  ];
}

function harmonizedCsv(result: PipelineResult): string {
  const header = [
    "supplier_reference_id",
    "in_manifest",
    "farm",
    "plot",
    "plot_type",
    "depth_min_cm",
    "depth_max_cm",
    "measurement_date",
    "collector",
    "measurement_location_reference_id",
    "latitude",
    "longitude",
    "labs",
    ...MASS_COLUMNS.map((analyte) => `${analyte}_mg_kg`),
    "pH",
    "withheld_analytes",
    "issue_kinds",
  ];
  const rows = result.samples.map((sample) => [
    sample.sampleId,
    sample.inManifest ? "yes" : "no",
    blank(sample.farm),
    blank(sample.plot),
    sample.plotType === "unknown" ? null : sample.plotType,
    sample.depthMinCm,
    sample.depthMaxCm,
    blank(sample.collectedOn),
    blank(sample.collector),
    blank(sample.locationId),
    sample.latitude,
    sample.longitude,
    sample.labs.join("; "),
    ...MASS_COLUMNS.map((analyte) => {
      const value = sample.readings[analyte]?.included;
      return value === null || value === undefined ? null : csvNumber(value);
    }),
    sample.readings.pH?.included ?? null,
    blank(withheld(sample)),
    blank(issueKinds(result, sample.sampleId)),
  ]);
  return toCsv([header, ...rows]);
}

function certifyCsv(result: PipelineResult): string {
  const header = [
    "supplier_reference_id",
    "measurement_location_reference_id",
    "measurement_date",
    "quantity_kind",
    "qualifier",
    "value",
    "unit",
  ];
  const rows: Array<Array<string | number | null>> = [];
  for (const sample of result.samples) {
    if (!sample.inManifest) continue;
    const shared = [sample.sampleId, blank(sample.locationId), blank(sample.collectedOn)];
    if (sample.depthMinCm !== null) {
      rows.push([...shared, DEPTH_MIN.quantityKind, DEPTH_MIN.qualifier, sample.depthMinCm, DEPTH_MIN.unit]);
    }
    if (sample.depthMaxCm !== null) {
      rows.push([...shared, DEPTH_MAX.quantityKind, DEPTH_MAX.qualifier, sample.depthMaxCm, DEPTH_MAX.unit]);
    }
    for (const analyte of ANALYTES) {
      const value = sample.readings[analyte]?.included;
      if (value === null || value === undefined) continue;
      const property = SOIL_PROPERTIES[analyte];
      rows.push([
        ...shared,
        property.quantityKind,
        property.qualifier || null,
        csvNumber(value),
        property.canonicalUnit,
      ]);
    }
  }
  return toCsv([header, ...rows]);
}

function locationsCsv(result: PipelineResult): string {
  const header = ["name", "reference_id", "latitude", "longitude"];
  const seen = new Set<string>();
  const rows: Array<Array<string | number | null>> = [];
  for (const sample of result.samples) {
    if (!sample.inManifest) continue;
    const reference = sample.locationId || sample.sampleId;
    if (seen.has(reference)) continue;
    seen.add(reference);
    const name = [sample.farm, sample.plot].filter(Boolean).join(" / ") || reference;
    rows.push([name, reference, sample.latitude, sample.longitude]);
  }
  return toCsv([header, ...rows]);
}

function auditStatus(sample: HarmonizedSample, analyte: AnalyteCode, error: string | null): string {
  if (!sample.inManifest) return "not_on_manifest";
  if (error) return "withheld_unreadable";
  const reading = sample.readings[analyte];
  if (reading?.conflict) return "withheld_conflict";
  if (reading?.included !== null && reading?.included !== undefined) return "included";
  return "withheld_unreadable";
}

function auditCsv(result: PipelineResult): string {
  const header = [
    "supplier_reference_id",
    "in_manifest",
    "lab",
    "quantity_kind",
    "qualifier",
    "canonical_value",
    "canonical_unit",
    "original_value",
    "original_unit",
    "status",
  ];
  const rows: Array<Array<string | number | null>> = [];
  for (const sample of result.samples) {
    for (const analyte of ANALYTES) {
      const reading = sample.readings[analyte];
      if (!reading) continue;
      const property = SOIL_PROPERTIES[analyte];
      for (const contribution of reading.contributions) {
        rows.push([
          sample.sampleId,
          sample.inManifest ? "yes" : "no",
          contribution.lab,
          property.quantityKind,
          property.qualifier || null,
          contribution.canonicalValue === null ? null : csvNumber(contribution.canonicalValue),
          contribution.canonicalValue === null ? null : property.canonicalUnit,
          contribution.originalValue,
          contribution.originalUnit,
          auditStatus(sample, analyte, contribution.error),
        ]);
      }
    }
  }
  return toCsv([header, ...rows]);
}

function issuesCsv(result: PipelineResult): string {
  const header = ["id", "severity", "kind", "sample_id", "message", "detail"];
  const rows = result.issues.map((item) => [
    item.id,
    item.severity,
    item.kind,
    blank(item.sampleId),
    item.message,
    item.detail,
  ]);
  return toCsv([header, ...rows]);
}
