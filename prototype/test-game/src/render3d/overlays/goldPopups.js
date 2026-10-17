/**
 * src/render3d/overlays/goldPopups.js — the "$500" a kill pays, popping out of the wreck. [MM-task_mvbyf6t8_z]
 *
 * Owner 2026-10-16: "the gold acquired should pop up "$500" with the correct value on each unit killed" — with AAA
 * choreography. The beat, per kill (the sim's `kill` event carries `income`, the exact bounty credited):
 *   0.00 s  the unit explodes (world-impact FX) — the number waits a moment so the blast flash reads first;
 *   0.10 s  "$N" pops out of the fireball: scale 0.35 → 1.25 → 1.0 with a slight overshoot, gold with a dark outline;
 *   → 1.5 s it rises about a cell with an ease-out and fades over its last third.
 * Several kills in one place stack upward instead of overprinting; a big bounty prints larger. Harvester deliveries
 * (`deposit`, gold credited at the dock) pop the same way in the crystal's colour.
 * DOM labels projected through the 3D camera every frame — crisp text at any zoom, no texture atlas. The model
 * (planned popups, positions, phases) is pure and testable; createGoldPopupView owns the DOM.
 */
import { cellToWorld } from '../camera.js';

export const POP = Object.freeze({ delay: 0.1, pop: 0.12, settle: 0.1, life: 1.5, rise: 1.0, stack: 0.38, near: 0.9 });
const DEPOSIT_COLOR = { blue: '#7fc4ff', yellow: '#ffd76a', red: '#ff8a7a', green: '#8ff0a0' };

/** Pure: a list of live popups; feed(events) adds, step(dt) ages, each popup exposes { x, y, z, text, scale, alpha }. */
export function createGoldPopups() {
  const live = [];
  const add = (x, z, gold, color) => {
    let lift = 0;
    for (const p of live) if (p.t < POP.delay + POP.pop + 0.35 && Math.hypot(p.x - x, p.z - z) < POP.near) lift = Math.max(lift, p.lift + POP.stack);
    live.push({ x, z, y0: 0.75 + lift, lift, text: '$' + Math.round(gold).toLocaleString('en-US'), big: gold >= 400, color, t: 0, y: 0.75 + lift, scale: 0, alpha: 0 });
  };
  return {
    live,
    feed(events, map) {
      if (!events) return;
      for (const ev of events) {
        if (ev.type === 'kill' && ev.income > 0 && ev.pos) add(cellToWorld(ev.pos.x), cellToWorld(ev.pos.y), ev.income, null);
        else if (ev.type === 'deposit' && ev.gold > 0) {
          const at = ev.pos || (map && map.base);   // deliveries land at the base dock
          if (at) add(cellToWorld(at.x), cellToWorld(at.y), ev.gold, DEPOSIT_COLOR[ev.color] || null);
        }
      }
    },
    step(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.t += Math.max(0, dt || 0);
        const t = p.t - POP.delay;
        if (t >= POP.life) { live.splice(i, 1); continue; }
        if (t < 0) { p.scale = 0; p.alpha = 0; continue; }
        // pop with overshoot, then settle
        p.scale = t < POP.pop ? 0.35 + (1.25 - 0.35) * (t / POP.pop) : t < POP.pop + POP.settle ? 1.25 - 0.25 * ((t - POP.pop) / POP.settle) : 1;
        if (p.big) p.scale *= 1.18;
        const k = t / POP.life, ease = 1 - (1 - k) * (1 - k);
        p.y = p.y0 + POP.rise * ease;
        p.alpha = k < 0.66 ? Math.min(1, t / 0.06) : 1 - (k - 0.66) / 0.34;
      }
    },
    clear() { live.length = 0; },
  };
}

/** DOM view: one absolutely-positioned label per popup, over the 3D canvas. */
export function createGoldPopupView(host) {
  const layer = document.createElement('div');
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: 3 });
  host.appendChild(layer);
  const style = document.createElement('style');
  style.textContent = `.r3d-gold{position:absolute;left:0;top:0;font:900 20px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.02em;
    color:#ffd76a;-webkit-text-stroke:1px rgba(40,24,0,.65);text-shadow:0 2px 0 #5a3a00,0 0 10px rgba(255,190,60,.55),0 3px 6px rgba(0,0,0,.6);
    white-space:nowrap;will-change:transform,opacity}`;
  layer.appendChild(style);
  const pool = [], v = { x: 0, y: 0, z: 0 };
  return {
    sync(model, camera, w, h, THREE) {
      const P = new THREE.Vector3();
      let i = 0;
      for (const p of model.live) {
        if (p.alpha <= 0.01) continue;
        P.set(p.x, p.y, p.z).project(camera);
        if (P.z > 1) continue;
        let el = pool[i];
        if (!el) { el = document.createElement('div'); el.className = 'r3d-gold'; layer.appendChild(el); pool[i] = el; }
        if (el.textContent !== p.text) el.textContent = p.text;
        el.style.color = p.color || '#ffd76a';
        el.style.display = '';
        el.style.opacity = p.alpha.toFixed(3);
        el.style.transform = `translate(${((P.x + 1) / 2 * w).toFixed(1)}px,${((1 - P.y) / 2 * h).toFixed(1)}px) translate(-50%,-100%) scale(${p.scale.toFixed(3)})`;
        i++;
      }
      for (let j = i; j < pool.length; j++) pool[j].style.display = 'none';
      return i;
    },
    dispose() { layer.remove(); },
  };
}
