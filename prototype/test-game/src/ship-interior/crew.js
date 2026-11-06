/**
 * src/ship-interior/crew.js — the capital ship's crew figures [MM-story_mw47lcvv_3].
 *
 * Ported from the Long Ledger prototype (tools/ship-interior/prototype/long-ledger, itself from the owner's "Project City
 * foremen" model): squashed-sphere head with hair, eyes and ears; shirt torso; open vest with reflective stripes; denim
 * legs; a per-faction military helmet; the 8-state pose machine. Added here (Ship-Crew-Characters.md §3, design §5.2):
 *   - hip pivots, so legs swing in a walk and fold to SIT;
 *   - poses sit, sit-drink, work and turn-to-camera;
 *   - FLASH: the vest pulses gold emissive (the patron in the opening's beat 6);
 *   - time comes in as accumulated seconds and every random draw from a seeded generator (rng below), so the room
 *     view looks the same on every run. Presentation only; nothing here is in the battle sim.
 *
 * three.js is injected: const kit = createCrewKit(THREE); const g = kit.makeChar(kit.cfgFor('arcane'));
 * Faction keys are the registry's (data/factions.js): collective, ground, air, hightech, artillery, water, arcane,
 * space, dark, greenies.
 */

/** Outfit colour + helmet per faction (the prototype's FACTIONS table, keyed by registry keys). */
export const LOOKS = Object.freeze({
  collective: { label: 'Collective', outfit: 0xE8863A, stripe: 0xFAD14A, helmet: 'servicecap', hc: { shell: 0xF1EDE4, trim: 0x222733, accent: 0xE8863A } },
  ground:     { label: 'Ground · Powder', outfit: 0x5f6a36, stripe: 0xb7c070, helmet: 'combat', hc: { shell: 0x5c6534, trim: 0x343a20, accent: 0x8a2f2a } },
  air:        { label: 'Air', outfit: 0x3f6fae, stripe: 0xa9c8ef, helmet: 'aviator', hc: { shell: 0xeef3f8, trim: 0x24396a, accent: 0xd23a3a } },
  hightech:   { label: 'High Tech', outfit: 0x3a3f46, stripe: 0xd4c07a, helmet: 'techvisor', hc: { shell: 0x2f333a, trim: 0xd4af37, accent: 0x9fe8ff } },
  artillery:  { label: 'Artillery', outfit: 0x8a7f52, stripe: 0xd8c98a, helmet: 'tanker', hc: { shell: 0x766c42, trim: 0x322d1c, accent: 0xcaa54a } },
  water:      { label: 'Water', outfit: 0x3f8c86, stripe: 0x8fd8cf, helmet: 'diver', hc: { shell: 0x4f9c8c, trim: 0xb5903f, accent: 0xf0d49a } },
  arcane:     { label: 'Arcane · Energy', outfit: 0xa6382f, stripe: 0xe59a5a, helmet: 'cowl', hc: { shell: 0x8a2f2a, trim: 0xc9a24a, accent: 0xff8a3a } },
  space:      { label: 'Space Tech', outfit: 0x2a4a8a, stripe: 0x8fb6f0, helmet: 'spacehelm', hc: { shell: 0xdfe8f2, trim: 0x24407a, accent: 0x38e1c8 } },
  dark:       { label: 'Dark Energy', outfit: 0x3a2f4a, stripe: 0xb06fd0, helmet: 'hoodmask', hc: { shell: 0x1b1724, trim: 0x463a58, accent: 0xc0379a } },
  greenies:   { label: 'Greenies · Chem', outfit: 0x5a7a3a, stripe: 0xcfd84a, helmet: 'gasmask', hc: { shell: 0x47591f, trim: 0x2f3a16, accent: 0xcfd84a } },
});
export const CAPTAIN_HC = Object.freeze({ shell: 0x141821, trim: 0x0d1017, accent: 0xd9b24a });
export const PLAYER_GOLD = 0xEAB23A;
/** The player's avatar: gold outfit and hard hat. */
export const PLAYER_CFG = Object.freeze({ outfit: PLAYER_GOLD, helmet: 'hardhat', hc: { shell: PLAYER_GOLD, trim: 0x8a6a1e, accent: 0xffe08a } });

