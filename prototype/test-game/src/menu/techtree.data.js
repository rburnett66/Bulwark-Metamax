/**
 * src/menu/techtree.data.js — the Tech Tree content model (ported from the Claude Design proof).
 *
 * Node IDs are STABLE strings and are the only thing the save persists (save.techNodes[id] = true),
 * so we can freely reorder / retune tier · cost · stat · infl in playtest without breaking saves.
 * Values here are PLACEHOLDERS the owner will shuffle later — see docs/sources/Bulwark-Tech-Tree-Epic.md.
 *
 *   tier  1..4   which tech-clearance tier gates the node (clearance = # Map-2 factions beaten)
 *   cost  gold   staggered: climbs with tier, and later nodes in a path cost more than earlier ones
 *   stat  [label, delta]   headline effect (display only until wired into the sim)
 *   infl  -1..1  faction-alignment influence (− lighter, + darker); 0 = neutral
 */

export const PATHS = [
  { key: 'base',   name: 'Base Systems', sub: 'Core defense & guns', ic: 'shield' },
  { key: 'econ',   name: 'Economy',      sub: 'Yield & sustain',     ic: 'core' },
  { key: 'struct', name: 'Structures',   sub: 'Turret & wall tech',  ic: 'range' },
  { key: 'hitech', name: 'Hi-Tech',      sub: 'Drones & exotic',     ic: 'energy' },
];

