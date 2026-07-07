const Assumptions = {
  HP_per_point: 10,
  DPS_per_point: 1.5,
  Range_per_point: 0.25,
  Speed_per_point: 0.08,
  Vision_base: 4,
  Vision_per_util_point: 0.1,
};

// Archetype power-budget table.
// Each archetype spends the SAME 100-point power budget across
// HP / DPS / Range / Speed / Utility, distributed by shape.
// Base stats are DERIVED from points × Assumptions conversion rates.
//   Base_HP     = HP_pts     * HP_per_point
//   Base_DPS    = DPS_pts    * DPS_per_point
//   Base_Range  = Range_pts  * Range_per_point
//   Base_Speed  = Speed_pts  * Speed_per_point
//   Base_Vision = Vision_base + Util_pts * Vision_per_util_point

const RAW_ARCHETYPES = [
  {
    shape: 'Troops', role: 'Skirmisher', domain: 'Walker',
    canTarget: 'Ground', targets: 'Base',
    hpPts: 20, dpsPts: 30, rangePts: 10, speedPts: 25, utilPts: 15,
  },
  {
    shape: 'Trucks', role: 'Support', domain: 'Walker',
    canTarget: 'Ground', targets: 'Base',
    hpPts: 25, dpsPts: 10, rangePts: 5, speedPts: 40, utilPts: 20,
  },
  {
    shape: 'Tanks', role: 'Bruiser', domain: 'Walker',
    canTarget: 'Ground', targets: 'Base',
    hpPts: 40, dpsPts: 30, rangePts: 15, speedPts: 10, utilPts: 5,
  },
  {
    shape: 'Artillery', role: 'Siege', domain: 'Walker',
    canTarget: 'Ground', targets: 'Structures',
    hpPts: 15, dpsPts: 40, rangePts: 40, speedPts: 5, utilPts: 0,
  },
  {
    shape: 'Heavy Tanks', role: 'Juggernaut', domain: 'Walker',
    canTarget: 'Ground', targets: 'Base',
    hpPts: 55, dpsPts: 25, rangePts: 12, speedPts: 5, utilPts: 3,
  },
  {
    shape: 'Copters', role: 'Harasser', domain: 'Flyer',
    canTarget: 'Both', targets: 'Base',
    hpPts: 20, dpsPts: 30, rangePts: 20, speedPts: 25, utilPts: 5,
  },
  {
    shape: 'Planes', role: 'Striker', domain: 'Flyer',
    canTarget: 'Ground', targets: 'Base',
    hpPts: 15, dpsPts: 35, rangePts: 25, speedPts: 25, utilPts: 0,
  },
  {
    shape: 'Missiles', role: 'Guided AA', domain: 'Flyer',
    canTarget: 'Both', targets: 'Base',
    hpPts: 10, dpsPts: 45, rangePts: 35, speedPts: 10, utilPts: 0,
  },
];

function deriveArchetype(a) {
  const total = a.hpPts + a.dpsPts + a.rangePts + a.speedPts + a.utilPts;
  return {
    shape: a.shape,
    role: a.role,
    domain: a.domain,
    canTarget: a.canTarget,
    targets: a.targets,
    points: {
      hp: a.hpPts,
      dps: a.dpsPts,
      range: a.rangePts,
      speed: a.speedPts,
      util: a.utilPts,
      total,
    },
    base: {
      hp: a.hpPts * Assumptions.HP_per_point,
      dps: a.dpsPts * Assumptions.DPS_per_point,
      range: a.rangePts * Assumptions.Range_per_point,
      speed: a.speedPts * Assumptions.Speed_per_point,
      vision: Assumptions.Vision_base + a.utilPts * Assumptions.Vision_per_util_point,
    },
  };
}

const ARCHETYPE_LIST = RAW_ARCHETYPES.map(deriveArchetype);

const ARCHETYPES = ARCHETYPE_LIST.reduce((acc, a) => {
  acc[a.shape] = a;
  return acc;
}, {});

export function getArchetype(shape) {
  return ARCHETYPES[shape] || null;
}

export function listArchetypes() {
  return ARCHETYPE_LIST.slice();
}

export { ARCHETYPES, ARCHETYPE_LIST };

export default {
  byShape: ARCHETYPES,
  list: ARCHETYPE_LIST,
  get: getArchetype,
  all: listArchetypes,
};