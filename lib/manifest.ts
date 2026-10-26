import { parseDate, parseDepth } from "./dates";
import { indexByAlias, isBlankRow, normHeader, parseGrid, findHeaderRow } from "./grid";
import type { ManifestSample, ParsedManifest, PlotType } from "./types";

const HEADER_ALIASES = {
  sampleId: ["sample id", "sample_id", "client sample id", "supplier reference id", "supplier_reference_id"],
  farm: ["farm", "farm name", "site"],
  plot: ["plot", "plot id", "field", "field id"],
  plotType: ["plot type", "plot_type"],
  depthTop: ["depth top cm", "depth_top_cm", "depth min cm", "top depth cm", "minimum depth"],
  depthBottom: ["depth bottom cm", "depth_bottom_cm", "depth max cm", "bottom depth cm", "maximum depth"],
  depth: ["depth", "depth cm", "depth (cm)"],
  collected: ["collected date", "collected_date", "collection date", "date collected", "measurement date", "measurement_date"],
  collector: ["collector", "collected by", "sampler"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon", "long"],
  locationId: ["location id", "location_id", "measurement location reference id", "measurement_location_reference_id"],
} as const;

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return row[index]?.trim() ?? "";
}

export function parsePlotType(raw: string): PlotType {
  const value = raw.trim().toLowerCase();
  if (value === "control" || value === "ctrl") return "control";
  if (value === "treatment" || value === "treated") return "treatment";
  if (value === "deployment") return "deployment";
  if (value === "research") return "research";
  return "unknown";
}

function parseCoordinate(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : null;
}

export function parseManifest(text: string, filename: string): ParsedManifest {
  const rows = parseGrid(text);
  const warnings: string[] = [];
  const headerIndex = findHeaderRow(rows, (headers) =>
    HEADER_ALIASES.sampleId.some((alias) => headers.includes(normHeader(alias))),
  );

  if (headerIndex < 0) {
    return {
      filename,
      samples: [],
      warnings: [
        "No sample id column was found. The manifest needs a header such as sample_id.",
      ],
    };
  }

  const headers = rows[headerIndex];
  const columns = {
    sampleId: indexByAlias(headers, [...HEADER_ALIASES.sampleId]),
    farm: indexByAlias(headers, [...HEADER_ALIASES.farm]),
    plot: indexByAlias(headers, [...HEADER_ALIASES.plot]),
    plotType: indexByAlias(headers, [...HEADER_ALIASES.plotType]),
    depthTop: indexByAlias(headers, [...HEADER_ALIASES.depthTop]),
    depthBottom: indexByAlias(headers, [...HEADER_ALIASES.depthBottom]),
    depth: indexByAlias(headers, [...HEADER_ALIASES.depth]),
    collected: indexByAlias(headers, [...HEADER_ALIASES.collected]),
    collector: indexByAlias(headers, [...HEADER_ALIASES.collector]),
    latitude: indexByAlias(headers, [...HEADER_ALIASES.latitude]),
    longitude: indexByAlias(headers, [...HEADER_ALIASES.longitude]),
    locationId: indexByAlias(headers, [...HEADER_ALIASES.locationId]),
  };

  const samples: ManifestSample[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (isBlankRow(row)) continue;
    const sampleId = cell(row, columns.sampleId);
    if (!sampleId) {
      warnings.push(`Manifest row ${index + 1} has no sample id and was skipped.`);
      continue;
    }

    let depthMinCm: number | null = null;
    let depthMaxCm: number | null = null;
    if (columns.depthTop >= 0 || columns.depthBottom >= 0) {
      const top = cell(row, columns.depthTop);
      const bottom = cell(row, columns.depthBottom);
      depthMinCm = top ? Number(top) : null;
      depthMaxCm = bottom ? Number(bottom) : null;
      if (top && !Number.isFinite(depthMinCm)) depthMinCm = null;
      if (bottom && !Number.isFinite(depthMaxCm)) depthMaxCm = null;
      if ((top && depthMinCm === null) || (bottom && depthMaxCm === null)) {
        warnings.push(`Manifest row ${index + 1} (${sampleId}) has a depth that is not a number.`);
      }
    } else if (columns.depth >= 0 && cell(row, columns.depth)) {
      const depth = parseDepth(cell(row, columns.depth));
      if (!depth) {
        warnings.push(`Manifest row ${index + 1} (${sampleId}) has a depth that could not be read.`);
      } else {
        depthMinCm = depth.min;
        depthMaxCm = depth.max;
      }
    }

    const collectedRaw = cell(row, columns.collected);
    const collectedOn = collectedRaw ? parseDate(collectedRaw) : null;
    if (collectedRaw && !collectedOn) {
      warnings.push(`Manifest row ${index + 1} (${sampleId}) has a collection date that could not be read (${collectedRaw}).`);
    }

    const latitudeRaw = cell(row, columns.latitude);
    const longitudeRaw = cell(row, columns.longitude);
    const latitude = parseCoordinate(latitudeRaw);
    const longitude = parseCoordinate(longitudeRaw);
    if (latitudeRaw && latitude === null) {
      warnings.push(`Manifest row ${index + 1} (${sampleId}) has a latitude that is not a number.`);
    }
    if (longitudeRaw && longitude === null) {
      warnings.push(`Manifest row ${index + 1} (${sampleId}) has a longitude that is not a number.`);
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      warnings.push(`Manifest row ${index + 1} (${sampleId}) has a latitude outside -90 to 90.`);
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      warnings.push(`Manifest row ${index + 1} (${sampleId}) has a longitude outside -180 to 180.`);
    }

    const plotTypeRaw = cell(row, columns.plotType);
    const plotType = parsePlotType(plotTypeRaw);
    if (plotTypeRaw && plotType === "unknown") {
      warnings.push(
        `Manifest row ${index + 1} (${sampleId}) has plot type "${plotTypeRaw}". Certify field metadata uses control, treatment, deployment, or research.`,
      );
    }

    samples.push({
      sampleId,
      farm: cell(row, columns.farm),
      plot: cell(row, columns.plot),
      plotType,
      plotTypeRaw,
      depthMinCm,
      depthMaxCm,
      collectedOn,
      collector: cell(row, columns.collector) || null,
      latitude: latitude !== null && latitude >= -90 && latitude <= 90 ? latitude : null,
      longitude: longitude !== null && longitude >= -180 && longitude <= 180 ? longitude : null,
      locationId: cell(row, columns.locationId) || null,
      sourceRow: index + 1,
    });
  }

  if (samples.length === 0) {
    warnings.push("The manifest header was found, but it has no sample rows.");
  }

  return { filename, samples, warnings };
}
