/**
 * storyModel.js — the Story Map's model [MM-story_mwtlwj5f_h] (epic MM-epic_mwtlwawp_f).
 *
 * Owner 2026-11-23: "Managing this complex a story will require a tool. We also need a graph which shows how the story
 * develops over a timeline. Prioritize shows branches that indicate the availability of missions over time. Also assume
 * the player is completing planets maps and waves in sequence."
 *
 * Built from the live content files (missions.json, characters/*.json, threads.json, voicepacks.json, reveals.json,
 * mapdata.json), never a copy, so the map cannot drift from the game. Pure data, no DOM: node-tested.
 *
 * TIME. One playthrough in sequence: planet by planet (in portal order), map 1 → 9, wave 1 → 8. Time is measured in
 * MAP SLOTS: map m of the planet at index p occupies [p·9 + m − 1, p·9 + m); wave w of it sits at slot + (w − 0.5)/8.
 * A map is won at the end of its slot.
 *
 * AVAILABILITY. Every node carries a window: `from` (when it can first be taken) → `due` (when a player playing in
 * sequence would naturally finish it) → open-ended (missions stay available: "players can always return").
 */

export const WAVES_PER_MAP = 8;
export const MAPS_PER_PLANET = 9;

/** The story themes the map can highlight. `test(node)` is applied once, at build time. */
export const THEMES = Object.freeze([
  { id: 'love', name: 'Love', color: '#ff5c8a', blurb: 'Two characters in love meet, speak or are involved' },
  { id: 'rivalry', name: 'Rivalry', color: '#ff8f3d', blurb: 'Rivals and hunters meet, speak or are involved' },
  { id: 'resources', name: 'Resources', color: '#f2c869', blurb: 'Harvests, hauls, deliveries, contracts and trade' },
  { id: 'tech', name: 'Tech', color: '#4dd8ff', blurb: 'Tech nodes unlocked or required' },
  { id: 'modes', name: 'Game modes', color: '#b48cff', blurb: 'New planets, capital ships, outposts and farming open' },
  { id: 'alignment', name: 'Light & shadow', color: '#e9ecff', blurb: 'Alignment-gated branches and alignment shifts' },
  { id: 'combat', name: 'Combat', color: '#ff4d4d', blurb: 'Kill counts, clean defence and fast wins' },
  { id: 'secrets', name: 'Secrets', color: '#5ff0b0', blurb: 'Character secrets, treasures and favours' },
]);

/** Lanes, top to bottom. `y` is in lane units; the view scales it. */
export const LANES = Object.freeze([
  { id: 'modes', name: 'Milestones', y: 0 },
  { id: 'light', name: 'Light contracts', y: 1.2 },
  { id: 'spine', name: 'Campaign', y: 2.4 },
  { id: 'shadow', name: 'Shadow contracts', y: 3.6 },
  { id: 'voices', name: 'Wave-3 voices', y: 4.8 },
  { id: 'outpost', name: 'Outpost contracts', y: 6.0 },
  { id: 'farm', name: 'Farm contracts', y: 7.4 },
]);
const LANE_Y = Object.fromEntries(LANES.map((l) => [l.id, l.y]));

/** Assumed pacing for chains that run beside the campaign (owner to tune): one outpost contract every 2 maps. */
export const PACING = Object.freeze({ outpostStepMaps: 2, outpostWork: 1.5, farmWork: 2, secondaryDue: 'planet-end' });

const allConds = (m) => ['view', 'unlock', 'execute', 'complete', 'fail'].flatMap((k) => m[k] || []);

/** Planet order from the portal chain (P-XXX-03 "Unlocks: Portal: Y"); falls back to the missions' own order. */
export function planetOrder(missions) {
  const seen = [];
  for (const m of missions) if (!seen.includes(m.planet)) seen.push(m.planet);
  const next = {};
  for (const m of missions) for (const r of m.rewards || []) {
    const hit = /Portal:\s*(.+)$/.exec(r.label || '');
    if (hit) next[m.planet] = hit[1].trim();
  }
  const targets = new Set(Object.values(next));
  const start = seen.find((p) => !targets.has(p)) || seen[0];
  const out = [];
  for (let p = start; p && !out.includes(p); p = next[p]) out.push(p);
  for (const p of seen) if (!out.includes(p)) out.push(p);
  return out;
}

