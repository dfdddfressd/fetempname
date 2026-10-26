"use client";

import { useMemo, useState } from "react";
import { DEMO_LABS, DEMO_MANIFEST, DEMO_MANIFEST_FILENAME, DEMO_NOTES } from "@/lib/demoData";
import { buildExports } from "@/lib/export";
import { formatMeasurement } from "@/lib/format";
import { parseLabFile } from "@/lib/labs";
import { parseManifest } from "@/lib/manifest";
import { runPipeline } from "@/lib/pipeline";
import type { AnalyteCode, ExportFile, HarmonizedSample, Issue, IssueKind, PipelineResult } from "@/lib/types";
import { ANALYTES } from "@/lib/types";

type LoadedFile = { name: string; text: string; note: string; ok: boolean };
type Source = "demo" | "upload";
type Filter = "all" | "errors" | "missing" | "duplicates" | "format" | "outliers" | "custody";

const FILTERS: Array<{ id: Filter; label: string; match: (issue: Issue) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "errors", label: "Errors", match: (issue) => issue.severity === "error" },
  { id: "missing", label: "Missing", match: (issue) => issue.kind === "missing_sample" || issue.kind === "orphan_result" },
  { id: "duplicates", label: "Duplicates", match: (issue) => issue.kind === "duplicate" || issue.kind === "cross_lab" },
  { id: "format", label: "Units and formats", match: (issue) => issue.kind === "format" },
  { id: "outliers", label: "Outliers", match: (issue) => issue.kind === "outlier" },
  { id: "custody", label: "Custody", match: (issue) => issue.kind === "custody" },
];

const KIND_LABEL: Record<IssueKind, string> = {
  missing_sample: "Missing sample",
  orphan_result: "Not on manifest",
  duplicate: "Duplicate",
  cross_lab: "Cross-lab disagreement",
  format: "Unit or format",
  outlier: "Outlier",
  custody: "Chain of custody",
};

