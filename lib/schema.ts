import type { AnalyteCode } from "./types";

/**
 * Soil properties published for Isometric Certify measurement type ew_soil.
 * Source: https://docs.isometric.com/user-guides/certify/measurement-samples
 * Reviewed October 26, 2026.
 *
 * Certify's project CSV template is downloaded inside a project and can change
 * with the protocol version. This map is the public property list, not that template.
 */
export const SOIL_PROPERTIES: Record<
  AnalyteCode,
  { quantityKind: string; qualifier: string; canonicalUnit: "mg/kg" | "pH" }
> = {
  Ca: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_CA", canonicalUnit: "mg/kg" },
  Mg: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_MG", canonicalUnit: "mg/kg" },
  Na: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_NA", canonicalUnit: "mg/kg" },
  K: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_K", canonicalUnit: "mg/kg" },
  Ti: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_TI", canonicalUnit: "mg/kg" },
  Al: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_AL", canonicalUnit: "mg/kg" },
  Fe: { quantityKind: "MASS_FRACTION", qualifier: "ELEMENT_FE", canonicalUnit: "mg/kg" },
  pH: { quantityKind: "ACIDITY", qualifier: "", canonicalUnit: "pH" },
};

export const DEPTH_MIN = { quantityKind: "DEPTH", qualifier: "MIN_LIMIT", unit: "cm" };
export const DEPTH_MAX = { quantityKind: "DEPTH", qualifier: "MAX_LIMIT", unit: "cm" };

/** Samples required before a modified z-score is stable enough to show. */
export const OUTLIER_MIN_SAMPLES = 6;

/** Iglewicz and Hoaglin: flag when the absolute modified z-score exceeds 3.5. */
export const OUTLIER_Z = 3.5;

/**
 * Relative gap above which two lab values are not collapsed into one number.
 * This is an MVP rule so the export does not invent a compromise. It is not a registry threshold.
 */
export const CROSS_LAB_FRACTION = 0.15;

/**
 * Mass fraction of elemental Ti in TiO2, from IUPAC standard atomic weights
 * Ti = 47.867 and O = 15.999.
 */
export const TI_FRACTION_OF_TIO2 = 47.867 / (47.867 + 15.999 * 2);
