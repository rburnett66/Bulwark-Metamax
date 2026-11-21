/**
 * src/data/characterGate.js — what today's characters fail in the character system [MM-story_mwp61a5f_32].
 *
 * docs/tech-plan/Character-System.md §9 and Magic-System.md §9. The checks that judge CONTENT (personalities, loves and
 * hates, who knows a secret, twists, secondaries, faction traits, magic tags) return findings rather than throwing, so
 * the cast rework can fix them one at a time: characterSystem.test.mjs fails only on a finding that is NOT in
 * content/characters/gate-baseline.json (a new problem), or on a baseline entry that no longer happens (fixed: take it
 * off the list). tools/dialog/character_gate.mjs writes the report and the baseline. Pure.
 */
import { FACTION_KEYS } from './factionRelations.js';
import { FACTION_TRAITS } from './factionTraits.js';
import { isSide, HOME_SIDE } from './magic.js';
import { conviction } from './alignment.js';
import { PLANET_ORDER } from '../save/reveals.js';

/** Unit stat averages per faction, and each faction's rank (1 = highest) on each stat. */
export function statRanks(units, packs) {
  const avg = {};
  for (const key of FACTION_KEYS) {
    const name = packs.factions[key] && packs.factions[key].name;
    const us = Object.values(units).filter((u) => u.faction === name);
    if (!us.length) continue;
    const mean = (f) => us.reduce((s, u) => s + f(u), 0) / us.length;
    avg[key] = { hp: mean((u) => u.hp[0]), dps: mean((u) => u.dps[0]), range: mean((u) => u.range), speed: mean((u) => u.speed),
      cost: mean((u) => (Array.isArray(u.cost) ? u.cost[0] : u.cost) || 0) };
  }
  const rank = {};
  for (const stat of ['hp', 'dps', 'range', 'speed', 'cost']) {
    const order = Object.keys(avg).sort((a, b) => avg[b][stat] - avg[a][stat]);
    order.forEach((k, i) => { (rank[k] || (rank[k] = {}))[stat] = i + 1; });
  }
  return { avg, rank, n: Object.keys(avg).length };
}

/** The distinctive words a hate would use for a character: the full name and the last name (not titles). */
function namesIn(name) {
  const bare = name.replace(/\s*\(.*?\)/g, '').replace(/"[^"]*"/g, '').trim();
  const parts = bare.split(/\s+/);
  const last = parts[parts.length - 1];
  return [bare, ...(last && last.length >= 4 && /^[A-Z]/.test(last) ? [last] : [])];
}

const short = (n) => n.replace(/^(Captain|Colonel|Field-Marshal|General|Chancellor|Quartermaster|Sergeant|Freikorps raider) /, '');

/**
 * Every content finding. model: buildModel(...); files: the faction characters files that exist; ranks: statRanks(...).
 * → [{ id, check, faction, who, text }] sorted by id
 */
