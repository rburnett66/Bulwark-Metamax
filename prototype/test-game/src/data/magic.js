/**
 * src/data/magic.js — the three magics: Brain, Soul and Body [MM-story_mwp61a5f_32].
 *
 * docs/tech-plan/Magic-System.md, owner decisions 2026-11-20: "Derive the names from the three fields: quantum,
 * electric, and organic. Kind of like Brain, Soul, and Body. Brain - electric, soul - quantum, body - organic" ·
 * "Names yes" (set A) · "Powder is soul". The magics are neutral; good and evil are how a character uses them.
 * Pure data + functions. Battle skills, the MAGIC tree and backlash live in their own stories.
 */
import { polarity } from './alignment.js';

/** The three magics: faculty (what people call it) and field (the deeper truth, learned at discovery stage 4). */
export const MAGICS = Object.freeze({
  brain: Object.freeze({ faculty: 'Brain', field: 'Electrum', theme: 'electric', source: 'the Storm-Lines' }),
  soul: Object.freeze({ faculty: 'Soul', field: 'Quantum', theme: 'quantum', source: 'the Fold' }),
  body: Object.freeze({ faculty: 'Body', field: 'Organum', theme: 'organic', source: 'the Mycel' }),
});
export const SIDES = Object.freeze(Object.keys(MAGICS));

/** Two magics together. */
export const BLENDS = Object.freeze({
  foresight: Object.freeze({ name: 'Foresight', of: ['brain', 'soul'] }),
  craft: Object.freeze({ name: 'Craft', of: ['brain', 'body'] }),
  valor: Object.freeze({ name: 'Valor', of: ['soul', 'body'] }),
});

/** The balance of the three, never said until late. */
export const HIDDEN_WHOLE = 'the Bulwark';

/** Every faction's home magic (Magic-System §4, confirmed by the owner). */
export const HOME_SIDE = Object.freeze({
  hightech: 'brain', artillery: 'brain', space: 'brain',
  ground: 'soul', arcane: 'soul', air: 'soul',
  greenies: 'body', water: 'body', dark: 'body',
});

/** The discovery storyline (Magic-System §6): what the player believes at each stage. */
export const STAGES = Object.freeze([
  null,
  'two kinds: blessing and curse',
  'three: Brain, Soul and Body',
  'intent: the same magic heals or harms',
  'blends, extremes and the fields (Electrum, Quantum, Organum)',
  'balance: the three are one system',
]);

/** A character's use of magic, from their alignment's polarity. → 'good' | 'neutral' | 'evil' */
export const useFor = (align) => polarity(align);

/** Is this a valid side for a magic or sense secret (a magic or a blend)? */
export const isSide = (s) => SIDES.includes(s) || Object.prototype.hasOwnProperty.call(BLENDS, s);
