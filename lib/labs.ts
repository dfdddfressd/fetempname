import { parseDate, parseDepth } from "./dates";
import { findHeaderRow, isBlankRow, normHeader, parseGrid } from "./grid";
import type { AnalyteCode, LabMeasurement, LabSampleMeta, ParsedLabFile } from "./types";
import { isNonNumericResult, parseNumber, toCanonical } from "./units";

/**
 * Three fictional lab layouts, standing in for the file shapes teams reconcile by hand:
 * a wide one-row-per-sample cation table, a long one-row-per-analyte table, and a
 * certificate that starts with preamble rows. They are not formats from a named commercial lab.
 * Replace them when a pilot shares real exports.
 */

const ANALYTE_NAMES: Array<{ code: AnalyteCode; names: string[]; oxide?: boolean }> = [
  { code: "Ca", names: ["ca", "calcium"] },
  { code: "Mg", names: ["mg", "magnesium"] },
  { code: "Na", names: ["na", "sodium"] },
  { code: "K", names: ["k", "potassium"] },
  { code: "Ti", names: ["tio2", "titanium dioxide", "ti o2"], oxide: true },
  { code: "Ti", names: ["ti", "titanium"] },
  { code: "Al", names: ["al", "aluminum", "aluminium"] },
  { code: "Fe", names: ["fe", "iron"] },
  { code: "pH", names: ["ph", "ph 1:1 water", "ph 1:2 water", "ph water"] },
];

export function analyteFromLabel(label: string): { code: AnalyteCode; oxide: boolean } | null {
  const header = normHeader(label);
  if (!header) return null;
  for (const entry of ANALYTE_NAMES) {
    if (entry.names.some((name) => header === name || header.startsWith(`${name} `))) {
      return { code: entry.code, oxide: Boolean(entry.oxide) || header.includes("tio2") };
    }
  }
  return null;
}

function unitFromHeader(header: string, oxide: boolean): string {
  const text = header.toLowerCase();
  if (oxide || text.includes("tio2")) return "TiO2 %";
  if (text.includes("mg/kg")) return "mg/kg";
  if (text.includes("ug/g") || text.includes("µg/g")) return "ug/g";
  if (text.includes("g/kg")) return "g/kg";
  if (text.includes("ppm")) return "ppm";
  if (text.includes("%")) return "%";
  if (normHeader(header).startsWith("ph")) return "pH";
  return "";
}

function measurement(
  sampleId: string,
  analyte: AnalyteCode,
  originalValue: string,
  originalUnit: string,
  method: string | null,
  sourceRow: number,
  oxide = false,
): LabMeasurement | null {
  const shown = originalValue.trim();
  if (!shown) return null;

  if (isNonNumericResult(shown) || parseNumber(shown) === null) {
    return {
      sampleId,
      analyte,
      originalValue: shown,
      originalUnit,
      canonicalValue: null,
      canonicalUnit: null,
      method,
      error: `${analyte} was reported as "${shown}", which is not a number`,
      sourceRow,
    };
  }

  const value = parseNumber(shown) as number;
  const converted = toCanonical(analyte, value, originalUnit, oxide);
  if ("error" in converted) {
    return {
      sampleId,
      analyte,
      originalValue: shown,
      originalUnit,
      canonicalValue: null,
      canonicalUnit: null,
      method,
      error: converted.error,
      sourceRow,
    };
  }

  return {
    sampleId,
    analyte,
    originalValue: shown,
    originalUnit,
    canonicalValue: converted.value,
    canonicalUnit: converted.unit,
    method,
    error: null,
    sourceRow,
  };
}

function columnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader);
  return normalized.findIndex((header) => aliases.some((alias) => header === normHeader(alias)));
}

interface WideColumn {
  analyte: AnalyteCode;
  index: number;
  unit: string;
  oxide: boolean;
}

function wideColumns(headers: string[]): WideColumn[] {
  const columns: WideColumn[] = [];
  headers.forEach((header, index) => {
    const analyte = analyteFromLabel(header);
    if (!analyte) return;
    columns.push({
      analyte: analyte.code,
      index,
      unit: unitFromHeader(header, analyte.oxide),
      oxide: analyte.oxide,
    });
  });
  return columns;
}

