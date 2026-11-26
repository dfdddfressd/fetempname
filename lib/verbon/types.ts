export type TreeTable = "large" | "small";

export type VigorCode = 1 | 2 | 3 | 4 | 5;

export interface Tree {
  number: string; // "Número del árbol": 1,2,3... (large) or A,B,C... (small)
  species: string; // "Especie"
  dbhCm: number | null; // "Diámetro (cm)" = DNP / DBH
  heightM: number | null; // "Altura total (m)"
  crownM: number | null; // "Longitud de la copa"
  vigor: number | null; // 1-5, see VIGOR. Kept as number so out-of-range codes can be flagged.
  azimuthDeg: number | null; // "Grados azimut del árbol al centro"
  distanceM: number | null; // horizontal distance from plot center
  increment5yMm?: number | null; // "Incremento en los últimos 5 años (mm)"
  defectUpper?: number | null; // % 0-100 ("Superior")
  defectMiddle?: number | null; // ("Media")
  defectLower?: number | null; // ("Baja")
  table: TreeTable;
}

export interface Plot {
  carId: string; // "ID CAR"
  plotNumber: string; // "Número del Punto de Muestreo"
  date: string; // "Fecha" (ISO)
  leader: string; // "Líder del Grupo"
  technicians: string[]; // "Técnico #1-#4"
  slopePct: number | null; // "Pendiente %"
  aspect: string | null; // "Aspecto"
  lat: number | null; // "Latitud"
  lon: number | null; // "Longitud" (negative in Mexico)
  trees: Tree[];
  notes: string; // "Notas"
  verifierTco2Ha?: number; // entered after CALCBOSK (demo: typed in)
}

export interface ActivityArea {
  name: string;
  hectares: number;
  strata: 1 | 2 | 3;
  developerMeanTco2Ha: number; // C6 in CAR's sheet
  sampleOrder: string[]; // plot numbers in CALCBOSK's random order
}

export type FlagLevel = "error" | "warning";

export interface Flag {
  level: FlagLevel; // error blocks "Finish plot"; warning asks to double-check
  where: string; // "Plot 047, tree B"
  message: string;
}
