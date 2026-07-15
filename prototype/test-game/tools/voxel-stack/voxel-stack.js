/* =============================================================================
 * voxel-stack.js — sprite-stack tanks on native Pixi v7
 *
 * Demonstrates the "colored voxels below a sprite" volume technique for Bulwark:
 *   1. Build a part (body / turret) as a stack of top-down layer slices.
 *   2. Pre-bake every rotation ANGLE of that stack into one flat RenderTexture
 *      (the shared per-type "angle cache") — done once at load, per unit TYPE.
 *   3. At runtime each part is a single Sprite that just swaps to the nearest
 *      baked angle when it rotates. No per-frame stack redraw, no shaders.
 *
 * Target: Pixi v7 (stays on 7 for React-Native support). Pure Sprite +
 * RenderTexture — the RN-portable subset. No filters, no MSAA render targets.
 * ========================================================================== */
(() => {
  "use strict";

  // Crisp voxel pixels, not blurred.
  PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

  // ---- object target: 64 (rotating parts use a SQUARE footprint) x H layers --
  const FOOT   = 64;   // square footprint so the shape never clips at 45°
  const LAYERS = 16;   // height slices (64x64x16)
  const SP     = 2;    // vertical px between layers when baking (the volume)
  const ANGLES = 64;   // rotation buckets in the cache (5.6° steps)
  const STEP   = (Math.PI * 2) / ANGLES;

  // RenderTexture geometry big enough to hold the rotated + stacked part.
  const DIAG = Math.ceil(FOOT * 1.42);              // rotation bounding box
  const RTW  = DIAG + 8;                            // width  (padded)
  const RTH  = DIAG + (LAYERS - 1) * SP + 8;        // height (adds stack rise)
  const CX   = RTW / 2;                             // footprint centre X
  const BASEY = RTH - DIAG / 2 - 4;                 // bottom-layer centre Y
  const PIV_Y = BASEY / RTH;                        // anchor Y for display sprite
  const MOUNT = Math.round((LAYERS - 1) * SP * 0.55);// turret lift — rests on the hull
  const PLANE_ALT = 30;                              // world-px a plane flies above the ground

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const bucketOf = a => (((Math.round(a / STEP) % ANGLES) + ANGLES) % ANGLES);

  // ---------------------------------------------------------------------------
  // 1. Procedural part art → per-layer slice textures (heightmap extrusion)
  //    drawFn(colorCtx, heightCtx, foot) paints a top-down part, front = +X.
  // ---------------------------------------------------------------------------
  function makeSlices(drawFn) {
    const col = document.createElement("canvas"); col.width = col.height = FOOT;
    const hgt = document.createElement("canvas"); hgt.width = hgt.height = FOOT;
    const cx = col.getContext("2d"), hx = hgt.getContext("2d");
    hx.fillStyle = "#000"; hx.fillRect(0, 0, FOOT, FOOT);
    drawFn(cx, hx, FOOT);

    const cd = cx.getImageData(0, 0, FOOT, FOOT).data;
    const hd = hx.getImageData(0, 0, FOOT, FOOT).data;
    const N = FOOT * FOOT;
    const height = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = cd[i * 4 + 3];
      height[i] = a > 20 ? (hd[i * 4] / 255) * LAYERS : 0;
    }

    const textures = [];
    for (let k = 0; k < LAYERS; k++) {
      const lc = document.createElement("canvas"); lc.width = lc.height = FOOT;
      const img = lc.getContext("2d").createImageData(FOOT, FOOT), o = img.data;
      const t = k / (LAYERS - 1);
      for (let i = 0; i < N; i++) {
        const h = height[i];
        if (h <= k) { o[i * 4 + 3] = 0; continue; }
        const isTop = h <= k + 1;                 // lit top surface of this column
        const shade = isTop ? 1.0 : lerp(0.42, 0.92, t);
        const p = i * 4;
        o[p]     = clamp(cd[p]     * shade, 0, 255);
        o[p + 1] = clamp(cd[p + 1] * shade, 0, 255);
        o[p + 2] = clamp(cd[p + 2] * shade, 0, 255);
        o[p + 3] = 255;
      }
      lc.getContext("2d").putImageData(img, 0, 0);
      textures.push(PIXI.Texture.from(lc));
    }
    return textures; // index 0 = bottom slice
  }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // M1 Abrams hull — tracks, side skirts, deck, sloped glacis, engine deck.
  // Front (+X) is the driving direction. Desert-tan (CARC) palette.
  function drawBody(x, hx, f) {
    const cx = f / 2, cy = f / 2;
    const TAN_HI = "#c9b88d", TAN = "#ad9d73", TAN_LO = "#8d7f5b";

    // tracks (run along X, outboard on ±Y)
    const tw = f * 0.86, th = f * 0.15, ty = f * 0.345;
    for (const sgn of [-1, 1]) {
      const y = cy + sgn * ty - th / 2;
      x.fillStyle = "#28241d"; rr(x, cx - tw / 2, y, tw, th, 2); x.fill();
      x.fillStyle = "#39332a";
      for (let i = -tw / 2 + 3; i < tw / 2 - 3; i += 4) x.fillRect(cx + i, y + 1, 2, th - 2);
      hx.fillStyle = "#464646"; rr(hx, cx - tw / 2, y, tw, th, 2); hx.fill();
    }
    // side skirts over the upper tracks (6 armored panels each side)
    const sw = f * 0.80, sh = f * 0.11, sy = f * 0.30;
    for (const sgn of [-1, 1]) {
      const y = cy + sgn * sy - sh / 2;
      x.fillStyle = "#b6a67f"; rr(x, cx - sw / 2, y, sw, sh, 2); x.fill();
      x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = 1;
      for (let p = 1; p < 6; p++) { const px = cx - sw / 2 + sw * p / 6; x.beginPath(); x.moveTo(px, y); x.lineTo(px, y + sh); x.stroke(); }
      x.strokeStyle = "rgba(255,255,255,.10)"; x.beginPath(); x.moveTo(cx - sw / 2, y + 1); x.lineTo(cx + sw / 2, y + 1); x.stroke();
      hx.fillStyle = "#606060"; rr(hx, cx - sw / 2, y, sw, sh, 2); hx.fill();
    }
    // hull deck
    const hl = f * 0.84, hw = f * 0.46;
    const g = x.createLinearGradient(0, cy - hw / 2, 0, cy + hw / 2);
    g.addColorStop(0, TAN_HI); g.addColorStop(0.5, TAN); g.addColorStop(1, TAN_LO);
    x.fillStyle = g; rr(x, cx - hl / 2, cy - hw / 2, hl, hw, 4); x.fill();
    x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = 1.5; x.stroke();
    hx.fillStyle = "#9c9c9c"; rr(hx, cx - hl / 2, cy - hw / 2, hl, hw, 4); hx.fill();
    // glacis (front sloped plate, +X) — lower + sunlit
    const gl = f * 0.16;
    x.fillStyle = "#cabb90"; rr(x, cx + hl / 2 - gl, cy - hw / 2, gl, hw, 3); x.fill();
    x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx + hl / 2 - gl, cy - hw / 2); x.lineTo(cx + hl / 2 - gl, cy + hw / 2); x.stroke();
    hx.fillStyle = "#727272"; rr(hx, cx + hl / 2 - gl, cy - hw / 2, gl, hw, 3); hx.fill();
    // driver's hatch (front-centre)
    x.fillStyle = "#9c8e69"; x.beginPath(); x.arc(cx + hl * 0.30, cy, f * 0.05, 0, 7); x.fill();
    hx.fillStyle = "#ababab"; hx.beginPath(); hx.arc(cx + hl * 0.30, cy, f * 0.05, 0, 7); hx.fill();
    // engine deck (rear, -X) with exhaust louvers
    const el = f * 0.22;
    x.fillStyle = "#a2946d"; rr(x, cx - hl / 2, cy - hw / 2 + 2, el, hw - 4, 3); x.fill();
    x.strokeStyle = "rgba(0,0,0,.32)"; x.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const ly = cy - hw / 2 + 2 + (hw - 4) * i / 6; x.beginPath(); x.moveTo(cx - hl / 2 + 2, ly); x.lineTo(cx - hl / 2 + el - 2, ly); x.stroke(); }
    hx.fillStyle = "#8a8a8a"; rr(hx, cx - hl / 2, cy - hw / 2 + 2, el, hw - 4, 3); hx.fill();
  }

  // M1 Abrams turret — faceted wedge, 120mm gun (sleeve + bore evacuator),
  // bustle rack, commander/loader hatches, CITV + gunner's sight. Gun to +X.
  function drawTurret(x, hx, f) {
    const cx = f / 2, cy = f / 2;
    const path = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(cx + p[0], cy + p[1]) : g.moveTo(cx + p[0], cy + p[1])); g.closePath(); };

    // bustle rack (rear, -X): low mesh stowage basket
    const bx0 = -f * 0.42, bx1 = -f * 0.22, bhw = f * 0.20;
    x.fillStyle = "#7c7154"; rr(x, cx + bx0, cy - bhw, bx1 - bx0, bhw * 2, 2); x.fill();
    x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1;
    for (let p = bx0 + 3; p < bx1; p += 4) { x.beginPath(); x.moveTo(cx + p, cy - bhw); x.lineTo(cx + p, cy + bhw); x.stroke(); }
    for (let p = -bhw + 3; p < bhw; p += 4) { x.beginPath(); x.moveTo(cx + bx0, cy + p); x.lineTo(cx + bx1, cy + p); x.stroke(); }
    hx.fillStyle = "#565656"; rr(hx, cx + bx0, cy - bhw, bx1 - bx0, bhw * 2, 2); hx.fill();

    // turret body: faceted wedge (widest mid, sloped armour toward the gun)
    const fX = f * 0.24, mX = f * 0.03, rX = -f * 0.24, fHW = f * 0.13, mHW = f * 0.25, rHW = f * 0.21;
    const shell = [[fX, -fHW], [mX, -mHW], [rX, -rHW], [rX, rHW], [mX, mHW], [fX, fHW]];
    path(hx, shell); hx.fillStyle = "#aeaeae"; hx.fill();
    path(x, shell); x.fillStyle = "#b7a87f"; x.fill();
    x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1.5; path(x, shell); x.stroke();
    // sloped front facets (light / dark chamfer read)
    path(x, [[fX, -fHW], [mX, -mHW], [mX, 0], [fX, 0]]); x.fillStyle = "#c6b98f"; x.fill();
    path(x, [[fX, fHW], [mX, mHW], [mX, 0], [fX, 0]]);   x.fillStyle = "#a1926c"; x.fill();
    path(x, [[rX, -rHW], [mX, -mHW], [mX, mHW], [rX, rHW]]); x.fillStyle = "rgba(0,0,0,.06)"; x.fill();

    // mantlet (raised gun mount)
    x.fillStyle = "#9f9070"; rr(x, cx + fX - f * 0.02, cy - f * 0.09, f * 0.06, f * 0.18, 2); x.fill();
    hx.fillStyle = "#a6a6a6"; rr(hx, cx + fX - f * 0.02, cy - f * 0.09, f * 0.06, f * 0.18, 2); hx.fill();

    // 120mm gun (+X): long barrel, thermal sleeve, bore evacuator, muzzle.
    // Raised to exit mid-turret so it protrudes as a proper gun, not a deck ridge.
    const b0 = fX - f * 0.01, b1 = f * 0.62, bw = f * 0.05;
    hx.fillStyle = "#6a6a6a"; rr(hx, cx + b0, cy - bw * 0.9, b1 - b0, bw * 1.8, 1); hx.fill(); // mid-height gun
    x.fillStyle = "#4f4a3d"; rr(x, cx + b0, cy - bw / 2, b1 - b0, bw, bw * 0.4); x.fill();
    x.fillStyle = "#5c5647"; rr(x, cx + b0, cy - bw * 0.8, (b1 - b0) * 0.46, bw * 1.6, bw * 0.5); x.fill(); // thermal sleeve
    x.fillStyle = "#6a6454"; x.beginPath(); x.ellipse(cx + b0 + (b1 - b0) * 0.6, cy, bw * 1.0, bw * 1.05, 0, 0, 7); x.fill(); // bore evacuator
    x.fillStyle = "#7a7360"; rr(x, cx + b1 - bw * 1.4, cy - bw * 0.6, bw * 1.0, bw * 1.2, 1); x.fill(); // muzzle collar
    x.fillStyle = "#2b2822"; rr(x, cx + b1 - bw * 0.5, cy - bw * 0.45, bw * 0.7, bw * 0.9, 1); x.fill(); // muzzle bore

    // hatches (commander +Y, loader -Y)
    for (const [hxo, hyo, rad] of [[-f * 0.05, f * 0.11, f * 0.06], [-f * 0.08, -f * 0.11, f * 0.055]]) {
      x.fillStyle = "#b3a47e"; x.beginPath(); x.arc(cx + hxo, cy + hyo, rad, 0, 7); x.fill();
      x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = 1; x.stroke();
      x.fillStyle = "#8f8163"; x.beginPath(); x.arc(cx + hxo, cy + hyo, rad * 0.5, 0, 7); x.fill();
      hx.fillStyle = "#d2d2d2"; hx.beginPath(); hx.arc(cx + hxo, cy + hyo, rad, 0, 7); hx.fill();
    }
    // CITV (commander's sight box) + gunner's primary sight
    x.fillStyle = "#8d7f60"; rr(x, cx + f * 0.04, cy + f * 0.05, f * 0.07, f * 0.06, 1); x.fill();
    hx.fillStyle = "#c4c4c4"; rr(hx, cx + f * 0.04, cy + f * 0.05, f * 0.07, f * 0.06, 1); hx.fill();
    x.fillStyle = "#6f6650"; rr(x, cx + f * 0.10, cy - f * 0.03, f * 0.05, f * 0.05, 1); x.fill();
    hx.fillStyle = "#bcbcbc"; rr(hx, cx + f * 0.10, cy - f * 0.03, f * 0.05, f * 0.05, 1); hx.fill();
  }

  // F-16 (top-down, nose = +X). Two-tone air-superiority gray. Flat swept wings,
  // raised fuselage spine, bubble canopy, and a tall vertical tail fin (height peak).
  function drawPlane(x, hx, f) {
    const cx = f / 2, cy = f / 2;
    const path = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(cx + p[0] * f, cy + p[1] * f) : g.moveTo(cx + p[0] * f, cy + p[1] * f)); g.closePath(); };
    const GRY = "#aeb4be", GRY_D = "#8f95a1", GRY_L = "#c4c9d2";

    // main wings — cropped delta, swept (mid-mount). Low + flat.
    const wing = s => [[0.12, 0.055 * s], [-0.14, 0.30 * s], [-0.24, 0.30 * s], [-0.26, 0.055 * s]];
    for (const s of [1, -1]) {
      path(x, wing(s)); x.fillStyle = GRY_D; x.fill();
      path(hx, wing(s)); hx.fillStyle = "#2f2f2f"; hx.fill();
    }
    // wingtip missile rails (AIM-9)
    for (const s of [1, -1]) {
      x.fillStyle = "#d7dbe2"; rr(x, cx - f * 0.20, cy + s * 0.30 * f - f * 0.012, f * 0.20, f * 0.024, 1); x.fill();
      hx.fillStyle = "#262626"; rr(hx, cx - f * 0.20, cy + s * 0.30 * f - f * 0.012, f * 0.20, f * 0.024, 1); hx.fill();
    }
    // horizontal stabilizers (tailplane) — swept delta at the tail
    const stab = s => [[-0.30, 0.05 * s], [-0.44, 0.20 * s], [-0.485, 0.20 * s], [-0.465, 0.05 * s]];
    for (const s of [1, -1]) {
      path(x, stab(s)); x.fillStyle = GRY_D; x.fill();
      path(hx, stab(s)); hx.fillStyle = "#2a2a2a"; hx.fill();
    }
    // fuselage — slender spindle, pointed nose (+X)
    const fus = [[0.46, 0], [0.30, -0.05], [0.02, -0.075], [-0.22, -0.07], [-0.40, -0.05], [-0.44, 0], [-0.40, 0.05], [-0.22, 0.07], [0.02, 0.075], [0.30, 0.05]];
    const fg = x.createLinearGradient(0, cy - f * 0.08, 0, cy + f * 0.08);
    fg.addColorStop(0, GRY_L); fg.addColorStop(0.5, GRY); fg.addColorStop(1, GRY_D);
    path(x, fus); x.fillStyle = fg; x.fill();
    x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = 1; path(x, fus); x.stroke();
    path(hx, fus); hx.fillStyle = "#606060"; hx.fill();
    // nose radome cap
    x.fillStyle = "#9299a4"; path(x, [[0.46, 0], [0.34, -0.03], [0.34, 0.03]]); x.fill();
    // canopy bubble (forward spine) — glass + reflection
    x.fillStyle = "#3d4759"; x.beginPath(); x.ellipse(cx + 0.22 * f, cy, 0.10 * f, 0.052 * f, 0, 0, 7); x.fill();
    x.fillStyle = "#6b7690"; x.beginPath(); x.ellipse(cx + 0.245 * f, cy - 0.012 * f, 0.055 * f, 0.028 * f, 0, 0, 7); x.fill();
    hx.fillStyle = "#828282"; hx.beginPath(); hx.ellipse(cx + 0.22 * f, cy, 0.10 * f, 0.052 * f, 0, 0, 7); hx.fill();
    // vertical tail fin — thin blade along centreline, the height peak
    const fin = [[-0.13, 0.022], [-0.13, -0.022], [-0.45, 0]];
    path(x, fin); x.fillStyle = GRY_L; x.fill();
    x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = 1; path(x, fin); x.stroke();
    path(hx, fin); hx.fillStyle = "#cccccc"; hx.fill();
    // engine exhaust nozzle (tail)
    x.fillStyle = "#3a372f"; x.beginPath(); x.arc(cx - 0.44 * f, cy, 0.05 * f, 0, 7); x.fill();
    x.fillStyle = "#585349"; x.beginPath(); x.arc(cx - 0.44 * f, cy, 0.03 * f, 0, 7); x.fill();
    hx.fillStyle = "#565656"; hx.beginPath(); hx.arc(cx - 0.44 * f, cy, 0.05 * f, 0, 7); hx.fill();
    // fuselage panel lines
    x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx + 0.05 * f, cy - 0.06 * f); x.lineTo(cx + 0.05 * f, cy + 0.06 * f); x.stroke();
    x.beginPath(); x.moveTo(cx - 0.10 * f, cy - 0.06 * f); x.lineTo(cx - 0.10 * f, cy + 0.06 * f); x.stroke();
  }

  // ---------------------------------------------------------------------------
  // 2. Angle-cache baker — stack the slices, rotate, flatten to one texture.
  //    Called once per unit type; returns ANGLES RenderTextures.
  // ---------------------------------------------------------------------------
  // CAS-lite unsharp mask: smooth (4-tap blur) then add back the high-frequency
  // difference — "smooth and sharpen" in one GLES2-safe pass. Runs only at bake.
  const SHARPEN_FRAG = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2 uTexel;
    uniform float uSharp;
    void main() {
      vec4 c = texture2D(uSampler, vTextureCoord);          // premultiplied
      vec3 n = texture2D(uSampler, vTextureCoord + vec2(0.0, -uTexel.y)).rgb;
      vec3 s = texture2D(uSampler, vTextureCoord + vec2(0.0,  uTexel.y)).rgb;
      vec3 e = texture2D(uSampler, vTextureCoord + vec2( uTexel.x, 0.0)).rgb;
      vec3 w = texture2D(uSampler, vTextureCoord + vec2(-uTexel.x, 0.0)).rgb;
      vec3 blur = (n + s + e + w) * 0.25;
      vec3 sharp = c.rgb + uSharp * (c.rgb - blur);          // unsharp mask
      gl_FragColor = vec4(clamp(sharp, 0.0, 1.0), c.a);      // keep premultiplied
    }`;
  const makeSharpen = amt =>
    new PIXI.Filter(undefined, SHARPEN_FRAG, { uSharp: amt, uTexel: [1 / RTW, 1 / RTH] });

  // Bake a part's angle cache. opts.smooth → 2x supersample (anti-aliases the
  // staircase) + optional unsharp (opts.sharp). All cost is paid here, once.
  function bakeAngleCache(renderer, sliceTextures, opts) {
    opts = opts || {};
    const SS = opts.smooth ? 2 : 1;
    const container = new PIXI.Container();
    const layerSprites = [];
    for (let k = 0; k < LAYERS; k++) {
      const s = new PIXI.Sprite(sliceTextures[k]);
      s.anchor.set(0.5);
      s.scale.set(SS);
      container.addChild(s);
      layerSprites.push(s);
    }
    // supersample scratch buffer + downscale sprite (reused across angles)
    let bigRT = null, ds = null;
    if (opts.smooth) {
      bigRT = PIXI.RenderTexture.create({ width: RTW * SS, height: RTH * SS });
      bigRT.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      ds = new PIXI.Sprite(bigRT);
      ds.scale.set(1 / SS);
      if (opts.sharp > 0) ds.filters = [makeSharpen(opts.sharp)];
    }
    const cache = [];
    for (let a = 0; a < ANGLES; a++) {
      const ang = a * STEP;
      for (let k = 0; k < LAYERS; k++) {
        layerSprites[k].position.set(CX * SS, (BASEY - k * SP) * SS); // offset = volume
        layerSprites[k].rotation = ang;                                // yaw the footprint
      }
      const rt = PIXI.RenderTexture.create({ width: RTW, height: RTH });
      rt.baseTexture.scaleMode = opts.smooth ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;
      if (opts.smooth) {
        renderer.render(container, { renderTexture: bigRT });  // crisp @ 2x
        renderer.render(ds, { renderTexture: rt });            // downsample + unsharp
      } else {
        renderer.render(container, { renderTexture: rt });
      }
      cache.push(rt);
    }
    container.destroy({ children: true });
    if (bigRT) { ds.destroy(); bigRT.destroy(true); }
    return cache;
  }

  // ---------------------------------------------------------------------------
  // 3. A tank instance — two Sprites (body + turret) sharing the type's cache.
  // ---------------------------------------------------------------------------
  class Tank {
    constructor(world, type, x, y, tint) {
      this.type = type; this.x = x; this.y = y;
      this.heading = 0; this.turretAng = 0; this.bCur = -1; this.tCur = -1;

      this.node = new PIXI.Container();

      this.shadow = new PIXI.Graphics();
      this.shadow.beginFill(0x000000, 0.32)
        .drawEllipse(0, 4, FOOT * 0.52, FOOT * 0.22).endFill();

      this.body   = new PIXI.Sprite(type.body[0]);
      this.turret = new PIXI.Sprite(type.turret[0]);
      for (const s of [this.body, this.turret]) { s.anchor.set(0.5, PIV_Y); s.tint = tint; }
      this.turret.y = -MOUNT;

      this.node.addChild(this.shadow, this.body, this.turret);
      world.addChild(this.node);
    }
    setHeading(a)   { const b = bucketOf(a); if (b !== this.bCur) { this.body.texture   = this.type.body[b];   this.bCur = b; } }
    setTurret(a)    { const b = bucketOf(a); if (b !== this.tCur) { this.turret.texture = this.type.turret[b]; this.tCur = b; } }
    sync() { this.node.position.set(this.x, this.y); this.node.zIndex = this.y; }
  }

  // A plane instance — one Sprite lifted to altitude, with a detached ground
  // shadow. Same yaw angle-cache as the tank; no turret. Renders above ground units.
  class Plane {
    constructor(world, shadowLayer, type, x, y, tint) {
      this.type = type; this.x = x; this.y = y; this.heading = 0; this.hCur = -1;
      this.node = new PIXI.Container();
      this.sprite = new PIXI.Sprite(type.body[0]);
      this.sprite.anchor.set(0.5, PIV_Y);
      this.sprite.tint = tint;
      this.sprite.y = -PLANE_ALT;                       // fly above the ground point
      this.node.addChild(this.sprite);
      world.addChild(this.node);
      this.shadow = new PIXI.Graphics();
      this.shadow.beginFill(0x000000, 0.20).drawEllipse(0, 0, FOOT * 0.34, FOOT * 0.13).endFill();
      shadowLayer.addChild(this.shadow);
    }
    setHeading(a) { const b = bucketOf(a); if (b !== this.hCur) { this.sprite.texture = this.type.body[b]; this.hCur = b; } }
    sync() {
      this.node.position.set(this.x, this.y);
      this.node.zIndex = this.y + 6000;                 // planes always over ground units
      this.shadow.position.set(this.x, this.y);
    }
  }

  // ---------------------------------------------------------------------------
  // Scene  (runs after the DOM is ready so document.body exists)
  // ---------------------------------------------------------------------------
  function boot() {
  const VIEW_W = 960, VIEW_H = 600, WORLD_SCALE = 1.6;
  const WORLD_W = VIEW_W / WORLD_SCALE, WORLD_H = VIEW_H / WORLD_SCALE;

  const app = new PIXI.Application({
    width: VIEW_W, height: VIEW_H, backgroundColor: 0x0e1a24,
    antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  document.body.appendChild(app.view);

  // ground
  const world = new PIXI.Container();
  world.scale.set(WORLD_SCALE);
  world.sortableChildren = true;
  app.stage.addChild(world);

  const grid = new PIXI.Graphics();
  grid.zIndex = -1000;
  grid.lineStyle(1, 0x1d3040, 1);
  for (let gx = 0; gx <= WORLD_W; gx += 32) grid.moveTo(gx, 0).lineTo(gx, WORLD_H);
  for (let gy = 0; gy <= WORLD_H; gy += 32) grid.moveTo(0, gy).lineTo(WORLD_W, gy);
  world.addChild(grid);

  // Bake the tank type TWICE — flat, and smoothed+sharpened — so we can A/B them
  // live. Slices are generated once and shared by both bakes.
  const t0 = performance.now();
  const bodySlices = makeSlices(drawBody);
  const turretSlices = makeSlices(drawTurret);
  const SHARP = 0.6;
  const tankTypes = {
    flat: {
      body:   bakeAngleCache(app.renderer, bodySlices,   { smooth: false }),
      turret: bakeAngleCache(app.renderer, turretSlices, { smooth: false }),
    },
    smooth: {
      body:   bakeAngleCache(app.renderer, bodySlices,   { smooth: true, sharp: SHARP }),
      turret: bakeAngleCache(app.renderer, turretSlices, { smooth: true, sharp: SHARP }),
    },
  };
  const planeSlices = makeSlices(drawPlane);
  const planeTypes = {
    flat:   { body: bakeAngleCache(app.renderer, planeSlices, { smooth: false }) },
    smooth: { body: bakeAngleCache(app.renderer, planeSlices, { smooth: true, sharp: SHARP }) },
  };
  const bakeMs = (performance.now() - t0).toFixed(0);
  let smoothOn = true;
  let current = tankTypes.smooth;
  let currentPlane = planeTypes.smooth;

  // hero + a few AI tanks (all reference the same cache; tint per instance)
  const hero = new Tank(world, current, WORLD_W * 0.5, WORLD_H * 0.6, 0xffffff);
  const ai = [
    new Tank(world, current, WORLD_W * 0.25, WORLD_H * 0.30, 0xff9a8a),
    new Tank(world, current, WORLD_W * 0.75, WORLD_H * 0.32, 0xff9a8a),
    new Tank(world, current, WORLD_W * 0.32, WORLD_H * 0.72, 0x8ab6ff),
  ];
  ai.forEach((t, i) => { t.wob = Math.sin(i * 2.1); t.dir = i * 1.7; });
  const allTanks = [hero, ...ai];

  // F-16s — single-part flying units. Shadows go on a ground layer beneath the units.
  const shadowLayer = new PIXI.Container();
  shadowLayer.zIndex = -50;
  world.addChild(shadowLayer);
  const planes = [
    new Plane(world, shadowLayer, currentPlane, WORLD_W * 0.20, WORLD_H * 0.50, 0xe2e8f2),
    new Plane(world, shadowLayer, currentPlane, WORLD_W * 0.82, WORLD_H * 0.62, 0xccd5e2),
  ];
  planes.forEach((p, i) => { p.ang = i ? Math.PI * 0.9 : 0.1; p.turn = i ? -0.16 : 0.15; });

  function setSmooth(on) {
    smoothOn = on;
    current = on ? tankTypes.smooth : tankTypes.flat;
    currentPlane = on ? planeTypes.smooth : planeTypes.flat;
    for (const t of allTanks) { t.type = current; t.bCur = -1; t.tCur = -1; }   // force re-swap
    for (const p of planes)   { p.type = currentPlane; p.hCur = -1; }
  }

  // ---- input ----
  const keys = {};
  addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === " ") { setSmooth(!smoothOn); e.preventDefault(); } // A/B the shader
  });
  addEventListener("keyup",   e => { keys[e.key.toLowerCase()] = false; });
  const mouse = { x: WORLD_W * 0.6, y: WORLD_H * 0.2 };
  app.view.addEventListener("pointermove", e => {
    const r = app.view.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width * VIEW_W) / WORLD_SCALE;
    mouse.y = ((e.clientY - r.top) / r.height * VIEW_H) / WORLD_SCALE;
  });

  // ---- HUD ----
  const hud = new PIXI.Container();
  app.stage.addChild(hud);
  const mkText = (y, size, color) => {
    const t = new PIXI.Text("", { fontFamily: "ui-monospace, Menlo, monospace", fontSize: size, fill: color });
    t.position.set(12, y); hud.addChild(t); return t;
  };
  const title = mkText(10, 15, 0x5fe6d6);
  const line1 = mkText(34, 13, 0xc9d2e0);
  const line2 = mkText(54, 13, 0x8b93a6);
  const help  = mkText(VIEW_H - 26, 13, 0x8b93a6);
  title.text = "Bulwark · voxel sprite-stack — M1 Abrams + F-16 — Pixi 7";
  help.text  = "WASD / arrows: drive    ·    mouse: aim turret    ·    SPACE: smooth+sharpen A/B";

  let smoothFps = 60;

  // ---- update ----
  app.ticker.add(() => {
    const dt = Math.min(app.ticker.deltaMS / 1000, 1 / 20);

    // hero drive
    let vx = 0, vy = 0;
    if (keys["a"] || keys["arrowleft"])  vx -= 1;
    if (keys["d"] || keys["arrowright"]) vx += 1;
    if (keys["w"] || keys["arrowup"])    vy -= 1;
    if (keys["s"] || keys["arrowdown"])  vy += 1;
    const moving = vx || vy;
    if (moving) {
      const m = Math.hypot(vx, vy), speed = 90;
      hero.x = clamp(hero.x + (vx / m) * speed * dt, 20, WORLD_W - 20);
      hero.y = clamp(hero.y + (vy / m) * speed * dt, 20, WORLD_H - 20);
      hero.heading = Math.atan2(vy, vx);
    }
    hero.setHeading(hero.heading);
    hero.turretAng = Math.atan2(mouse.y - hero.y, mouse.x - hero.x);
    hero.setTurret(hero.turretAng);
    hero.sync();

    // ai: wander, turrets track hero
    for (const t of ai) {
      t.dir += (Math.sin(performance.now() / 1000 + t.wob) * 0.6) * dt;
      t.x = clamp(t.x + Math.cos(t.dir) * 40 * dt, 20, WORLD_W - 20);
      t.y = clamp(t.y + Math.sin(t.dir) * 40 * dt, 20, WORLD_H - 20);
      t.heading = t.dir;
      t.setHeading(t.heading);
      t.setTurret(Math.atan2(hero.y - t.y, hero.x - t.x));
      t.sync();
    }

    // planes: fly, bank gently, wrap at the edges. Altitude + detached shadow.
    for (const p of planes) {
      p.ang += p.turn * dt;
      const spd = 150;
      p.x += Math.cos(p.ang) * spd * dt;
      p.y += Math.sin(p.ang) * spd * dt;
      const M = 40;
      if (p.x < -M) p.x = WORLD_W + M; else if (p.x > WORLD_W + M) p.x = -M;
      if (p.y < -M) p.y = WORLD_H + M; else if (p.y > WORLD_H + M) p.y = -M;
      p.heading = p.ang;
      p.setHeading(p.heading);
      p.sync();
    }

    smoothFps = smoothFps * 0.92 + app.ticker.FPS * 0.08;
    const total = ANGLES * 6; // (tank body+turret + plane body) × flat+smooth
    line1.text = `${smoothFps.toFixed(0)} fps   ·   4 tanks + 2 F-16s   ·   smooth+sharpen: ${smoothOn ? "ON" : "OFF"}`;
    line2.text = `angle cache: ${ANGLES}×6 baked in ${bakeMs} ms (${total} textures)   ·   runtime pass: none   ·   re-bakes/frame: 0`;
  });

  window.__voxel = { app, tankTypes, planeTypes, hero, planes, setSmooth, isSmooth: () => smoothOn }; // debug handle
  }

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot);
  else boot();
})();