/** Resting arm / head / body targets per state (arm groups pivot at the shoulder; +z raises an arm outward). */
export const POSE = Object.freeze({
  idle:        { rax: .06, raz: .10, lax: .06, laz: -.10, hx: .00, bx: 0, leg: 0 },
  walk:        { rax: 0, raz: .06, lax: 0, laz: -.06, hx: .02, bx: 0, leg: 0 },
  talk:        { rax: -.55, raz: .40, lax: -.45, laz: -.40, hx: .05, bx: 0, leg: 0 },
  point:       { rax: -1.45, raz: .14, lax: .06, laz: -.10, hx: -.05, bx: .05, leg: 0 },
  wave:        { rax: -.10, raz: 2.45, lax: .06, laz: -.10, hx: -.05, bx: 0, leg: 0 },
  salute:      { rax: -2.55, raz: -.28, lax: .06, laz: -.10, hx: .04, bx: 0, leg: 0 },
  angry:       { rax: -.95, raz: .50, lax: -.95, laz: -.50, hx: .14, bx: .14, leg: 0 },
  celebrate:   { rax: -2.55, raz: .45, lax: -2.55, laz: -.45, hx: -.14, bx: -.08, leg: 0 },
  work:        { rax: -1.05, raz: .12, lax: -1.05, laz: -.12, hx: .18, bx: .06, leg: 0 },
  sit:         { rax: -.5, raz: .12, lax: -.5, laz: -.12, hx: .04, bx: 0, leg: -1.45 },
  'sit-drink': { rax: -.5, raz: .12, lax: -.5, laz: -.12, hx: .04, bx: 0, leg: -1.45 },
});
/** Gestures ambient deck crew cycle through. */
export const GESTURES = Object.freeze(['talk', 'talk', 'point', 'idle', 'wave', 'salute', 'angry', 'celebrate']);
/** A room's flag picks its occupant's signature gesture (prototype FLAGPOSE). */
export const FLAG_POSE = Object.freeze({ mission: 'point', reward: 'celebrate', store: 'talk', talk: 'talk', upgrade: 'point' });
const SEATED = new Set(['sit', 'sit-drink']);
/** How far down each helmet sits over the head (full-cover helmets ride lower). */
const HELM_DROP = { servicecap: -.02, captain: -.02, combat: -.05, aviator: -.04, techvisor: 0, tanker: -.03, diver: -.1, cowl: 0, spacehelm: -.08, hoodmask: -.07, gasmask: -.07, hardhat: 0 };
const SKIN = 0xF5C9A0, HAIR = 0x5A3A24, SHIRT = 0x9C7A5B, DENIM = 0x3E5F8A, SHOE = 0x6B4227;
/** Leg length in rig units: how far a seated figure's origin drops below a standing one's. */
export const SEAT_DROP = 0.34;

/** A small seeded generator (mulberry32): the room view's crew schedules repeat run to run. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The look for a faction (+ captain / player overrides). */
export function cfgFor(facKey, opts = {}) {
  const f = LOOKS[facKey] || LOOKS.collective;
  const captain = !!opts.captain;
  return {
    outfit: opts.outfit != null ? opts.outfit : f.outfit,
    stripe: opts.stripe != null ? opts.stripe : f.stripe,
    helmet: opts.helmet || (captain ? 'captain' : f.helmet),
    hc: opts.hc || (captain ? CAPTAIN_HC : f.hc),
    faction: facKey, captain,
  };
}

/**
 * Drive one figure's pose toward `state` (pure maths on the figure's pivots).
 * cur = { rax, raz, lax, laz, hx, bx, leg, yaw } carried between frames; t = seconds; reduce = prefers-reduced-motion.
 * → { hop, drop, yaw } in rig units (hop up, drop down for a seated figure).
 */
