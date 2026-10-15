/**
 * src/render3d/fx/glowTexture.js — the ONE glow texture every 3D combat effect samples (plan v2.2 §6.4)
 * [MM-task_mv9s9mza_2].
 *
 * White RGBA, alpha = a soft radial falloff — the same profile as the Pixi glow (renderer.js glowTexture:
 * 0.95 at the centre, 0.4 at 40 % of the radius, 0 at the rim). Tinted per instance in the shader. Built as
 * plain bytes so it needs no canvas and node can test it.
 */
export const GLOW_SIZE = 64;

/** Alpha (0..1) at normalised radius r (0 = centre, 1 = rim). */
export function glowAlpha(r) {
  if (r >= 1) return 0;
  if (r <= 0.4) return 0.95 + (0.4 - 0.95) * (r / 0.4);
  return 0.4 * (1 - (r - 0.4) / 0.6);
}

/** n×n RGBA bytes. Texel centres are sampled, so the border texels are (near) zero and a clamped lookup fades out. */
export function glowPixels(n = GLOW_SIZE) {
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1;
      const i = (y * n + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = Math.round(255 * glowAlpha(Math.hypot(dx, dy)));
    }
  }
  return px;
}
