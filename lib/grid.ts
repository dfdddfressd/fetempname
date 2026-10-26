import Papa from "papaparse";

export function parseGrid(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: false,
  });
  return parsed.data.map((row) => (row ?? []).map((cell) => String(cell ?? "").trim()));
}

export function normHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

export function findHeaderRow(
  rows: string[][],
  predicate: (headers: string[]) => boolean,
  limit = 40,
): number {
  const stop = Math.min(rows.length, limit);
  for (let index = 0; index < stop; index += 1) {
    if (isBlankRow(rows[index])) continue;
    if (predicate(rows[index].map(normHeader))) return index;
  }
  return -1;
}

export function indexByAlias(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader);
  for (const alias of aliases) {
    const match = normalized.indexOf(normHeader(alias));
    if (match >= 0) return match;
  }
  return -1;
}

export function toCsv(rows: Array<Array<string | number | null>>): string {
  return Papa.unparse(rows.map((row) => row.map((cell) => (cell === null ? "" : cell))), {
    newline: "\n",
  });
}
