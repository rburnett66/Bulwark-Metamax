// ── Planet atmosphere (aerial perspective + drifting cloud shadows) ─────────────────────────────────────
// Injected into EVERY lit or unlit built-in material (Lambert, Phong, Basic): ground, rocks, foliage, units,
// wrecks, structures. The battle camera never sees the sky (pitch 37°, FOV 30° → the top of the view is 22°
// below the horizon), so the atmosphere has to be told by what it does to the world:
//   • distance haze — per-channel extinction toward the planet's haze colour (blue skies lose blue first,
//     dusty skies go orange); starts a little in front of the camera target so the battle stays readable
//   • sun in-scatter — haze brightens toward the sun's side (forward scattering)
//   • cloud shadows — two-octave noise in world XZ, drifting with the wind, darkening everything under it
// Lighting (sun colour, sky/ground hemisphere, ambient) is set per planet by applyStyle.
// Mechanism: Material.prototype.onBeforeCompile becomes an accessor, so any material's own onBeforeCompile
// still runs first and the atmosphere is appended after it. Off (uAtmOn 0) for the non-planet styles.
const ATM = {
  uAtmOn: { value: 0 }, uAtmHaze: { value: new THREE.Color(0x9fb8e0) }, uAtmSunCol: { value: new THREE.Color(0xfff0d0) },
  uAtmSunDir: { value: new THREE.Vector3(0, 1, 0) }, uAtmDens: { value: 0.012 }, uAtmStart: { value: 25 },
  uAtmExt: { value: new THREE.Vector3(1, 1, 1) }, uAtmMie: { value: 0.5 },
  uCloudK: { value: 0 }, uCloudScale: { value: 0.05 }, uCloudWind: { value: new THREE.Vector2(0.03, 0.012) }, uAtmTime: { value: 0 },
};
const ATM_PARS = `
uniform float uAtmOn; uniform vec3 uAtmHaze; uniform vec3 uAtmSunCol; uniform vec3 uAtmSunDir; uniform float uAtmDens; uniform float uAtmStart;
uniform vec3 uAtmExt; uniform float uAtmMie; uniform float uCloudK; uniform float uCloudScale; uniform vec2 uCloudWind; uniform float uAtmTime;
varying vec3 vAtmW;
float atmH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atmNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atmH(i), atmH(i + vec2(1.0, 0.0)), f.x), mix(atmH(i + vec2(0.0, 1.0)), atmH(i + 1.0), f.x), f.y); }`;
const ATM_FRAG = `
if (uAtmOn > 0.5) {
  vec2 cp = vAtmW.xz * uCloudScale + uCloudWind * uAtmTime;
  float cn = atmNoise(cp) * 0.62 + atmNoise(cp * 2.3 + 7.1) * 0.38;
  gl_FragColor.rgb *= 1.0 - uCloudK * smoothstep(0.5, 0.7, cn);
  vec3 Va = vAtmW - cameraPosition; float da = length(Va); vec3 dira = Va / max(da, 1e-3);
  vec3 Ta = exp(-max(da - uAtmStart, 0.0) * uAtmDens * uAtmExt);
  float mua = max(dot(dira, uAtmSunDir), 0.0);
  vec3 insa = uAtmHaze + uAtmSunCol * (uAtmMie * mua * mua);
  gl_FragColor.rgb = gl_FragColor.rgb * Ta + insa * (1.0 - Ta);
}`;
const ATM_VERT = `
vec4 atmW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
atmW = instanceMatrix * atmW;
#endif
vAtmW = (modelMatrix * atmW).xyz;`;
function atmInject(sh, mat) {
  if (mat.isShaderMaterial || !sh.fragmentShader.includes('#include <fog_fragment>') || !sh.vertexShader.includes('#include <fog_vertex>')) return;
  Object.assign(sh.uniforms, ATM);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAtmW;').replace('#include <fog_vertex>', '#include <fog_vertex>' + ATM_VERT);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + ATM_PARS).replace('#include <fog_fragment>', '#include <fog_fragment>' + ATM_FRAG);
}
Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', {
  configurable: true,
  get() { const self = this; return this._atmOBC || (this._atmOBC = function (sh, r) { if (self._userOBC) self._userOBC.call(self, sh, r); atmInject(sh, self); }); },
  set(f) { this._userOBC = f; },
});
// the default cache key was onBeforeCompile.toString(); keep it distinct per user hook
THREE.Material.prototype.customProgramCacheKey = function () { return (this._userOBC ? this._userOBC.toString() : '') + '|atm'; };
