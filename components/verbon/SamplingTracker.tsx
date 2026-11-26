"use client";

import type { ActivityArea } from "@/lib/verbon/types";
import { hectareClass, type PlotResult } from "@/lib/verbon/sampling";
import { fmt, SampleTag } from "./ui";

interface Props {
  area: ActivityArea;
  results: PlotResult[];
  minPlots: number;
  k: number;
  passed: boolean;
  stillNeeded: number;
  justFinished: string | null;
  nextPlot: string | null;
  missingDeveloper: string[];
  onGoToForm: () => void;
}

export function SamplingTracker({ area, results, minPlots, k, passed, stillNeeded, justFinished, nextPlot, missingDeveloper, onGoToForm }: Props) {
  const run = results.length ? results[results.length - 1].passesInSequence : 0;
  const passedAt = passed ? results[results.length - 1] : null;

  return (
    <>
      <section
        key={passed ? "passed" : "open"}
        className={`vb-banner${passed ? " passed" : ""}${passed && justFinished ? " flash" : ""}`}
        aria-live="polite"
      >
        <div className="vb-banner-kicker">CAR sequential sampling · Muestreo secuencial</div>
        <div className="vb-banner-title">{passed ? "✓ Sequential sampling passed" : "Sequential sampling not passed yet"}</div>
        {passedAt ? (
          <p>
            Passed at plot {passedAt.plotNumber} (n = {passedAt.n}) with {passedAt.passesInSequence} passing plots in a row. Minimum
            for this area: {minPlots}.
          </p>
        ) : (
          <p>
            Best case: <strong>{stillNeeded}</strong> more passing {stillNeeded === 1 ? "plot" : "plots"} needed.
            {nextPlot ? ` Next in sample order: plot ${nextPlot}.` : ""}
          </p>
        )}
        <div className={`vb-progress${passed ? " passed" : ""}`} aria-hidden="true">
          {Array.from({ length: minPlots }, (_, i) => (
            <span key={i} className={i < Math.min(run, minPlots) ? "on" : ""} />
          ))}
        </div>
        {!passed && nextPlot ? (
          <div className="vb-row" style={{ marginTop: 12 }}>
            <button type="button" className="vb-btn small" onClick={onGoToForm}>
              Open field form
            </button>
          </div>
        ) : null}
      </section>

      <section className="vb-card" aria-labelledby="plots">
        <div className="vb-card-head">
          <div>
            <h2 id="plots">Plots in sample order</h2>
            <p className="vb-sub">Difference = developer − verifier, tCO2/ha</p>
          </div>
          <SampleTag />
        </div>
        {results.length === 0 ? (
          <p className="vb-empty">No plots finished yet.</p>
        ) : (
          <div className="vb-table-scroll">
            <table className="vb-table">
              <thead>
                <tr>
                  <th scope="col">n</th>
                  <th scope="col">Plot</th>
                  <th scope="col" className="num">Dev.</th>
                  <th scope="col" className="num">Verif.</th>
                  <th scope="col" className="num">Diff.</th>
                  <th scope="col">Result</th>
                  <th scope="col" className="num">Run</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.n} className={r.plotNumber === justFinished ? "is-new" : undefined}>
                    <td>{r.n}</td>
                    <td>{r.plotNumber}</td>
                    <td className="num">{fmt(r.projectTco2Ha)}</td>
                    <td className="num">{fmt(r.verifierTco2Ha)}</td>
                    <td className="num">{fmt(r.projectTco2Ha - r.verifierTco2Ha)}</td>
                    <td>
                      <span className={`vb-result ${r.test === "Pass" ? "pass" : "inc"}`}>{r.test === "Pass" ? "✓ Pass" : `… ${r.test}`}</span>
                    </td>
                    <td className="num">{r.passesInSequence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {missingDeveloper.length ? (
          <p className="vb-note">
            Not in the test yet (no developer tCO2/ha for {missingDeveloper.length === 1 ? "plot" : "plots"} {missingDeveloper.join(", ")}). Load
            the developer data on the Reconciliation tab.
          </p>
        ) : null}
      </section>

      <section className="vb-card" aria-labelledby="area">
        <div className="vb-card-head">
          <h2 id="area">Activity area</h2>
        </div>
        <dl className="vb-facts">
          <div>
            <dt>Area</dt>
            <dd>{area.hectares.toLocaleString("en-US")} ha</dd>
          </div>
          <div>
            <dt>Strata verified</dt>
            <dd>{area.strata}</dd>
          </div>
          <div>
            <dt>Developer mean</dt>
            <dd>{fmt(area.developerMeanTco2Ha)} tCO2/ha</dd>
          </div>
          <div>
            <dt>Min. passing in a row</dt>
            <dd>{minPlots}</dd>
          </div>
          <div>
            <dt>Size class</dt>
            <dd>{hectareClass(area.hectares).replace("-", "–")} ha</dd>
          </div>
          <div>
            <dt>Tolerance · α · β</dt>
            <dd>10% · 0.05 · 0.20</dd>
          </div>
          <div>
            <dt>K (mean-difference limit)</dt>
            <dd>±{fmt(k, 2)} tCO2/ha</dd>
          </div>
        </dl>
        <p className="vb-note">CAR Mexico Forest Protocol v3.0, sequential sampling sheet. Runs on site, while the crew can still add plots.</p>
      </section>
    </>
  );
}
