# Sampleproof

Pre-submission sample ledger for enhanced rock weathering. Upload a sample manifest and lab files, get one harmonized dataset, a quality report, and an export shaped like public [Isometric Certify](https://docs.isometric.com/user-guides/certify/measurement-samples) fields.

It does not calculate tonnes removed, run a TiCAT significance test, or train a model. It is not a file you upload straight into Certify. Certify assigns `measurement_location_id` values after locations are uploaded, and the project CSV template inside Certify is the authority for a real submission.

Processing runs in the browser. Files are not sent to a server.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and load the demo project. `npm test` checks the parsers, the planted demo issues, and the export.

## What the check does

1. Read a manifest (`sample_id`, farm, plot, plot type, depth, collection date, collector, coordinates, location id).
2. Read lab CSVs in one of three example layouts: a wide cation table, a long analyte table, or a certificate with preamble rows. Those layouts are named Northline, Helio, and Fieldstone in the demo. They are not a real laboratory’s format.
3. Convert elemental results to mg/kg. ppm is treated as mg/kg. Percent is a mass fraction. TiO2 percent is converted to elemental titanium with IUPAC atomic weights. Solution units such as mg/L are rejected.
4. Report missing samples, manifest ids with no lab row, duplicate manifest rows, cross-lab gaps above 15%, unreadable values, modified z-score outliers above 3.5 (only with at least six samples), and chain-of-custody gaps.
5. Export a wide dataset, a long measurement file, a location CSV (`name`, `reference_id`, `latitude`, `longitude`), an audit trail, and the quality report. Conflicting analytes are left blank.

The 15% rule and the outlier screen are MVP choices so the export does not invent a number. They are not registry rules.

## Schema notes

Reviewed October 26, 2026:

- [Certify field measurements](https://docs.isometric.com/user-guides/certify/field-measurements) — required sample fields are `supplier_reference_id`, `measurement_location_id`, and `measurement_date`.
- [Measurement samples](https://docs.isometric.com/user-guides/certify/measurement-samples) — soil quantity kinds and qualifiers for `ew_soil`.
- [Site reference](https://docs.isometric.com/user-guides/certify/project-assets/sites-reference) — location CSV columns, and plot types `control`, `treatment`, `deployment`, `research`.
- [Cascade ERW Data Quarry variable list](https://cascadeclimate.org/cascadeclimate-data-quarry-variable-list.pdf) — sample-level variables. Cascade says the quarry schema is still changing, so this app does not claim a Quarry-compatible file.

## Next

Replace the three example lab parsers with a pilot’s real exports. Until those files exist, the parsers are illustrations of the shapes teams reconcile by hand.
