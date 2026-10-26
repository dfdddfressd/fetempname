import { formatMeasurement } from "./format";
import { parseLabFile } from "./labs";
import { parseManifest } from "./manifest";
import { CROSS_LAB_FRACTION, OUTLIER_MIN_SAMPLES, OUTLIER_Z } from "./schema";
import { median, modifiedZScores } from "./stats";
import type {
  AnalyteCode,
  AnalyteReading,
  Contribution,
  HarmonizedSample,
  Issue,
  LabMeasurement,
  LabSampleMeta,
  ManifestSample,
  ParsedLabFile,
  PipelineResult,
} from "./types";
import { ANALYTES } from "./types";

export interface PipelineInput {
  manifestFilename: string;
  manifestText: string;
  labs: Array<{ filename: string; text: string }>;
}

interface Point {
  lab: string;
  filename: string;
  sampleId: string;
  analyte: AnalyteCode;
  originalValue: string;
  originalUnit: string;
  canonicalValue: number | null;
  canonicalUnit: "mg/kg" | "pH" | null;
  method: string | null;
  error: string | null;
  sourceRow: number;
}

function sampleKey(id: string): string {
  return id.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function rangeProblem(analyte: AnalyteCode, value: number): string | null {
  if (analyte === "pH" && (value < 2 || value > 12)) {
    return `pH ${formatMeasurement("pH", value)} is outside 2 to 12`;
  }
  if (analyte !== "pH" && value < 0) {
    return `${analyte} is negative (${formatMeasurement(analyte, value)} mg/kg)`;
  }
  if (analyte !== "pH" && value > 1_000_000) {
    return `${analyte} is above 1,000,000 mg/kg, which is more than 100% of the sample`;
  }
  return null;
}

function usable(point: Point): boolean {
  return point.error === null && point.canonicalValue !== null;
}

/** True when the spread between lab values is too wide to collapse into one number. */
function disagrees(values: number[]): boolean {
  if (values.length < 2) return false;
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (high === 0) return low !== 0;
  return (high - low) / Math.abs(high) > CROSS_LAB_FRACTION;
}

function sameManifestRow(left: ManifestSample, right: ManifestSample): boolean {
  return (
    left.farm === right.farm &&
    left.plot === right.plot &&
    left.plotTypeRaw === right.plotTypeRaw &&
    left.depthMinCm === right.depthMinCm &&
    left.depthMaxCm === right.depthMaxCm &&
    left.collectedOn === right.collectedOn &&
    left.collector === right.collector &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.locationId === right.locationId
  );
}

function overlaps(
  leftMin: number | null,
  leftMax: number | null,
  rightMin: number | null,
  rightMax: number | null,
): boolean {
  if (leftMin === null || leftMax === null || rightMin === null || rightMax === null) return true;
  return leftMin <= rightMax && rightMin <= leftMax;
}

function depthText(min: number | null, max: number | null): string {
  if (min === null || max === null) return "an unreadable depth";
  if (min === max) return `${min} cm`;
  return `${min}–${max} cm`;
}

function labsTouching(labs: ParsedLabFile[], key: string): string[] {
  return labs
    .filter(
      (lab) =>
        lab.sampleMeta.some((meta) => sampleKey(meta.sampleId) === key) ||
        lab.measurements.some((item) => sampleKey(item.sampleId) === key),
    )
    .map((lab) => lab.formatLabel);
}

function toPoint(lab: ParsedLabFile, item: LabMeasurement): Point {
  const point: Point = {
    lab: lab.formatLabel,
    filename: lab.filename,
    sampleId: item.sampleId.trim(),
    analyte: item.analyte,
    originalValue: item.originalValue,
    originalUnit: item.originalUnit,
    canonicalValue: item.canonicalValue,
    canonicalUnit: item.canonicalUnit,
    method: item.method,
    error: item.error,
    sourceRow: item.sourceRow,
  };
  if (point.canonicalValue !== null) {
    const problem = rangeProblem(point.analyte, point.canonicalValue);
    if (problem) point.error = problem;
  }
  return point;
}

function contributionFromPoint(point: Point): Contribution {
  return {
    lab: point.lab,
    originalValue: point.originalValue,
    originalUnit: point.originalUnit,
    canonicalValue: point.canonicalValue,
    error: point.error,
  };
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const manifest = parseManifest(input.manifestText, input.manifestFilename);
  const labs = input.labs.map((file) => parseLabFile(file.text, file.filename));
  const issues: Issue[] = [];

  for (const warning of manifest.warnings) {
    issues.push(issue("format", "warning", null, warning, manifest.filename));
  }
  for (const lab of labs) {
    for (const warning of lab.warnings) {
      issues.push(issue("format", lab.recognized ? "warning" : "error", null, warning, lab.filename));
    }
  }

  const manifestByKey = new Map<string, ManifestSample[]>();
  for (const sample of manifest.samples) {
    const key = sampleKey(sample.sampleId);
    manifestByKey.set(key, [...(manifestByKey.get(key) ?? []), sample]);
  }

  for (const group of manifestByKey.values()) {
    if (group.length < 2) continue;
    const [first] = group;
    const matches = group.every((sample) => sameManifestRow(sample, first));
    issues.push(
      issue(
        "duplicate",
        matches ? "warning" : "error",
        first.sampleId,
        matches
          ? `${first.sampleId} appears ${group.length} times on the manifest with the same fields. The extra row was ignored.`
          : `${first.sampleId} appears ${group.length} times on the manifest and the rows do not match. The first row was kept.`,
        `Rows ${group.map((sample) => sample.sourceRow).join(", ")} of ${manifest.filename}.`,
      ),
    );
  }

  const points = labs.flatMap((lab) => lab.measurements.map((item) => toPoint(lab, item)));
  for (const point of points) {
    if (!point.error) continue;
    const manifestId = manifestByKey.get(sampleKey(point.sampleId))?.[0]?.sampleId ?? point.sampleId;
    issues.push(
      issue(
        "format",
        "error",
        manifestId,
        `${point.lab}, ${manifestId}: ${point.error}. That value was left out.`,
        `${point.filename}, row ${point.sourceRow}.`,
      ),
    );
  }

  const orderedKeys: string[] = [];
  const remember = (id: string) => {
    const key = sampleKey(id);
    if (key && !orderedKeys.includes(key)) orderedKeys.push(key);
  };
  for (const sample of manifest.samples) remember(sample.sampleId);
  for (const lab of labs) {
    for (const meta of lab.sampleMeta) remember(meta.sampleId);
    for (const item of lab.measurements) remember(item.sampleId);
  }

  const samples: HarmonizedSample[] = orderedKeys.map((key) => {
    const manifestSample = manifestByKey.get(key)?.[0];
    const samplePoints = points.filter((point) => sampleKey(point.sampleId) === key);
    const displayId = manifestSample?.sampleId ?? samplePoints[0]?.sampleId ?? key;
    const readings: HarmonizedSample["readings"] = {};

    for (const analyte of ANALYTES) {
      const analytePoints = samplePoints.filter((point) => point.analyte === analyte);
      if (analytePoints.length === 0) continue;
      const good = analytePoints.filter(usable);
      const values = good.map((point) => point.canonicalValue as number);
      const conflict = disagrees(values);
      readings[analyte] = {
        contributions: analytePoints.map(contributionFromPoint),
        included: !conflict && values.length > 0 ? median(values) : null,
        conflict,
        outlier: false,
      };
      if (!conflict) continue;
      issues.push(
        issue(
          "cross_lab",
          "error",
          displayId,
          `${analyte} for ${displayId} differs by more than ${Math.round(CROSS_LAB_FRACTION * 100)}% across reports, so the registry-shaped export leaves it blank.`,
          `${good
            .map((point) => {
              const canonical = `${formatMeasurement(analyte, point.canonicalValue as number)} ${point.canonicalUnit}`;
              const originalUnit = point.originalUnit.trim().toLowerCase().replace(/\s+/g, "");
              const alreadyCanonical = originalUnit === "mg/kg" || originalUnit === "ph";
              return alreadyCanonical
                ? `${point.lab} reported ${canonical}`
                : `${point.lab} reported ${point.originalValue} ${point.originalUnit} (${canonical})`;
            })
            .join(". ")}.`,
        ),
      );
    }

    return {
      sampleId: displayId,
      inManifest: Boolean(manifestSample),
      farm: manifestSample?.farm ?? "",
      plot: manifestSample?.plot ?? "",
      plotType: manifestSample?.plotType ?? "unknown",
      depthMinCm: manifestSample?.depthMinCm ?? null,
      depthMaxCm: manifestSample?.depthMaxCm ?? null,
      collectedOn: manifestSample?.collectedOn ?? null,
      collector: manifestSample?.collector ?? null,
      latitude: manifestSample?.latitude ?? null,
      longitude: manifestSample?.longitude ?? null,
      locationId: manifestSample?.locationId ?? null,
      labs: labsTouching(labs, key),
      readings,
    };
  });

  flagOutliers(samples, issues);
  flagCoverage(samples, issues);
  flagCustody(samples, labs, issues);
  assignIssueIds(issues);

  return {
    manifestFilename: manifest.filename,
    manifestRowCount: manifest.samples.length,
    uniqueManifestSamples: manifestByKey.size,
    manifestWarnings: manifest.warnings,
    labs,
    samples,
    issues,
  };
}

function flagOutliers(samples: HarmonizedSample[], issues: Issue[]) {
  for (const analyte of ANALYTES) {
    const candidates = samples.filter((sample) => {
      if (!sample.inManifest) return false;
      const reading = sample.readings[analyte];
      return Boolean(reading && reading.included !== null && !reading.conflict);
    });
    if (candidates.length < OUTLIER_MIN_SAMPLES) continue;
    const values = candidates.map((sample) => sample.readings[analyte]?.included as number);
    const scores = modifiedZScores(values);
    candidates.forEach((sample, index) => {
      const score = scores[index];
      const reading = sample.readings[analyte] as AnalyteReading;
      if (score === null || Math.abs(score) <= OUTLIER_Z) return;
      reading.outlier = true;
      const unit = analyte === "pH" ? "" : " mg/kg";
      issues.push(
        issue(
          "outlier",
          "warning",
          sample.sampleId,
          `${analyte} for ${sample.sampleId} is ${formatMeasurement(analyte, reading.included as number)}${unit}. Its modified z-score is ${score.toFixed(1)}, past ${OUTLIER_Z}.`,
          `Compared with ${candidates.length} samples that have one ${analyte} value. The number stays in the export. This screen only asks someone to check it; it is not a weathering or significance test.`,
        ),
      );
    });
  }
}

function flagCoverage(samples: HarmonizedSample[], issues: Issue[]) {
  for (const sample of samples) {
    if (sample.inManifest && sample.labs.length === 0) {
      const place = [sample.farm, sample.plot].filter(Boolean).join(", ");
      issues.push(
        issue(
          "missing_sample",
          "error",
          sample.sampleId,
          `${sample.sampleId} is on the manifest and does not appear in any lab file.`,
          place || "No farm or plot was recorded.",
        ),
      );
    }
    if (!sample.inManifest) {
      issues.push(
        issue(
          "orphan_result",
          "warning",
          sample.sampleId,
          `${sample.sampleId} is in ${sample.labs.join(" and ") || "a lab file"} and is not on the sample manifest.`,
          "It is left out of the registry-shaped export.",
        ),
      );
    }
  }
}

function flagCustody(samples: HarmonizedSample[], labs: ParsedLabFile[], issues: Issue[]) {
  for (const sample of samples) {
    if (!sample.inManifest) continue;
    if (!sample.collector) {
      issues.push(
        issue(
          "custody",
          "warning",
          sample.sampleId,
          `${sample.sampleId} has no collector on the manifest.`,
          "The chain of custody does not say who took the sample.",
        ),
      );
    }
    if (!sample.collectedOn) {
      issues.push(
        issue(
          "custody",
          "error",
          sample.sampleId,
          `${sample.sampleId} has no collection date on the manifest.`,
          "A registry sample needs a measurement date.",
        ),
      );
    }

    const earlyReceipts: string[] = [];
    const reportBeforeReceipt: string[] = [];
    const missingReceipt: string[] = [];

    for (const lab of labs) {
      const metas = lab.sampleMeta.filter((meta) => sampleKey(meta.sampleId) === sampleKey(sample.sampleId));
      if (metas.length === 0) continue;
      if (metas.length > 1) {
        issues.push(
          issue(
            "duplicate",
            "warning",
            sample.sampleId,
            `${lab.formatLabel} lists ${sample.sampleId} on ${metas.length} rows.`,
            `${lab.filename}, rows ${metas.map((meta) => meta.sourceRow).join(", ")}.`,
          ),
        );
      }
      for (const meta of metas) {
        noteMeta(sample, lab, meta, earlyReceipts, reportBeforeReceipt, missingReceipt, issues);
      }
    }

    if (sample.collectedOn && earlyReceipts.length > 0) {
      issues.push(
        issue(
          "custody",
          "error",
          sample.sampleId,
          `${sample.sampleId} was logged as received before it was collected on ${sample.collectedOn}.`,
          `${unique(earlyReceipts).join(". ")}.`,
        ),
      );
    }
    if (reportBeforeReceipt.length > 0) {
      issues.push(
        issue(
          "custody",
          "error",
          sample.sampleId,
          `${sample.sampleId} has a report date before its receipt date.`,
          `${unique(reportBeforeReceipt).join(". ")}.`,
        ),
      );
    }
    if (missingReceipt.length > 0) {
      issues.push(
        issue(
          "custody",
          "warning",
          sample.sampleId,
          `${sample.sampleId} has results from ${unique(missingReceipt).join(" and ")} with no receipt date.`,
          "The chain of custody does not show when the lab took the sample.",
        ),
      );
    }
  }
}

function noteMeta(
  sample: HarmonizedSample,
  lab: ParsedLabFile,
  meta: LabSampleMeta,
  earlyReceipts: string[],
  reportBeforeReceipt: string[],
  missingReceipt: string[],
  issues: Issue[],
) {
  if (sample.collectedOn && meta.receivedOn && meta.receivedOn < sample.collectedOn) {
    earlyReceipts.push(`${lab.formatLabel} received it on ${meta.receivedOn}`);
  }
  if (meta.receivedOn && meta.reportedOn && meta.reportedOn < meta.receivedOn) {
    reportBeforeReceipt.push(
      `${lab.formatLabel} reported it on ${meta.reportedOn}, before receipt on ${meta.receivedOn}`,
    );
  }
  if (!meta.receivedOn) missingReceipt.push(lab.formatLabel);
  if (
    sample.depthMinCm !== null &&
    sample.depthMaxCm !== null &&
    meta.depthMinCm !== null &&
    meta.depthMaxCm !== null &&
    !overlaps(sample.depthMinCm, sample.depthMaxCm, meta.depthMinCm, meta.depthMaxCm)
  ) {
    issues.push(
      issue(
        "format",
        "warning",
        sample.sampleId,
        `${lab.formatLabel} recorded depth ${depthText(meta.depthMinCm, meta.depthMaxCm)} for ${sample.sampleId}, which does not overlap the manifest depth ${depthText(sample.depthMinCm, sample.depthMaxCm)}.`,
        `${lab.filename}, row ${meta.sourceRow}. The manifest depth is the one used in the export.`,
      ),
    );
  }
}

function issue(
  kind: Issue["kind"],
  severity: Issue["severity"],
  sampleId: string | null,
  message: string,
  detail: string,
): Issue {
  return { id: "", kind, severity, sampleId, message, detail };
}

function assignIssueIds(issues: Issue[]) {
  const severityRank: Record<Issue["severity"], number> = { error: 0, warning: 1 };
  const kindRank: Record<Issue["kind"], number> = {
    missing_sample: 0,
    orphan_result: 1,
    duplicate: 2,
    cross_lab: 3,
    format: 4,
    outlier: 5,
    custody: 6,
  };
  issues.sort((left, right) => {
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) return bySeverity;
    const byKind = kindRank[left.kind] - kindRank[right.kind];
    if (byKind !== 0) return byKind;
    return (left.sampleId ?? "").localeCompare(right.sampleId ?? "") || left.message.localeCompare(right.message);
  });
  issues.forEach((item, index) => {
    item.id = `issue-${index + 1}`;
  });
}