export function characterFindings(model, files, ranks) {
  const out = [];
  const add = (id, check, faction, who, text) => out.push({ id, check, faction, who, text });

  for (const key of FACTION_KEYS) if (!files[key]) add(`no-file:${key}`, 'files', key, null, 'no characters file yet (secrets, lines, maps); the cast rework writes it');

  for (const c of model.chars.values()) {
    const p = model.personalityOf(c.name);
    if (p.outside) add(`personality:${c.name}`, 'personality', c.faction, c.name, `${p.declared} is not ${c.align}'s primary or alternate (${p.personality} is the primary)`);
    if (!c.entry) continue;
    const secrets = c.entry.secrets || [];
    for (const s of secrets) {
      if (s.key === 'love' && s.who) {
        const t = model.threads.find((x) => x.from === c.name && x.to === s.who && (x.kind === 'love' || x.kind === 'kin'));
        if (!t) add(`love:${c.name}`, 'love', c.faction, c.name, `loves ${s.who}, with no love or kin thread`);
      }
      // a hate may be of a group or a person, and may be dislike or distrust (owner 2026-11-20); a hate that names a
      // character needs a rival or hunts thread to them
      if (s.key === 'hate') {
        const text = String(s.text), others = [...model.chars.values()].filter((o) => o.name !== c.name);
        const lastCount = {}; for (const o of model.chars.values()) { const l = namesIn(o.name)[1]; if (l) lastCount[l] = (lastCount[l] || 0) + 1; }
        const named = others.find((o) => text.includes(namesIn(o.name)[0]))
          || others.find((o) => namesIn(o.name)[1] && lastCount[namesIn(o.name)[1]] === 1 && text.includes(namesIn(o.name)[1]));
        if (named && !model.threads.some((x) => x.from === c.name && x.to === named.name && (x.kind === 'rival' || x.kind === 'hunts'))) {
          add(`hate:${c.name}`, 'hate', c.faction, c.name, `hates ${named.name}, with no rival or hunts thread to them`);
        }
      }
      const reach = model.reachOf(c.name, s);
      const knowers = model.knowersOf(c.name, s);
      if (reach !== 'private' && !knowers.length) add(`no-knower:${c.name}:${s.key}`, 'knowers', c.faction, c.name, `${s.key} reaches ${reach}, but no one is in a position to know it`);
      const hostile = knowers.filter((k) => model.polarityOf(k) === 'evil' && model.baseRelation(k, c.name) <= -1);
      if (hostile.length && !s.twist) add(`twist:${c.name}:${s.key}`, 'twist', c.faction, c.name, `${s.key} can reach ${hostile.map(short).join(', ')} (evil, hostile) but has no twist`);
      if (s.key === 'magic' || s.key === 'sense') {
        const missing = [!isSide(s.side) && 'side', !(s.depth >= 0 && s.depth <= 3) && 'depth', !(s.stage >= 1 && s.stage <= 5) && 'stage'].filter(Boolean);
        if (missing.length) add(`magic-tags:${c.name}:${s.key}`, 'magic', c.faction, c.name, `${s.key} has no ${missing.join(', ')}`);
        if (s.depth === 3 && !s.cost) add(`magic-cost:${c.name}:${s.key}`, 'magic', c.faction, c.name, `${s.key} is extreme (depth 3) with no cost written`);
        if (s.stage === 5 && conviction(c.align) !== 3) add(`magic-stage5:${c.name}:${s.key}`, 'magic', c.faction, c.name, `a balance clue (stage 5) from a character who is not a Balance-Keeper (${c.align})`);
      }
    }
  }

  // a love against the matrix (base ≤ 0) is a drama thread and must say which one (Character-System §5)
  for (const t of model.threads) {
    if (t.kind !== 'love' || t.tag) continue;
    const b = model.baseRelation(t.from, t.to);
    if (b !== null && b <= 0) add(`love-matrix:${t.from}->${t.to}`, 'love', model.chars.get(t.from).faction, t.from, `loves ${t.to} against the matrix (base ${b}) with no drama tag`);
  }

  for (const [key, file] of Object.entries(files)) {
    for (const [mapId, m] of Object.entries(file.maps || {})) {
      if (!m.primary || !m.secondary) continue;
      const pc = model.chars.get(m.primary);
      if (!pc || !pc.entry) continue;
      const across = new Set((pc.entry.secrets || []).filter((s) => model.reachOf(pc.name, s) === 'across').flatMap((s) => model.knowersOf(pc.name, s))
        .filter((k) => model.chars.get(k).faction !== key));   // the secondary is always from another faction
      if (across.size && !across.has(m.secondary.name)) {
        add(`secondary:${key}:${mapId}`, 'secondary', key, m.primary, `map ${mapId}'s secondary ${m.secondary.name} knows none of ${short(m.primary)}'s secrets (who does: ${[...across].map(short).join(', ')})`);
      }
    }
    const chars = file.characters || [];
    if (!chars.some((c) => c.againstType)) add(`against-type:${key}`, 'traits', key, null, 'no character goes against the faction\'s reputation');
    const hearts = chars.filter((c) => c.magicHeart);
    if (hearts.length !== 1) add(`magic-heart:${key}`, 'magic', key, null, hearts.length ? `${hearts.length} magic hearts; there must be one` : 'no magic heart declared');
  }

  // names before their stage (Magic-System §9 check 7): the field names (Electrum, Quantum, Organum) only in a secret
  // of stage 4 or later; the folk names (brain-craft, soul-fire, body-craft) only from stage 2; nowhere in the lines
  // every player hears (start / win / lose) [MM-story_mwpt846x_3z]
  const FIELD = /\b(Electrum|Quantum|Organum)\b/, FOLK = /\b(brain-craft|soul-fire|body-craft)\b/i;
  for (const [key, file] of Object.entries(files)) for (const c of file.characters || []) {
    const said = [...Object.values(c.lines || {})];
    for (const t of said) {
      if (FIELD.test(t) || FOLK.test(t)) add(`magic-names:${c.name}:lines`, 'magic', key, c.name, `an everyday line names the magic before the player learns it: "${t}"`);
    }
    for (const s of c.secrets || []) {
      const words = [s.text, s.line, s.twist, s.lie && s.lie.text, s.lie && s.lie.line].filter(Boolean).join(' ');
      const stage = s.stage || 1;
      if (FIELD.test(words) && stage < 4) add(`magic-names:${c.name}:${s.key}`, 'magic', key, c.name, `${s.key} names a field (stage 4) at stage ${stage}`);
      else if (FOLK.test(words) && stage < 2) add(`magic-names:${c.name}:${s.key}`, 'magic', key, c.name, `${s.key} uses a faculty name (stage 2) at stage ${stage}`);
    }
  }

  // magic across the cast (Magic-System §6, §6.1, §9 checks 4, 6 and 10)
  const keys = Object.keys(files);
  if (keys.length === FACTION_KEYS.length) {
    const fifth = new Set();
    for (const key of keys) {
      const cs = files[key].characters || [];
      const sides = cs.flatMap((c) => (c.secrets || []).filter((s) => s.key === 'magic' && s.side).map((s) => s.side));
      if (sides.length && sides.every((sd) => sd === HOME_SIDE[key])) add(`magic-offside:${key}`, 'magic', key, null, `every magic secret is the home magic (${HOME_SIDE[key]}); one character should use another`);
      for (const c of cs) if ((c.secrets || []).some((s) => s.stage === 5)) fifth.add(key);
    }
    if (fifth.size < 5) add('magic-stage5-spread', 'magic', null, null, `balance clues (stage 5) in ${fifth.size} factions; the rule is at least 5`);
    const third = (m) => (m <= 3 ? 'early' : m <= 6 ? 'middle' : 'late');
    const heartMap = {};
    for (const key of keys) {
      const heart = (files[key].characters || []).find((c) => c.magicHeart);
      const at = heart && Object.entries(files[key].maps || {}).find(([, m]) => m.primary === heart.name);
      if (at) heartMap[key] = +at[0];
    }
    const placed = Object.values(heartMap);
    if (placed.length === keys.length) {
      if (!placed.includes(1) || !placed.includes(9)) add('magic-hearts-ends', 'magic', null, null, 'no faction meets its magic heart first (map 1) or last (map 9)');
      for (const t of ['early', 'middle', 'late']) if (placed.filter((m) => third(m) === t).length < 2) add(`magic-hearts-${t}`, 'magic', null, null, `fewer than two factions meet their magic heart in the ${t} maps`);
      const order = PLANET_ORDER.filter((k) => heartMap[k]);
      for (let i = 1; i < order.length; i++) if (third(heartMap[order[i]]) === third(heartMap[order[i - 1]])) add(`magic-hearts-neighbours:${order[i - 1]}-${order[i]}`, 'magic', order[i], null, `${order[i - 1]} and ${order[i]} are neighbouring homeworlds with their hearts both in the ${third(heartMap[order[i]])} maps`);
    }
  }

  for (const key of FACTION_KEYS) {
    const t = FACTION_TRAITS[key], r = ranks && ranks.rank[key];
    if (!t || !r) continue;
    const third = Math.ceil(ranks.n / 3);
    for (const [list, strength] of [[t.knownFor, true], [t.knownToLack, false]]) {
      for (const w of list) {
        if (!w.stat) continue;
        // cost is inverted: strength in numbers means cheap units (a low cost rank = expensive)
        const rk = r[w.stat], high = rk <= third, low = rk > ranks.n - third;
        const ok = w.stat === 'cost' ? (strength ? low : high) : (strength ? high : low);
        if (!ok) add(`trait-stat:${key}:${w.word}`, 'traits', key, null, `"${strength ? 'known for' : 'known to lack'} ${w.word}" but its units rank ${rk} of ${ranks.n} on ${w.stat}`);
      }
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
