export const ANALYTES = ["Ca", "Mg", "Na", "K", "Ti", "Al", "Fe", "pH"] as const;

export type AnalyteCode = (typeof ANALYTES)[number];

export type PlotType = "control" | "treatment" | "deployment" | "research" | "unknown";

export type IssueKind =
  | "missing_sample"
  | "orphan_result"
  | "duplicate"
  | "cross_lab"
  | "format"
  | "outlier"
  | "custody";

export type IssueSeverity = "error" | "warning";

export interface ManifestSample {
  sampleId: string;
  farm: string;
  plot: string;
  plotType: PlotType;
  plotTypeRaw: string;
  depthMinCm: number | null;
  depthMaxCm: number | null;
  collectedOn: string | null;
  collector: string | null;
  latitude: number | null;
  longitude: number | null;
  locationId: string | null;
  sourceRow: number;
}

export interface LabMeasurement {
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

export interface LabSampleMeta {
  sampleId: string;
  receivedOn: string | null;
  reportedOn: string | null;
  depthMinCm: number | null;
  depthMaxCm: number | null;
  sourceRow: number;
}

export interface ParsedLabFile {
  filename: string;
  formatId: "northline" | "helio" | "fieldstone" | "unknown";
  formatLabel: string;
  recognized: boolean;
  measurements: LabMeasurement[];
  sampleMeta: LabSampleMeta[];
  warnings: string[];
}

export interface ParsedManifest {
  filename: string;
  samples: ManifestSample[];
  warnings: string[];
}

export interface Contribution {
  lab: string;
  originalValue: string;
  originalUnit: string;
  canonicalValue: number | null;
  error: string | null;
}

export interface AnalyteReading {
  contributions: Contribution[];
  /** Number written to the registry-shaped export. Null when there is no defensible single value. */
  included: number | null;
  conflict: boolean;
  outlier: boolean;
}

export interface HarmonizedSample {
  sampleId: string;
  inManifest: boolean;
  farm: string;
  plot: string;
  plotType: PlotType;
  depthMinCm: number | null;
  depthMaxCm: number | null;
  collectedOn: string | null;
  collector: string | null;
  latitude: number | null;
  longitude: number | null;
  locationId: string | null;
  labs: string[];
  readings: Partial<Record<AnalyteCode, AnalyteReading>>;
}

export interface Issue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  sampleId: string | null;
  message: string;
  detail: string;
}

export interface PipelineResult {
  manifestFilename: string;
  manifestRowCount: number;
  uniqueManifestSamples: number;
  manifestWarnings: string[];
  labs: ParsedLabFile[];
  samples: HarmonizedSample[];
  issues: Issue[];
}

export interface ExportFile {
  id: "harmonized" | "certify" | "locations" | "audit" | "issues";
  filename: string;
  label: string;
  description: string;
  csv: string;
}
