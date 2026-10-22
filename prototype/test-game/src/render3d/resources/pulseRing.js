/**
 * src/render3d/resources/pulseRing.js — the resource field marker: a THIN ring that expands and fades, then starts
 * again [MM-task_mvk37bu6_k]. Owner 2026-10-22: "on resources, change the wide lined circle for a thin lined circle
 * that expands and cycles". Replaces the static wide band (RingGeometry 0.36–0.45).
 *
 * The pulse is evaluated in the ring shader (resources3d.js) from one time uniform; this module is the reference the
 * shader mirrors and the tests read. Each field gets its own phase (from its id) so a field cluster ripples instead
 * of blinking in step. A regrowing (dimmed) field pulses fainter.
 */
export const RING = Object.freeze({
  period: 1.8,    // seconds per pulse
  r0: 0.32,       // cells: radius a pulse starts at — the edge of the field's mound, so the whole expansion shows …
  r1: 0.78,       // … and ends at, spreading past the field's cell
  width: 0.028,   // cells: line thickness — thin (the old band was 0.09)
  alpha: 0.9,     // peak opacity
  fadeIn: 0.08,   // fraction of the cycle spent fading in
});

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Pulse state at time t (s) for a field with phase in [0,1): { u (0..1 through the cycle), radius, alpha }. */
export function pulseAt(t, phase = 0) {
  const u = ((t / RING.period + phase) % 1 + 1) % 1;
  const e = 1 - (1 - u) * (1 - u);                                       // ease-out: quick at first, settling outward
  return { u, radius: RING.r0 + (RING.r1 - RING.r0) * e, alpha: RING.alpha * smooth(0, RING.fadeIn, u) * Math.pow(1 - u, 1.5) };
}

/** A stable phase in [0,1) from a field id, so neighbouring fields don't pulse in lockstep. */
export function phaseOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

export const RING_VERT = `
attribute float aPhase;
attribute vec3 aColor;
varying vec2 vUv;
varying float vPhase;
varying vec3 vColor;
void main() {
  vUv = uv * 2.0 - 1.0; vPhase = aPhase; vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
// mirrors pulseAt(): the quad spans ±r1, so radii are divided by r1
export const RING_FRAG = `
uniform float uTime;
varying vec2 vUv;
varying float vPhase;
varying vec3 vColor;
void main() {
  float u = fract(uTime / ${RING.period.toFixed(3)} + vPhase);
  float e = 1.0 - (1.0 - u) * (1.0 - u);
  float rad = (${RING.r0.toFixed(4)} + ${(RING.r1 - RING.r0).toFixed(4)} * e) / ${RING.r1.toFixed(4)};
  float w = ${(RING.width / RING.r1).toFixed(4)};
  float d = abs(length(vUv) - rad);
  float line = 1.0 - smoothstep(w * 0.35, w * 0.5 + 0.012, d);
  float a = ${RING.alpha.toFixed(3)} * smoothstep(0.0, ${RING.fadeIn.toFixed(3)}, u) * pow(1.0 - u, 1.5) * line;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}`;
