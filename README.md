# Verbon

Field workflow for independent carbon-credit verifiers (VVBs). The MVP covers one forest-carbon verification under the **Climate Action Reserve (CAR) Mexico Forest Protocol v3.0**:

1. **Field form**: enter a plot on a phone. Errors and checks appear while typing. Errors block "Finish plot"; checks don't.
2. **Sampling tracker**: each finished plot updates CAR's sequential sampling test live (pass or inconclusive, the passing run, plots still needed at best).
3. **Reconciliation**: import the developer's tree list (CSV), flag every mismatch, label one-digit DBH differences as likely transcription errors, and export draft findings (CSV or copy).

Everything runs in the browser. There is no backend; demo state is kept in `localStorage` so a refresh doesn't lose it. **Reset demo** restores the seeded state. All data is fictional.

Out of scope: computing tCO2/ha from tree measurements (that is CAR's CALCBOSK tool). The verifier types each plot's tCO2/ha, and the developer's per-plot tCO2/ha comes from the seeded plot list or the developer CSV.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm test` runs the rule tests; `npm run typecheck` and `npm run build` should be clean.

## Demo script (about 2 minutes)

The app opens on **Demo Ejido, Activity Area 1** (1,500 ha, 1 stratum, developer mean 180 tCO2/ha), with seven plots already passing and plot **047** open with tree 1 entered.

1. **+ Add large tree**. Enter tree **B**: Pinus, DBH 23.0, height 18.0, crown 7, vigor 2, azimuth 200, distance 4.0. The form says "under 30 cm: belongs in the small-tree table". Tap **Move to small-tree table**; the error clears.
2. **+ Add large tree**. Enter tree **3**: Quercus, DBH 41.0, height 15.0, crown 6, vigor 1, azimuth 75, distance **12.4**. The form says "outside the 11.28 m plot radius". Change it to **10.0**.
3. Enter plot tCO2/ha **176** and tap **Finish plot**. The Sampling tab opens: plot 047 is the 8th passing plot in a row, and the banner turns to **Sequential sampling passed**.
4. **Reconcile** tab: **Load developer data**. Plot 047 shows tree B (13.0 vs 23.0 cm, "Differs by one digit: likely transcription error"), tree 3 (species mismatch) and tree 4 (not found in the field). **Export draft findings** or **Copy findings**.

## Where the rules live

| File | What |
|---|---|
| `lib/verbon/fieldChecks.ts` | `validatePlot`: field-form checks (FOR-P04-21 / CAR MFP v3.0) |
| `lib/verbon/sampling.ts` | `SequentialSampling` (CAR `Sequential_Sampling_Mexico_ESP_V3.0.xlsm`) and the optional `confidenceDeduction` helper |
| `lib/verbon/reconcile.ts` | `compareTrees` with configurable tolerances (`DBH_TOLERANCE_CM`, `HEIGHT_TOLERANCE_PCT`, placeholders) |
| `lib/verbon/developerCsv.ts` | Developer CSV import and validation |
| `lib/verbon/draft.ts` | Form state (raw strings) to `Plot`, and per-field flag placement |
| `lib/verbon/seed.ts` | Fictional demo data |

These are a 1:1 port of the reference Python in the build spec (Appendix A). Rule constants and messages are unchanged. `SequentialSampling` takes `firstPassAfter12RuleAllPlots` (default `true`, per CAR's written instructions; `false` mirrors the sheet, which applies the rule only to plots 13-17).

Developer CSV format:

```
plot,table,tree,species,dbh_cm,height_m,vigor,plot_tco2_ha
047,large,1,Pinus,34.2,21.0,2,180
047,small,B,Pinus,13.0,18.0,2,180
```

## Earlier prototype

Sampleproof, the earlier enhanced-rock-weathering sample ledger, is still in the repo at [`/sampleproof`](http://localhost:3000/sampleproof) (`components/Workbench.tsx`, `lib/*.ts`). Delete `app/(sampleproof)`, `components/Workbench.tsx` and the non-`verbon` files in `lib/` to drop it.
