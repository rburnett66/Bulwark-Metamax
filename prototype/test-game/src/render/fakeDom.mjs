// A tiny DOM for the HUD's node tests (no jsdom in this repo): enough of Document / Element for render/hud.js createHud
// and render/hudCard.js to build their trees, and serialize() to compare a tree's markup. Test-only (not shipped: it is
// an .mjs helper beside the tests, imported by them alone).

class ClassList {
  constructor(el) { this.el = el; }
  get list() { return this.el.className ? this.el.className.split(/\s+/).filter(Boolean) : []; }
  add(...c) { const s = this.list; for (const x of c) if (!s.includes(x)) s.push(x); this.el.className = s.join(' '); }
  remove(...c) { this.el.className = this.list.filter((x) => !c.includes(x)).join(' '); }
  toggle(c, on) { const has = this.contains(c); const want = on === undefined ? !has : !!on; if (want && !has) this.add(c); else if (!want && has) this.remove(c); return want; }
  contains(c) { return this.list.includes(c); }
}

function makeStyle() {
  const props = {};
  return new Proxy(props, {
    get(t, k) {
      if (k === 'setProperty') return (n, v) => { t[n] = String(v); };
      if (k === 'removeProperty') return (n) => { delete t[n]; };
      if (k === '__all') return t;
      return k in t ? t[k] : '';
    },
    set(t, k, v) { t[k] = String(v); return true; },
  });
}

let uid = 0;
class Node {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag ? tag.toUpperCase() : null; this.nodeType = tag ? 1 : 3;
    this.childNodes = []; this.parentNode = null; this._listeners = {}; this._attrs = {}; this.className = ''; this._text = '';
    this.style = makeStyle(); this.classList = new ClassList(this); this.dataset = {}; this._id = ++uid; this._html = null;
    this.hidden = false; this.disabled = false; this.title = ''; this.value = '';
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.documentElement; }
  get nodeValue() { return this._text; }
  set nodeValue(v) { this._text = String(v); }
  get offsetWidth() { return 0; } get offsetHeight() { return 0; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); this._html = null; return c; }
  insertBefore(c, ref) { if (!ref) return this.appendChild(c); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get textContent() { return this.nodeType === 3 ? this._text : (this._html != null ? this._html.replace(/<[^>]*>/g, '') : this.childNodes.map((c) => c.textContent).join('')); }
  set textContent(v) { this.childNodes = []; this._html = null; if (this.nodeType === 3) this._text = String(v); else if (v !== '' && v != null) this.appendChild(this.ownerDocument.createTextNode(String(v))); }
  get innerHTML() { return this._html != null ? this._html : this.childNodes.map(serialize).join(''); }
  set innerHTML(v) { this.childNodes = []; this._html = String(v); }
  insertAdjacentHTML(_where, html) { this._html = (this._html || this.childNodes.map(serialize).join('')) + html; this.childNodes = []; }
  setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { this._listeners[t] = (this._listeners[t] || []).filter((f) => f !== fn); }
  dispatch(t, ev = {}) { const e = { type: t, target: this, stopPropagation() {}, preventDefault() {}, ...ev }; let n = this; while (n) { for (const f of n._listeners[t] || []) f(e); n = n.parentNode; } }
  click() { this.dispatch('click'); }
  getContext() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  matches(sel) { return matchOne(this, sel); }
  closest(sel) { let n = this; while (n && n.nodeType === 1) { if (matchOne(n, sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (sel.split(',').some((s) => matchChain(c, s.trim()))) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

/** One compound selector: tag, .class (any number), [attr="v"]. */
function matchOne(n, sel) {
  if (n.nodeType !== 1) return false;
  const m = sel.match(/^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i);
  if (!m) return false;
  if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
  for (const c of (m[2] || '').split('.').filter(Boolean)) if (!n.classList.contains(c)) return false;
  for (const a of (m[3] || '').match(/\[[^\]]+\]/g) || []) {
    const [, k, v] = a.match(/^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/) || [];
    const dk = k && k.startsWith('data-') ? k.slice(5).replace(/-(\w)/g, (_, x) => x.toUpperCase()) : null;
    const have = dk ? n.dataset[dk] : n.getAttribute(k);
    if (have == null || (v !== undefined && String(have) !== v)) return false;
  }
  return true;
}
/** A descendant chain "a b c" (no combinators besides the space). */
function matchChain(n, sel) {
  const parts = sel.split(/\s+/);
  if (!matchOne(n, parts[parts.length - 1])) return false;
  let i = parts.length - 2, p = n.parentNode;
  while (i >= 0 && p) { if (matchOne(p, parts[i])) i--; p = p.parentNode; }
  return i < 0;
}

/** The node's markup: tag, class, the attributes and inline styles set, text and children — stable for comparing. */
export function serialize(n) {
  if (n.nodeType === 3) return n._text.replace(/</g, '&lt;');
  const tag = n.tagName.toLowerCase();
  const st = Object.entries(n.style.__all).map(([k, v]) => `${k}:${v}`).join(';');
  const attrs = [n.className ? ` class="${n.className}"` : '', ...Object.entries(n._attrs).filter(([k]) => k !== 'class').map(([k, v]) => ` ${k}="${v}"`),
    ...Object.entries(n.dataset).map(([k, v]) => ` data-${k}="${v}"`), n.title ? ` title="${n.title}"` : '', n.disabled ? ' disabled' : '', n.hidden ? ' hidden' : '', st ? ` style="${st}"` : ''].join('');
  return `<${tag}${attrs}>${n.innerHTML}</${tag}>`;
}

/** A fresh document with a window: rAF never fires (layout is a browser concern), storage in memory. */
export function fakeDocument({ width = 844, height = 390 } = {}) {
  const mem = new Map();
  const win = {
    innerWidth: width, innerHeight: height, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, addEventListener() {},
    setTimeout: (fn) => 0, clearTimeout() {}, matchMedia: () => ({ matches: false }), performance: { now: () => 0 },
    localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) },
  };
  const doc = {
    defaultView: win, _ids: {},
    createElement(tag) { return new Node(doc, tag); },
    createTextNode(t) { const n = new Node(doc, null); n._text = String(t); return n; },
    getElementById(id) { return doc.documentElement.querySelectorAll('*').find((n) => n.getAttribute('id') === id || n.id === id) || null; },
    addEventListener() {},
  };
  doc.documentElement = new Node(doc, 'html');
  doc.head = doc.createElement('head'); doc.body = doc.createElement('body');
  doc.documentElement.appendChild(doc.head); doc.documentElement.appendChild(doc.body);
  // querySelectorAll('*') for getElementById
  const qsa = doc.documentElement.querySelectorAll.bind(doc.documentElement);
  doc.documentElement.querySelectorAll = (sel) => (sel === '*' ? (() => { const out = []; const w = (n) => { for (const c of n.children) { out.push(c); w(c); } }; w(doc.documentElement); return out; })() : qsa(sel));
  return doc;
}
