/**
 * src/diag/errorLog.js — the game's own error log, for phones with no console (owner 2026-11-09: "I can't get error
 * logs from ios browser"; option 3 approved: "Copy error report").
 *
 * installErrorLog(win) catches every uncaught error, failed promise, console.error and lost WebGL context, and keeps
 * the last MAX_ENTRIES of them with breadcrumbs (crumb('outpost: building the scene')) in localStorage. It survives a
 * page reload, so when iOS kills the tab ("A problem repeatedly occurred") the next load still has the trail: a
 * session that ends inside the outpost with no 'outpost: closed' crumb is a crash, most likely memory.
 *
 * errorReport() is the text the player copies and pastes to us. lastSessionCrashed() / hasErrors() tell the boot chip
 * whether there is anything worth offering. Storage is a convenience: every read and write is wrapped, and the log
 * still works in memory when storage throws (private mode).
 */
import { VERSION } from '../version.js';

export const STORE_KEY = 'bulwark.errorLog.v1';
export const MAX_ENTRIES = 40;

let entries = null;        // [{ t, kind: 'load'|'crumb'|'error'|'reject'|'console'|'gl', text, stack? }]
let storage = null;
let installed = false;

const now = () => new Date().toISOString();
const clip = (s, n = 600) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; };

function read() {
  if (entries) return entries;
  entries = [];
  try { const raw = storage && storage.getItem(STORE_KEY); const v = raw ? JSON.parse(raw) : null; if (Array.isArray(v)) entries = v; } catch (_) { /* no storage */ }
  return entries;
}
function write() {
  try { if (storage) storage.setItem(STORE_KEY, JSON.stringify(entries)); } catch (_) { /* full or blocked: keep it in memory */ }
}
function push(kind, text, stack) {
  const list = read(), last = list[list.length - 1];
  // a frame loop that throws every frame would flood the log: a repeat of the last entry counts up instead
  if (last && last.kind === kind && last.text === clip(text)) { last.n = (last.n || 1) + 1; last.t = now(); write(); return; }
  list.push(stack ? { t: now(), kind, text: clip(text), stack: clip(stack, 1500) } : { t: now(), kind, text: clip(text) });
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  write();
}

const describe = (v) => {
  if (v instanceof Error || (v && typeof v === 'object' && 'message' in v && 'stack' in v)) return { text: `${v.name || 'Error'}: ${v.message}`, stack: v.stack };
  if (v && typeof v === 'object') { try { return { text: JSON.stringify(v) }; } catch (_) { return { text: String(v) }; } }
  return { text: String(v) };
};

/** A breadcrumb: what the game was doing (kept with the errors, so a crash shows its last step). */
export function crumb(text) { push('crumb', text); }

/** Log an error by hand (a caught failure worth reporting). */
export function logError(err, where = '') {
  const d = describe(err);
  push('error', (where ? where + ': ' : '') + d.text, d.stack);
}

