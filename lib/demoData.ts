export const DEMO_MANIFEST_FILENAME = "northfield-manifest.csv";

export const DEMO_MANIFEST = `sample_id,farm,plot,plot_type,depth_top_cm,depth_bottom_cm,collected_date,collector,latitude,longitude,location_id
NF-001,North Farm,A1,treatment,0,10,2026-03-02,A. Okonkwo,40.1123,-75.4410,LOC-A1-01
NF-002,North Farm,A1,treatment,10,30,2026-03-02,A. Okonkwo,40.1123,-75.4410,LOC-A1-01
NF-003,North Farm,A2,control,0,10,2026-03-02,A. Okonkwo,40.1188,-75.4362,LOC-A2-01
NF-003,North Farm,A2,control,0,10,2026-03-02,A. Okonkwo,40.1188,-75.4362,LOC-A2-01
NF-004,North Farm,A2,control,10,30,2026-03-03,,40.1188,-75.4362,LOC-A2-02
NF-005,South Farm,B1,treatment,0,10,2026-03-04,M. Chen,40.0910,-75.4702,LOC-B1-01
NF-006,South Farm,B1,treatment,10,30,2026-03-04,M. Chen,40.0910,-75.4702,LOC-B1-01
NF-007,South Farm,B2,control,0,10,2026-03-04,M. Chen,40.0866,-75.4680,LOC-B2-01
NF-008,South Farm,B2,control,10,30,2026-03-12,M. Chen,40.0866,-75.4680,LOC-B2-02
`;

export const DEMO_NORTHLINE_FILENAME = "northline-cations.csv";

export const DEMO_NORTHLINE = `Client Sample ID,Date Received,Date Reported,Ca (mg/kg),Mg (mg/kg),Na (mg/kg),K (mg/kg),Ti (mg/kg),Al (mg/kg),Fe (mg/kg),pH
NF-001,2026-03-06,2026-03-18,4120,1860,210,1420,3680,48200,22100,6.4
NF-002,2026-03-06,2026-03-18,3890,1740,198,1380,3510,46900,21400,6.3
NF-003,2026-03-06,2026-03-18,4410,2010,240,1510,3900,51000,23800,6.1
NF-004,2026-03-07,2026-03-18,85000,1920,225,1475,3740,49800,22900,6.2
NF-008,2026-03-04,2026-03-18,4280,1795,205,1402,3605,47500,21850,6.5
`;

export const DEMO_HELIO_FILENAME = "helio-results.csv";

export const DEMO_HELIO = `SAMPLE_NO,ANALYTE,RESULT,UNITS,METHOD,ANALYSIS_DATE,DATE_RECEIVED
NF-001,Calcium,9050,ppm,ICP-OES,2026-03-20,2026-03-08
NF-001,Magnesium,1910,ppm,ICP-OES,2026-03-20,2026-03-08
NF-001,Sodium,206,ppm,ICP-OES,2026-03-20,2026-03-08
NF-001,Potassium,1395,ppm,ICP-OES,2026-03-20,2026-03-08
NF-001,Titanium,0.37,%,XRF,2026-03-20,2026-03-08
NF-001,Aluminum,4.90,%,XRF,2026-03-20,2026-03-08
NF-001,Iron,2.18,%,XRF,2026-03-20,2026-03-08
NF-001,pH,6.5,pH,1:1 water,2026-03-20,2026-03-08
NF-005,Calcium,2710,ppm,ICP-OES,2026-03-21,2026-03-09
NF-005,Magnesium,1560,ppm,ICP-OES,2026-03-21,2026-03-09
NF-005,Sodium,190,ppm,ICP-OES,2026-03-21,2026-03-09
NF-005,Potassium,1310,ppm,ICP-OES,2026-03-21,2026-03-09
NF-005,Titanium,0.36,%,XRF,2026-03-21,2026-03-09
NF-005,Aluminum,4.20,%,XRF,2026-03-21,2026-03-09
NF-005,Iron,1.90,%,XRF,2026-03-21,2026-03-09
NF-005,pH,5.9,pH,1:1 water,2026-03-21,2026-03-09
NF-006,Calcium,2505,ppm,ICP-OES,2026-03-21,2026-03-09
NF-006,Magnesium,1475,ppm,ICP-OES,2026-03-21,2026-03-09
NF-006,Sodium,172,ppm,ICP-OES,2026-03-21,2026-03-09
NF-006,Potassium,12.4,mg/L,ICP-OES,2026-03-21,2026-03-09
NF-006,Titanium,0.34,%,XRF,2026-03-21,2026-03-09
NF-006,Aluminum,3.80,%,XRF,2026-03-21,2026-03-09
NF-006,Iron,1.70,%,XRF,2026-03-21,2026-03-09
NF-006,pH,6.0,pH,1:1 water,2026-03-21,2026-03-09
HX-999,Calcium,3100,ppm,ICP-OES,2026-03-21,2026-03-09
HX-999,pH,5.8,pH,1:1 water,2026-03-21,2026-03-09
`;

export const DEMO_FIELDSTONE_FILENAME = "fieldstone-certificate.csv";

export const DEMO_FIELDSTONE = `Fieldstone Assay Co.
Certificate FS-2026-118
Prepared for: Northfield pilot

Sample Number,Depth (cm),Ca ppm,Mg ppm,Na ppm,K ppm,TiO2 %,pH (1:1 water),Date Received,Date Reported
NF-002,10-30,4010,1802,204,1410,0.59,6.2,2026-03-07,2026-03-19
NF-005,0-10,2688,1540,188,1295,0.60,5.9,2026-03-09,2026-03-19
NF-006 ,10-30,2550,1490,176,1330,0.57,pending,2026-03-09,2026-03-19
NF-008,15,4330,1820,211,1444,0.60,6.4,2026-03-04,2026-03-19
`;

export const DEMO_LABS = [
  { filename: DEMO_NORTHLINE_FILENAME, text: DEMO_NORTHLINE },
  { filename: DEMO_HELIO_FILENAME, text: DEMO_HELIO },
  { filename: DEMO_FIELDSTONE_FILENAME, text: DEMO_FIELDSTONE },
];

export const DEMO_NOTES = [
  "NF-003 is duplicated on the manifest.",
  "NF-007 was never returned by a lab.",
  "HX-999 is a lab id that is not on the manifest.",
  "NF-001 calcium disagrees between Northline and Helio.",
  "Helio reported NF-006 potassium in mg/L.",
  "Fieldstone wrote “pending” for NF-006 pH.",
  "NF-004 calcium is far outside the other samples, and the collector cell is empty.",
  "NF-008 was received on March 4 and collected on March 12.",
];
