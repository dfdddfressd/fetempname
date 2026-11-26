"use client";

import { useState } from "react";
import { DEVELOPER_COLUMNS, type DeveloperData } from "@/lib/verbon/developerCsv";
import { VIGOR } from "@/lib/verbon/fieldChecks";
import { findingsCsv, findingsText } from "@/lib/verbon/findings";
import { pyFloat } from "@/lib/verbon/pyfmt";
import { compareTrees, type ReconcileTree } from "@/lib/verbon/reconcile";
import type { Flag } from "@/lib/verbon/types";
import { Counts, FlagList, SampleTag } from "./ui";

export interface PlotComparison {
  plotNumber: string;
  developer: ReconcileTree[];
  verifier: ReconcileTree[];
  flags: Flag[];
}

interface Props {
  areaName: string;
  developer: { filename: string; data: DeveloperData; isSample: boolean } | null;
  csvErrors: { filename: string; errors: string[] } | null;
  comparisons: PlotComparison[];
  notInField: string[]; // developer plots with no verifier tree data
  tco2Changes: string[];
  onLoadSample: () => void;
  onUpload: (file: File) => void;
  onClear: () => void;
  notify: (msg: string) => void;
}

const v = (x: number | null) => (x === null ? "—" : pyFloat(x));
const vig = (x: number | null) => (x === null ? "—" : `${x}${VIGOR[x] ? ` ${x >= 4 ? "dead" : "live"}` : ""}`);

function keyOf(t: ReconcileTree) {
  return `${t.table}\u0000${t.number}`;
}

function TreeComparison({ c }: { c: PlotComparison }) {
  const dev = new Map(c.developer.map((t) => [keyOf(t), t]));
  const ver = new Map(c.verifier.map((t) => [keyOf(t), t]));
  const keys = [...new Set([...dev.keys(), ...ver.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    <>
      {keys.map((k) => {
        const [table, number] = k.split("\u0000");
        const d = dev.get(k);
        const vv = ver.get(k);
        // compareTrees treats each (table, tree) key on its own, so running it on just
        // this key gives exactly this tree's flags, even when "B" exists in both tables.
        const mine = compareTrees(c.plotNumber, d ? [d] : [], vv ? [vv] : []);
        const hit = (word: string) => mine.some((f) => f.message.startsWith(word));
        const cell = (val: string, differs: boolean) => <td className={differs ? "diff" : undefined}>{val}</td>;
        return (
          <div key={k} className={`vb-cmp${mine.some((f) => f.level === "error") ? " has-error" : ""}`}>
            <div className="vb-cmp-head">
              Tree {number} <span>{table === "large" ? "Large table" : "Small table"}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Developer</th>
                  <th scope="col">Verifier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Species</th>
                  {cell(d ? d.species || "—" : "—", hit("Species"))}
                  {cell(vv ? vv.species || "—" : "—", hit("Species"))}
                </tr>
                <tr>
                  <th scope="row">DBH cm</th>
                  {cell(d ? v(d.dbhCm) : "—", hit("DBH"))}
                  {cell(vv ? v(vv.dbhCm) : "—", hit("DBH"))}
                </tr>
                <tr>
                  <th scope="row">Height m</th>
                  {cell(d ? v(d.heightM) : "—", hit("Height"))}
                  {cell(vv ? v(vv.heightM) : "—", hit("Height"))}
                </tr>
                <tr>
                  <th scope="row">Vigor</th>
                  {cell(d ? vig(d.vigor) : "—", hit("Live/dead"))}
                  {cell(vv ? vig(vv.vigor) : "—", hit("Live/dead"))}
                </tr>
              </tbody>
            </table>
            {mine.length ? <FlagList flags={mine} /> : <p className="vb-note" style={{ margin: 0 }}>✓ Matches within tolerance</p>}
          </div>
        );
      })}
    </>
  );
}

export function Reconciliation({ areaName, developer, csvErrors, comparisons, notInField, tco2Changes, onLoadSample, onUpload, onClear, notify }: Props) {
  const [copied, setCopied] = useState(false);
  const allFlags = comparisons.flatMap((c) => c.flags);
  const errors = allFlags.filter((f) => f.level === "error").length;
  const warnings = allFlags.length - errors;

  function download() {
    const blob = new Blob([findingsCsv(allFlags)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verbon-draft-findings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    const text = findingsText(allFlags, areaName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        notify("Copy failed. Use Export CSV instead.");
        ta.remove();
        return;
      }
      ta.remove();
    }
    setCopied(true);
    notify(`Copied ${allFlags.length} findings`);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <section className="vb-card" aria-labelledby="dev">
        <div className="vb-card-head">
          <div>
            <h2 id="dev">Developer data</h2>
            <p className="vb-sub">The developer&apos;s tree list for the same plots, matched by table and tree number.</p>
          </div>
          {developer?.isSample ? <SampleTag /> : null}
        </div>
        <div className="vb-row">
          <button type="button" className="vb-btn primary" onClick={onLoadSample}>
            Load developer data
          </button>
          <label className="vb-btn vb-file">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {developer ? (
            <button type="button" className="vb-btn ghost" onClick={onClear}>
              Clear
            </button>
          ) : null}
        </div>
        {developer ? (
          <p className="vb-note">
            {developer.filename}: {developer.data.rowCount} trees in {developer.data.plots.length}{" "}
            {developer.data.plots.length === 1 ? "plot" : "plots"}.
          </p>
        ) : null}
        {csvErrors ? (
          <div className="vb-csv-error">
            <FlagList flags={csvErrors.errors.map((message) => ({ level: "error" as const, where: csvErrors.filename, message }))} />
          </div>
        ) : null}
        <details className="vb-more">
          <summary>Expected CSV format</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.8rem", margin: 0, color: "var(--sage)" }}>
            {DEVELOPER_COLUMNS.join(",")}
            {"\n"}047,large,1,Pinus,34.2,21.0,2,180
          </pre>
        </details>
        {tco2Changes.length ? <p className="vb-note">{tco2Changes.join(" ")}</p> : null}
      </section>

      {developer ? (
        <section className="vb-card" aria-labelledby="flags">
          <div className="vb-card-head">
            <h2 id="flags">Mismatches</h2>
            <span className="vb-sub">
              Tolerances: DBH 1.0 cm, height 10%
            </span>
          </div>
          {comparisons.length === 0 ? (
            <p className="vb-empty">
              None of the developer&apos;s plots have field tree data in Verbon yet. Finish a plot in the field form first.
            </p>
          ) : (
            <>
              <Counts errors={errors} warnings={warnings} />
              {comparisons.map((c) => (
                <div key={c.plotNumber}>
                  <h3 style={{ margin: "8px 0", fontSize: "1rem" }}>Plot {c.plotNumber}</h3>
                  <TreeComparison c={c} />
                </div>
              ))}
              <div className="vb-row" style={{ marginTop: 6 }}>
                <button type="button" className="vb-btn primary" onClick={download} disabled={allFlags.length === 0}>
                  Export draft findings (CSV)
                </button>
                <button type="button" className="vb-btn" onClick={copy} disabled={allFlags.length === 0}>
                  {copied ? "✓ Copied" : "Copy findings"}
                </button>
              </div>
            </>
          )}
          {notInField.length ? (
            <p className="vb-note">
              No field tree data yet for {notInField.length === 1 ? "plot" : "plots"} {notInField.join(", ")}.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
