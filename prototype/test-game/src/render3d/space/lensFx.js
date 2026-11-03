// lensFx.js — camera-lens post effects for the capital-ship presentation (three r128).
//
//   import { ShaderPass } from '…/vendor/three-addons/postprocessing/ShaderPass.js';
//   import { Lensflare, LensflareElement } from '…/vendor/three-addons/objects/Lensflare.js';
//
//   // HDR chain — the renderer does NOT tone-map; it happens once, at the end:
//   renderer.toneMapping = THREE.NoToneMapping;
//   const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });     // keep values > 1
//   const composer = new EffectComposer(renderer, rt);
//   composer.addPass(new RenderPass(scene, camera));
//   composer.addPass(bloom);                                   // UnrealBloomPass, threshold ≈ 1
//   composer.addPass(tonemapPass(THREE, ShaderPass, { exposure: 0.9 }));   // HDR → display sRGB
//   composer.addPass(chromaticAberrationPass(THREE, ShaderPass, { amount: 0.0025, vignette: 0.35, grain: 0.035 }));
//
//   const flare = createLensFlare(THREE, Lensflare, LensflareElement, { color: bd.sunColor, seed: 7 });
//   bd.sunAnchor.add(flare);                                   // backdrop.js: the flare sits on the sun
//
// The CA/vignette/grain pass works in display space, so it goes AFTER the tone-map pass (grain and vignette are
// defined on what the eye sees). It is also correct (just a touch stronger) on a plain LDR chain.

// ── chromatic aberration + vignette + grain (one pass, 3 texture fetches) ─────────────────────────────
const CA_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, amount: { value: 0.0025 }, vignette: { value: 0.3 }, grain: { value: 0.03 },
    time: { value: 0 }, aspect: { value: 1 },
  },
  vertexShader: `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float amount; uniform float vignette; uniform float grain; uniform float time; uniform float aspect;
varying vec2 vUv;
void main() {
  vec2 d = vUv - 0.5;
  vec2 off = d * dot(d, d) * 4.0 * amount;               // radial, ~0 at centre, ≈ 1.4 × amount at the corners
  vec4 g = texture2D(tDiffuse, vUv);
  float r = texture2D(tDiffuse, vUv - off).r;
  float b = texture2D(tDiffuse, vUv + off).b;
  vec3 col = vec3(r, g.g, b);
  vec2 dc = d * vec2(aspect, 1.0) / sqrt(aspect * aspect * 0.25 + 0.25);   // 1.0 at the corners whatever the aspect
  float v = smoothstep(0.35, 1.05, length(dc));
  col *= 1.0 - vignette * v * v;
  // grain: animated hash, strongest in the mid-tones (film grain disappears in black and in highlights)
  vec2 p = gl_FragCoord.xy + fract(time * vec2(0.6180339, 0.4142135)) * 1024.0;
  vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33);
  float n = fract((p3.x + p3.y) * p3.z) - 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += n * grain * (0.25 + 4.0 * l * (1.0 - l));
  gl_FragColor = vec4(col, g.a);
}`,
};

/**
 * Radial chromatic aberration with optional vignette and film grain — one ShaderPass.
 * Uniforms on the returned pass: `pass.uniforms.amount / vignette / grain / time` (advance `time` each frame,
 * or call `pass.tick(dt)`). Aspect is kept current by the composer's setSize.
 */
export function chromaticAberrationPass(THREE, ShaderPass, { amount = 0.0025, vignette = 0.3, grain = 0.03 } = {}) {
  const pass = new ShaderPass(CA_SHADER);
  pass.uniforms.amount.value = amount;
  pass.uniforms.vignette.value = vignette;
  pass.uniforms.grain.value = grain;
  pass.setSize = (w, h) => { pass.uniforms.aspect.value = h > 0 ? w / h : 1; };
  pass.tick = (dt) => { pass.uniforms.time.value = (pass.uniforms.time.value + (dt || 0)) % 1000; };
  return pass;
}

