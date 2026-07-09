/**
 * prototype/test-game/src/harness/drive.js  [state-harness sh-m1.s3]
 *
 * Render DRIVE — map a unit READOUT (readout.js) onto its part-stack transforms. A pure function over a Pixi
 * container (buildPartStack output: `.parts.{base,weapon,head}`) — no sim, no DOM — so the wiring is asserted
 * headlessly AND used verbatim by the live bench (bench.js). Uses reliable transforms (rotation/scale/alpha) as
 * the primary signal so it renders on any Pixi build; `.tint` is a bonus where Graphics tint is supported.
 *   weapon.rotation <- aimAngle    base.scale/alpha <- health    head.scale/alpha <- awareness    death -> fade + list
 */

export function applyReadout(stack, r) {
  if (!stack || !stack.parts || !r) return;
  const { base, weapon, head } = stack.parts;
  const dead = r.health <= 0;

  // WEAPON <- aim: point the barrel at the acquired target; return to rest (0) when idle.
  if (weapon) weapon.rotation = (r.aimAngle != null) ? r.aimAngle : 0;

  // BASE <- health: shrink + fade as hp drops (transform is the authoritative visual; tint is a bonus).
  if (base) {
    const h = Math.max(0, Math.min(1, r.health));
    const s = 0.72 + 0.28 * h;
    if (base.scale && base.scale.set) base.scale.set(s, s);
    base.alpha = 0.45 + 0.55 * h;
    base.tint = healthTint(h);
  }

  // HEAD <- awareness: grows + brightens when locked on a target, dims while scanning.
  if (head) {
    const aware = r.awareness >= 1;
    if (head.scale && head.scale.set) head.scale.set(aware ? 1.35 : 1, aware ? 1.35 : 1);
    head.alpha = aware ? 1 : 0.5;
    head.tint = aware ? 0x8ff0ff : 0x40525e;
  }

  // DEATH: hp 0 -> the whole stack fades and lists over.
  if (typeof stack.alpha === 'number') stack.alpha = dead ? 0.3 : 1;
  stack.rotation = dead ? 0.5 : 0;
}

/** Health 0..1 -> a green→amber→red tint (bonus feedback where the renderer supports Graphics tint). */
export function healthTint(h) {
  h = Math.max(0, Math.min(1, h));
  const r = Math.round(230 * (1 - h) + 90 * h);
  const g = Math.round(200 * h + 45 * (1 - h));
  const b = Math.round(80 * h + 50 * (1 - h));
  return (r << 16) | (g << 8) | b;
}
