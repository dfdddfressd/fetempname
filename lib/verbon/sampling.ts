// Port of SequentialSampling (Appendix A), from CAR Sequential_Sampling_Mexico_ESP_V3.0.xlsm.

export const TOLERANCE = 0.1;
export const ALPHA = 0.05;
export const BETA = 0.2;
// NormalDist().inv_cdf(ALPHA) and inv_cdf(BETA)
export const Z_ALPHA = -1.6448536269514722;
export const Z_BETA = -0.8416212335729143;

export type HectareClass = "<200" | "201-2000" | "2001-4000" | ">4000";

export const MIN_PLOTS: Record<1 | 2 | 3, Record<HectareClass, number>> = {
  1: { "<200": 6, "201-2000": 8, "2001-4000": 10, ">4000": 12 },
  2: { "<200": 4, "201-2000": 6, "2001-4000": 7, ">4000": 8 },
  3: { "<200": 3, "201-2000": 4, "2001-4000": 5, ">4000": 6 },
};

export function hectareClass(ha: number): HectareClass {
  return ha < 200 ? "<200" : ha <= 2000 ? "201-2000" : ha <= 4000 ? "2001-4000" : ">4000";
}

export type TestResult = "Pass" | "Inconclusive" | "Inconclusive (H1)";
export type SamplingStatus = "Sequential sampling passed" | "Sequential sampling not passed";

export interface PlotResult {
  n: number;
  plotNumber: string;
  projectTco2Ha: number;
  verifierTco2Ha: number;
  test: TestResult;
  passesInSequence: number;
  status: SamplingStatus;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Sample standard deviation (n - 1), as Python statistics.stdev and Excel STDEV.
function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export class SequentialSampling {
  readonly mean: number;
  readonly minPlots: number;
  readonly za = Z_ALPHA;
  readonly zb = Z_BETA;
  readonly k: number;
  readonly results: PlotResult[] = [];
  private readonly after12All: boolean;
  private readonly diffs: number[] = [];

  constructor(areaMeanTco2Ha: number, strata: 1 | 2 | 3, hectares: number, firstPassAfter12RuleAllPlots = true) {
    this.mean = areaMeanTco2Ha;
    this.minPlots = MIN_PLOTS[strata][hectareClass(hectares)];
    const d0 = this.mean;
    const d1 = TOLERANCE * this.mean + d0;
    const md0 = d0 - this.mean;
    const md1 = d1 - d0;
    this.k = (this.za * md1 + this.zb * md0) / (this.za + this.zb);
    this.after12All = firstPassAfter12RuleAllPlots;
  }

  addPlot(plotNumber: string, project: number, verifier: number): PlotResult {
    const n = this.results.length + 1;
    this.diffs.push(project - verifier);
    let test: TestResult;
    if (n === 1) {
      test = Math.abs(project - verifier) < TOLERANCE * verifier ? "Pass" : "Inconclusive";
    } else {
      const kRun = mean(this.diffs);
      const lRun = stdev(this.diffs);
      const nThresh = ((this.za + this.zb) ** 2 * lRun ** 2) / (TOLERANCE * this.mean) ** 2;
      if (n > nThresh) {
        test = kRun > this.k ? "Inconclusive (H1)" : kRun < -this.k ? "Inconclusive" : "Pass";
      } else {
        test = "Inconclusive";
      }
    }
    const prev = this.results.length ? this.results[this.results.length - 1].passesInSequence : 0;
    const run = test === "Pass" ? prev + 1 : 0;
    const after12 = n > 12 && test === "Pass" && (this.after12All || n <= 17);
    const status: SamplingStatus =
      run >= this.minPlots || after12 ? "Sequential sampling passed" : "Sequential sampling not passed";
    const r: PlotResult = {
      n,
      plotNumber,
      projectTco2Ha: project,
      verifierTco2Ha: verifier,
      test,
      passesInSequence: run,
      status,
    };
    this.results.push(r);
    return r;
  }

  get passed(): boolean {
    return this.results.length > 0 && this.results[this.results.length - 1].status === "Sequential sampling passed";
  }

  plotsStillNeeded(): number {
    if (this.passed) return 0;
    const run = this.results.length ? this.results[this.results.length - 1].passesInSequence : 0;
    return Math.max(this.minPlots - run, 1);
  }
}

// Optional: carbon spreadsheet row 15 (confidence deduction)
export const TSE: Record<number, number> = {
  1: 0.05, 2: 0.07, 3: 0.08, 4: 0.09, 5: 0.1, 6: 0.11, 7: 0.12, 8: 0.13,
  9: 0.14, 10: 0.15, 11: 0.16, 12: 0.17, 13: 0.18, 14: 0.19, 15: 0.2,
};

export function confidenceDeduction(samplingError: number, activityAreas: number): number {
  const thr = TSE[activityAreas] ?? 0.2;
  if (samplingError <= thr) return 0.0;
  if (samplingError <= 0.2) return samplingError - thr;
  return 1.0;
}
