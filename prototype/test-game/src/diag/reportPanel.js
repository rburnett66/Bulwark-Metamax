/**
 * src/diag/reportPanel.js — "COPY ERROR REPORT": the button and the report text, on the outpost's failure card, its
 * stalled-load screen and the boot chip (errorLog.js). Plain DOM in the loading screen's look: Rajdhani, dark panel,
 * the gold action button.
 */
import { errorReport, copyText, lastSessionCrashed, hasErrors, clearErrorLog } from './errorLog.js';

const BTN = { font: '700 13px/1 Rajdhani, system-ui, sans-serif', letterSpacing: '.2em', padding: '10px 20px', border: '0', cursor: 'pointer' };

/** A COPY ERROR REPORT button; tapping it copies the report and shows it in a box underneath. → element */
export function reportButton(doc, { label = 'COPY ERROR REPORT' } = {}) {
  const wrap = doc.createElement('div');
  Object.assign(wrap.style, { display: 'grid', gap: '10px', justifyItems: 'center', width: 'min(92vw, 560px)' });
  const btn = doc.createElement('button');
  btn.textContent = label; btn.className = 'bw-errreport-btn';
  Object.assign(btn.style, BTN, { background: '#1f2732', color: '#dfe7ef', border: '1px solid #3a4655' });
  const area = doc.createElement('textarea');
  area.readOnly = true; area.className = 'bw-errreport-text';
  Object.assign(area.style, { display: 'none', width: '100%', height: '38vh', background: '#0b0f14', color: '#cfd6dd', border: '1px solid #3a4655',
    font: '11px/1.35 ui-monospace, Menlo, monospace', letterSpacing: '0', padding: '8px', boxSizing: 'border-box', textAlign: 'left' });
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    area.value = errorReport(doc.defaultView);
    area.style.display = 'block';
    const ok = await copyText(doc, area.value, area);
    btn.textContent = ok ? 'COPIED — PASTE IT TO US' : 'SELECT THE TEXT AND COPY';
  });
  wrap.append(btn, area);
  return wrap;
}

/** ?debug=1 in the address: the error UX is shown (owner 2026-11-10: hidden from players otherwise). */
export const debugOn = (doc) => /[?&]debug=1(&|$)/.test(((doc && doc.defaultView && doc.defaultView.location) || {}).search || '');

/**
 * On boot, with ?debug=1 only (owner 2026-11-10: "the error dialog messes up the UX ... hide that error UX")
 * [MM-story_mwb10lqu_1x]: when the last session was killed inside the outpost, or the log holds errors, a small chip
 * offers the report (bottom-left, over the menu). Dismiss hides it for this session; CLEAR empties the log.
 * opts.force shows it whatever the address says (tests). → element | null
 */
export function mountReportChip(doc, { force = false } = {}) {
  if (!force && !debugOn(doc)) return null;
  const crashed = lastSessionCrashed();
  if (!crashed && !hasErrors()) return null;
  const chip = doc.createElement('div');
  chip.className = 'bw-errreport-chip';
  Object.assign(chip.style, { position: 'fixed', left: '10px', bottom: '10px', zIndex: '9000', display: 'grid', gap: '8px', justifyItems: 'start',
    background: 'rgba(12,16,22,.94)', border: '1px solid #3a4655', padding: '10px 12px', color: '#cfd6dd',
    font: '600 12px/1.35 Rajdhani, system-ui, sans-serif', letterSpacing: '.08em', boxSizing: 'border-box', maxWidth: 'calc(100vw - 20px)' });
  const msg = doc.createElement('div');
  msg.textContent = crashed ? 'THE LAST SESSION CLOSED INSIDE THE OUTPOST' : 'THE GAME LOGGED AN ERROR';
  msg.style.color = '#ffb3aa';
  const row = doc.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });
  const rb = reportButton(doc);
  Object.assign(rb.style, { justifyItems: 'start', width: 'min(calc(100vw - 46px), 560px)' });
  const clear = doc.createElement('button'); clear.textContent = 'CLEAR';
  Object.assign(clear.style, BTN, { background: 'transparent', color: '#8fa0b3', border: '1px solid #3a4655' });
  clear.addEventListener('click', () => { clearErrorLog(); chip.remove(); });
  const close = doc.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', 'Hide');
  Object.assign(close.style, BTN, { background: 'transparent', color: '#8fa0b3', border: '0', padding: '10px 8px' });
  close.addEventListener('click', () => chip.remove());
  row.append(clear, close);
  chip.append(msg, rb, row);
  doc.body.appendChild(chip);
  return chip;
}
