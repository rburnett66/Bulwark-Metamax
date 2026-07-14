/**
 * src/render/contractModal.js — the pre-battle QUEST CONTRACT offer.
 *
 * A character from the map's quest-giver faction makes the pitch before the first tap: haul the
 * quest crystals, get paid in loyalty — refuse and pay for it. Menu design language (gold on
 * ink); ACCEPT/DECLINE resolves through save/contracts.js. Shown once per map entry, over the
 * board, before TAP TO START.
 */
import { alignWord } from '../save/contracts.js';

const CSS = `
.bwc-veil { position:absolute; inset:0; z-index:80; display:flex; align-items:center; justify-content:center;
  background:rgba(8,10,14,.72); }
.bwc-card { width:min(480px, 92vw); background:#14181f; border:1px solid #2e3846; padding:22px 24px;
  font-family:"Segoe UI",system-ui,sans-serif; color:#e6ecf3; box-shadow:0 18px 60px rgba(0,0,0,.6); }
.bwc-kicker { font-size:10px; letter-spacing:.4em; color:#d9a441; margin-bottom:10px; }
.bwc-who { font-size:17px; font-weight:800; letter-spacing:.04em; }
.bwc-align { display:inline-block; margin-left:8px; font-size:9px; letter-spacing:.24em; padding:2px 8px;
  border:1px solid #2e3846; vertical-align:2px; }
.bwc-align.good { color:#7fd08a; border-color:#2e4a34; }
.bwc-align.evil { color:#e07a6a; border-color:#4a2e2e; }
.bwc-align.neutral { color:#8fa0b3; }
.bwc-phrase { margin-top:8px; font-size:12px; color:#8fa0b3; font-style:italic; }
.bwc-task { margin-top:14px; font-size:13px; line-height:1.55; color:#cfe3f0; }
.bwc-terms { margin-top:12px; font-size:11px; color:#8fa0b3; line-height:1.6; }
.bwc-terms b { color:#f2c869; }
.bwc-row { display:flex; gap:10px; margin-top:18px; }
.bwc-btn { flex:1; padding:12px 0; font-size:13px; letter-spacing:.14em; font-weight:700; cursor:pointer;
  border:1px solid #2e3846; background:#1a1f28; color:#e6ecf3; }
.bwc-btn:hover { border-color:#d9a441; }
.bwc-btn.accept { background:linear-gradient(160deg,#f2c869,#d9a441); color:#0c0e12; border-color:#f2c869; }
`;

export function showContractModal(mountEl, offer, cbs) {
  const doc = mountEl.ownerDocument;
  if (!doc.getElementById('bwc-style')) {
    const st = doc.createElement('style'); st.id = 'bwc-style'; st.textContent = CSS;
    doc.head.appendChild(st);
  }
  const veil = doc.createElement('div'); veil.className = 'bwc-veil';
  const card = doc.createElement('div'); card.className = 'bwc-card';
  const w = offer.alignScore >= 2 ? 'good' : offer.alignScore <= -2 ? 'evil' : 'neutral';
  const ch = offer.character;
  card.innerHTML =
    '<div class="bwc-kicker">CONTRACT — ' + offer.giver.toUpperCase() + '</div>' +
    '<div class="bwc-who">' + (ch ? ch.name : 'An envoy') +
      '<span class="bwc-align ' + w + '">' + alignWord(offer.alignScore) + '</span></div>' +
    (ch && ch.phrase ? '<div class="bwc-phrase">“' + ch.phrase + '”</div>' : '') +
    '<div class="bwc-task">Haul the <b>quest crystals</b> seeded beyond the front — ' + offer.nodes +
      ' field' + (offer.nodes === 1 ? '' : 's') + ', deep in contested ground. Deliver at least 80% and the ' +
      offer.giver + ' remember it.</div>' +
    '<div class="bwc-terms">Fulfil: <b>+' + offer.gainMax + ' loyalty</b> (their rival loses half that)' +
      '<br>Break it: partial credit minus the broken-promise penalty — worse than never agreeing' +
      '<br>Decline: <b>−' + offer.declineCost + ' loyalty</b> now, and their rival smiles</div>';
  const row = doc.createElement('div'); row.className = 'bwc-row';
  const acc = doc.createElement('button'); acc.className = 'bwc-btn accept'; acc.textContent = 'ACCEPT CONTRACT';
  const dec = doc.createElement('button'); dec.className = 'bwc-btn'; dec.textContent = 'DECLINE';
  const close = (fn) => { veil.remove(); if (fn) fn(); };
  acc.addEventListener('click', () => close(cbs.onAccept));
  dec.addEventListener('click', () => close(cbs.onDecline));
  row.appendChild(acc); row.appendChild(dec);
  card.appendChild(row);
  veil.appendChild(card);
  mountEl.appendChild(veil);
  return { close: () => veil.remove() };
}