export function drivePose(ud, cur, state, baseYaw, dt, t, phase, reduce = false) {
  const P = POSE[state] || POSE.idle, k = 1 - Math.exp(-dt * 7);
  for (const key of ['rax', 'raz', 'lax', 'laz', 'hx', 'bx', 'leg']) cur[key] += (P[key] - cur[key]) * k;
  const ph = t + phase;
  let oRx = 0, oRz = 0, oLx = 0, oLz = 0, hop = 0, bodyRz = 0, hb = 0;
  if (reduce) { /* held poses only */ }
  else if (state === 'talk') { oRx = Math.sin(ph * 3) * .22; oLx = Math.sin(ph * 3 + 1) * .18; hb = Math.sin(ph * 3) * .05; }
  else if (state === 'wave') { oRz = Math.sin(ph * 9) * .4; }
  else if (state === 'celebrate') { hop = Math.max(0, Math.sin(ph * 5)) * 1.1; oRz = Math.sin(ph * 10) * .2; oLz = -Math.sin(ph * 10) * .2; }
  else if (state === 'angry') { bodyRz = Math.sin(ph * 16) * .05; oRx = Math.sin(ph * 16) * .16; oLx = Math.sin(ph * 16 + .5) * .16; hop = Math.max(0, Math.sin(ph * 8)) * .3; }
  else if (state === 'point') { oRx = Math.sin(ph * 2) * .05; }
  else if (state === 'idle') { hb = Math.sin(ph * 1.2) * .03; }
  else if (state === 'work') { oRx = Math.sin(ph * 4) * .12; oLx = Math.sin(ph * 4 + 2) * .12; hb = Math.sin(ph * 2) * .06; }
  else if (state === 'sit-drink') {
    const sip = Math.max(0, Math.sin(ph * 0.9)) ** 3;            // a slow lift of the glass every ~7 s
    oRx = -1.55 * sip; oRz = .25 * sip; hb = -.12 * sip;
  }
  let yawT = baseYaw;
  if (state === 'wave' || state === 'angry' || state === 'celebrate' || state === 'salute' || state === 'turn') yawT = 0;
  cur.yaw += (yawT - cur.yaw) * k * .9;
  ud.rArm.rotation.set(cur.rax + oRx, 0, cur.raz + oRz);
  ud.lArm.rotation.set(cur.lax + oLx, 0, cur.laz + oLz);
  ud.head.rotation.set(cur.hx + (reduce ? 0 : Math.sin(ph * 1.3) * .03 + hb), 0, reduce ? 0 : Math.sin(ph * .7) * .04);
  ud.body.rotation.set(cur.bx, 0, bodyRz);
  ud.lLeg.rotation.set(cur.leg, 0, 0); ud.rLeg.rotation.set(cur.leg, 0, 0);
  // how far a seated figure's origin sits below a standing one's: the caller lowers the whole figure so the hips rest
  // on the seat (the legs fold forward from the hip; the torso stays on them)
  const drop = SEAT_DROP * Math.min(1, Math.abs(cur.leg) / 1.45);
  return { hop, drop, yaw: cur.yaw, seated: SEATED.has(state) };
}

/** Swing arms and legs for a walk step (phase advances with distance). */
export function walkSwing(ud, cur, ph, reduce = false) {
  const sw = reduce ? 0 : Math.sin(ph) * .5;
  cur.lax = sw; cur.rax = -sw; cur.raz = .06; cur.laz = -.06; cur.leg = 0;
  ud.lArm.rotation.set(sw, 0, -.06); ud.rArm.rotation.set(-sw, 0, .06);
  ud.lLeg.rotation.set(-sw * .8, 0, 0); ud.rLeg.rotation.set(sw * .8, 0, 0);
  ud.head.rotation.set(.02, 0, 0); ud.body.rotation.set(0, 0, 0);
}

