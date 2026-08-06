// STACK FORGE AUDIT — facts derived from source text only.
// Comments and string literals are BLANKED (replaced space-for-space, newlines kept) before anything is
// counted, so no claim in a comment can create or hide a reference, and every reported index is an exact
// index into the original file.
import { readFileSync } from 'node:fs';

const DIR = 'C:/Users/hottd/Documents/Metamax/Bulwark-Metamax/prototype/test-game/tools/voxel-stack/';
const raw = readFileSync(DIR + 'stack-forge.js', 'utf8');
const html = readFileSync(DIR + 'stack-forge.html', 'utf8');

function blank(s) {
  const a = s.split(''); const n = s.length; let i = 0;
  const kill = (from, to) => { for (let k = from; k < to && k < n; k++) if (a[k] !== '\n') a[k] = ' '; };
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { let e = i; while (e < n && s[e] !== '\n') e++; kill(i, e); i = e; continue; }
    if (c === '/' && d === '*') { let e = i + 2; while (e < n && !(s[e] === '*' && s[e + 1] === '/')) e++; kill(i, e + 2); i = e + 2; continue; }
    if (c === '"' || c === "'") { const q = c; let e = i + 1; while (e < n && s[e] !== q && s[e] !== '\n') { if (s[e] === '\\') e++; e++; } kill(i, e + 1); i = e + 1; continue; }
    if (c === '`') {
      let e = i + 1;
      while (e < n && s[e] !== '`') {
        if (s[e] === '\\') { kill(e, e + 2); e += 2; continue; }
        if (s[e] === '$' && s[e + 1] === '{') { let d2 = 1; kill(e, e + 2); e += 2; while (e < n && d2) { if (s[e] === '{') d2++; else if (s[e] === '}') d2--; e++; } continue; }
        if (s[e] !== '\n') a[e] = ' ';
        e++;
      }
      a[i] = ' '; if (e < n) a[e] = ' '; i = e + 1; continue;
    }
    i++;
  }
  return a.join('');
}
const src = blank(raw);
const NLIDX = []; for (let i = 0; i < src.length; i++) if (src[i] === '\n') NLIDX.push(i);
const lineOf = (idx) => { let lo = 0, hi = NLIDX.length; while (lo < hi) { const m = (lo + hi) >> 1; if (NLIDX[m] < idx) lo = m + 1; else hi = m; } return lo + 1; };

// ── every binding name introduced anywhere ──────────────────────────────────────────────────────
const declared = new Set();
const addName = (t) => {
  const id = String(t).replace(/[{}[\]()]/g, ' ').split('=')[0].split(':').pop().trim().split(/\s+/).pop();
  if (/^[A-Za-z_$][\w$]*$/.test(id)) declared.add(id);
};
for (const m of src.matchAll(/\b(?:const|let|var)\s+([^;\n]+)/g)) m[1].split(',').forEach(addName);
for (const m of src.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
for (const m of src.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
for (const m of src.matchAll(/\(([^()]{0,400})\)\s*(?:=>|\{)/g)) m[1].split(',').forEach(addName);
for (const m of src.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(m[1]);
for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+(?:\[([^\]]*)\]|([A-Za-z_$][\w$]*))/g)) { if (m[1]) m[1].split(',').forEach(addName); if (m[2]) declared.add(m[2]); }

const AMBIENT = new Set(('window document console Math JSON Object Array String Number Boolean Date RegExp Map Set WeakMap WeakSet Promise Symbol Proxy Reflect Error TypeError RangeError ReferenceError SyntaxError EvalError ' +
'parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI btoa atob structuredClone queueMicrotask escape unescape ' +
'setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback ' +
'localStorage sessionStorage indexedDB IDBKeyRange fetch Request Response Headers Blob File FileReader URL URLSearchParams FormData AbortController ' +
'Image ImageData ImageBitmap createImageBitmap OffscreenCanvas Path2D ' +
'Uint8Array Uint8ClampedArray Uint16Array Uint32Array Int8Array Int16Array Int32Array Float32Array Float64Array ArrayBuffer DataView BigInt ' +
'alert confirm prompt navigator location history screen performance crypto getComputedStyle matchMedia ' +
'PIXI module exports require globalThis self undefined NaN Infinity arguments ' +
'Event CustomEvent EventTarget MutationObserver ResizeObserver IntersectionObserver PointerEvent KeyboardEvent MouseEvent WheelEvent DragEvent ' +
'Node Element HTMLElement NodeList DOMParser XMLSerializer Intl TextEncoder TextDecoder').split(/\s+/));
const KEYWORD = new Set(('if else for while do switch case break continue return function class extends new delete typeof instanceof void yield await async try catch finally throw ' +
'in of let const var default export import from as get set static super this true false null debugger with').split(/\s+/));

// ── identifier READS that resolve to nothing ────────────────────────────────────────────────────
const reads = new Map();
for (const m of src.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)/g)) {
  const id = m[2], at = m.index + m[1].length;
  if (KEYWORD.has(id) || AMBIENT.has(id) || declared.has(id)) continue;
  const after = src.slice(at + id.length, at + id.length + 4);
  if (/^\s*:/.test(after)) continue;                 // object-literal key or label
  if (!reads.has(id)) reads.set(id, []);
  reads.get(id).push(lineOf(at));
}
console.log('=== A. IDENTIFIERS READ BUT NEVER BOUND ===');
const undecl = [...reads.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(undecl.length ? undecl.map(([id, l]) => `  ${id.padEnd(22)} ${String(l.length).padStart(3)} read(s)  first at line ${l[0]}`).join('\n') : '  none');

// ── functions never referenced ──────────────────────────────────────────────────────────────────
const fns = new Map();
for (const m of src.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) if (!fns.has(m[1])) fns.set(m[1], lineOf(m.index));
for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]{0,300}\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) if (!fns.has(m[1])) fns.set(m[1], lineOf(m.index));
const deadFns = [];
for (const [name, line] of fns) {
  const uses = [...src.matchAll(new RegExp(`(^|[^.\\w$])${name.replace(/\$/g, '\\$')}\\b`, 'g'))].length;
  if (uses <= 1) deadFns.push(`  ${name.padEnd(26)} line ${line}`);
}
console.log('\n=== B. FUNCTIONS WITH NO CALL SITE ===');
console.log(deadFns.length ? deadFns.join('\n') : '  none');

