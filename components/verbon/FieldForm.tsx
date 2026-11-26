"use client";

import { useState } from "react";
import {
  blankTree,
  checkDraft,
  parseNum,
  type DraftPlot,
  type DraftTree,
  type FieldFlag,
  type TreeNumericField,
} from "@/lib/verbon/draft";
import { LARGE_RADIUS, SMALL_RADIUS, VIGOR, VIGOR_ES } from "@/lib/verbon/fieldChecks";
import type { TreeTable } from "@/lib/verbon/types";
import { Counts, Field, FlagLine, FlagList, SampleTag } from "./ui";

const SPECIES = ["Pinus", "Quercus", "Arbutus", "Abies", "Alnus", "Juniperus", "Cupressus"];
const ASPECTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

interface Props {
  draft: DraftPlot;
  onChange: (next: DraftPlot) => void;
  onFinish: () => void;
  finishBlocker: string | null; // problems outside validatePlot, e.g. plot already finished
  sampleOrder: string[];
  isSeedPlot: boolean;
}

const isMissing = (f: FieldFlag) => f.message.startsWith("Missing") || f.message.startsWith("At least one");

export function FieldForm({ draft, onChange, onFinish, finishBlocker, sampleOrder, isSeedPlot }: Props) {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const check = checkDraft(draft);

  const touch = (key: string) =>
    setTouched((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  // Inline "Missing …" errors wait until the field has been left, so a freshly added
  // tree is not a wall of errors. Value errors show while typing. The summary at the
  // bottom always lists everything, and errors there still block "Finish plot".
  const visible = (flags: FieldFlag[], key: string) => flags.filter((f) => !isMissing(f) || touched.has(key));

  const headerFlags = (field: string) => visible(check.header.filter((f) => f.field === field), `h:${field}`);
  const set = <K extends keyof DraftPlot>(key: K, value: DraftPlot[K]) => onChange({ ...draft, [key]: value });

  const updateTree = (id: string, patch: Partial<DraftTree>) =>
    onChange({ ...draft, trees: draft.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const updateValue = (t: DraftTree, key: TreeNumericField, value: string) =>
    updateTree(t.id, { values: { ...t.values, [key]: value } });
  const addTree = (table: TreeTable) => onChange({ ...draft, trees: [...draft.trees, blankTree(table, draft.trees)] });
  const removeTree = (id: string) => onChange({ ...draft, trees: draft.trees.filter((t) => t.id !== id) });

  const tco2 = parseNum(draft.tco2Ha);
  const tco2Error =
    tco2 === "bad" ? `"${draft.tco2Ha}" is not a number.` : tco2 !== null && tco2 <= 0 ? "tCO2/ha must be above 0." : null;
  const canFinish = check.errors === 0 && typeof tco2 === "number" && tco2 > 0 && !finishBlocker;

  function tryFinish() {
    if (!canFinish) return;
    setTouched(new Set());
    onFinish();
  }

  function treeCard(t: DraftTree) {
    const flags = check.byTree[t.id] ?? [];
    const f = (field: string) => visible(flags.filter((x) => x.field === field), `${t.id}:${field}`);
    const id = (field: string) => `tree-${t.id}-${field}`;
    const r = t.table === "large" ? LARGE_RADIUS : SMALL_RADIUS;
    const other: TreeTable = t.table === "large" ? "small" : "large";
    const wrongTable = flags.find(
      (x) => x.message.includes("belongs in the small-tree table") || x.message.includes("outside 5-30 cm"),
    );
    const dbhVal = parseNum(t.values.dbhCm);
    const canMove = wrongTable && !(t.table === "small" && typeof dbhVal === "number" && dbhVal < 5);

    const num = (field: TreeNumericField, label: string, es: string, unit: string, mode: "decimal" | "numeric" = "decimal") => {
      const shown = f(field);
      return (
        <Field id={id(field)} label={label} es={es}>
          <div className="vb-unit">
            <input
              id={id(field)}
              className={`vb-input${shown.some((x) => x.level === "warning") ? " is-check" : ""}`}
              inputMode={mode}
              autoComplete="off"
              value={t.values[field]}
              aria-invalid={shown.some((x) => x.level === "error")}
              onChange={(e) => updateValue(t, field, e.target.value)}
              onBlur={() => touch(`${t.id}:${field}`)}
            />
            <span>{unit}</span>
          </div>
        </Field>
      );
    };

    // Flags for a row of fields, shown full width right under that row. Half-width
    // columns are too narrow on a phone to read a message.
    const rowFlags = (fields: string[]) => {
      const shown = fields.flatMap((field) => f(field));
      if (shown.length === 0) return null;
      return (
        <div className="vb-span">
          {shown.map((x, i) => (
            <FlagLine key={`${x.message}-${i}`} flag={x}>
              {x === wrongTable && canMove ? (
                <button type="button" className="vb-btn small warn" onClick={() => updateTree(t.id, { table: other })}>
                  Move to {other}-tree table
                </button>
              ) : null}
            </FlagLine>
          ))}
        </div>
      );
    };

    return (
      <div key={t.id} className={`vb-tree${flags.some((x) => x.level === "error") ? " has-error" : ""}`}>
        <div className="vb-tree-head">
          <span className="vb-tree-title">
            Tree {t.number || "?"} <span className="vb-es">{t.table === "large" ? "Árbol grande" : "Árbol pequeño"}</span>
          </span>
          <button type="button" className="vb-btn small ghost" onClick={() => removeTree(t.id)} aria-label={`Remove tree ${t.number}`}>
            Remove
          </button>
        </div>
        <div className="vb-tree-grid">
          <Field id={id("number")} label="Tree number" es="Número del árbol">
            <input
              id={id("number")}
              className="vb-input"
              autoComplete="off"
              autoCapitalize="characters"
              value={t.number}
              aria-invalid={f("number").some((x) => x.level === "error")}
              onChange={(e) => updateTree(t.id, { number: e.target.value })}
              onBlur={() => touch(`${t.id}:number`)}
            />
          </Field>
          <Field id={id("species")} label="Species" es="Especie">
            <input
              id={id("species")}
              className="vb-input"
              list="vb-species"
              autoComplete="off"
              value={t.species}
              aria-invalid={f("species").some((x) => x.level === "error")}
              onChange={(e) => updateTree(t.id, { species: e.target.value })}
              onBlur={() => touch(`${t.id}:species`)}
            />
          </Field>
          {rowFlags(["number", "species"])}
          {num("dbhCm", "DBH", "Diámetro (DNP)", "cm")}
          {num("heightM", "Total height", "Altura total", "m")}
          {rowFlags(["dbhCm", "heightM"])}
          {num("crownM", "Crown length", "Longitud de la copa", "m")}
          <Field id={id("vigor")} label="Vigor" es="Vigor">
            <select
              id={id("vigor")}
              className="vb-input"
              value={t.values.vigor}
              aria-invalid={f("vigor").some((x) => x.level === "error")}
              onChange={(e) => {
                updateValue(t, "vigor", e.target.value);
                touch(`${t.id}:vigor`);
              }}
              onBlur={() => touch(`${t.id}:vigor`)}
            >
              <option value="">Choose…</option>
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={String(v)}>
                  {v} {VIGOR[v]} · {VIGOR_ES[v]}
                </option>
              ))}
            </select>
          </Field>
          {rowFlags(["crownM", "vigor"])}
          {num("azimuthDeg", "Azimuth to center", "Azimut al centro", "°", "numeric")}
          {num("distanceM", "Distance", `Distancia · máx ${r} m`, "m")}
          {rowFlags(["azimuthDeg", "distanceM"])}
        </div>
        <details className="vb-more" open={["increment5yMm", "defectUpper", "defectMiddle", "defectLower"].some((k) => f(k).length > 0) || undefined}>
          <summary>Growth and defects</summary>
          <div className="vb-tree-grid">
            {num("increment5yMm", "5-year increment", "Incremento 5 años", "mm")}
            {num("defectUpper", "Defect upper", "Defecto superior", "%")}
            {num("defectMiddle", "Defect middle", "Defecto media", "%")}
            {num("defectLower", "Defect lower", "Defecto baja", "%")}
            {rowFlags(["increment5yMm", "defectUpper", "defectMiddle", "defectLower"])}
          </div>
        </details>
      </div>
    );
  }

  const large = draft.trees.filter((t) => t.table === "large");
  const small = draft.trees.filter((t) => t.table === "small");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        tryFinish();
      }}
      noValidate
    >
      <datalist id="vb-species">
        {SPECIES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="vb-plots">
        {sampleOrder.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="vb-aspects">
        {ASPECTS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <section className="vb-card" aria-labelledby="hdr">
        <div className="vb-card-head">
          <div>
            <h2 id="hdr">Plot {draft.plotNumber || "—"}</h2>
            <p className="vb-sub">Plot header · Encabezado del punto de muestreo</p>
          </div>
          {isSeedPlot ? <SampleTag /> : null}
        </div>
        <div className="vb-grid">
          <Field id="carId" label="CAR ID" es="ID CAR" flags={headerFlags("carId")}>
            <input id="carId" className="vb-input" value={draft.carId} onChange={(e) => set("carId", e.target.value)} onBlur={() => touch("h:carId")} />
          </Field>
          <Field id="plotNumber" label="Plot number" es="Núm. punto de muestreo" flags={headerFlags("plotNumber")}>
            <input
              id="plotNumber"
              className="vb-input"
              list="vb-plots"
              inputMode="numeric"
              value={draft.plotNumber}
              onChange={(e) => set("plotNumber", e.target.value)}
              onBlur={() => touch("h:plotNumber")}
            />
          </Field>
          <Field id="date" label="Date" es="Fecha" flags={headerFlags("date")}>
            <input id="date" type="date" className="vb-input" value={draft.date} onChange={(e) => set("date", e.target.value)} onBlur={() => touch("h:date")} />
          </Field>
          <Field id="leader" label="Group leader" es="Líder del grupo" flags={headerFlags("leader")}>
            <input id="leader" className="vb-input" value={draft.leader} onChange={(e) => set("leader", e.target.value)} onBlur={() => touch("h:leader")} />
          </Field>
          <Field label="Technicians" es="Técnico #1-#4" span flags={headerFlags("technicians")}>
            <div className="vb-techs">
              {draft.technicians.map((tech, i) => (
                <input
                  key={i}
                  aria-label={`Technician ${i + 1}`}
                  placeholder={`#${i + 1}`}
                  className="vb-input"
                  value={tech}
                  onChange={(e) => set("technicians", draft.technicians.map((x, j) => (j === i ? e.target.value : x)))}
                  onBlur={() => touch("h:technicians")}
                />
              ))}
            </div>
          </Field>
          <Field id="slope" label="Slope" es="Pendiente" flags={headerFlags("slopePct")}>
            <div className="vb-unit">
              <input id="slope" className="vb-input" inputMode="decimal" value={draft.slopePct} onChange={(e) => set("slopePct", e.target.value)} />
              <span>%</span>
            </div>
          </Field>
          <Field id="aspect" label="Aspect" es="Aspecto">
            <input id="aspect" className="vb-input" list="vb-aspects" autoCapitalize="characters" value={draft.aspect} onChange={(e) => set("aspect", e.target.value)} />
          </Field>
          <Field id="lat" label="Latitude" es="Latitud">
            <input id="lat" className="vb-input" inputMode="text" value={draft.lat} onChange={(e) => set("lat", e.target.value)} onBlur={() => touch("h:coords")} />
          </Field>
          <Field id="lon" label="Longitude" es="Longitud">
            <input id="lon" className="vb-input" inputMode="text" value={draft.lon} onChange={(e) => set("lon", e.target.value)} onBlur={() => touch("h:coords")} />
          </Field>
          {headerFlags("coords").length ? (
            <div className="vb-span">
              <FlagList flags={headerFlags("coords")} />
            </div>
          ) : null}
          <Field id="notes" label="Notes" es="Notas" span>
            <textarea id="notes" className="vb-input" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="vb-card" aria-labelledby="large">
        <div className="vb-card-head">
          <div>
            <h2 id="large">Large trees</h2>
            <p className="vb-sub">DBH ≥ 30 cm · 1/25 ha · {LARGE_RADIUS} m radius · Árboles grandes</p>
          </div>
        </div>
        {large.length === 0 ? <p className="vb-empty">No large trees yet.</p> : large.map(treeCard)}
        <button type="button" className="vb-btn block" onClick={() => addTree("large")}>
          + Add large tree
        </button>
      </section>

      <section className="vb-card" aria-labelledby="small">
        <div className="vb-card-head">
          <div>
            <h2 id="small">Small trees</h2>
            <p className="vb-sub">5 ≤ DBH &lt; 30 cm · 1/100 ha · {SMALL_RADIUS} m radius · Árboles pequeños</p>
          </div>
        </div>
        {small.length === 0 ? <p className="vb-empty">No small trees yet.</p> : small.map(treeCard)}
        <button type="button" className="vb-btn block" onClick={() => addTree("small")}>
          + Add small tree
        </button>
      </section>

      <section className="vb-card" aria-labelledby="finish">
        <div className="vb-card-head">
          <h2 id="finish">Plot check</h2>
          <span className="vb-sub">{draft.trees.length} {draft.trees.length === 1 ? "tree" : "trees"}</span>
        </div>
        <Counts errors={check.errors} warnings={check.warnings} />
        <FlagList flags={check.all} showWhere />
        <div className="vb-finish">
          <Field id="tco2" label="Plot tCO2/ha" es="From CALCBOSK, typed in" flags={tco2Error ? [{ level: "error", where: "", message: tco2Error }] : []}>
            <div className="vb-unit">
              <input id="tco2" className="vb-input" inputMode="decimal" value={draft.tco2Ha} onChange={(e) => set("tco2Ha", e.target.value)} />
              <span>t/ha</span>
            </div>
          </Field>
          <button type="submit" className="vb-btn primary" disabled={!canFinish} aria-disabled={!canFinish}>
            Finish plot
          </button>
        </div>
        {finishBlocker ? <FlagLine flag={{ level: "error", where: "", message: finishBlocker }} /> : null}
        {!canFinish && !finishBlocker ? (
          <p className="vb-note">
            {check.errors > 0
              ? `Fix ${check.errors} ${check.errors === 1 ? "error" : "errors"} to finish. Checks don't block.`
              : "Enter the plot's tCO2/ha to finish."}
          </p>
        ) : null}
      </section>
    </form>
  );
}