/** Slot start of a planet's map (1-based map). */
export const slotOf = (pIdx, map) => pIdx * MAPS_PER_PLANET + (map - 1);
/** The time of a wave within a map. */
export const waveTime = (pIdx, map, wave) => slotOf(pIdx, map) + (wave - 0.5) / WAVES_PER_MAP;

/** "Verdance · map 3 · wave 3" for a time. */
export function timeLabel(order, t) {
  const p = Math.min(order.length - 1, Math.max(0, Math.floor(t / MAPS_PER_PLANET)));
  const within = t - p * MAPS_PER_PLANET;
  const map = Math.min(MAPS_PER_PLANET, Math.floor(within) + 1);
  const wave = Math.min(WAVES_PER_MAP, Math.floor((within - (map - 1)) * WAVES_PER_MAP) + 1);
  return `${order[p]} · map ${map} · wave ${wave}`;
}

/** Index the threads by pair: pairKind(a, b) → Set of kinds between them (either direction). */
function threadIndex(threads) {
  const by = new Map();
  const add = (a, b, k) => { const key = a + '\u0000' + b; if (!by.has(key)) by.set(key, new Set()); by.get(key).add(k); };
  for (const t of threads || []) { add(t.from, t.to, t.kind); add(t.to, t.from, t.kind); }
  return {
    between(a, b) { return by.get(a + '\u0000' + b) || new Set(); },
    /** All threads touching a set of names, pairs inside the set only. */
    inside(names) {
      const out = [];
      for (const t of threads || []) if (names.includes(t.from) && names.includes(t.to)) out.push(t);
      return out;
    },
  };
}

/** name → { factionKey, entry } across the character files. */
function characterIndex(characterFiles) {
  const idx = new Map();
  for (const [key, file] of Object.entries(characterFiles || {})) {
    for (const c of (file && file.characters) || []) idx.set(c.name, { factionKey: key, entry: c });
  }
  return idx;
}

function tagThemes(node, ctx) {
  const t = new Set();
  const m = node.mission;
  const names = node.people || [];
  const inside = ctx.threads.inside(names);
  if (inside.some((x) => x.kind === 'love')) t.add('love');
  for (const n of names) {
    const c = ctx.chars.get(n);
    const love = c && (c.entry.secrets || []).find((s) => s.key === 'love');
    if (love && love.who && names.includes(love.who)) t.add('love');
  }
  if (inside.some((x) => x.kind === 'rival' || x.kind === 'hunts')) t.add('rivalry');
  if (m) {
    const conds = allConds(m).map((c) => c.cond);
    const rewards = (m.rewards || []).map((r) => r.kind);
    // nearly every mission pays in a resource and costs a rival loyalty, so those alone light nothing: the theme is the
    // TASK (harvest, haul, deliver, sell) and, for rivalry, the people (rival and hunter threads, above)
    if (m.type === 'outpost' || m.type === 'farm'
      || conds.some((c) => /harvest|haul|ore_|crop_|quota|premium/.test(c))) t.add('resources');
    if (rewards.includes('tech_unlock') || conds.includes('tech_node')) t.add('tech');
    if ((m.rewards || []).some((r) => /Portal:/.test(r.label || ''))) t.add('modes');
    if (m.variant || (m.impact || {}).alignment) t.add('alignment');
    if (conds.some((c) => /kills|no_base_damage|finish_under|under_par|five_star/.test(c))) t.add('combat');
  }
  if (node.kind === 'milestone') t.add('modes');
  if (node.kind === 'beat' && node.offer) t.add('resources');
  if (node.secrets && node.secrets.length) t.add('secrets');
  if (node.firstOfMode) t.add('modes');
  return [...t];
}

/**
 * Build the story timeline. src: { missions (missions.json), characters ({ factionKey: file }), threads (threads.json),
 * reveals, mapdata, planets (PLANETS: key → { name, ui }) }.
 * → { order, planets: [{ name, key, color, from, to }], nodes, branches, lanes, themes, end, density(t) }
 */
