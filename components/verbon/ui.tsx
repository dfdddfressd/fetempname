"use client";

import type { ReactNode } from "react";
import type { Flag } from "@/lib/verbon/types";

export function Logo() {
  // public/verbon-logo.png is 588 x 187 (cream wordmark, green leaf, transparent).
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="vb-logo" src="/verbon-logo.png" alt="Verbon" width={110} height={35} />;
}

export function SampleTag() {
  return <span className="vb-sample">Sample data</span>;
}

export function FlagLine({ flag, showWhere = false, children }: { flag: Flag; showWhere?: boolean; children?: ReactNode }) {
  return (
    <div className={`vb-flag ${flag.level}`} role={flag.level === "error" ? "alert" : "status"}>
      <b>{flag.level === "error" ? "Error" : "Check"}</b>
      <span>
        {showWhere ? <span className="vb-flag-where">{flag.where}: </span> : null}
        {flag.message}
        {children ? <div className="vb-flag-action">{children}</div> : null}
      </span>
    </div>
  );
}

export function FlagList({ flags, showWhere = false }: { flags: Flag[]; showWhere?: boolean }) {
  if (flags.length === 0) return null;
  return (
    <div>
      {flags.map((f, i) => (
        <FlagLine key={`${f.where}-${f.message}-${i}`} flag={f} showWhere={showWhere} />
      ))}
    </div>
  );
}

export function Field({
  id,
  label,
  es,
  flags = [],
  span = false,
  children,
}: {
  id?: string;
  label: string;
  es?: string;
  flags?: Flag[];
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`vb-field${span ? " vb-span" : ""}`}>
      {id ? (
        <label htmlFor={id}>
          {label}
          {es ? <span className="vb-es">{es}</span> : null}
        </label>
      ) : (
        <span className="vb-label">
          {label}
          {es ? <span className="vb-es">{es}</span> : null}
        </span>
      )}
      {children}
      <FlagList flags={flags} />
    </div>
  );
}

export function Counts({ errors, warnings }: { errors: number; warnings: number }) {
  return (
    <div className="vb-summary-counts" aria-live="polite">
      {errors === 0 && warnings === 0 ? <span className="vb-pill ok">✓ No flags</span> : null}
      {errors > 0 ? (
        <span className="vb-pill error">
          {errors} {errors === 1 ? "Error" : "Errors"}
        </span>
      ) : null}
      {warnings > 0 ? (
        <span className="vb-pill warning">
          {warnings} {warnings === 1 ? "Check" : "Checks"}
        </span>
      ) : null}
    </div>
  );
}

export function fmt(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return r.toLocaleString("en-US", { maximumFractionDigits: digits });
}