function parseWide(
  rows: string[][],
  filename: string,
  formatId: "northline" | "fieldstone",
  formatLabel: string,
  headerIndex: number,
  sampleAliases: string[],
): ParsedLabFile {
  const headers = rows[headerIndex];
  const sampleColumn = columnIndex(headers, sampleAliases);
  const receivedColumn = columnIndex(headers, ["date received", "received", "received date", "date_received"]);
  const reportedColumn = columnIndex(headers, ["date reported", "reported", "report date", "analysis date", "analysis_date"]);
  const methodColumn = columnIndex(headers, ["method"]);
  const depthColumn = columnIndex(headers, ["depth", "depth cm", "depth (cm)"]);
  const columns = wideColumns(headers);
  const warnings: string[] = [];

  if (sampleColumn < 0) {
    return emptyFile(filename, formatId, formatLabel, ["The header row has no sample id column."]);
  }
  if (columns.length === 0) {
    warnings.push("The header row has no recognized analyte columns.");
  }
  for (const column of columns) {
    if (column.analyte !== "pH" && !column.unit) {
      warnings.push(`${headers[column.index]} has no unit in the header, so those cells were skipped.`);
    }
  }

  const measurements: LabMeasurement[] = [];
  const sampleMeta: LabSampleMeta[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (isBlankRow(row)) continue;
    const sampleId = row[sampleColumn]?.trim() ?? "";
    if (!sampleId) {
      warnings.push(`${formatLabel} row ${index + 1} has no sample id and was skipped.`);
      continue;
    }

    const receivedRaw = receivedColumn >= 0 ? row[receivedColumn] ?? "" : "";
    const reportedRaw = reportedColumn >= 0 ? row[reportedColumn] ?? "" : "";
    const receivedOn = receivedRaw ? parseDate(receivedRaw) : null;
    const reportedOn = reportedRaw ? parseDate(reportedRaw) : null;
    if (receivedRaw && !receivedOn) warnings.push(`${formatLabel} row ${index + 1} (${sampleId}) has a receipt date that could not be read (${receivedRaw}).`);
    if (reportedRaw && !reportedOn) warnings.push(`${formatLabel} row ${index + 1} (${sampleId}) has a report date that could not be read (${reportedRaw}).`);

    let depthMinCm: number | null = null;
    let depthMaxCm: number | null = null;
    if (depthColumn >= 0 && (row[depthColumn] ?? "").trim()) {
      const depth = parseDepth(row[depthColumn]);
      if (!depth) warnings.push(`${formatLabel} row ${index + 1} (${sampleId}) has a depth that could not be read.`);
      else {
        depthMinCm = depth.min;
        depthMaxCm = depth.max;
      }
    }

    sampleMeta.push({ sampleId, receivedOn, reportedOn, depthMinCm, depthMaxCm, sourceRow: index + 1 });

    const method = methodColumn >= 0 ? row[methodColumn]?.trim() || null : null;
    for (const column of columns) {
      if (column.analyte !== "pH" && !column.unit) continue;
      const raw = row[column.index] ?? "";
      const next = measurement(sampleId, column.analyte, raw, column.unit, method, index + 1, column.oxide);
      if (next) measurements.push(next);
    }
  }

  return { filename, formatId, formatLabel, recognized: true, measurements, sampleMeta, warnings };
}