/** Start catching. Idempotent. win: the window; opts.storage overrides localStorage (tests). → the log's API */
export function installErrorLog(win, opts = {}) {
  if (installed) return api;
  installed = true;
  try { storage = opts.storage !== undefined ? opts.storage : win.localStorage; } catch (_) { storage = null; }
  entries = null; read();
  push('load', `page load ${VERSION}`);
  win.addEventListener('error', (e) => {
    if (e && e.target && e.target !== win && e.target.tagName) return;   // a failed <img>/<script> fetch, not a JS error
    const d = e && e.error ? describe(e.error) : { text: (e && e.message) || 'error' };
    push('error', `${d.text}${e && e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno}:${e.colno})` : ''}`, d.stack);
  });
  win.addEventListener('unhandledrejection', (e) => { const d = describe(e && e.reason); push('reject', d.text, d.stack); });
  // a lost WebGL context does not bubble; a capture listener on the window still sees it. A context the game lets go
  // on purpose (renderer.forceContextLoss → WEBGL_lose_context.loseContext) is marked first and is not an error.
  for (const C of [win.WebGLRenderingContext, win.WebGL2RenderingContext]) {
    if (!C || !C.prototype || C.prototype.getExtension.__bwWrapped) continue;
    const orig = C.prototype.getExtension;
    const wrapped = function getExtension(name) {
      const ext = orig.call(this, name);
      if (ext && /lose_context/i.test(String(name)) && !ext.__bwWrapped) {
        const lose = ext.loseContext.bind(ext), canvas = this.canvas;
        ext.loseContext = () => { try { if (canvas) canvas.__bwReleased = true; } catch (_) { /* */ } return lose(); };
        ext.__bwWrapped = true;
      }
      return ext;
    };
    wrapped.__bwWrapped = true;
    C.prototype.getExtension = wrapped;
  }
  win.addEventListener('webglcontextlost', (e) => {
    if (e && e.target && e.target.__bwReleased) return;
    push('gl', 'WebGL context lost');
  }, true);
  const con = win.console;
  if (con && typeof con.error === 'function') {
    const orig = con.error.bind(con);
    con.error = (...args) => {
      try {
        const err = args.find((a) => a instanceof Error);
        const text = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : describe(a).text)).join(' ');
        push('console', text, err && err.stack);
      } catch (_) { /* never let logging break the caller */ }
      orig(...args);
    };
  }
  return api;
}

/** The sessions in the log, oldest first: each starts at a 'load' entry. */
function sessions() {
  const out = [];
  for (const e of read()) { if (e.kind === 'load' || !out.length) out.push([]); out[out.length - 1].push(e); }
  return out;
}

const isProblem = (e) => e.kind === 'error' || e.kind === 'reject' || e.kind === 'console' || e.kind === 'gl';

/**
 * Did the session before this one end inside the outpost (an 'outpost: …' step with no 'outpost: closed' or
 * 'outpost: failed' after it)? That is the iPhone tab being killed mid-outpost.
 */
export function lastSessionCrashed() {
  const s = sessions();
  const prev = s.length >= 2 ? s[s.length - 2] : null;
  if (!prev) return false;
  let inside = false;
  for (const e of prev) {
    if (e.kind !== 'crumb' || !e.text.startsWith('outpost: ')) continue;
    inside = !(e.text === 'outpost: closed' || e.text.startsWith('outpost: failed'));
  }
  return inside;
}

/** Any error in this session or the one before it? */
export function hasErrors() {
  const s = sessions();
  return s.slice(-2).some((ss) => ss.some(isProblem));
}

/** How many problems (errors, failed promises, console errors, lost GL contexts) the log holds, all sessions. */
export function problemCount() { return read().reduce((n, e) => n + (isProblem(e) ? (e.n || 1) : 0), 0); }

/** The report the player copies: device, version, then the last sessions' entries. */
export function errorReport(win = globalThis) {
  const nav = (win && win.navigator) || {}, scr = (win && win.screen) || {};
  const head = [
    `Bulwark error report — ${VERSION}`,
    `time: ${now()}`,
    `device: ${nav.userAgent || 'unknown'}`,
    `screen: ${scr.width || '?'}×${scr.height || '?'} @${(win && win.devicePixelRatio) || 1}x · view ${(win && win.innerWidth) || '?'}×${(win && win.innerHeight) || '?'}`,
    lastSessionCrashed() ? 'note: the previous session ended inside the outpost without closing it (the tab was likely killed)' : '',
  ].filter(Boolean);
  const body = read().map((e) => `${e.t.slice(11, 19)} ${e.kind.toUpperCase().padEnd(7)} ${e.text}${e.n ? ` (×${e.n})` : ''}${e.stack ? '\n' + e.stack.split('\n').slice(0, 8).map((l) => '    ' + l.trim()).join('\n') : ''}`);
  return head.join('\n') + '\n\n' + (body.length ? body.join('\n') : '(no entries)');
}

/** Clear the log (after the report is copied, if the player wants a clean slate). */
export function clearErrorLog() { entries = []; write(); }

/** Copy text to the clipboard; falls back to selecting a textarea. → Promise<boolean> */
export async function copyText(doc, text, fallbackArea) {
  try { await doc.defaultView.navigator.clipboard.writeText(text); return true; } catch (_) { /* fall through */ }
  try { if (fallbackArea) { fallbackArea.focus(); fallbackArea.select(); return !!doc.execCommand('copy'); } } catch (_) { /* fall through */ }
  return false;
}

/** For tests: forget the installed state. */
export function _resetForTest() { installed = false; entries = null; storage = null; }

const api = { crumb, logError, errorReport, lastSessionCrashed, hasErrors, clearErrorLog };
