/**
 * prototype/test-game/src/harness/roster.js  [state-harness sh-m1.s2]
 *
 * The DESIGN roster — generated from docs/16 Bulwark MM/sources/bulwark-balance-xlsx.md (the balance
 * spreadsheet, the source of truth). 9 factions x 8 shapes. The State Harness sources its faction + unit
 * pickers from THIS (the design), not the game's tables.js (which only implements the tutorial faction).
 * Regenerate from the xlsx.md when the design changes — do not hand-edit.
 */
export const FACTIONS = [
  {
    "faction": "Ground / Powder",
    "trope": "Nationalistic",
    "beats": "Greenies (Chem)",
    "signatureDamage": "Kinetic",
    "identity": "Infantry & armor; flags & honor"
  },
  {
    "faction": "Air",
    "trope": "Manga (ace pilots)",
    "beats": "Ground / Powder",
    "signatureDamage": "Kinetic",
    "identity": "Air superiority; weak on the ground"
  },
  {
    "faction": "High Tech",
    "trope": "Capitalist (mega-corp)",
    "beats": "Air",
    "signatureDamage": "Electric",
    "identity": "Precision, shields, expensive"
  },
  {
    "faction": "Artillery",
    "trope": "Military (siege)",
    "beats": "High Tech",
    "signatureDamage": "Concussion",
    "identity": "Range & arc; poor up close"
  },
  {
    "faction": "Water",
    "trope": "Fantasy RPG (sea tribes)",
    "beats": "Artillery",
    "signatureDamage": "Frost",
    "identity": "Swimmers/floaters; coastal"
  },
  {
    "faction": "Arcane / Energy",
    "trope": "Fantasy theocracy / religion",
    "beats": "Water",
    "signatureDamage": "Fire",
    "identity": "Energy weapons, shields, no ammo economy"
  },
  {
    "faction": "Space Tech",
    "trope": "Sci-Fi (federation)",
    "beats": "Arcane / Energy",
    "signatureDamage": "Electric",
    "identity": "Orbital tech; strong vision; ignores some fog"
  },
  {
    "faction": "Dark Energy",
    "trope": "Social realignment (cult)",
    "beats": "Space Tech",
    "signatureDamage": "Poison",
    "identity": "DoT, corruption, night-strong"
  },
  {
    "faction": "Greenies (Chem)",
    "trope": "Socialist (hive collective)",
    "beats": "Dark Energy",
    "signatureDamage": "Poison",
    "identity": "Swarms, chem clouds, area denial"
  }
];

