/**
 * src/menu/qualityRow.js — 3D QUALITY on the main menu's SETTINGS screen [MM-story_mweksov8_1].
 *
 * Owner 2026-11-12: "I dont see quality controls in settings". The choice already existed in the in-game settings gear
 * (battle/session.js → hud.addSetting('quality3d')); this row reads and writes the SAME per-device choice through
 * render3d/quality.js (loadChoice / saveChoice / settingsOptions), so the two can never disagree. The next 3D view
 * (battle, outpost, farm) opens at the chosen tier.
 */
import { loadChoice, saveChoice, settingsOptions, autoTier, probeEnv } from '../render3d/quality.js';

/** The tier Auto would pick on this device (one throwaway WebGL probe, released at once). Never throws. */
export function probeAutoTier(win = globalThis.window) {
  let gl = null;
  try {
    const c = win.document.createElement('canvas');
    gl = c.getContext('webgl2') || c.getContext('webgl');
    return autoTier(probeEnv(win, gl));
  } catch (e) { return 'high'; }
  finally { try { const x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* */ } }
}

/** The row: label + select (Auto (…) / High / Standard / Low). `.sync()` re-reads the stored choice. */
export function qualityRow(doc, { storage = globalThis.localStorage, autoKey = probeAutoTier() } = {}) {
  const row = doc.createElement('div'); row.className = 'bwm-srow';
  const lab = doc.createElement('label'); lab.textContent = '3D QUALITY'; row.appendChild(lab);
  const sel = doc.createElement('select');
  sel.setAttribute('aria-label', '3D view quality');
  sel.style.cssText = 'flex:1;background:#0c0e12;color:#e6ecf3;border:1px solid #2e3846;border-radius:5px;padding:6px 8px;font-size:12px';
  for (const o of settingsOptions(autoKey)) { const op = doc.createElement('option'); op.value = o.value; op.textContent = o.label; sel.appendChild(op); }
  sel.value = loadChoice(storage);
  sel.addEventListener('change', () => { sel.value = saveChoice(storage, sel.value); });
  row.appendChild(sel);
  row.sync = () => { sel.value = loadChoice(storage); };
  row.select = sel;
  return row;
}