function parseHelio(rows: string[][], filename: string, headerIndex: number): ParsedLabFile {
  const headers = rows[headerIndex];
  const sampleColumn = columnIndex(headers, ["sample no", "sample number", "sample id", "sample_no"]);
  const analyteColumn = columnIndex(headers, ["analyte", "parameter", "element"]);
  const resultColumn = columnIndex(headers, ["result", "value", "concentration"]);
  const unitColumn = columnIndex(headers, ["units", "unit"]);
  const methodColumn = columnIndex(headers, ["method"]);
  const reportedColumn = columnIndex(headers, ["analysis date", "date reported", "report date"]);
  const receivedColumn = columnIndex(headers, ["date received", "received", "received date"]);
  const formatLabel = "Helio Labs";
  const warnings: string[] = [];

  if (sampleColumn < 0 || analyteColumn < 0 || resultColumn < 0) {
    return emptyFile(filename, "helio", formatLabel, ["The long table is missing sample, analyte, or result columns."]);
  }

  const measurements: LabMeasurement[] = [];
  const metaBySample = new Map<string, LabSampleMeta>();

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (isBlankRow(row)) continue;
    const sampleId = row[sampleColumn]?.trim() ?? "";
    if (!sampleId) {
      warnings.push(`Helio Labs row ${index + 1} has no sample id and was skipped.`);
      continue;
    }

    const analyte = analyteFromLabel(row[analyteColumn] ?? "");
    if (!analyte) {
      const label = (row[analyteColumn] ?? "").trim();
      if (label) warnings.push(`Helio Labs row ${index + 1} (${sampleId}) has analyte "${label}", which this check does not map.`);
      continue;
    }

    const unit = unitColumn >= 0 ? row[unitColumn] ?? "" : "";
    const method = methodColumn >= 0 ? row[methodColumn]?.trim() || null : null;
    const next = measurement(
      sampleId,
      analyte.code,
      row[resultColumn] ?? "",
      unit,
      method,
      index + 1,
      analyte.oxide,
    );
    if (next) measurements.push(next);

    const receivedRaw = receivedColumn >= 0 ? row[receivedColumn] ?? "" : "";
    const reportedRaw = reportedColumn >= 0 ? row[reportedColumn] ?? "" : "";
    const receivedOn = receivedRaw ? parseDate(receivedRaw) : null;
    const reportedOn = reportedRaw ? parseDate(reportedRaw) : null;
    const existing = metaBySample.get(sampleId);
    metaBySample.set(sampleId, {
      sampleId,
      receivedOn: receivedOn ?? existing?.receivedOn ?? null,
      reportedOn: reportedOn ?? existing?.reportedOn ?? null,
      depthMinCm: existing?.depthMinCm ?? null,
      depthMaxCm: existing?.depthMaxCm ?? null,
      sourceRow: existing?.sourceRow ?? index + 1,
    });
  }

  return {
    filename,
    formatId: "helio",
    formatLabel,
    recognized: true,
    measurements,
    sampleMeta: [...metaBySample.values()],
    warnings,
  };
}

function emptyFile(
  filename: string,
  formatId: ParsedLabFile["formatId"],
  formatLabel: string,
  warnings: string[],
): ParsedLabFile {
  return {
    filename,
    formatId,
    formatLabel,
    recognized: formatId !== "unknown",
    measurements: [],
    sampleMeta: [],
    warnings,
  };
}

function isHelioHeader(headers: string[]): boolean {
  const hasSample = headers.some((header) => ["sample no", "sample number", "sample id"].includes(header));
  return hasSample && headers.includes("analyte") && (headers.includes("result") || headers.includes("value")) && (headers.includes("units") || headers.includes("unit"));
}

function isNorthlineHeader(headers: string[]): boolean {
  const hasSample = headers.some((header) => header === "client sample id" || header === "client sample");
  return hasSample && wideColumns(headers).length >= 2;
}

function isFieldstoneHeader(headers: string[]): boolean {
  const hasSample = headers.includes("sample number");
  return hasSample && wideColumns(headers).some((column) => column.oxide || column.analyte === "Ca");
}

export function parseLabFile(text: string, filename: string): ParsedLabFile {
  const rows = parseGrid(text);
  const helioAt = findHeaderRow(rows, isHelioHeader);
  if (helioAt >= 0) return parseHelio(rows, filename, helioAt);

  const northlineAt = findHeaderRow(rows, isNorthlineHeader);
  if (northlineAt >= 0) {
    return parseWide(rows, filename, "northline", "Northline Analytical", northlineAt, ["client sample id", "client sample"]);
  }

  const fieldstoneAt = findHeaderRow(rows, isFieldstoneHeader);
  if (fieldstoneAt >= 0) {
    return parseWide(rows, filename, "fieldstone", "Fieldstone Assay", fieldstoneAt, ["sample number", "sample no"]);
  }

  return emptyFile(filename, "unknown", "Unrecognized file", [
    "This file does not match a layout this version can read. The built-in layouts are a wide cation table, a long analyte table, and a certificate with preamble rows. They are examples, waiting on a real lab export from a pilot.",
  ]);
}