// ── an object property assigned more than one shape ─────────────────────────────────────────────
const props = new Map();
for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)\s*=\s*([^=;\n][^;\n]{0,60})/g)) {
  const key = m[1] + '.' + m[2];
  const v = m[3].trim();
  const shape = /^\{/.test(v) ? 'object' : /^\[/.test(v) ? 'array' : /^(null|undefined)\b/.test(v) ? 'null' : /^(true|false)\b/.test(v) ? 'bool' : /^-?[\d.]+\s*[;,)]?$/.test(v) ? 'number' : /^new\s/.test(v) ? 'instance' : 'expr';
  if (!props.has(key)) props.set(key, new Map());
  const byShape = props.get(key);
  if (!byShape.has(shape)) byShape.set(shape, lineOf(m.index));
}
console.log('\n=== C. PROPERTIES ASSIGNED MORE THAN ONE SHAPE (type collisions) ===');
let coll = 0;
for (const [key, byShape] of props) {
  const shapes = [...byShape.keys()].filter((s) => s !== 'expr');
  if (shapes.length > 1) { console.log(`  ${key.padEnd(28)} ${shapes.map((s) => `${s}@${byShape.get(s)}`).join('  ')}`); coll++; }
}
if (!coll) console.log('  none');

// ── DOM contract, both directions ───────────────────────────────────────────────────────────────
// DOM ids live INSIDE string literals, which `src` blanks — so these two sections must read a source
// with only COMMENTS removed. Using `src` here reported "none" for every id, which is why this is split.
const srcC = (() => { const a = raw.split(''); const n = raw.length; let i = 0;
  const kill = (f, t) => { for (let k = f; k < t && k < n; k++) if (a[k] !== '\n') a[k] = ' '; };
  while (i < n) { const c = raw[i], d = raw[i + 1];
    if (c === '/' && d === '/') { let e = i; while (e < n && raw[e] !== '\n') e++; kill(i, e); i = e; continue; }
    if (c === '/' && d === '*') { let e = i + 2; while (e < n && !(raw[e] === '*' && raw[e + 1] === '/')) e++; kill(i, e + 2); i = e + 2; continue; }
    i++; }
  return a.join(''); })();
const htmlIds = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
const jsIds = new Map();
for (const m of srcC.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)) if (!jsIds.has(m[1])) jsIds.set(m[1], lineOf(m.index));
for (const m of srcC.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) if (!jsIds.has(m[1])) jsIds.set(m[1], lineOf(m.index));
const missing = [...jsIds.entries()].filter(([id]) => !htmlIds.has(id));
console.log('\n=== D. JS REFERENCES AN ELEMENT THE HTML DOES NOT DEFINE ===');
console.log(missing.length ? missing.map(([id, l]) => `  ${id.padEnd(22)} first read line ${l}`).join('\n') : '  none');

const htmlCtrls = [...html.matchAll(/<(?:button|input|select|textarea)[^>]*id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
const orphan = htmlCtrls.filter((id) => !srcC.includes(`'${id}'`) && !srcC.includes(`"${id}"`));
console.log('\n=== E. INTERACTIVE CONTROLS THE JS NEVER NAMES (may still be reached by computed id) ===');
console.log(orphan.length ? '  ' + orphan.join(', ') : '  none');

// ── persistence surface ─────────────────────────────────────────────────────────────────────────
console.log('\n=== F. STORAGE KEYS ===');
const keys = new Set();
for (const m of raw.matchAll(/(?:localStorage\.(?:get|set|remove)Item\(|idb\.(?:get|put|del)\(\s*)['"`]([^'"`]+)/g)) keys.add(m[1]);
for (const m of raw.matchAll(/['"]([A-Za-z]+:[A-Za-z0-9_:.-]*)['"]\s*\+/g)) keys.add(m[1] + '<id>');
for (const m of raw.matchAll(/\b([A-Z_]*KEY)\s*=\s*'([^']+)'/g)) keys.add(`${m[2]}  (${m[1]})`);
console.log('  ' + [...keys].sort().join('\n  '));

console.log(`\n--- scanned ${raw.length.toLocaleString()} chars · ${NLIDX.length + 1} lines · ${declared.size} bindings · ${fns.size} functions ---`);
