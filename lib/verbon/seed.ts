// Fictional demo data only. No real project or client data.
import type { ActivityArea, Plot, Tree } from "./types";

export const DEMO_AREA: ActivityArea = {
  name: "Demo Ejido, Activity Area 1",
  hectares: 1500,
  strata: 1,
  developerMeanTco2Ha: 180,
  sampleOrder: ["012", "033", "007", "051", "020", "044", "003", "047", "029", "058", "016", "039"],
};

// Developer's per-plot tCO2/ha, known before the field trip. The developer CSV import
// can update these.
export const DEMO_DEVELOPER_TCO2: Record<string, number> = {
  "012": 182,
  "033": 175,
  "007": 190,
  "051": 168,
  "020": 185,
  "044": 177,
  "003": 181,
  "047": 179,
  "029": 183,
  "058": 172,
  "016": 186,
  "039": 178,
};

// Plots already verified before the demo, in sample order. tCO2/ha only.
export const DEMO_COMPLETED: Array<{ plotNumber: string; verifierTco2Ha: number }> = [
  { plotNumber: "012", verifierTco2Ha: 178 },
  { plotNumber: "033", verifierTco2Ha: 180 },
  { plotNumber: "007", verifierTco2Ha: 186 },
  { plotNumber: "051", verifierTco2Ha: 171 },
  { plotNumber: "020", verifierTco2Ha: 181 },
  { plotNumber: "044", verifierTco2Ha: 179 },
  { plotNumber: "003", verifierTco2Ha: 184 },
];

export function demoTree(partial: Partial<Tree> & Pick<Tree, "number" | "table">): Tree {
  return {
    species: "",
    dbhCm: null,
    heightM: null,
    crownM: null,
    vigor: null,
    azimuthDeg: null,
    distanceM: null,
    increment5yMm: null,
    defectUpper: null,
    defectMiddle: null,
    defectLower: null,
    ...partial,
  };
}

// Plot 047 as it opens in the demo: header filled, tree 1 already measured.
// The presenter adds tree B and tree 3 live.
export const DEMO_PLOT_047_START: Plot = {
  carId: "CAR-DEMO-01",
  plotNumber: "047",
  date: "2026-11-20",
  leader: "JV",
  technicians: ["AB", "", "", ""],
  slopePct: 22,
  aspect: "NE",
  lat: 19.43,
  lon: -101.95,
  notes: "",
  trees: [
    demoTree({ number: "1", table: "large", species: "Pinus", dbhCm: 34.0, heightM: 21.5, crownM: 8, vigor: 2, azimuthDeg: 120, distanceM: 6.1 }),
  ],
};

// Plot 047 as the demo ends, after the fixes.
export const DEMO_PLOT_047_FINAL_TREES: Tree[] = [
  DEMO_PLOT_047_START.trees[0],
  demoTree({ number: "3", table: "large", species: "Quercus", dbhCm: 41.0, heightM: 15.0, crownM: 6, vigor: 1, azimuthDeg: 75, distanceM: 10.0 }),
  demoTree({ number: "B", table: "small", species: "Pinus", dbhCm: 23.0, heightM: 18.0, crownM: 7, vigor: 2, azimuthDeg: 200, distanceM: 4.0 }),
];

export const DEMO_DEVELOPER_FILENAME = "demo_ejido_aa1_developer_trees.csv";

export const DEMO_DEVELOPER_CSV = `plot,table,tree,species,dbh_cm,height_m,vigor,plot_tco2_ha
047,large,1,Pinus,34.2,21.0,2,179
047,small,B,Pinus,13.0,18.0,2,179
047,large,3,Pinus,41.0,15.0,1,179
047,large,4,Quercus,30.5,14.0,2,179
`;
