/**
 * src/data/factionTraits.js — what everyone knows about each faction [MM-story_mwp61a5f_32].
 *
 * Owner 2026-11-20: "Each faction might also possess a set of common strengths as characteristics. Everyone knows
 * Powder is resourceful and heavily armored, but lacking in science and strategic planning." Powder's are the owner's
 * words; the other eight were drafted and confirmed by the owner the same day ("confirm traits"). Where a draft trait
 * disagreed with the unit data, the owner chose to change the wording, not the units ("change wording for units"):
 * Air lacks thrift (was staying power), High Tech is known for precision at range and lacks speed (was precision /
 * numbers), Arcane lacks reach (was hardiness).
 * docs/tech-plan/Character-System.md §2a. Authored world input, public.
 *
 * Each trait may name:
 *   stat  — a unit stat it must show in (src/data/tables.js UNITS, averaged per faction): 'hp' | 'dps' | 'range' |
 *           'speed' | 'cost'. A strength ranks the faction in the top third of the nine on it, a weakness in the bottom
 *           third ('cost' is inverted: a strength in numbers means cheap units). The gate lists mismatches.
 *   push  — a flaw-axis push for the faction's characters when the weakness is personal (Character-System §5a.2):
 *           { axis, by }. Against-type characters skip it.
 * Pure data.
 */

export const FACTION_TRAITS = Object.freeze({
  ground: {
    knownFor: [{ word: 'resourceful' }, { word: 'heavily armoured', stat: 'hp' }],
    knownToLack: [{ word: 'science' }, { word: 'strategic planning', push: { axis: 'mind', by: -1 } }],
  },
  air: {
    knownFor: [{ word: 'speed', stat: 'speed' }, { word: 'daring aces' }],
    knownToLack: [{ word: 'thrift (the costliest units)', stat: 'cost' }, { word: 'patience', push: { axis: 'courage', by: 1 } }],
  },
  hightech: {
    knownFor: [{ word: 'precision at range', stat: 'range' }, { word: 'shields' }],
    knownToLack: [{ word: 'speed (heavy kit)', stat: 'speed' }, { word: 'adaptability', push: { axis: 'mind', by: 1 } }],
  },
  artillery: {
    knownFor: [{ word: 'range', stat: 'range' }, { word: 'siege patience' }],
    knownToLack: [{ word: 'speed', stat: 'speed' }, { word: 'close defence' }],
  },
  water: {
    knownFor: [{ word: 'endurance in the cold', stat: 'hp' }, { word: 'adaptability' }],
    knownToLack: [{ word: 'unity (rival tribes)', push: { axis: 'trust', by: 1 } }, { word: 'reach away from water' }],
  },
  arcane: {
    knownFor: [{ word: 'discipline of faith' }, { word: 'energy weapons', stat: 'dps' }],
    knownToLack: [{ word: 'open minds (dogma)', push: { axis: 'mind', by: 1 } }, { word: 'reach (short-ranged weapons)', stat: 'range' }],
  },
  space: {
    knownFor: [{ word: 'advanced science' }, { word: 'long sight (orbital)', stat: 'range' }],
    knownToLack: [{ word: 'ground sense (detached)' }, { word: 'speed of decision (bureaucracy)', push: { axis: 'drive', by: -1 } }],
  },
  dark: {
    knownFor: [{ word: 'strength at night' }, { word: 'endurance past death' }],
    knownToLack: [{ word: 'trust (everyone distrusts them)', push: { axis: 'trust', by: 1 } }, { word: 'restraint', push: { axis: 'temper', by: 1 } }],
  },
  greenies: {
    knownFor: [{ word: 'numbers (the swarm)', stat: 'cost' }, { word: 'recovery' }],
    knownToLack: [{ word: 'individual initiative (the hive)', push: { axis: 'drive', by: -1 } }, { word: 'strength alone', stat: 'hp' }],
  },
});

/** The flaw-axis pushes a faction's reputation gives its characters. → [{ axis, by, word }] */
export function traitPushes(factionKey) {
  const t = FACTION_TRAITS[factionKey];
  return t ? t.knownToLack.filter((w) => w.push).map((w) => ({ ...w.push, word: w.word })) : [];
}

/** Does the faction's reputation say it lacks science? (it is then never Brain-home, Magic-System §4) */
export const lacksScience = (factionKey) => !!(FACTION_TRAITS[factionKey] || { knownToLack: [] }).knownToLack.some((w) => /science/i.test(w.word));