export const NODES = {
  base: [
    { id: 'b-def', nm: 'Reinforced Hull',   sub: 'Defense',          ic: 'shield', tier: 1, cost: 400,  stat: ['ARMOR', '+8%'],      desc: 'Hardens the command base against direct fire and melee siege.',              infl: 0.10 },
    { id: 'b-atk', nm: 'Cannon Calibration', sub: 'Attack',          ic: 'cannon', tier: 1, cost: 400,  stat: ['DAMAGE', '+10%'],    desc: 'Tunes the base super-cannon for higher per-shot damage.',                    infl: 0.15 },
    { id: 'b-awr', nm: 'Threat Awareness',  sub: 'Awareness',        ic: 'eye',    tier: 2, cost: 900,  stat: ['SIGHT', '+2 cell'],  desc: 'Extends the base sensor radius so incoming lanes light up earlier.',          infl: 0 },
    { id: 'b-rpg', nm: 'RPG Battery',       sub: 'Rocket ordnance',  ic: 'rpg',    tier: 3, cost: 1800, stat: ['SPLASH', '+1 cell'], desc: 'Adds a rocket pod for area damage against clustered ground units.',           infl: 0.30 },
    { id: 'b-sam', nm: 'SAM Site',          sub: 'Surface-to-air',   ic: 'sam',    tier: 4, cost: 3200, stat: ['ANTI-AIR', '+30%'],  desc: 'Mounts guided missiles that reach flyers ignoring your walls.',               infl: 0.20 },
  ],
  econ: [
    { id: 'e-hp',   nm: 'Core Capacity',   sub: 'Base HP',          ic: 'core',  tier: 1, cost: 400,  stat: ['BASE HP', '+150'],    desc: 'Larger reactor housing raises the base health pool.',                        infl: -0.10 },
    { id: 'e-dmg',  nm: 'Output Boost',    sub: 'Harvest yield',    ic: 'bolt',  tier: 1, cost: 400,  stat: ['GOLD/CROP', '+12%'],  desc: 'Overclocks harvesters to pull more gold from each resource cell.',            infl: -0.15 },
    { id: 'e-rng',  nm: 'Extended Reach',  sub: 'Harvest range',    ic: 'range', tier: 2, cost: 900,  stat: ['REACH', '+1 cell'],   desc: 'Harvesters service resource cells one tile farther from base.',               infl: 0 },
    { id: 'e-dual', nm: 'Dual Refinery',   sub: 'Twin yield',       ic: 'dual',  tier: 3, cost: 1800, stat: ['YIELD', '×2 node'],   desc: 'A second refinery line lets one node feed two harvesters at once.',           infl: -0.20 },
    { id: 'e-rep',  nm: 'L4 Repair Bay',   sub: 'Repair slot',      ic: 'wrench', tier: 4, cost: 3200, stat: ['REPAIR', '+1 slot'], desc: 'Unlocks a fourth field-repair slot for keeping structures alive.',            infl: -0.10 },
  ],
  struct: [
    { id: 's-hp',   nm: 'Bulwark Plating', sub: 'Structure HP',     ic: 'shield', tier: 1, cost: 500,  stat: ['STRUCT HP', '+20%'], desc: 'Thicker plating on every deployed cannon, flak, and wall.',                   infl: 0.10 },
    { id: 's-dmg',  nm: 'Munition Upgrade', sub: 'Structure DMG',   ic: 'cannon', tier: 1, cost: 500,  stat: ['DAMAGE', '+12%'],    desc: 'Standardized high-yield rounds across all built turrets.',                    infl: 0.15 },
    { id: 's-rng',  nm: 'Targeting Optics', sub: 'Structure range', ic: 'range',  tier: 2, cost: 1000, stat: ['RANGE', '+1 cell'],  desc: 'Optical tracking widens the firing envelope of your turrets.',                infl: 0 },
    { id: 's-dual', nm: 'Layered Armor',   sub: 'Dual defense',     ic: 'dual',   tier: 3, cost: 2000, stat: ['MITIGATION', '+15%'], desc: 'Composite layering resists both kinetic and energy damage.',                 infl: 0.20 },
    { id: 's-rep',  nm: 'Repair Slot IV',  sub: 'Structure repair', ic: 'wrench', tier: 4, cost: 3400, stat: ['REPAIR', '+1 slot'], desc: 'Dedicated repair channel for frontline structures under siege.',              infl: 0.10 },
  ],
  hitech: [
    { id: 'h-rep', nm: 'Repair Drone',      sub: 'Auto-repair',     ic: 'drone', tier: 2, cost: 1500, stat: ['HEAL', '8/s'],       desc: 'A drone that patrols the line and welds damaged structures.',                 infl: -0.10 },
    { id: 'h-min', nm: 'Mining Drone',      sub: 'Passive gold',    ic: 'pick',  tier: 2, cost: 1500, stat: ['GOLD', '+5/s'],      desc: 'Autonomous miner that trickles gold without a harvester slot.',               infl: -0.20 },
    { id: 'h-ewn', nm: 'Early Warning Net', sub: 'Recon',           ic: 'radar', tier: 3, cost: 2600, stat: ['LEAD', '+1 wave'],   desc: 'Reveals the next wave composition before it deploys.',                        infl: 0 },
    { id: 'h-l3',  nm: 'L3 Troop Command',  sub: 'Allied troops',   ic: 'troop', tier: 4, cost: 3800, stat: ['TROOPS', 'L3'],      desc: 'Fields a third rank of allied ground troops each wave.',                      infl: 0.25 },
    { id: 'h-l4',  nm: 'L4 Energy Core',    sub: 'Power grid',      ic: 'energy', tier: 4, cost: 4500, stat: ['ENERGY', 'L4'],     desc: 'Top-tier reactor powering the most demanding exotic tech.',                   infl: 0.35 },
  ],
};

export const ULT = {
  id: 'ult', nm: 'Apocalypse Cannon', lvl: 'MK VII', cost: 25000, ic: 'ult', tier: 4,
  desc: 'Overcharges the base super-cannon into a map-wide orbital strike. Requires all four tiers unlocked.',
  stat: [['DAMAGE', '900'], ['RANGE', 'GLOBAL']],
};

// path color tokens (ink = bright, deep = connector base). Gold/green/blue/purple per the mockup.
export const PATH_COLOR = {
  base:   { ink: '#f2c869', deep: '#c99a3a' },
  econ:   { ink: '#57d98a', deep: '#2fae63' },
  struct: { ink: '#4aa3ff', deep: '#2f6fd0' },
  hitech: { ink: '#b06cff', deep: '#7d3fd0' },
};
