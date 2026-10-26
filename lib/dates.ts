const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Accepts ISO dates, US numeric dates (month/day/year), and dates like 2 Mar 2026.
 * Numeric dates are read month-first because that is the usual US lab export.
 */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  const numeric = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (numeric) return iso(+numeric[3], +numeric[1], +numeric[2]);

  const named = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{4})$/.exec(value);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    return iso(+named[3], month, +named[1]);
  }

  return null;
}

export function parseDepth(raw: string): { min: number | null; max: number | null } | null {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/centimeters?|cm/g, "")
    .replace(/[–—]/g, "-")
    .trim();
  if (!value) return { min: null, max: null };

  const range = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(value);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (max < min) return null;
    return { min, max };
  }

  const single = /^(-?\d+(?:\.\d+)?)$/.exec(value);
  if (single) {
    const depth = Number(single[1]);
    return { min: depth, max: depth };
  }

  return null;
}
