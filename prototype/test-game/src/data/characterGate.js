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
import { isSide } from './magic.js';

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
      if (s.key === 'hate' && !model.threads.some((x) => x.from === c.name && (x.kind === 'rival' || x.kind === 'hunts'))) {
        add(`hate:${c.name}`, 'hate', c.faction, c.name, `the hate names no one they hunt or rival: "${String(s.text).slice(0, 70)}"`);
      }
      const reach = model.reachOf(c.name, s);
      const knowers = model.knowersOf(c.name, s);
      if (reach !== 'private' && !knowers.length) add(`no-knower:${c.name}:${s.key}`, 'knowers', c.faction, c.name, `${s.key} reaches ${reach}, but no one is in a position to know it`);
      const hostile = knowers.filter((k) => model.polarityOf(k) === 'evil' && model.baseRelation(k, c.name) <= -1);
      if (hostile.length && !s.twist) add(`twist:${c.name}:${s.key}`, 'twist', c.faction, c.name, `${s.key} can reach ${hostile.map(short).join(', ')} (evil, hostile) but has no twist`);
      if (s.key === 'magic' || s.key === 'sense') {
        const missing = [!isSide(s.side) && 'side', !(s.depth >= 0 && s.depth <= 3) && 'depth', !(s.stage >= 1 && s.stage <= 5) && 'stage'].filter(Boolean);
        if (missing.length) add(`magic-tags:${c.name}:${s.key}`, 'magic', c.faction, c.name, `${s.key} has no ${missing.join(', ')}`);
      }
    }
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
