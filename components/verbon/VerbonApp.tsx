"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseDeveloperCsv, type DeveloperData } from "@/lib/verbon/developerCsv";
import { checkDraft, draftTreeToTree, parseNum, plotToDraft, type DraftPlot } from "@/lib/verbon/draft";
import { compareTrees } from "@/lib/verbon/reconcile";
import { SequentialSampling } from "@/lib/verbon/sampling";
import {
  DEMO_AREA,
  DEMO_COMPLETED,
  DEMO_DEVELOPER_CSV,
  DEMO_DEVELOPER_FILENAME,
  DEMO_DEVELOPER_TCO2,
  DEMO_PLOT_047_START,
} from "@/lib/verbon/seed";
import type { ActivityArea, Plot } from "@/lib/verbon/types";
import { FieldForm } from "./FieldForm";
import { Reconciliation, type PlotComparison } from "./Reconciliation";
import { SamplingTracker } from "./SamplingTracker";
import { Logo, SampleTag } from "./ui";

type Tab = "form" | "sampling" | "reconcile";

interface CompletedPlot {
  plotNumber: string;
  verifierTco2Ha: number;
  plot?: Plot; // field data; absent for seeded plots (tCO2/ha only)
}

interface AppState {
  version: 1;
  area: ActivityArea;
  developerTco2: Record<string, number>;
  completed: CompletedPlot[];
  draft: DraftPlot;
  developer: { filename: string; data: DeveloperData; isSample: boolean } | null;
  tco2Changes: string[];
  tab: Tab;
  justFinished: string | null;
}

const STORAGE_KEY = "verbon.demo.v1";

function seedState(): AppState {
  return {
    version: 1,
    area: DEMO_AREA,
    developerTco2: { ...DEMO_DEVELOPER_TCO2 },
    completed: DEMO_COMPLETED.map((c) => ({ ...c })),
    draft: plotToDraft(DEMO_PLOT_047_START),
    developer: null,
    tco2Changes: [],
    tab: "form",
    justFinished: null,
  };
}

function loadSaved(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AppState;
    if (s?.version !== 1 || !s.draft || !Array.isArray(s.completed)) return null;
    return s;
  } catch {
    return null;
  }
}

function save(s: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage full: the demo still works, it just won't survive a reload.
  }
}

function nextInOrder(area: ActivityArea, completed: CompletedPlot[]): string | null {
  const done = new Set(completed.map((c) => c.plotNumber));
  return area.sampleOrder.find((p) => !done.has(p)) ?? null;
}