export function buildStory(src) {
  // the game's missions, and the contracts the design has but the game cannot play yet (missions.json plannedMissions,
  // e.g. the 26 farming contracts not live) [MM-story_mwu3uc19_1v]: on the map, marked planned
  const missions = [...((src.missions && src.missions.missions) || []), ...((src.missions && src.missions.plannedMissions) || [])];
  const order = planetOrder(missions);
  const planetsByName = {};
  for (const [key, p] of Object.entries(src.planets || {})) planetsByName[p.name] = { key, ...p };
  const pIdx = Object.fromEntries(order.map((p, i) => [p, i]));
  const end = order.length * MAPS_PER_PLANET;
  const ctx = { threads: threadIndex((src.threads || {}).threads), chars: characterIndex(src.characters) };
  const rare = ((src.mapdata || {}).rareContracts) || [];
  const ships = (src.missions && src.missions.capitalShips) || {};
  const nodes = [];
  const add = (n) => { n.themes = tagThemes(n, ctx); n.planned = !!(n.mission && n.mission.status === 'Planned'); nodes.push(n); return n; };

  const castOf = (planet, map) => {
    const key = (planetsByName[planet] || {}).key;
    const file = key && src.characters && src.characters[key];
    return (file && file.maps && file.maps[String(map)]) || null;
  };
  const secretsOf = (names) => names.flatMap((n) => {
    const c = ctx.chars.get(n);
    return c ? (c.entry.secrets || []).map((s) => ({ ...s, who: n, about: s.who || null })) : [];   // who: the keeper; about: whom it is about
  });

  // ── the campaign and its contracts ───────────────────────────────────────────────────────────────────────────────
  for (const m of missions) {
    const p = pIdx[m.planet];
    if (p == null) continue;
    const planetEnd = slotOf(p, MAPS_PER_PLANET) + 1;
    if (m.type === 'campaign') {
      const s = slotOf(p, m.map), cast = castOf(m.planet, m.map) || {};
      const people = [m.giver && m.giver.name, cast.primary, cast.secondary && cast.secondary.name].filter(Boolean);
      add({ id: m.id, kind: 'campaign', lane: 'spine', planet: m.planet, map: m.map, x: s + 0.5, from: s, due: s + 1,
        branch: m.questLine, title: m.title, mission: m, people: [...new Set(people)], cast });
    } else if (m.type === 'faction') {
      const won = slotOf(p, m.map) + 1;                 // the map is beaten → a replay can take the contract
      const lane = m.variant === 'shadow' ? 'shadow' : 'light';
      add({ id: m.id, kind: 'secondary', lane, planet: m.planet, map: m.map, x: won + 0.18, from: won, due: planetEnd,
        branch: m.questLine + ':' + (m.variant || ''), title: m.title, mission: m, variant: m.variant,
        people: [m.giver && m.giver.name].filter(Boolean) });
    }
  }

  // ── capital ships, outposts and farms, beside the campaign (assumed pacing) ──────────────────────────────────────
  const arrivalOf = {};
  for (const planet of order) {
    const p = pIdx[planet], ship = ships[planet] || {};
    const at = /map (\d)/.exec(ship.arrives || '');
    const t = slotOf(p, at ? Number(at[1]) : 3) + 1;
    arrivalOf[planet] = t;
  }
  let firstOutpost = true, firstFarm = true;
  for (const planet of order) {
    const p = pIdx[planet];
    const outs = missions.filter((m) => m.planet === planet && m.type === 'outpost').sort((a, b) => a.step - b.step);
    outs.forEach((m, k) => {
      const from = arrivalOf[planet] + k * PACING.outpostStepMaps;
      add({ id: m.id, kind: 'outpost', lane: 'outpost', planet, step: m.step, x: from + 0.35, from, due: from + PACING.outpostWork,
        branch: m.questLine, title: m.title, mission: m, people: [m.giver && m.giver.name].filter(Boolean),
        firstOfMode: firstOutpost && k === 0 ? 'Outposts open' : null, assumed: true });
      if (k === 0) firstOutpost = false;
    });
    const farms = missions.filter((m) => m.planet === planet && m.type === 'farm').sort((a, b) => a.step - b.step);
    farms.forEach((m, k) => {
      const from = slotOf(p, MAPS_PER_PLANET) + 1 + k * PACING.farmWork;   // "<planet> finished: every campaign map beaten"
      add({ id: m.id, kind: 'farm', lane: 'farm', planet, step: m.step, x: from + 0.35, from, due: from + PACING.farmWork,
        branch: m.questLine, title: m.title, mission: m, people: [m.giver && m.giver.name].filter(Boolean),
        firstOfMode: firstFarm && k === 0 ? 'Farming opens' : null, assumed: true });
      if (k === 0) firstFarm = false;
    });
  }

  // ── wave-3 voices and the rare offer ─────────────────────────────────────────────────────────────────────────────
  for (const planet of order) {
    const p = pIdx[planet], key = (planetsByName[planet] || {}).key;
    for (let map = 1; map <= MAPS_PER_PLANET; map++) {
      const cast = castOf(planet, map);
      const sec = cast && cast.secondary;
      const terms = rare.find((r) => r.Planet === planet && Number(r.Map_ID) === map) || null;
      if (!sec && !terms) continue;
      const t = waveTime(p, map, 3);
      const people = [cast && cast.primary, sec && sec.name].filter(Boolean);
      add({ id: `W3-${key || planet}-${map}`, kind: 'beat', lane: 'voices', planet, map, wave: 3, x: t, from: t, due: t + 1 / WAVES_PER_MAP,
        branch: 'voices:' + planet, title: sec ? `${sec.name} calls in` : 'Rare offer',
        people, cast, offer: terms && { quota: terms.Quota, price: terms.Price_Per_Unit, loyalty: terms.Loyalty, seeded: terms.Rare_Seeded,
          buyer: sec && sec.faction, contact: sec && sec.name, needs: '3★ on wave 3' },
        secrets: [] });
    }
  }

  // ── milestones: planets, capital ships ───────────────────────────────────────────────────────────────────────────
  for (const planet of order) {
    const p = pIdx[planet], s = slotOf(p, 1);
    add({ id: 'M-open-' + planet, kind: 'milestone', lane: 'modes', planet, x: s + 0.04, from: s, due: s,
      branch: 'milestones', title: p === 0 ? `${planet}: the campaign begins` : `Portal to ${planet} opens`, people: [] });
    const ship = ships[planet] || {};
    add({ id: 'M-ship-' + planet, kind: 'milestone', lane: 'modes', planet, x: arrivalOf[planet], from: arrivalOf[planet], due: arrivalOf[planet],
      branch: 'milestones', title: `${ship.ship || 'The capital ship'} in orbit`, people: [ship.captain].filter(Boolean),
      detail: ship.arrives || '' });
  }
  for (const n of nodes.filter((x) => x.firstOfMode)) {
    add({ id: 'M-mode-' + n.kind, kind: 'milestone', lane: 'modes', planet: n.planet, x: n.from + 0.02, from: n.from, due: n.from,
      branch: 'milestones', title: n.firstOfMode, people: [], opens: n.id });
  }

  // ── character secrets: attach each character's secrets to the first node they appear on ──────────────────────────
  const seen = new Set();
  for (const n of [...nodes].sort((a, b) => a.x - b.x)) {
    const fresh = (n.people || []).filter((name) => !seen.has(name));
    fresh.forEach((name) => seen.add(name));
    n.debut = fresh;
    n.secrets = secretsOf(fresh);
    n.themes = tagThemes(n, ctx);
  }

  nodes.sort((a, b) => a.x - b.x || LANE_Y[a.lane] - LANE_Y[b.lane]);

  // ── branches: a quest line's nodes in order, forking from the spine where it opens ──────────────────────────────
  const byBranch = new Map();
  for (const n of nodes) { if (!byBranch.has(n.branch)) byBranch.set(n.branch, []); byBranch.get(n.branch).push(n); }
  const branches = [];
  for (const [id, list] of byBranch) {
    const first = list[0];
    const ql = (src.missions && src.missions.questLines || {})[id.split(':')[0]] || null;
    const kind = first.kind;
    branches.push({
      id, kind, lane: first.lane, planet: kind === 'milestone' ? null : first.planet,
      name: ql ? ql.name + (first.variant ? ` (${first.variant})` : '') : kind === 'beat' ? `${first.planet} wave-3 voices` : 'Milestones',
      ship: ql && ql.ship, nodes: list.map((n) => n.id), from: Math.min(...list.map((n) => n.from)),
      to: Math.max(...list.map((n) => n.due)), forks: kind === 'secondary' || kind === 'outpost' || kind === 'farm',
      themes: [...new Set(list.flatMap((n) => n.themes))],
    });
  }

  const planets = order.map((name, i) => ({ name, key: (planetsByName[name] || {}).key || null,
    color: (planetsByName[name] || {}).ui || '#9cc8f0', from: i * MAPS_PER_PLANET, to: (i + 1) * MAPS_PER_PLANET }));

  /** How many missions are open (from ≤ t < due) at time t, by kind. */
  function density(t) {
    const out = { campaign: 0, secondary: 0, outpost: 0, farm: 0, beat: 0, total: 0 };
    for (const n of nodes) {
      if (n.kind === 'milestone' || n.kind === 'beat') continue;
      if (n.from <= t && t < n.due) { out[n.kind]++; out.total++; }
    }
    return out;
  }

  return { order, planets, nodes, branches, lanes: LANES, themes: THEMES, end, density, arrivalOf };
}