/** The three.js half: builds figures. Materials are shared by colour, so twenty figures cost far fewer programs. */
export function createCrewKit(THREE) {
  const SRGB = (h) => new THREE.Color(h).convertSRGBToLinear();
  const matCache = new Map();
  let uniq = 0;
  const sm = (h, o = {}) => {
    const { unique, ...rest } = o;
    const key = unique ? `u${uniq++}` : h + JSON.stringify(rest);
    const hit = matCache.get(key); if (hit) return hit;
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: SRGB(h), roughness: .6, metalness: .04 }, rest));
    matCache.set(key, m);
    return m;
  };
  const geoCache = new Map();
  const geo = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; };
  const put = (g, m, parent, pos, scl, rot) => {
    const o = new THREE.Mesh(g, m);
    if (pos) o.position.set(pos[0], pos[1], pos[2]);
    if (scl) o.scale.set(scl[0], scl[1], scl[2]);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(o); return o;
  };

  function makeHelmet(style, hc) {
    const h = new THREE.Group();
    const shell = sm(hc.shell, { roughness: .5 }), trim = sm(hc.trim, { roughness: .5 });
    const accent = sm(hc.accent, { roughness: .4, metalness: .2 });
    const glow = (c) => sm(c, { emissive: SRGB(c), emissiveIntensity: .7, roughness: .4 });
    const glass = sm(0x0c1622, { transparent: true, opacity: .34, roughness: .06, metalness: .5 });
    const dome = (r, seg) => geo(`dome${r}${seg}`, () => new THREE.SphereGeometry(r, seg || 22, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    const ball = (r) => geo(`ball${r}`, () => new THREE.SphereGeometry(r, 16, 12));
    const cyl = (a, b, ht, s) => geo(`cyl${a},${b},${ht},${s}`, () => new THREE.CylinderGeometry(a, b, ht, s || 18));
    const torus = (r, t, a, b, arc) => geo(`tor${r},${t},${a},${b},${arc}`, () => new THREE.TorusGeometry(r, t, a, b, arc));
    const box = (x, y, z) => geo(`box${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z));
    if (style === 'hardhat') {
      const d = new THREE.Group(); d.scale.set(1.02, .85, 1.08); h.add(d);
      put(dome(.4), shell, d); put(torus(.4, .035, 8, 32, Math.PI), shell, d, null, null, [0, Math.PI / 2, 0]);
      put(cyl(.47, .48, .05, 40), shell, h, [0, 0, .03], [1, 1, 1.1]);
    } else if (style === 'servicecap') {
      put(cyl(.4, .41, .15, 24), trim, h, [0, -.04, 0]);
      const crown = new THREE.Group(); crown.scale.set(1.04, .6, 1.12); h.add(crown); put(dome(.4), shell, crown, [0, .02, 0]);
      put(torus(.405, .018, 8, 28), accent, h, [0, .04, 0], null, [Math.PI / 2, 0, 0]);
      put(geo('peak52', () => new THREE.CylinderGeometry(.52, .5, .03, 28, 1, false, 0, Math.PI)), trim, h, [0, -.1, .12], [1, 1, .6], [-.3, 0, 0]);
    } else if (style === 'captain') {
      put(cyl(.41, .42, .16, 26), trim, h, [0, -.03, 0]);
      put(torus(.41, .022, 8, 30), accent, h, [0, 0, 0], null, [Math.PI / 2, 0, 0]);
      const crown = new THREE.Group(); crown.scale.set(1.08, .52, 1.14); h.add(crown); put(dome(.42), shell, crown, [0, .05, 0]);
      put(geo('visor56', () => new THREE.CylinderGeometry(.56, .52, .035, 30, 1, false, 0, Math.PI)), trim, h, [0, -.1, .14], [1, 1, .62], [-.34, 0, 0]);
      put(geo('visor58', () => new THREE.CylinderGeometry(.58, .54, .015, 30, 1, false, 0, Math.PI)), accent, h, [0, -.1, .145], [1, 1, .6], [-.34, 0, 0]);
      put(box(.14, .1, .02), accent, h, [0, .03, .4]);
    } else if (style === 'combat') {
      const d = new THREE.Group(); d.scale.set(1.12, .96, 1.2); h.add(d); put(dome(.44), shell, d, [0, -.02, 0]);
      put(torus(.49, .03, 8, 34), trim, h, [0, -.06, 0], [1.08, 1, 1.14], [Math.PI / 2, 0, 0]);
      put(box(.24, .06, .1), accent, h, [0, .12, .46], null, [.2, 0, 0]);
      [-1, 1].forEach((s) => put(cyl(.03, .03, .3, 8), trim, h, [s * .3, -.24, .1], null, [.5, 0, s * .2]));
    } else if (style === 'aviator') {
      const d = new THREE.Group(); d.scale.set(1.04, 1, 1.06); h.add(d); put(dome(.45), shell, d, [0, -.03, 0]);
      put(torus(.4, .07, 10, 28, Math.PI), glass, h, [0, -.02, .1], [1.05, .8, 1.2], [.15, 0, 0]);
      [-1, 1].forEach((s) => put(cyl(.13, .13, .1, 16), trim, h, [s * .44, -.12, 0], null, [0, 0, Math.PI / 2]));
      put(box(.5, .05, .04), accent, h, [0, .2, .3]);
    } else if (style === 'techvisor') {
      const d = new THREE.Group(); d.scale.set(1.04, .82, 1.06); h.add(d); put(dome(.43), shell, d);
      put(torus(.42, .016, 8, 30), accent, h, [0, .02, 0], null, [Math.PI / 2, 0, 0]);
      put(box(.6, .1, .06), glow(hc.accent), h, [0, -.04, .33], null, [.1, 0, 0]);
      [-1, 1].forEach((s) => put(cyl(.05, .05, .12, 10), trim, h, [s * .42, -.06, .08], null, [0, 0, Math.PI / 2]));
    } else if (style === 'tanker') {
      const d = new THREE.Group(); d.scale.set(1.06, .96, 1.1); h.add(d); put(dome(.44), shell, d, [0, -.02, 0]);
      [-1, 1].forEach((s) => put(cyl(.16, .16, .16, 16), trim, h, [s * .44, -.1, 0], null, [0, 0, Math.PI / 2]));
      put(box(.5, .1, .06), trim, h, [0, -.02, .36], null, [.2, 0, 0]);
      put(cyl(.02, .02, .34, 8), trim, h, [.4, -.22, .26], null, [0, 0, -.6]);
      put(ball(.05), accent, h, [.24, -.32, .4]);
    } else if (style === 'diver') {
      put(ball(.5), shell, h, [0, -.04, 0], [1, 1.04, 1]);
      put(torus(.19, .035, 10, 26), accent, h, [0, -.02, .47]);
      put(geo('circ17', () => new THREE.CircleGeometry(.17, 22)), glass, h, [0, -.02, .48]);
      put(cyl(.07, .07, .1, 12), accent, h, [0, .42, 0]);
      [[-.34, .1], [.34, .1], [0, -.42]].forEach((p) => put(ball(.04), accent, h, [p[0], p[1], .3]));
    } else if (style === 'cowl') {
      put(geo('cone5', () => new THREE.ConeGeometry(.5, .95, 18, 1, true)), shell, h, [0, .16, -.04]);
      put(geo('cone44', () => new THREE.ConeGeometry(.44, .8, 18, 1, true)), trim, h, [0, .12, 0]);
      put(torus(.46, .03, 8, 26), accent, h, [0, -.26, 0], null, [Math.PI / 2, 0, 0]);
      put(ball(.06), glow(hc.accent), h, [0, .02, .42]);
    } else if (style === 'spacehelm') {
      put(ball(.5), glass, h, [0, -.02, 0]);
      put(torus(.42, .055, 12, 30), sm(hc.trim, { metalness: .4, roughness: .3 }), h, [0, -.3, 0], null, [Math.PI / 2, 0, 0]);
      put(torus(.44, .02, 10, 30), glow(hc.accent), h, [0, -.24, 0], null, [Math.PI / 2, 0, 0]);
      put(torus(.5, .016, 8, 30), accent, h, [0, .06, 0], [1, .7, 1], [Math.PI / 2, 0, 0]);
    } else if (style === 'hoodmask') {
      put(ball(.47), shell, h, [0, -.02, -.03], [1, 1.08, 1.02]);
      put(geo('cone12', () => new THREE.ConeGeometry(.12, .3, 10)), trim, h, [0, .46, -.08], null, [.3, 0, 0]);
      [-1, 1].forEach((s) => put(geo('cone05', () => new THREE.ConeGeometry(.05, .16, 8)), trim, h, [s * .3, .34, -.02], null, [0, 0, s * .5]));
      put(cyl(.025, .025, .14, 8), trim, h, [0, .12, .4], null, [1.2, 0, 0]);
      put(ball(.075), glow(hc.accent), h, [0, .16, .5]);
      put(torus(.47, .012, 8, 28), glow(hc.accent), h, [0, -.04, 0], [1, 1.06, 1], [Math.PI / 2, 0, 0]);
    } else if (style === 'gasmask') {
      put(ball(.46), shell, h, [0, -.02, 0], [1, 1.06, 1]);
      [-1, 1].forEach((s) => put(ball(.1), glass, h, [s * .15, .1, .38], [1, 1, .6]));
      put(cyl(.11, .13, .12, 14), trim, h, [0, -.16, .36], null, [Math.PI / 2, 0, 0]);
      put(torus(.11, .02, 8, 18), accent, h, [0, -.16, .42], null, [Math.PI / 2, 0, 0]);
      put(torus(.46, .014, 8, 26), accent, h, [0, 0, 0], [1, 1.06, 1], [Math.PI / 2, 0, 0]);
    } else {
      put(dome(.4), shell, h);
    }
    return h;
  }

  /** One figure. userData = { lArm, rArm, lLeg, rLeg, head, body, vestM, cfg, setFlash(k) }. Native height ≈ 4.6 units. */
  function makeChar(cfg) {
    const g = new THREE.Group();
    const rig = new THREE.Group(); g.add(rig);
    const vestM = sm(cfg.outfit, { side: THREE.DoubleSide, unique: true, emissive: SRGB(0xffcf5c), emissiveIntensity: 0 });
    const stripeM = sm(cfg.stripe, { side: THREE.DoubleSide });
    const body = new THREE.Group(); rig.add(body);
    // legs pivot at the hip (y .46): a denim leg and a shoe each
    const legG = geo('leg', () => new THREE.CylinderGeometry(.1, .1, .36, 12)), shoeG = geo('shoe', () => new THREE.SphereGeometry(1, 12, 10));
    const leg = (s) => {
      const p = new THREE.Group(); p.position.set(s * .11, .46, 0); rig.add(p);
      put(legG, sm(DENIM), p, [0, -.18, 0]);
      put(shoeG, sm(SHOE), p, [s * .01, -.40, .04], [.15, .08, .21]);
      return p;
    };
    const lLeg = leg(-1), rLeg = leg(1);
    put(geo('torso', () => new THREE.CylinderGeometry(.25, .27, .5, 18)), sm(SHIRT), body, [0, .7, 0]);
    put(geo('vest', () => new THREE.CylinderGeometry(.28, .295, .46, 22, 1, true, .25, Math.PI * 2 - .5)), vestM, body, [0, .69, 0]);
    put(geo('band', () => new THREE.CylinderGeometry(.297, .297, .05, 22, 1, true, .25, Math.PI * 2 - .5)), stripeM, body, [0, .56, 0]);
    [-1, 1].forEach((s) => put(geo('strap', () => new THREE.BoxGeometry(.05, .42, .02)), stripeM, body, [s * .1, .69, .278]));
    const sleeveG = geo('sleeve', () => new THREE.CylinderGeometry(.075, .08, .34, 10)), handG = geo('hand', () => new THREE.SphereGeometry(.085, 12, 8));
    const arm = (side) => { const p = new THREE.Group(); p.position.set(side * .3, .9, 0); put(sleeveG, sm(SHIRT), p, [0, -.17, 0]); put(handG, sm(SKIN), p, [0, -.38, 0]); body.add(p); return p; };
    const lArm = arm(-1), rArm = arm(1);
    const head = new THREE.Group(); head.position.set(0, .95, 0);
    put(geo('head', () => new THREE.SphereGeometry(.36, 24, 16)), sm(SKIN), head, [0, .32, 0], [1, .94, .94]);
    put(geo('hair', () => new THREE.SphereGeometry(.372, 24, 14, Math.PI - .55, Math.PI + 1.1, .35, 1.45)), sm(HAIR), head, [0, .33, -.01]);
    [-1, 1].forEach((s) => {
      put(geo('eye', () => new THREE.SphereGeometry(.048, 10, 8)), sm(0x231812, { roughness: .25 }), head, [s * .125, .3, .322], [1, 1.1, .6]);
      put(geo('ear', () => new THREE.SphereGeometry(.07, 10, 8)), sm(SKIN), head, [s * .37, .3, .02], [.6, 1, .9]);
    });
    const helm = makeHelmet(cfg.helmet, cfg.hc);
    helm.position.set(0, .4 + (HELM_DROP[cfg.helmet] || 0), 0);
    head.add(helm); body.add(head);
    const sh = new THREE.Mesh(geo('shadow', () => new THREE.CircleGeometry(.5, 20)), matCache.get('shadow') || (() => {
      const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .26, depthWrite: false }); matCache.set('shadow', m); return m; })());
    sh.position.set(0, .02, -.06); sh.scale.set(1.1, .42, 1); rig.add(sh);
    rig.scale.setScalar(2.7);
    g.userData = {
      lArm, rArm, lLeg, rLeg, head, body, vestM, cfg,
      /** 0..1: the vest glows gold (FLASH). */
      setFlash(k) { vestM.emissiveIntensity = 1.6 * Math.max(0, k); },
    };
    return g;
  }

  return { makeChar, makeHelmet, cfgFor, dispose() { for (const m of matCache.values()) m.dispose(); for (const g of geoCache.values()) g.dispose(); } };
}
