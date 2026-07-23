/**
 * src/render/gameDialog.js — reusable board-overlay dialog (Wave-Bonuses epic).
 *
 * One veil+card shell, two contents so far:
 *   - showWavePreview: the wave lineup shown before a map starts (WB2)
 *   - showBonusPicker: the pick-1-of-3 wave-end bonus cards (WB5)
 * Menu design language (ink + gold), mobile-first tap targets. Same veil pattern
 * as contractModal.js so the two never fight over the board.
 */

const CSS = `
.bwd-veil { position:absolute; inset:0; z-index:82; display:flex; align-items:center; justify-content:center;
  background:rgba(8,10,14,.74); }
.bwd-card { width:min(560px, 94vw); max-height:88vh; overflow:auto; background:#14181f; border:1px solid #2e3846;
  padding:20px 22px; font-family:"Segoe UI",system-ui,sans-serif; color:#e6ecf3; box-shadow:0 18px 60px rgba(0,0,0,.6); }
.bwd-kicker { font-size:10px; letter-spacing:.4em; color:#d9a441; margin-bottom:4px; }
.bwd-title { font-size:18px; font-weight:800; letter-spacing:.03em; margin-bottom:12px; }
.bwd-unit { border:1px solid #263040; border-radius:6px; padding:9px 11px; margin-bottom:7px; font-size:13px; color:#cfe3f0; }
.bwd-unit.new { border-color:#7a2e2e; background:#1e1414; }
.bwd-unit .warn { display:block; font-size:11px; font-weight:800; letter-spacing:.12em; color:#ff6a5a; margin-bottom:3px; }
.bwd-cards { display:flex; gap:10px; flex-wrap:wrap; }
.bwd-bonus { flex:1 1 150px; min-width:140px; background:#1a1f28; border:1px solid #2e3846; border-radius:8px;
  padding:14px 12px; cursor:pointer; text-align:center; transition:border-color .1s, transform .05s; }
.bwd-bonus:hover { border-color:#f2c869; }
.bwd-bonus:active { transform:translateY(1px); }
.bwd-bonus .ic { font-size:26px; line-height:1; }
.bwd-bonus .lb { font-size:13px; font-weight:700; margin-top:8px; }
.bwd-bonus .ds { font-size:11px; color:#8fa0b3; margin-top:5px; line-height:1.4; }
.bwd-btn { display:block; width:100%; margin-top:16px; padding:12px 0; font-size:13px; letter-spacing:.14em;
  font-weight:700; cursor:pointer; border:1px solid #2e3846; background:#1a1f28; color:#e6ecf3; border-radius:4px; }
.bwd-btn.go { background:linear-gradient(160deg,#f2c869,#d9a441); color:#0c0e12; border-color:#f2c869; }
.bwd-owned { margin-top:12px; font-size:11px; color:#8fa0b3; }
`;

function ensureStyle(doc) {
  if (!doc.getElementById('bwd-style')) {
    const st = doc.createElement('style'); st.id = 'bwd-style'; st.textContent = CSS;
    doc.head.appendChild(st);
  }
}
function veilCard(mountEl) {
  const doc = mountEl.ownerDocument;
  ensureStyle(doc);
  const veil = doc.createElement('div'); veil.className = 'bwd-veil';
  const card = doc.createElement('div'); card.className = 'bwd-card';
  veil.appendChild(card); mountEl.appendChild(veil);
  return { doc, veil, card };
}

/**
 * WB2 — INCOMING WAVE INTEL for ONE wave (owner rev): a DESCRIPTION of the unit
 * types in the upcoming wave — no counts. A type appearing for the first time
 * THIS BATTLE is flagged "WARNING NEW UNIT". `info` = { wave, faction?,
 * units:[{desc, isNew}] } (built by the caller, which owns the seen-set).
 * onStart resolves + closes; escapeHtml keeps unit descriptions render-safe.
 */
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
export function showWaveIntel(mountEl, info, onStart) {
  const { doc, veil, card } = veilCard(mountEl);
  const rows = (info.units || []).map((u) =>
    '<div class="bwd-unit' + (u.isNew ? ' new' : '') + '">' +
      (u.isNew ? '<span class="warn">⚠ WARNING · NEW UNIT</span>' : '') + esc(u.desc) + '</div>').join('');
  card.innerHTML =
    '<div class="bwd-kicker">INCOMING WAVE INTEL</div>' +
    '<div class="bwd-title">Wave ' + info.wave + (info.faction ? ' — ' + esc(info.faction) : '') + '</div>' +
    (rows || '<div class="bwd-unit">—</div>');
  const btn = doc.createElement('button'); btn.className = 'bwd-btn go'; btn.textContent = 'TO THE WALLS ▶';
  btn.addEventListener('click', () => { veil.remove(); if (onStart) onStart(); });
  card.appendChild(btn);
  return { close: () => veil.remove() };
}

const BONUS_ICONS = {
  dmg_air: '🎯', dmg_ground: '🎯', dmg_troops: '🎯',
  heal_walls: '🧱', heal_cannons: '🔧', heal_base: '🏰', heal_aa: '🔧', heal_harv: '🔧',
  harv_speed: '⚡', harv_cap: '📦', harv_hp: '❤️',
  mine_drones: '💣', cannon_range: '📡', cannon_dmg: '💥',
  tier3_turret: '⭐', tier3_wall: '⭐',
};

/**
 * WB5 — bonus picker. `offer` is [bonusId,…]; `getBonus(id)` → {id,label,...};
 * onPick(id) resolves + closes. `owned` (optional) renders a small tally line.
 */
export function showBonusPicker(mountEl, offer, getBonus, onPick, owned) {
  const { doc, veil, card } = veilCard(mountEl);
  card.innerHTML = '<div class="bwd-kicker">WAVE CLEARED</div><div class="bwd-title">Choose a bonus</div>';
  const wrap = doc.createElement('div'); wrap.className = 'bwd-cards';
  for (const id of offer || []) {
    const def = getBonus(id); if (!def) continue;
    const c = doc.createElement('div'); c.className = 'bwd-bonus';
    c.innerHTML = '<div class="ic">' + (BONUS_ICONS[id] || '✨') + '</div><div class="lb">' + def.label + '</div>';
    c.addEventListener('click', () => { veil.remove(); if (onPick) onPick(id); });
    wrap.appendChild(c);
  }
  card.appendChild(wrap);
  if (owned && owned.length) {
    const o = doc.createElement('div'); o.className = 'bwd-owned';
    o.textContent = 'Owned: ' + owned.map((id) => { const d = getBonus(id); return d ? d.label : id; }).join(' · ');
    card.appendChild(o);
  }
  return { close: () => veil.remove() };
}