export const ROSTER = {
  "GND-Troops": {
    "faction": "Ground / Powder",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      220,
      352,
      528
    ],
    "dps": [
      45.0,
      69.75,
      103.5
    ],
    "range": 2.5,
    "speed": 1.84,
    "vision": 5.5
  },
  "GND-Trucks": {
    "faction": "Ground / Powder",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      275,
      440,
      660
    ],
    "dps": [
      15.0,
      23.25,
      34.5
    ],
    "range": 1.25,
    "speed": 2.944,
    "vision": 6.0
  },
  "GND-Tanks": {
    "faction": "Ground / Powder",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      440,
      704,
      1056
    ],
    "dps": [
      45.0,
      69.75,
      103.5
    ],
    "range": 3.75,
    "speed": 0.736,
    "vision": 4.5
  },
  "GND-Artillery": {
    "faction": "Ground / Powder",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      165,
      264,
      396
    ],
    "dps": [
      60.0,
      93.0,
      138.0
    ],
    "range": 10.0,
    "speed": 0.368,
    "vision": 4.0
  },
  "GND-HeavyTanks": {
    "faction": "Ground / Powder",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      605,
      968,
      1452
    ],
    "dps": [
      37.5,
      58.125,
      86.25
    ],
    "range": 3.0,
    "speed": 0.368,
    "vision": 4.3
  },
  "GND-Copters": {
    "faction": "Ground / Powder",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      220,
      352,
      528
    ],
    "dps": [
      45.0,
      69.75,
      103.5
    ],
    "range": 5.0,
    "speed": 1.84,
    "vision": 4.5
  },
  "GND-Planes": {
    "faction": "Ground / Powder",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      165,
      264,
      396
    ],
    "dps": [
      52.5,
      81.375,
      120.75
    ],
    "range": 6.25,
    "speed": 1.84,
    "vision": 4.0
  },
  "GND-Missiles": {
    "faction": "Ground / Powder",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      110,
      176,
      264
    ],
    "dps": [
      67.5,
      104.625,
      155.25
    ],
    "range": 8.75,
    "speed": 0.736,
    "vision": 4.0
  },
  "AIR-Troops": {
    "faction": "Air",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      170,
      272,
      408
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 2.45,
    "speed": 2.4,
    "vision": 5.5
  },
  "AIR-Trucks": {
    "faction": "Air",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      212,
      340,
      510
    ],
    "dps": [
      15.75,
      24.4125,
      36.225
    ],
    "range": 1.225,
    "speed": 3.84,
    "vision": 6.0
  },
  "AIR-Tanks": {
    "faction": "Air",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      340,
      544,
      816
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 3.675,
    "speed": 0.96,
    "vision": 4.5
  },
  "AIR-Artillery": {
    "faction": "Air",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      128,
      204,
      306
    ],
    "dps": [
      63.0,
      97.65,
      144.9
    ],
    "range": 9.8,
    "speed": 0.48,
    "vision": 4.0
  },
  "AIR-HeavyTanks": {
    "faction": "Air",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      468,
      748,
      1122
    ],
    "dps": [
      39.375,
      61.03125,
      90.5625
    ],
    "range": 2.94,
    "speed": 0.48,
    "vision": 4.3
  },
  "AIR-Copters": {
    "faction": "Air",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      170,
      272,
      408
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 4.9,
    "speed": 2.4,
    "vision": 4.5
  },
  "AIR-Planes": {
    "faction": "Air",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      128,
      204,
      306
    ],
    "dps": [
      55.125,
      85.44375,
      126.7875
    ],
    "range": 6.125,
    "speed": 2.4,
    "vision": 4.0
  },
  "AIR-Missiles": {
    "faction": "Air",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Kinetic",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      85,
      136,
      204
    ],
    "dps": [
      70.875,
      109.85625,
      163.0125
    ],
    "range": 8.575,
    "speed": 0.96,
    "vision": 4.0
  },
  "HTC-Troops": {
    "faction": "High Tech",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      190,
      304,
      456
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 2.8,
    "speed": 1.8,
    "vision": 5.5
  },
  "HTC-Trucks": {
    "faction": "High Tech",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      238,
      380,
      570
    ],
    "dps": [
      15.75,
      24.4125,
      36.225
    ],
    "range": 1.4,
    "speed": 2.88,
    "vision": 6.0
  },
  "HTC-Tanks": {
    "faction": "High Tech",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      380,
      608,
      912
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 4.2,
    "speed": 0.72,
    "vision": 4.5
  },
  "HTC-Artillery": {
    "faction": "High Tech",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      142,
      228,
      342
    ],
    "dps": [
      63.0,
      97.65,
      144.9
    ],
    "range": 11.2,
    "speed": 0.36,
    "vision": 4.0
  },
  "HTC-HeavyTanks": {
    "faction": "High Tech",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      522,
      836,
      1254
    ],
    "dps": [
      39.375,
      61.03125,
      90.5625
    ],
    "range": 3.36,
    "speed": 0.36,
    "vision": 4.3
  },
  "HTC-Copters": {
    "faction": "High Tech",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      190,
      304,
      456
    ],
    "dps": [
      47.25,
      73.2375,
      108.675
    ],
    "range": 5.6,
    "speed": 1.8,
    "vision": 4.5
  },
  "HTC-Planes": {
    "faction": "High Tech",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      142,
      228,
      342
    ],
    "dps": [
      55.125,
      85.44375,
      126.7875
    ],
    "range": 7.0,
    "speed": 1.8,
    "vision": 4.0
  },
  "HTC-Missiles": {
    "faction": "High Tech",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      95,
      152,
      228
    ],
    "dps": [
      70.875,
      109.85625,
      163.0125
    ],
    "range": 9.8,
    "speed": 0.72,
    "vision": 4.0
  },
  "ART-Troops": {
    "faction": "Artillery",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      184,
      294,
      442
    ],
    "dps": [
      49.5,
      76.725,
      113.85
    ],
    "range": 3.125,
    "speed": 1.56,
    "vision": 5.5
  },
  "ART-Trucks": {
    "faction": "Artillery",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      230,
      368,
      552
    ],
    "dps": [
      16.5,
      25.575,
      37.95
    ],
    "range": 1.5625,
    "speed": 2.496,
    "vision": 6.0
  },
  "ART-Tanks": {
    "faction": "Artillery",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      368,
      589,
      883
    ],
    "dps": [
      49.5,
      76.725,
      113.85
    ],
    "range": 4.6875,
    "speed": 0.624,
    "vision": 4.5
  },
  "ART-Artillery": {
    "faction": "Artillery",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      138,
      221,
      331
    ],
    "dps": [
      66.0,
      102.3,
      151.8
    ],
    "range": 12.5,
    "speed": 0.312,
    "vision": 4.0
  },
  "ART-HeavyTanks": {
    "faction": "Artillery",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      506,
      810,
      1214
    ],
    "dps": [
      41.25,
      63.9375,
      94.875
    ],
    "range": 3.75,
    "speed": 0.312,
    "vision": 4.3
  },
  "ART-Copters": {
    "faction": "Artillery",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Concussion",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      184,
      294,
      442
    ],
    "dps": [
      49.5,
      76.725,
      113.85
    ],
    "range": 6.25,
    "speed": 1.56,
    "vision": 4.5
  },
  "ART-Planes": {
    "faction": "Artillery",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      138,
      221,
      331
    ],
    "dps": [
      57.75,
      89.5125,
      132.825
    ],
    "range": 7.8125,
    "speed": 1.56,
    "vision": 4.0
  },
  "ART-Missiles": {
    "faction": "Artillery",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Concussion",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      92,
      147,
      221
    ],
    "dps": [
      74.25,
      115.0875,
      170.775
    ],
    "range": 10.9375,
    "speed": 0.624,
    "vision": 4.0
  },
  "WTR-Troops": {
    "faction": "Water",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Swimmer",
    "armorClass": "Organic",
    "damageType": "Frost",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      224,
      358,
      538
    ],
    "dps": [
      42.75,
      66.2625,
      98.325
    ],
    "range": 2.45,
    "speed": 1.96,
    "vision": 5.5
  },
  "WTR-Trucks": {
    "faction": "Water",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Floater",
    "armorClass": "Organic",
    "damageType": "Frost",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      280,
      448,
      672
    ],
    "dps": [
      14.25,
      22.0875,
      32.775
    ],
    "range": 1.225,
    "speed": 3.136,
    "vision": 6.0
  },
  "WTR-Tanks": {
    "faction": "Water",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Swimmer",
    "armorClass": "Organic",
    "damageType": "Frost",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      448,
      717,
      1075
    ],
    "dps": [
      42.75,
      66.2625,
      98.325
    ],
    "range": 3.675,
    "speed": 0.784,
    "vision": 4.5
  },
  "WTR-Artillery": {
    "faction": "Water",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Floater",
    "armorClass": "Organic",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      168,
      269,
      403
    ],
    "dps": [
      57.0,
      88.35,
      131.1
    ],
    "range": 9.8,
    "speed": 0.392,
    "vision": 4.0
  },
  "WTR-HeavyTanks": {
    "faction": "Water",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Swimmer",
    "armorClass": "Organic",
    "damageType": "Frost",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      616,
      986,
      1478
    ],
    "dps": [
      35.625,
      55.21875,
      81.9375
    ],
    "range": 2.94,
    "speed": 0.392,
    "vision": 4.3
  },
  "WTR-Copters": {
    "faction": "Water",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Frost",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      224,
      358,
      538
    ],
    "dps": [
      42.75,
      66.2625,
      98.325
    ],
    "range": 4.9,
    "speed": 1.96,
    "vision": 4.5
  },
  "WTR-Planes": {
    "faction": "Water",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Frost",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      168,
      269,
      403
    ],
    "dps": [
      49.875,
      77.30625,
      114.7125
    ],
    "range": 6.125,
    "speed": 1.96,
    "vision": 4.0
  },
  "WTR-Missiles": {
    "faction": "Water",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Frost",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      112,
      179,
      269
    ],
    "dps": [
      64.125,
      99.39375,
      147.4875
    ],
    "range": 8.575,
    "speed": 0.784,
    "vision": 4.0
  },
  "ARC-Troops": {
    "faction": "Arcane / Energy",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Fire",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      200,
      320,
      480
    ],
    "dps": [
      48.6,
      75.33,
      111.78
    ],
    "range": 2.55,
    "speed": 1.84,
    "vision": 5.5
  },
  "ARC-Trucks": {
    "faction": "Arcane / Energy",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Fire",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      250,
      400,
      600
    ],
    "dps": [
      16.2,
      25.11,
      37.26
    ],
    "range": 1.275,
    "speed": 2.944,
    "vision": 6.0
  },
  "ARC-Tanks": {
    "faction": "Arcane / Energy",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Fire",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      400,
      640,
      960
    ],
    "dps": [
      48.6,
      75.33,
      111.78
    ],
    "range": 3.825,
    "speed": 0.736,
    "vision": 4.5
  },
  "ARC-Artillery": {
    "faction": "Arcane / Energy",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      150,
      240,
      360
    ],
    "dps": [
      64.8,
      100.44,
      149.04
    ],
    "range": 10.2,
    "speed": 0.368,
    "vision": 4.0
  },
  "ARC-HeavyTanks": {
    "faction": "Arcane / Energy",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Fire",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      550,
      880,
      1320
    ],
    "dps": [
      40.5,
      62.775,
      93.15
    ],
    "range": 3.06,
    "speed": 0.368,
    "vision": 4.3
  },
  "ARC-Copters": {
    "faction": "Arcane / Energy",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Fire",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      200,
      320,
      480
    ],
    "dps": [
      48.6,
      75.33,
      111.78
    ],
    "range": 5.1,
    "speed": 1.84,
    "vision": 4.5
  },
  "ARC-Planes": {
    "faction": "Arcane / Energy",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Fire",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      150,
      240,
      360
    ],
    "dps": [
      56.7,
      87.885,
      130.41
    ],
    "range": 6.375,
    "speed": 1.84,
    "vision": 4.0
  },
  "ARC-Missiles": {
    "faction": "Arcane / Energy",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Fire",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      100,
      160,
      240
    ],
    "dps": [
      72.9,
      112.995,
      167.67
    ],
    "range": 8.925,
    "speed": 0.736,
    "vision": 4.0
  },
  "SPC-Troops": {
    "faction": "Space Tech",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      192,
      307,
      461
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 2.75,
    "speed": 2.0,
    "vision": 5.5
  },
  "SPC-Trucks": {
    "faction": "Space Tech",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      240,
      384,
      576
    ],
    "dps": [
      14.7,
      22.785,
      33.81
    ],
    "range": 1.375,
    "speed": 3.2,
    "vision": 6.0
  },
  "SPC-Tanks": {
    "faction": "Space Tech",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      384,
      614,
      922
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 4.125,
    "speed": 0.8,
    "vision": 4.5
  },
  "SPC-Artillery": {
    "faction": "Space Tech",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      144,
      230,
      346
    ],
    "dps": [
      58.8,
      91.14,
      135.24
    ],
    "range": 11.0,
    "speed": 0.4,
    "vision": 4.0
  },
  "SPC-HeavyTanks": {
    "faction": "Space Tech",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Machinery",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      528,
      845,
      1267
    ],
    "dps": [
      36.75,
      56.9625,
      84.525
    ],
    "range": 3.3,
    "speed": 0.4,
    "vision": 4.3
  },
  "SPC-Copters": {
    "faction": "Space Tech",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      192,
      307,
      461
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 5.5,
    "speed": 2.0,
    "vision": 4.5
  },
  "SPC-Planes": {
    "faction": "Space Tech",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      144,
      230,
      346
    ],
    "dps": [
      51.45,
      79.7475,
      118.335
    ],
    "range": 6.875,
    "speed": 2.0,
    "vision": 4.0
  },
  "SPC-Missiles": {
    "faction": "Space Tech",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Electric",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      96,
      154,
      230
    ],
    "dps": [
      66.15,
      102.5325,
      152.145
    ],
    "range": 9.625,
    "speed": 0.8,
    "vision": 4.0
  },
  "DRK-Troops": {
    "faction": "Dark Energy",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      180,
      288,
      432
    ],
    "dps": [
      50.4,
      78.12,
      115.92
    ],
    "range": 2.5,
    "speed": 2.04,
    "vision": 5.5
  },
  "DRK-Trucks": {
    "faction": "Dark Energy",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      225,
      360,
      540
    ],
    "dps": [
      16.8,
      26.04,
      38.64
    ],
    "range": 1.25,
    "speed": 3.264,
    "vision": 6.0
  },
  "DRK-Tanks": {
    "faction": "Dark Energy",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      360,
      576,
      864
    ],
    "dps": [
      50.4,
      78.12,
      115.92
    ],
    "range": 3.75,
    "speed": 0.816,
    "vision": 4.5
  },
  "DRK-Artillery": {
    "faction": "Dark Energy",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      135,
      216,
      324
    ],
    "dps": [
      67.2,
      104.16,
      154.56
    ],
    "range": 10.0,
    "speed": 0.408,
    "vision": 4.0
  },
  "DRK-HeavyTanks": {
    "faction": "Dark Energy",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Energy",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      495,
      792,
      1188
    ],
    "dps": [
      42.0,
      65.1,
      96.6
    ],
    "range": 3.0,
    "speed": 0.408,
    "vision": 4.3
  },
  "DRK-Copters": {
    "faction": "Dark Energy",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      180,
      288,
      432
    ],
    "dps": [
      50.4,
      78.12,
      115.92
    ],
    "range": 5.0,
    "speed": 2.04,
    "vision": 4.5
  },
  "DRK-Planes": {
    "faction": "Dark Energy",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      135,
      216,
      324
    ],
    "dps": [
      58.8,
      91.14,
      135.24
    ],
    "range": 6.25,
    "speed": 2.04,
    "vision": 4.0
  },
  "DRK-Missiles": {
    "faction": "Dark Energy",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      90,
      144,
      216
    ],
    "dps": [
      75.6,
      117.18,
      173.88
    ],
    "range": 8.75,
    "speed": 0.816,
    "vision": 4.0
  },
  "GRN-Troops": {
    "faction": "Greenies (Chem)",
    "shape": "Troops",
    "role": "Skirmisher",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      164,
      262,
      394
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 2.375,
    "speed": 2.1,
    "vision": 5.5
  },
  "GRN-Trucks": {
    "faction": "Greenies (Chem)",
    "shape": "Trucks",
    "role": "Support",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      205,
      328,
      492
    ],
    "dps": [
      14.7,
      22.785,
      33.81
    ],
    "range": 1.1875,
    "speed": 3.36,
    "vision": 6.0
  },
  "GRN-Tanks": {
    "faction": "Greenies (Chem)",
    "shape": "Tanks",
    "role": "Bruiser",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      328,
      525,
      787
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 3.5625,
    "speed": 0.84,
    "vision": 4.5
  },
  "GRN-Artillery": {
    "faction": "Greenies (Chem)",
    "shape": "Artillery",
    "role": "Siege",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Concussion",
    "canTarget": "Ground",
    "targets": "Structures",
    "hp": [
      123,
      197,
      295
    ],
    "dps": [
      58.8,
      91.14,
      135.24
    ],
    "range": 9.5,
    "speed": 0.42,
    "vision": 4.0
  },
  "GRN-HeavyTanks": {
    "faction": "Greenies (Chem)",
    "shape": "Heavy Tanks",
    "role": "Juggernaut",
    "domain": "Walker",
    "armorClass": "Organic",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      451,
      722,
      1082
    ],
    "dps": [
      36.75,
      56.9625,
      84.525
    ],
    "range": 2.85,
    "speed": 0.42,
    "vision": 4.3
  },
  "GRN-Copters": {
    "faction": "Greenies (Chem)",
    "shape": "Copters",
    "role": "Harasser",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      164,
      262,
      394
    ],
    "dps": [
      44.1,
      68.355,
      101.43
    ],
    "range": 4.75,
    "speed": 2.1,
    "vision": 4.5
  },
  "GRN-Planes": {
    "faction": "Greenies (Chem)",
    "shape": "Planes",
    "role": "Striker",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Ground",
    "targets": "Base",
    "hp": [
      123,
      197,
      295
    ],
    "dps": [
      51.45,
      79.7475,
      118.335
    ],
    "range": 5.9375,
    "speed": 2.1,
    "vision": 4.0
  },
  "GRN-Missiles": {
    "faction": "Greenies (Chem)",
    "shape": "Missiles",
    "role": "Guided AA",
    "domain": "Flyer",
    "armorClass": "Aircraft",
    "damageType": "Poison",
    "canTarget": "Both",
    "targets": "Base",
    "hp": [
      82,
      131,
      197
    ],
    "dps": [
      66.15,
      102.5325,
      152.145
    ],
    "range": 8.3125,
    "speed": 0.84,
    "vision": 4.0
  }
};

/** Distinct factions in design order. */
export function factionNames() { return FACTIONS.map((f) => f.faction); }
/** Units of a faction as [{ id, label }]. */
export function unitsOf(faction) {
  return Object.keys(ROSTER).filter((id) => ROSTER[id].faction === faction)
    .map((id) => ({ id, label: `${ROSTER[id].role} — ${ROSTER[id].shape}` }));
}