/** The criteria of a mission, grouped and in the order the game checks them. */
export function criteriaOf(m) {
  if (!m) return [];
  const label = { view: 'Visible when', unlock: 'Unlocks when', execute: 'Played on', complete: 'Complete when', fail: 'Fails when' };
  return ['view', 'unlock', 'execute', 'complete', 'fail']
    .map((k) => ({ stage: k, label: label[k], items: (m[k] || []).map((c) => ({ text: c.text, cond: c.cond, bonus: !!c.bonus })) }))
    .filter((g) => g.items.length);
}

/** Every dialog line a node can play, by speaker, from the voice packs, character files and reveals. */
export function dialogOf(node, src) {
  const out = [];
  const vp = (src.voicepacks && src.voicepacks.factions) || {};
  const chars = characterIndex(src.characters);
  const packLine = (name) => {
    for (const [key, f] of Object.entries(vp)) {
      const c = (f.characters || []).find((x) => x.name === name);
      if (c) return { key, c };
    }
    return null;
  };
  const say = (who, when, line, factionKey) => { if (line) out.push({ who, when, line, factionKey }); };
  const voiceOf = (name, which) => {
    const pk = packLine(name), ce = chars.get(name);
    const key = (pk && pk.key) || (ce && ce.factionKey);
    const L = (pk && pk.c.lines) || {};
    const E = (ce && ce.entry.lines) || {};
    const pick = { opening: [['m0', L.m0 && L.m0.line], ['start', E.start]], win: [['winEfficient', L.winEfficient && L.winEfficient.line],
      ['winClose', L.winClose && L.winClose.line], ['win', E.win]], lose: [['defeat', L.defeat && L.defeat.line], ['lose', E.lose]],
      reward: [['reward', L.reward && L.reward.line]] };
    for (const w of which) for (const [tag, line] of pick[w] || []) say(name, `${w} · ${tag}`, line, key);
  };
  const m = node.mission;
  if (m && m.briefing) say('Briefing', 'mission text', m.briefing, null);
  if (node.kind === 'campaign') {
    if (node.cast && node.cast.primary) voiceOf(node.cast.primary, ['opening']);
    if (m && m.giver) voiceOf(m.giver.name, ['win', 'lose', 'reward']);
    const sec = node.cast && node.cast.secondary;
    if (sec) say(sec.name, 'wave 3 · their line', sec.line, sec.faction);
  } else if (node.kind === 'secondary') {
    if (m && m.giver) voiceOf(m.giver.name, ['opening', 'win', 'lose', 'reward']);
  } else if (node.kind === 'beat') {
    const sec = node.cast && node.cast.secondary;
    if (sec) say(sec.name, 'wave 3 · their line', sec.line, sec.faction);
  } else if (node.kind === 'outpost') {
    const key = Object.entries(src.planets || {}).find(([, p]) => p.name === node.planet);
    const lines = key && (((src.reveals || {}).factionShip || {}).outpost || {})[key[0]];
    if (Array.isArray(lines) && node.step === 1) for (const l of lines) say(m && m.giver ? m.giver.name : 'Captain', `aboard · ${l.beat}`, l.line, key[0]);
  } else if (node.kind === 'farm') {
    const key = Object.entries(src.planets || {}).find(([, p]) => p.name === node.planet);
    const f = key && (((src.reveals || {}).factionShip || {}).farm || {})[key[0]];
    if (f) for (const [beat, lines] of Object.entries(f)) if (Array.isArray(lines)) for (const l of lines) say(m && m.giver ? m.giver.name : 'Factor', `aboard · ${beat}`, l.line, key[0]);
  }
  for (const s of node.secrets || []) say(s.who, `secret · ${s.key}`, s.line, (chars.get(s.who) || {}).factionKey);
  return out;
}
