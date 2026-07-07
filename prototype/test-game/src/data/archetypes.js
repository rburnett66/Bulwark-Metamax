const HP_per_point = 10;
const DPS_per_point = 1.5;
const Range_per_point = 0.25;
const Speed_per_point = 0.08;
const Vision_base = 4;
const Vision_per_util_point = 0.1;

// Archetype power budgets (from balance workbook: Archetypes sheet).
// Each archetype spends a 100-point budget across HP/DPS/Range/Speed/Utility.
// Base stats are derived via Assumptions conversion rates.
const ARCHETYPE_BUDGETS = [
  { shape: 'Troops',      role: 'Skirmisher', defaultDomain: 'Walker', canTarget: 'Ground', targets: 'Base',       hpPts: 20, dpsPts: 30, rangePts: 10, speedPts: 25, utilPts: 15 },
  { shape: 'Trucks',      role: 'Support',    defaultDomain: 'Walker', canTarget: 'Ground', targets: 'Base',       hpPts: 25, dpsPts: 10, rangePts: 5,  speedPts: 40, utilPts: 20 },
  { shape: 'Tanks',       role: 'Bruiser',    defaultDomain: 'Walker', canTarget: 'Ground', targets: 'Base',       hpPts: 40, dpsPts: 30, rangePts: 15, speedPts: 10, utilPts: 5  },
  { shape: 'Artillery',   role: 'Siege',      defaultDomain: 'Walker', canTarget: 'Ground', targets: 'Structures', hpPts: 15, dpsPts: 40, rangePts: 40, speedPts: 5,  utilPts: 0  },
  { shape: 'Heavy Tanks', role: 'Juggernaut', defaultDomain: 'Walker', canTarget: 'Ground', targets: 'Base',       hpPts: 55, dpsPts: 25, rangePts: 12, speedPts: 5,  utilPts: 3  },
  { shape: 'Copters',     role: 'Harasser',   defaultDomain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       hpPts: 20, dpsPts: 30, rangePts: 20, speedPts: 25, utilPts: 5  },
  { shape: 'Planes',      role: 'Striker',    defaultDomain: 'Flyer',  canTarget: 'Ground', targets: 'Base',       hpPts: 15, dpsPts: 35, rangePts: 25, speedPts: 25, utilPts: 0  },
  { shape: 'Missiles',    role: 'Guided AA',  defaultDomain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       hpPts: 10, dpsPts: 45, rangePts: 35, speedPts: 10, utilPts: 0  },
];

function deriveArchetype(b) {
  const total = b.hpPts + b.dpsPts + b.rangePts + b.speedPts + b.utilPts;
  return {
    shape: b.shape,
    role: b.role,
    defaultDomain: b.defaultDomain,
    canTarget: b.canTarget,
    targets: b.targets,
    hpPts: b.hpPts,
    dpsPts: b.dpsPts,
    rangePts: b.rangePts,
    speedPts: b.speedPts,
    utilPts: b.utilPts,
    totalPts: total,
    baseHP: b.hpPts * HP_per_point,
    baseDPS: b.dpsPts * DPS_per_point,
    baseRange: b.rangePts * Range_per_point,
    baseSpeed: b.speedPts * Speed_per_point,
    baseVision: Vision_base + b.utilPts * Vision_per_util_point,
  };
}

export const archetypes = ARCHETYPE_BUDGETS.map(deriveArchetype);

export const archetypesByShape = archetypes.reduce((acc, a) => {
  acc[a.shape] = a;
  return acc;
}, {});

export function getArchetype(shape) {
  return archetypesByShape[shape] || null;
}

export default archetypes;