export function Workbench() {
  const [manifest, setManifest] = useState<LoadedFile | null>(null);
  const [labs, setLabs] = useState<LoadedFile[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [previewId, setPreviewId] = useState<ExportFile["id"]>("certify");
  const [formError, setFormError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const exports = useMemo(() => (result ? buildExports(result) : []), [result]);
  const preview = exports.find((file) => file.id === previewId) ?? exports[0];

  function loadDemo() {
    setFormError(null);
    setFilter("all");
    setPreviewId("certify");
    setSource("demo");
    setResult(
      runPipeline({
        manifestFilename: DEMO_MANIFEST_FILENAME,
        manifestText: DEMO_MANIFEST,
        labs: DEMO_LABS,
      }),
    );
  }

  function reset() {
    setResult(null);
    setSource(null);
    setManifest(null);
    setLabs([]);
    setFormError(null);
    setFilter("all");
  }

  function runUpload() {
    if (!manifest?.ok || labs.length === 0 || labs.some((file) => !file.ok)) {
      setFormError("Add a manifest and at least one lab CSV this checker can read.");
      return;
    }
    setFormError(null);
    setFilter("all");
    setPreviewId("certify");
    setSource("upload");
    setResult(
      runPipeline({
        manifestFilename: manifest.name,
        manifestText: manifest.text,
        labs: labs.map((file) => ({ filename: file.name, text: file.text })),
      }),
    );
  }

  async function onManifest(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setReading(true);
    setManifest(await readManifest(file));
    setReading(false);
  }

  async function onLabs(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading(true);
    const loaded = await Promise.all([...files].map(readLab));
    setLabs((current) => [...current, ...loaded]);
    setReading(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <p className="eyebrow">Enhanced rock weathering</p>
          <h1>Sampleproof</h1>
          <p className="lede">
            Upload a sample manifest and lab files. Get one dataset, a quality report, and an export shaped like public Isometric Certify fields. The science of tonnes removed stays outside this tool.
          </p>
        </div>
      </header>
      <main className="wrap">
        {result ? (
          <Report
            result={result}
            source={source}
            filter={filter}
            onFilter={setFilter}
            exports={exports}
            preview={preview}
            onPreview={setPreviewId}
            onReset={reset}
          />
        ) : (
          <Intake
            manifest={manifest}
            labs={labs}
            reading={reading}
            formError={formError}
            onManifest={onManifest}
            onLabs={onLabs}
            onRemoveLab={(name) => setLabs((current) => current.filter((file) => file.name !== name))}
            onRun={runUpload}
            onDemo={loadDemo}
          />
        )}
      </main>
    </>
  );
}

function Intake({
  manifest,
  labs,
  reading,
  formError,
  onManifest,
  onLabs,
  onRemoveLab,
  onRun,
  onDemo,
}: {
  manifest: LoadedFile | null;
  labs: LoadedFile[];
  reading: boolean;
  formError: string | null;
  onManifest: (files: FileList | null) => void;
  onLabs: (files: FileList | null) => void;
  onRemoveLab: (name: string) => void;
  onRun: () => void;
  onDemo: () => void;
}) {
  const ready = Boolean(manifest?.ok && labs.length > 0 && labs.every((file) => file.ok) && !reading);
  return (
    <>
      <section className="steps" aria-label="What a check does">
        <article className="step">
          <span>01</span>
          <h3>Read the files</h3>
          <p className="muted small">A sample manifest, plus lab exports that do not share a layout.</p>
        </article>
        <article className="step">
          <span>02</span>
          <h3>Put them on one scale</h3>
          <p className="muted small">Cations become mg/kg. ppm counts as mg/kg. Percent and TiO2 are converted. pH stays pH.</p>
        </article>
        <article className="step">
          <span>03</span>
          <h3>Flag the gaps</h3>
          <p className="muted small">Missing samples, duplicates, cross-lab conflicts, bad units, outliers, and broken custody.</p>
        </article>
        <article className="step">
          <span>04</span>
          <h3>Export the record</h3>
          <p className="muted small">One row per sample, a location file, and measurements using public Certify quantity kinds.</p>
        </article>
      </section>
      <section className="chooser">
        <article className="panel">
          <h2>Demo project</h2>
          <p className="muted">
            Northfield baseline, March 2026. Eight soil cores and three lab layouts, with problems planted on purpose. Files stay in this browser.
          </p>
          <div className="actions">
            <button className="primary" type="button" onClick={onDemo}>
              Load the demo project
            </button>
          </div>
        </article>
        <article className="panel">
          <h2>Your files</h2>
          <p className="muted small">CSV only. Nothing is uploaded to a server.</p>
          <div className="stack" style={{ marginTop: "0.8rem" }}>
            <DropZone label="Sample manifest" hint="One CSV. Needs a sample id column." onFiles={onManifest} />
            {manifest ? <FileNote file={manifest} /> : null}
            <DropZone label="Lab result files" hint="One or more CSVs. Wide table, long table, or a certificate with a preamble." multiple onFiles={onLabs} />
            {labs.map((file) => (
              <FileNote key={file.name} file={file} onRemove={() => onRemoveLab(file.name)} />
            ))}
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="actions">
            <button className="primary" type="button" disabled={!ready} onClick={onRun}>
              {reading ? "Reading files…" : "Run the check"}
            </button>
          </div>
        </article>
      </section>
      <SchemaNote />
    </>
  );
}

function Report({
  result,
  source,
  filter,
  onFilter,
  exports,
  preview,
  onPreview,
  onReset,
}: {
  result: PipelineResult;
  source: Source | null;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  exports: ExportFile[];
  preview: ExportFile | undefined;
  onPreview: (id: ExportFile["id"]) => void;
  onReset: () => void;
}) {
  const errors = result.issues.filter((issue) => issue.severity === "error").length;
  const warnings = result.issues.length - errors;
  const active = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const visible = result.issues.filter(active.match);

  return (
    <>
      <div className="toolbar">
        <div>
          <h2>Quality report</h2>
          <p className="muted small" style={{ margin: "0.3rem 0 0" }}>
            {result.manifestFilename}
            {result.labs.map((lab) => ` · ${lab.filename} (${lab.formatLabel})`).join("")}
          </p>
        </div>
        <button className="ghost" type="button" onClick={onReset}>
          Check different files
        </button>
      </div>
      <section className="stats" aria-label="Summary">
        <div className="stat">
          <b>{result.uniqueManifestSamples}</b>
          <span>samples on the manifest</span>
        </div>
        <div className="stat">
          <b>{result.labs.filter((lab) => lab.recognized).length}</b>
          <span>lab files read</span>
        </div>
        <div className={`stat ${errors ? "error" : ""}`}>
          <b>{errors}</b>
          <span>{errors === 1 ? "error" : "errors"}</span>
        </div>
        <div className={`stat ${warnings ? "warning" : ""}`}>
          <b>{warnings}</b>
          <span>{warnings === 1 ? "warning" : "warnings"}</span>
        </div>
      </section>
      <p className="banner">
        {errors > 0
          ? `${errors} ${errors === 1 ? "error needs" : "errors need"} a look before this is treated as registry-ready. The export is still available, and conflicting values are left blank rather than averaged.`
          : "No errors. Warnings stay in the report so a person can decide what to do with them."}
      </p>
      <div className="filters" role="toolbar" aria-label="Filter findings">
        {FILTERS.map((item) => {
          const count = result.issues.filter(item.match).length;
          return (
            <button key={item.id} className="chip" type="button" aria-pressed={filter === item.id} onClick={() => onFilter(item.id)}>
              {item.label} {count}
            </button>
          );
        })}
      </div>
      <section aria-label="Findings">
        {visible.length === 0 ? <p className="note">Nothing in this filter.</p> : null}
        {visible.map((issue) => (
          <article className="issue" key={issue.id}>
            <div>
              <p className={`severity ${issue.severity}`}>{issue.severity}</p>
              <p className="kind">{KIND_LABEL[issue.kind]}</p>
            </div>
            <div>
              <h3>{issue.message}</h3>
              <p className="muted small">{issue.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="section">
        <h2>Harmonized samples</h2>
        <p className="muted small">A red value disagrees across labs and is blank in the export. A marked value is an outlier and is still exported.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sample</th>
                <th>Farm</th>
                <th>Plot</th>
                <th>Depth</th>
                <th>Collected</th>
                <th>Labs</th>
                {ANALYTES.map((analyte) => (
                  <th key={analyte} className="num">
                    {analyte === "pH" ? "pH" : `${analyte}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.samples.map((sample) => (
                <SampleRow key={sample.sampleId} sample={sample} issues={result.issues} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Export</h2>
        <div className="exports">
          {exports.map((file) => (
            <div className="export-row" key={file.id}>
              <strong>{file.label}</strong>
              <p className="muted small">{file.description}</p>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="ghost" type="button" aria-pressed={preview?.id === file.id} onClick={() => onPreview(file.id)}>
                  Preview
                </button>
                <button className="primary" type="button" onClick={() => downloadCsv(file)}>
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
        {preview ? (
          <pre className="preview" tabIndex={0}>
            {preview.csv.split("\n").slice(0, 14).join("\n")}
            {preview.csv.split("\n").length > 14 ? "\n…" : ""}
          </pre>
        ) : null}
      </section>

      {source === "demo" ? (
        <details className="planted">
          <summary>What was planted in the demo</summary>
          <ul>
            {DEMO_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <SchemaNote />
    </>
  );
}

function SampleRow({ sample, issues }: { sample: HarmonizedSample; issues: Issue[] }) {
  const sampleIssues = issues.filter((issue) => issue.sampleId === sample.sampleId);
  const hasError = sampleIssues.some((issue) => issue.severity === "error");
  const hasWarning = sampleIssues.some((issue) => issue.severity === "warning");
  const rowClass = hasError ? "row-error" : hasWarning ? "row-warning" : undefined;
  return (
    <tr className={rowClass}>
      <td className="sample-id">
        {sample.sampleId}
        {sample.inManifest ? "" : " · not on manifest"}
      </td>
      <td>{sample.farm || "—"}</td>
      <td>{sample.plot ? `${sample.plot}${sample.plotType !== "unknown" ? ` · ${sample.plotType}` : ""}` : "—"}</td>
      <td>{depthLabel(sample.depthMinCm, sample.depthMaxCm)}</td>
      <td>{sample.collectedOn || "—"}</td>
      <td>{sample.labs.join(", ") || "—"}</td>
      {ANALYTES.map((analyte) => (
        <td key={analyte} className="num">
          <AnalyteCell sample={sample} analyte={analyte} />
        </td>
      ))}
    </tr>
  );
}

function AnalyteCell({ sample, analyte }: { sample: HarmonizedSample; analyte: AnalyteCode }) {
  const reading = sample.readings[analyte];
  if (!reading) return "—";
  if (reading.conflict) {
    const parts = reading.contributions
      .filter((item) => item.canonicalValue !== null && !item.error)
      .map((item) => formatMeasurement(analyte, item.canonicalValue as number));
    return <span className="conflict">{parts.join(" / ")}</span>;
  }
  if (reading.included === null) return <span className="unreadable">unreadable</span>;
  const text = formatMeasurement(analyte, reading.included);
  if (reading.outlier) return <span className="outlier">{text}</span>;
  return text;
}

function SchemaNote() {
  return (
    <details>
      <summary>How this maps to public registry fields</summary>
      <p className="small">
        Checked against Isometric’s public Certify guides on October 26, 2026. A project template downloaded inside Certify is still the file to upload. This tool does not invent <span className="mono">mlc_</span> location ids, and it does not claim to be a Cascade Data Quarry file. Cascade describes sample-level variables and says its schema is still changing.
      </p>
      <ul className="small">
        <li>
          Locations use <span className="mono">name</span>, <span className="mono">reference_id</span>, <span className="mono">latitude</span>, <span className="mono">longitude</span>.
        </li>
        <li>
          Samples use <span className="mono">supplier_reference_id</span> and <span className="mono">measurement_date</span>. Your location reference is kept beside them because Certify assigns <span className="mono">measurement_location_id</span> after upload.
        </li>
        <li>
          Soil properties use the published quantity kinds for measurement type <span className="mono">ew_soil</span>: mass fraction, acidity, and depth. Units here are mg/kg, pH, and cm.
        </li>
        <li>A cross-lab gap above 15% leaves that analyte blank. That threshold is an MVP rule, not a registry rule.</li>
        <li>Outliers are a modified z-score above 3.5, and only once an analyte has at least six samples. The value is still exported.</li>
        <li>Northline, Helio, and Fieldstone are example layouts for three file shapes. They are not a real laboratory’s export. A pilot’s files should replace them.</li>
      </ul>
      <p className="small">
        <a href="https://docs.isometric.com/user-guides/certify/field-measurements">Certify field measurements</a>
        {" · "}
        <a href="https://docs.isometric.com/user-guides/certify/measurement-samples">Measurement samples</a>
        {" · "}
        <a href="https://docs.isometric.com/user-guides/certify/project-assets/sites-reference">Site reference</a>
        {" · "}
        <a href="https://cascadeclimate.org/cascadeclimate-data-quarry-variable-list.pdf">Cascade variable list (PDF)</a>
      </p>
    </details>
  );
}

function DropZone({
  label,
  hint,
  multiple = false,
  onFiles,
}: {
  label: string;
  hint: string;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={over ? "drop over" : "drop"}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept=".csv,.txt,.tsv,text/csv"
        multiple={multiple}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <strong>{label}</strong>
      <span className="muted small">{hint}</span>
    </label>
  );
}

function FileNote({ file, onRemove }: { file: LoadedFile; onRemove?: () => void }) {
  return (
    <div className="file-row">
      <div>
        <strong className="mono">{file.name}</strong>
        <p className={file.ok ? "muted small" : "small bad-note"}>{file.note}</p>
      </div>
      {onRemove ? (
        <button className="text" type="button" onClick={onRemove}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

async function readManifest(file: File): Promise<LoadedFile> {
  if (!isCsv(file.name)) {
    return { name: file.name, text: "", note: "Save this sheet as CSV. This version reads CSV.", ok: false };
  }
  const text = await file.text();
  const parsed = parseManifest(text, file.name);
  if (parsed.samples.length === 0) {
    return { name: file.name, text, note: parsed.warnings[0] ?? "No sample rows were found.", ok: false };
  }
  const extra = parsed.warnings.length ? ` ${parsed.warnings[0]}` : "";
  return { name: file.name, text, note: `${parsed.samples.length} manifest rows.${extra}`, ok: true };
}

async function readLab(file: File): Promise<LoadedFile> {
  if (!isCsv(file.name)) {
    return { name: file.name, text: "", note: "Save this sheet as CSV. This version reads CSV.", ok: false };
  }
  const text = await file.text();
  const parsed = parseLabFile(text, file.name);
  if (!parsed.recognized || parsed.measurements.length === 0) {
    return {
      name: file.name,
      text,
      note: parsed.warnings[0] ?? "No measurements were found.",
      ok: parsed.recognized && parsed.measurements.length > 0,
    };
  }
  return {
    name: file.name,
    text,
    note: `${parsed.formatLabel}: ${parsed.sampleMeta.length} ${parsed.sampleMeta.length === 1 ? "sample" : "samples"}, ${parsed.measurements.length} ${parsed.measurements.length === 1 ? "value" : "values"}.`,
    ok: true,
  };
}

function isCsv(name: string): boolean {
  return /\.(csv|txt|tsv)$/i.test(name);
}

function depthLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return "—";
  if (min === max) return `${min} cm`;
  return `${min}–${max} cm`;
}

function downloadCsv(file: ExportFile) {
  const blob = new Blob([file.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
