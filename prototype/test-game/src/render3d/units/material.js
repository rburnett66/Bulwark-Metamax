/**
 * src/render3d/units/material.js — the metal unit material (code design §4.11 unitMaterial; plan v2.2.2 §6.11).
 * MAT [MM-story_mv87jwol_6]. Shared by live units and (FX, later) their wrecks.
 *
 * A stock MeshPhongMaterial (per-pixel) with onBeforeCompile injections, so the one sun, ambient light and the
 * static shadow map keep working unchanged. Per vertex: aEmit (1 on glow parts) and aMR (metalness, roughness)
 * written when the model is merged (models3d.js, from metal.js). In the fragment:
 *   - metals darken their diffuse and tint their highlight with their own colour; shininess from roughness;
 *   - a FAKE environment reflection: the reflected view ray picks between the style's sky colour (above the
 *     horizon) and a darkened ground colour (below), plus a fresnel edge — no env map, no PBR, no extra draw;
 *   - glow parts output their own colour, unlit.
 * uMetalK scales all of it: 0 = the previous flat look. Hull tops catch the sky, sides pick up the ground,
 * curved shells get a hot highlight.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { ENV_MEADOW, METAL_ON } from './metal.js';

export function createUnitMaterial(THREE, { metal = METAL_ON, env = ENV_MEADOW } = {}) {
  const uniforms = {
    uMetalK: { value: metal },
    uEnvSky: { value: new THREE.Color(env.sky) },
    uEnvGround: { value: new THREE.Color(env.ground) },
  };
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x111111 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmit; attribute vec2 aMR; varying float vEmit; varying vec2 vMR;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvEmit = aEmit; vMR = aMR;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEnvSky; uniform vec3 uEnvGround; uniform float uMetalK; varying float vEmit; varying vec2 vMR;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 baseCol = diffuseColor.rgb;')
      .replace('#include <lights_phong_fragment>', `#include <lights_phong_fragment>
float mtl = vMR.x * uMetalK, rgh = mix(0.6, vMR.y, uMetalK);
material.diffuseColor = diffuseColor.rgb * (1.0 - mtl * 0.72);
material.specularColor = mix(vec3(0.05), diffuseColor.rgb * 1.6 + 0.15, mtl) * (1.0 - vEmit);
material.specularShininess = mix(6.0, 110.0, 1.0 - rgh);`)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;',
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
{ vec3 Vv = normalize(vViewPosition); vec3 Rv = reflect(-Vv, normal); vec3 Rw = (vec4(Rv, 0.0) * viewMatrix).xyz;
  float hz = smoothstep(-0.12, 0.18, Rw.y);
  vec3 env = mix(uEnvGround * 0.3, uEnvSky * (0.75 + 0.35 * smoothstep(0.6, 0.0, Rw.y)), hz);
  float fr = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 4.0);
  vec3 refl = env * (mix(vec3(0.03), baseCol, mtl) * (0.75 - 0.6 * rgh) + fr * (0.3 - 0.22 * rgh)) * uMetalK;
  outgoingLight += refl * (1.0 - vEmit); }
outgoingLight = mix(outgoingLight, baseCol, vEmit);`);
    m.userData.compiled = true;
  };
  m.customProgramCacheKey = () => 'unit3d-metal';
  m.userData.uniforms = uniforms;
  return {
    material: m,
    uniforms,
    /** 1 = metal (default), 0 = the previous flat look. */
    setMetal(k) { uniforms.uMetalK.value = Math.max(0, Math.min(1, k)); },
    /** Re-point the reflected environment at a world style's sky / ground colours. */
    setEnv({ sky, ground }) { if (sky != null) uniforms.uEnvSky.value.set(sky); if (ground != null) uniforms.uEnvGround.value.set(ground); },
  };
}
