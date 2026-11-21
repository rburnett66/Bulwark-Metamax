/**
 * src/save/rumours.js — RUMOURS: a secret told by someone other than its owner [MM-story_mwp61bjm_33].
 *
 * docs/tech-plan/Character-System.md §7. Owner 2026-11-20: "Rumored .. but players who carefully track story can infer
 * probability." · 2026-11-21: "Secrets should usually be delivered at the capital ships" (the main channel).
 *   §7.1 who tells: a knower (characterModel knowersOf) tells an owner's secret once the player's rapport with the KNOWER
 *        reaches that secret's step in the owner's order, while the owner has not told it; a devoted knower of the
 *        owner's own faction shields them.
 *   §7.2 what they say: good → the truth (a gullible or flighty one repeats the owner's lie, wrong but honest); neutral →
 *        the truth or the owner's lie; evil and friendly → the truth or the owner's lie; evil and hostile → the twist;
 *        evil and hunting the owner → false (the twist, told as fact).
 *   §7.3 credibility (hidden; never shown): good 1.0 (gullible / flighty 0.8) · neutral 0.8 · evil friendly 0.6 · evil
 *        hostile 0.3 · ×0.5 for a teller who lied before · several tellers 1 − ∏(1 − p).
 *   §7.5 the owner's reaction when they tell it themselves, by the secret's guard.
 * Save: s.rumours[owner] = [{ key, teller, version, text }] · s.liedBefore[teller] = true. Pure: no DOM.
 */
import { SECRET_STEPS, discoveryStage } from './secrets.js';

const rapportOf = (s, name) => (s && s.rapport && s.rapport[name]) || null;
// secrets.js tellToken: the key, or key + ':lie' when the owner told their lie
const toldByOwner = (s, owner, key) => ((s && s.secretsHeard && s.secretsHeard[owner]) || []).some((t) => t === key || t === key + ':lie');
const lieActive = (s, owner, sec) => !!(sec.lie && ((rapportOf(s, owner) || {}).score || 0) < sec.lie.until);

/** Is the teller gullible or flighty (Character-System §5a.4: honest, and can be wrong)? */
export function canBeWrong(model, teller) {
  return model.flawsOf(teller).some((f) => (f.axis === 'trust' || f.axis === 'mind') && f.extreme === 'low');
}

/** §7.2: which version a teller gives of an owner's secret. → 'true' | 'lie' | 'twist' | 'false' */
export function rumourVersion(model, teller, owner, sec, s) {
  const pol = model.polarityOf(teller);
  const lie = lieActive(s, owner, sec);
  if (pol === 'good') return lie && canBeWrong(model, teller) ? 'lie' : 'true';
  if (pol === 'neutral') return lie ? 'lie' : 'true';
  const hunts = model.threads.some((t) => t.from === teller && t.to === owner && t.kind === 'hunts');
  if (hunts && sec.twist) return 'false';
  if (model.baseRelation(teller, owner) <= -1) return sec.twist ? 'twist' : (lie ? 'lie' : 'true');
  return lie ? 'lie' : 'true';
}

/** The words of a version. */
export function rumourText(sec, version) {
  if (version === 'lie') return sec.lie ? sec.lie.text : sec.text;
  if (version === 'twist' || version === 'false') return sec.twist || sec.text;
  return sec.text;
}

/** §7.3: how far one teller can be believed about one owner (hidden). */
export function tellerCredibility(model, teller, owner, s) {
  const pol = model.polarityOf(teller);
  let p = pol === 'good' ? (canBeWrong(model, teller) ? 0.8 : 1) : pol === 'neutral' ? 0.8 : model.baseRelation(teller, owner) <= -1 ? 0.3 : 0.6;
  if (s && s.liedBefore && s.liedBefore[teller]) p *= 0.5;
  return p;
}

/** Several independent tellers agreeing. */
export const combinedCredibility = (ps) => 1 - ps.reduce((q, p) => q * (1 - p), 1);

