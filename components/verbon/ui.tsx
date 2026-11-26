"use client";

import type { ReactNode } from "react";
import type { Flag } from "@/lib/verbon/types";

export function Logo() {
  return (
    <span className="vb-logo" aria-label="verbon">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6 L16 28 L29 6" stroke="#6B8F4E" />
          <path d="M9 6 L16 18 L23 6" stroke="#B5CBA6" />
          <path d="M13.5 6 L16 10.5 L18.5 6" stroke="#D9B25F" />
        </g>
      </svg>
      <span aria-hidden="true">verbon</span>
    </span>
  );
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
