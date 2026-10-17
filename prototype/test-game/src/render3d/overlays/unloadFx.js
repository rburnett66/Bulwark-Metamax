/**
 * src/render3d/overlays/unloadFx.js — a harvester unloading at the base. [MM-story_mvbyf8gq_10]
 *
 * Owner 2026-10-16: "when harvesters unload resource there should be a 3 second delay as the resources unload."
 * The sim holds the harvester at the dock for the unload (event `unloadStart` { id, pos, dur, color, gold }) and
 * credits the gold at the end (`deposit`). Here the wait reads as work being done:
 *   - a ring on the ground around the harvester fills clockwise in the crystal's colour over the unload time;
 *   - crystal glints stream from the harvester's bed up toward the base's hatch the whole time;
 *   - the ring flashes full when the delivery lands, and the "$N" pops (overlays/goldPopups.js on `deposit`).
 * planUnloads is pure; createUnloadView draws the rings (one mesh each, few at a time) and feeds the glints to the
 * world-impact particles.
 */
import { cellToWorld } from '../camera.js';

const COLORS = { blue: [0.36, 0.66, 0.94], yellow: [0.95, 0.78, 0.29], red: [0.91, 0.31, 0.31], green: [0.32, 0.75, 0.44] };

export function createUnloads() {
  const live = [];
  return {
    live,
    feed(events, state) {
      if (!events) return;
      for (const ev of events) {
        if (ev.type === 'unloadStart') {
          const p = ev.pos || (state && state.units && state.units.get(ev.id) && state.units.get(ev.id).pos);
          if (!p) continue;
          for (let i = live.length - 1; i >= 0; i--) if (live[i].id === ev.id) live.splice(i, 1);
          live.push({ id: ev.id, x: cellToWorld(p.x), z: cellToWorld(p.y), t: 0, dur: ev.dur || 3, color: COLORS[ev.color] || COLORS.blue, done: 0 });
        } else if (ev.type === 'unloadCancel') {                       // the base fell: the load is lost
          for (let i = live.length - 1; i >= 0; i--) if (live[i].id === ev.id) live.splice(i, 1);
        } else if (ev.type === 'deposit') {
          const u = live.find((q) => q.id === (ev.id ?? ev.harvesterId)) || live.find((q) => q.t >= q.dur - 0.25);
          if (u) { u.t = u.dur; u.done = 0.0001; }
        }
      }
    },
    step(dt, state) {
      for (let i = live.length - 1; i >= 0; i--) {
        const u = live[i];
        const h = state && state.units && state.units.get(u.id);
        if (h && h.pos) { u.x = cellToWorld(h.pos.x); u.z = cellToWorld(h.pos.y); }
        if (!h && !u.done) { live.splice(i, 1); continue; }      // the harvester died mid-unload: nothing delivered
        u.t = Math.min(u.dur, u.t + dt);
        if (u.done) u.done += dt;
        if (u.done > 0.45 || u.t > u.dur + 1.5) live.splice(i, 1);
      }
    },
    clear() { live.length = 0; },
  };
}

export function createUnloadView(THREE, scene, { cap = 8 } = {}) {
  const mk = () => new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uCol: { value: new THREE.Color() }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uP, uFlash; uniform vec3 uCol; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float d = length(p);
        if (d > 1.0) discard;
        float band = smoothstep(0.72, 0.76, d) * (1.0 - smoothstep(0.94, 0.98, d));
        float ang = fract(atan(p.x, -p.y) / 6.2831853 + 1.0);           // 0 at north, clockwise
        float on = step(ang, uP);
        vec3 col = mix(vec3(0.08, 0.1, 0.12), uCol, on);
        float a = band * mix(0.45, 0.95, on) + uFlash * (1.0 - d) * 0.6;
        gl_FragColor = vec4(mix(col, vec3(1.0), uFlash * 0.6), a);
      }`,
    transparent: true, depthWrite: false,
  });
  const rings = Array.from({ length: cap }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), mk());
    m.position.y = 0.06; m.renderOrder = 7; m.visible = false; scene.add(m); return m;
  });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return {
    sync(model, dt, impacts, K, base) {
      rings.forEach((m, i) => {
        const u = model.live[i];
        m.visible = !!u;
        if (!u) return;
        m.position.x = u.x; m.position.z = u.z;
        m.material.uniforms.uP.value = u.t / u.dur;
        m.material.uniforms.uCol.value.setRGB(u.color[0], u.color[1], u.color[2]);
        m.material.uniforms.uFlash.value = u.done ? Math.max(0, 1 - u.done / 0.45) : 0;
        // glints arcing from the bed toward the base hatch while it unloads
        if (impacts && K && !u.done && base) {
          for (let c = Math.floor(14 * dt + rnd()); c > 0; c--) {
            const bx = cellToWorld(base.x) - u.x, bz = cellToWorld(base.y) - u.z;
            impacts.emit(K.EMBER, u.x + (rnd() - 0.5) * 0.3, 0.35, u.z + (rnd() - 0.5) * 0.3, bx * 0.9, 1.4 + rnd() * 0.6, bz * 0.9, 0.7, 0.03);
          }
        }
      });
    },
    dispose() { for (const m of rings) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } },
  };
}