export function VerbonApp() {
  const [state, setState] = useState<AppState>(seedState);
  const [csvErrors, setCsvErrors] = useState<{ filename: string; errors: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const loaded = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) setState({ ...saved, justFinished: null });
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) save(state);
  }, [state]);

  const patch = (p: Partial<AppState>) => setState((s) => ({ ...s, ...p }));
  const setTab = (tab: Tab) => {
    patch({ tab });
    window.scrollTo({ top: 0 });
  };
  const notify = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const { area, completed, draft, developerTco2, developer } = state;

  const sampling = useMemo(() => {
    const ss = new SequentialSampling(area.developerMeanTco2Ha, area.strata, area.hectares);
    const missing: string[] = [];
    for (const c of completed) {
      const dev = developerTco2[c.plotNumber];
      if (dev === undefined) missing.push(c.plotNumber);
      else ss.addPlot(c.plotNumber, dev, c.verifierTco2Ha);
    }
    return { ss, missing };
  }, [area, completed, developerTco2]);

  const reconciliation = useMemo(() => {
    const comparisons: PlotComparison[] = [];
    const notInField: string[] = [];
    if (developer) {
      for (const plotNumber of developer.data.plots) {
        const done = completed.find((c) => c.plotNumber === plotNumber && c.plot);
        const devTrees = developer.data.treesByPlot[plotNumber];
        if (!done?.plot) {
          notInField.push(plotNumber);
          continue;
        }
        comparisons.push({
          plotNumber,
          developer: devTrees,
          verifier: done.plot.trees,
          flags: compareTrees(plotNumber, devTrees, done.plot.trees),
        });
      }
    }
    return { comparisons, notInField };
  }, [developer, completed]);

  const plotNumber = draft.plotNumber.trim();
  const finishBlocker = completed.some((c) => c.plotNumber === plotNumber)
    ? `Plot ${plotNumber} is already finished.`
    : null;
  const draftErrors = checkDraft(draft).errors;

  function finishPlot() {
    const tco2 = parseNum(draft.tco2Ha);
    if (typeof tco2 !== "number" || finishBlocker || checkDraft(draft).errors > 0) return;
    const plot: Plot = { ...checkDraft(draft).plot, trees: draft.trees.map(draftTreeToTree), verifierTco2Ha: tco2 };
    const nextCompleted = [...completed, { plotNumber, verifierTco2Ha: tco2, plot }];
    const next = nextInOrder(area, nextCompleted) ?? "";
    setState((s) => ({
      ...s,
      completed: nextCompleted,
      // Same crew and day; new plot number, location and trees.
      draft: { ...s.draft, plotNumber: next, slopePct: "", aspect: "", lat: "", lon: "", notes: "", trees: [], tco2Ha: "" },
      tab: "sampling",
      justFinished: plotNumber,
    }));
    window.scrollTo({ top: 0 });
  }

  function applyDeveloper(filename: string, text: string, isSample: boolean) {
    const parsed = parseDeveloperCsv(text);
    if (!parsed.ok) {
      setCsvErrors({ filename, errors: parsed.errors });
      return;
    }
    setCsvErrors(null);
    const changes: string[] = [];
    const tco2 = { ...developerTco2 };
    for (const [p, val] of Object.entries(parsed.data.tco2ByPlot)) {
      if (tco2[p] !== undefined && tco2[p] !== val) changes.push(`Developer tCO2/ha for plot ${p} updated from ${tco2[p]} to ${val}.`);
      tco2[p] = val;
    }
    patch({ developer: { filename, data: parsed.data, isSample }, developerTco2: tco2, tco2Changes: changes });
  }

  async function upload(file: File) {
    try {
      const text = await file.text();
      applyDeveloper(file.name, text, false);
    } catch {
      setCsvErrors({ filename: file.name, errors: ["Could not read this file."] });
    }
  }

  function resetDemo() {
    if (!window.confirm("Reset the demo to its starting state?")) return;
    setCsvErrors(null);
    setState(seedState());
    window.scrollTo({ top: 0 });
  }

  const recFlags = reconciliation.comparisons.reduce((n, c) => n + c.flags.length, 0);
  const tabs: Array<{ id: Tab; n: string; label: string; dot: boolean }> = [
    { id: "form", n: "1", label: "Field form", dot: draft.trees.length > 0 && draftErrors > 0 },
    { id: "sampling", n: "2", label: "Sampling", dot: false },
    { id: "reconcile", n: "3", label: "Reconcile", dot: recFlags > 0 },
  ];
  const isSeedPlot = DEMO_AREA.sampleOrder.includes(plotNumber);

  return (
    <>
      <header className="vb-top">
        <div className="vb-wrap">
          <div className="vb-top-row">
            <Logo />
            <button type="button" className="vb-btn small ghost" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
          <div className="vb-project">
            <strong>{area.name}</strong>
            <span>
              {area.hectares.toLocaleString("en-US")} ha · {area.strata} {area.strata === 1 ? "stratum" : "strata"} · CAR MFP v3.0
            </span>
            <SampleTag />
          </div>
          <div className="vb-tabs" role="tablist" aria-label="Verification steps">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className="vb-tab"
                aria-selected={state.tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                <span className="vb-tab-n">STEP {t.n}</span>
                {t.label}
                {t.dot ? (
                  <>
                    <span className="vb-dot" aria-hidden="true" />
                    <span className="sr-only"> (has errors)</span>
                  </>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="vb-wrap">
        <div id={`panel-${state.tab}`} role="tabpanel">
          {state.tab === "form" ? (
            plotNumber || draft.trees.length || nextInOrder(area, completed) ? (
              <FieldForm
                draft={draft}
                onChange={(d) => patch({ draft: d })}
                onFinish={finishPlot}
                finishBlocker={finishBlocker}
                sampleOrder={area.sampleOrder.filter((p) => !completed.some((c) => c.plotNumber === p))}
                isSeedPlot={isSeedPlot}
              />
            ) : (
              <p className="vb-empty">Every plot in the sample order is finished.</p>
            )
          ) : null}
          {state.tab === "sampling" ? (
            <SamplingTracker
              area={area}
              results={sampling.ss.results}
              minPlots={sampling.ss.minPlots}
              k={sampling.ss.k}
              passed={sampling.ss.passed}
              stillNeeded={sampling.ss.plotsStillNeeded()}
              justFinished={state.justFinished}
              nextPlot={nextInOrder(area, completed)}
              missingDeveloper={sampling.missing}
              onGoToForm={() => setTab("form")}
            />
          ) : null}
          {state.tab === "reconcile" ? (
            <Reconciliation
              areaName={area.name}
              developer={developer}
              csvErrors={csvErrors}
              comparisons={reconciliation.comparisons}
              notInField={reconciliation.notInField}
              tco2Changes={state.tco2Changes}
              onLoadSample={() => applyDeveloper(DEMO_DEVELOPER_FILENAME, DEMO_DEVELOPER_CSV, true)}
              onUpload={upload}
              onClear={() => {
                setCsvErrors(null);
                patch({ developer: null, tco2Changes: [] });
              }}
              notify={notify}
            />
          ) : null}
        </div>
        <p className="vb-foot">
          Fictional sample data. Plot tCO2/ha is computed outside Verbon (CAR&apos;s CALCBOSK tool) and typed in. Runs in the browser; nothing is
          sent to a server.
        </p>
      </main>
      {toast ? (
        <div className="vb-toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