/** The rumours the player has heard about an owner. */
export const rumoursFor = (s, owner) => (s && s.rumours && s.rumours[owner]) || [];

/**
 * What one teller can pass on now: the first secret (in its owner's order) of someone they know about that the player
 * has reached with the TELLER, that the owner has not told, and that the player has not already heard as a rumour.
 * files: the faction characters files; s: the save. → { teller, owner, key, version, text, credibility } | null
 */
export function rumourFrom(model, files, teller, s) {
  const tc = model.chars.get(teller);
  if (!tc) return null;
  const score = (rapportOf(s, teller) || {}).score;
  if (!(score >= 0) || !rapportOf(s, teller)) return null;
  const stageNow = discoveryStage(s);
  for (const owner of model.chars.keys()) {
    if (owner === teller) continue;
    const oc = model.chars.get(owner);
    const entry = oc.entry || ((files[oc.faction] || { characters: [] }).characters.find((c) => c.name === owner));
    if (!entry) continue;
    const shielding = model.personalityOf(teller).personality === 'devoted' && tc.faction === oc.faction;
    if (shielding) continue;
    const secrets = entry.secrets || [];
    for (let i = 0; i < secrets.length; i++) {
      const sec = secrets[i];
      if (score < SECRET_STEPS[Math.min(i, SECRET_STEPS.length - 1)]) break;
      if (sec.stage > 1 && sec.stage > stageNow) continue;
      if (toldByOwner(s, owner, sec.key) || rumoursFor(s, owner).some((r) => r.key === sec.key && r.teller === teller)) continue;
      if (!model.knowersOf(owner, sec).includes(teller)) continue;
      const version = rumourVersion(model, teller, owner, sec, s);
      return { teller, owner, key: sec.key, version, text: rumourText(sec, version), credibility: tellerCredibility(model, teller, owner, s) };
    }
  }
  return null;
}

/** Record a rumour heard. → s */
export function noteRumour(s, r) {
  if (!s || !r) return s;
  const book = s.rumours || (s.rumours = {});
  const list = book[r.owner] || (book[r.owner] = []);
  if (!list.some((x) => x.key === r.key && x.teller === r.teller)) list.push({ key: r.key, teller: r.teller, version: r.version, text: r.text });
  return s;
}

/** §7.5: what the owner says, and what it costs, when they tell a secret the player already heard as a rumour. */
export const REACTIONS = Object.freeze({
  shame: { line: 'Who told you?', owner: -5, teller: -5, sameFactionOnly: true },
  fear: { line: 'Then you know. Good.', owner: 3, teller: 0 },
  control: { line: 'So you know. Then we bargain.', owner: 0, teller: 0 },
  love: { line: 'Leave them out of this.', owner: 0, teller: -3 },
});

/**
 * The owner tells a secret in person that the player heard as a rumour: their reaction, and every teller whose version
 * was not the truth is marked as having lied before. Applies the rapport changes to s. → { line, tellers } | null
 */
export function ownerTells(model, s, owner, sec) {
  const heard = rumoursFor(s, owner).filter((r) => r.key === sec.key);
  if (!heard.length) return null;
  const react = REACTIONS[sec.guard] || null;
  const bump = (name, by) => {
    if (!by) return;
    const book = s.rapport || (s.rapport = {});
    const r = book[name] || (book[name] = { score: 0, kept: 0, broken: 0, faction: model.chars.get(name) ? model.chars.get(name).faction : null });
    r.score += by;
  };
  if (react) bump(owner, react.owner);
  for (const r of heard) {
    if (react && react.teller && (!react.sameFactionOnly || (model.chars.get(r.teller) || {}).faction === (model.chars.get(owner) || {}).faction)) bump(r.teller, react.teller);
    if (r.version !== 'true') (s.liedBefore || (s.liedBefore = {}))[r.teller] = true;
  }
  return { line: react ? react.line : null, tellers: heard.map((r) => r.teller) };
}