// ── ACES filmic + sRGB (exactly three r128's ACESFilmicToneMapping and LinearTosRGB) ──────────────────
const TONEMAP_SHADER = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, dither: { value: 1 } },
  vertexShader: CA_SHADER.vertexShader,
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float exposure; uniform float dither;
varying vec2 vUv;
#ifndef saturate
#define saturate(a) clamp( a, 0.0, 1.0 )
#endif
// copied from three r128 tonemapping_pars_fragment
vec3 RRTAndODTFit( vec3 v ) {
  vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
  vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
  return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
  const mat3 ACESInputMat = mat3(
    vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ),
    vec3( 0.04823, 0.01566, 0.83777 )
  );
  const mat3 ACESOutputMat = mat3(
    vec3(  1.60475, -0.10208, -0.00327 ), vec3( -0.53108,  1.10813, -0.07276 ),
    vec3( -0.07367, -0.00605,  1.07602 )
  );
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit( color );
  color = ACESOutputMat * color;
  return saturate( color );
}
// copied from three r128 encodings_pars_fragment
vec4 LinearTosRGB( in vec4 value ) {
  return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  vec4 c = LinearTosRGB(vec4(ACESFilmicToneMapping(max(tex.rgb, 0.0)), 1.0));
  // ±0.5 LSB triangular-ish dither after encoding: kills 8-bit banding in the nebula gradients (0 = exact match)
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  c.rgb += (ign - 0.5) * dither / 255.0;
  gl_FragColor = vec4(c.rgb, 1.0);
}`,
};

/**
 * Final tone map: ACES Filmic (three r128's, numerically identical with `dither: 0`) then linear → sRGB.
 * Use with `renderer.toneMapping = THREE.NoToneMapping` and a HalfFloat composer target, so tone mapping
 * happens exactly once. `pass.uniforms.exposure.value` = the old `renderer.toneMappingExposure`.
 */
export function tonemapPass(THREE, ShaderPass, { exposure = 1, dither = 1 } = {}) {
  const pass = new ShaderPass(TONEMAP_SHADER);
  pass.uniforms.exposure.value = exposure;
  pass.uniforms.dither.value = dither;
  return pass;
}

// ── lens flare ────────────────────────────────────────────────────────────────────────────────────────
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function canvasTex(THREE, size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

// white RGB, the shape in alpha (the Lensflare shader multiplies alpha by visibility, then adds src·alpha)
function radial(g, s, stops) {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}

function makeFlareTextures(THREE) {
  const glow = canvasTex(THREE, 128, (g, s) => radial(g, s, [[0, 1], [0.08, 0.55], [0.25, 0.14], [0.55, 0.03], [1, 0]]));
  const ring = canvasTex(THREE, 256, (g, s) => radial(g, s, [[0, 0], [0.72, 0], [0.84, 0.09], [0.9, 0.22], [0.94, 0.08], [1, 0]]));
  const hex = canvasTex(THREE, 128, (g, s) => {
    // a soft hexagonal aperture ghost: faint fill, brighter rim, blurred edge
    g.filter = 'blur(2px)';
    const hexPath = (r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3;
      g[i ? 'lineTo' : 'moveTo'](s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } g.closePath(); };
    hexPath(s * 0.42); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
    g.lineWidth = s * 0.035; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
  });
  const streak = canvasTex(THREE, 256, (g, s) => {
    // anamorphic streak: a thin horizontal line, brightest at the centre
    const gr = g.createLinearGradient(0, 0, s, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    for (let i = 0; i < 6; i++) { g.globalAlpha = 0.5 / (i + 1); const h = 1 + i * 1.6; g.fillRect(0, s / 2 - h / 2, s, h); }
  });
  return { glow, ring, hex, streak };
}

/**
 * A subtle procedural lens flare (no image files): central glow, anamorphic streak, hexagonal ghosts and halo
 * rings along the flare axis. Returns the r128 Lensflare (add it at the sun, e.g. `backdrop.sunAnchor.add(flare)`).
 * Options: color (Color | hex, the sun's), seed, intensity (1), pixelRatio (element sizes are device pixels in the
 * Lensflare addon — pass renderer.getPixelRatio()), streak (true).
 * Also attached: `flare.disposeAll()` (textures too) and `flare.hdrOcclusion` ('native' | 'patched' | 'off').
 *
 * HalfFloat render targets: the addon's occlusion test copies framebuffer pixels into an RGB8 texture, which
 * WebGL2 rejects for a float framebuffer. When it is drawn into a float target this wrapper does the copy into a
 * matching float texture instead; if the driver refuses that too, occlusion is disabled (flare always visible
 * when on screen) and `flare.hdrOcclusion === 'off'`.
 */
export function createLensFlare(THREE, Lensflare, LensflareElement, {
  color = 0xffe8c8, seed = 1, intensity = 1, pixelRatio = 1, streak = true,
} = {}) {
  const rnd = mulberry32((seed * 2246822519) >>> 0 || 1);
  const tex = makeFlareTextures(THREE);
  const base = new THREE.Color(color);
  const tint = (r, g, b, k) => new THREE.Color(base.r * r, base.g * g, base.b * b).multiplyScalar(k * intensity);
  const pr = pixelRatio;
  const flare = new Lensflare();
  flare.name = 'lensFlare';
  flare.addElement(new LensflareElement(tex.glow, 220 * pr, 0, tint(1, 1, 1, 0.45)));
  if (streak) flare.addElement(new LensflareElement(tex.streak, 900 * pr, 0, tint(0.75, 0.85, 1.2, 0.22)));
  // ghosts: distance along the sun→centre axis (0 = sun, 1 = screen centre, 2 = mirrored)
  const ghosts = [
    [tex.hex, 0.42, 46, [0.6, 0.8, 1.2], 0.06],
    [tex.hex, 0.62, 80, [0.7, 1.1, 0.8], 0.045],
    [tex.ring, 0.78, 190, [1.0, 0.85, 1.1], 0.05],
    [tex.hex, 1.05, 30, [1.2, 0.8, 0.6], 0.07],
    [tex.hex, 1.28, 120, [0.6, 0.9, 1.3], 0.03],
    [tex.ring, 1.55, 340, [0.7, 0.9, 1.2], 0.035],
  ];
  for (const [t, d, s, c, k] of ghosts) {
    const j = 0.92 + rnd() * 0.16;
    flare.addElement(new LensflareElement(t, s * j * pr, d * (0.96 + rnd() * 0.08), tint(c[0], c[1], c[2], k)));
  }

  // float-target occlusion: route the addon's framebuffer copies into a float texture of the right format
  flare.hdrOcclusion = 'native';
  const orig = flare.onBeforeRender;
  let proxy = null, proxyFor = null;
  const converted = new WeakSet();
  flare.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    const rt = renderer.getRenderTarget();
    const isFloat = rt && rt.texture && (rt.texture.type === THREE.HalfFloatType || rt.texture.type === THREE.FloatType);
    if (!isFloat || !renderer.capabilities.isWebGL2) return orig.call(this, renderer, scene, camera, geometry, material, group);
    if (proxyFor !== renderer) { proxy = makeProxy(renderer); proxyFor = renderer; }
    return orig.call(this, proxy, scene, camera, geometry, material, group);
  };
  function makeProxy(renderer) {
    const gl = renderer.getContext();
    return new Proxy(renderer, {
      get(target, key) {
        if (key === 'copyFramebufferToTexture') return (pos, texture) => {
          if (flare.hdrOcclusion === 'off') return fallbackCopy(texture);
          if (!converted.has(texture)) {               // give the addon's 16×16 textures float RGBA storage
            texture.format = THREE.RGBAFormat; texture.type = THREE.HalfFloatType;
            texture.image = { data: new Uint16Array(texture.image.width * texture.image.height * 4), width: texture.image.width, height: texture.image.height };
            texture.needsUpdate = true; converted.add(texture);
          }
          target.initTexture(texture);
          const h = target.properties.get(texture).__webglTexture;
          target.state.bindTexture(gl.TEXTURE_2D, h);
          gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, pos.x, pos.y, texture.image.width, texture.image.height);
          target.state.unbindTexture();
          if (flare.hdrOcclusion === 'native') {        // check once; a stall on the first frame only
            flare.hdrOcclusion = gl.getError() === gl.NO_ERROR ? 'patched' : 'off';
            if (flare.hdrOcclusion === 'off') console.warn('lensFx: float framebuffer copy refused; lens flare occlusion disabled');
          }
        };
        if (key === 'renderBufferDirect' && flare.hdrOcclusion === 'off') return (cam, sc, geo, mat, obj, grp) => {
          // skip the pink occlusion quad and the restore quad (they would paint a 16 px square over the sun)
          if (!(mat.uniforms && mat.uniforms.occlusionMap)) return;
          target.renderBufferDirect(cam, sc, geo, mat, obj, grp);
        };
        const v = target[key];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
  }
  // occlusion off: make the occlusion map read "fully visible" (pink 1,0,1)
  function fallbackCopy(texture) {
    if (texture.userData.__pink) return;
    const w = texture.image.width, h = texture.image.height;
    const data = new Uint16Array(w * h * 4);
    const one = 0x3C00;                                   // 1.0 as half float
    for (let i = 0; i < w * h; i++) { data[i * 4] = one; data[i * 4 + 2] = one; data[i * 4 + 3] = one; }
    texture.image = { data, width: w, height: h };
    texture.format = THREE.RGBAFormat; texture.type = THREE.HalfFloatType; texture.needsUpdate = true;
    texture.userData.__pink = true;
  }

  flare.disposeAll = () => { flare.dispose(); for (const t of Object.values(tex)) t.dispose(); };
  return flare;
}
