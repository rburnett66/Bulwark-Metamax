/**
 * src/opening/contractCard.js — the first contract, offered at the end of the bar conversation [MM-story_mw47lq0l_7].
 *
 * Design: Collective-Opening-Design §6.5 — the Collective seal, "FIRST CONTRACT — VERDANCE", the terms in plain words
 * (the Verdance quota per tier; the surplus is the player's) and one ACCEPT button. The quotas come from the
 * Collective_Contracts sheet (data/collectiveContract.js): common and uncommon only; rare is always kept (owner Q1).
 *
 *   const card = openContractCard(doc, parent, { planet: 'Verdance', mapId: 1, contract, reward, onAccept });
 *   card.close()
 */

const CSS = `
.cxc { position:absolute; inset:0; display:grid; place-items:center; background:rgba(4,3,2,.55); z-index:6; animation:cxcIn .35s ease; }
@keyframes cxcIn { from { opacity:0 } to { opacity:1 } }
.cxc .card { width:min(420px, calc(100% - 32px)); background:linear-gradient(180deg, #1c140e, #0f0b08); border:1px solid rgba(242,200,105,.55);
  border-radius:14px; padding:22px 22px 18px; color:#e9e2d6; font:14px/1.45 "IBM Plex Sans Condensed", system-ui, sans-serif; box-shadow:0 20px 60px rgba(0,0,0,.6); text-align:center; }
.cxc svg { width:56px; height:56px; color:#f2c869; }
.cxc .kick { font:600 11px "Chakra Petch", sans-serif; letter-spacing:.3em; color:#9b8f80; margin-top:8px; }
.cxc h3 { margin:2px 0 14px; font:700 20px "Chakra Petch", sans-serif; letter-spacing:.12em; color:#f2c869; }
.cxc dl { display:grid; grid-template-columns:1fr auto; gap:6px 16px; margin:0 0 12px; text-align:left; }
.cxc dt { color:#cfc4b4; } .cxc dd { margin:0; font-variant-numeric:tabular-nums; color:#fff; text-align:right; }
.cxc p { margin:0 0 16px; color:#cfc4b4; font-size:13px; text-align:left; }
.cxc button { width:100%; min-height:44px; font:700 14px "Chakra Petch", sans-serif; letter-spacing:.24em; color:#1a1208; background:#f2c869;
  border:0; border-radius:8px; cursor:pointer; }
.cxc button:focus-visible { outline:2px solid #fff; outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { .cxc { animation:none; } }
`;

const SEAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7.5"/><path d="M8 12h8M12 8v8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>';

export function openContractCard(doc, parent, { planet = 'Verdance', mapId = 1, contract = { common: 0, uncommon: 0 }, reward = null, onAccept = () => {} } = {}) {
  if (!doc.getElementById('cxc-css')) { const st = doc.createElement('style'); st.id = 'cxc-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const el = doc.createElement('div'); el.className = 'cxc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'First contract');
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  el.innerHTML = `<div class="card">${SEAL}
    <div class="kick">THE COLLECTIVE</div>
    <h3>FIRST CONTRACT — ${planet.toUpperCase()}</h3>
    <dl><dt>Common ore we buy (map ${mapId})</dt><dd>${fmt(contract.common)}</dd>
        <dt>Uncommon finds we buy</dt><dd>${fmt(contract.uncommon)}</dd>
        ${reward ? `<dt>Collective standing, first completion</dt><dd>+${reward.standing}</dd>` : ''}</dl>
    <p>We pay for every unit up to the quota. Anything past it, and every rare find, is yours to keep. The transport in the
    Loading Bay is yours while the contract stands.</p>
    <button type="button">ACCEPT</button></div>`;
  parent.appendChild(el);
  const btn = el.querySelector('button');
  btn.addEventListener('click', (e) => { e.stopPropagation(); onAccept(); });
  btn.focus({ preventScroll: true });
  return { el, close() { el.remove(); } };
}
