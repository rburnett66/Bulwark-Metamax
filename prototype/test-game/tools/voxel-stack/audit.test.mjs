// The audit, as a GATE. Dead code and undeclared globals are not style problems here — both have
// already cost real debugging time in this tool:
//   RES_MAX was read twice and declared nowhere, so every geometry-box drag threw before it could draw.
//   Five edit tools wrote to a store nothing read, so Clear layer and both Mirrors silently did nothing.
// This test fails the moment either class reappears.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const raw = readFileSync(DIR + 'stack-forge.js', 'utf8');
const html = readFileSync(DIR + 'stack-forge.html', 'utf8');

// Length-preserving blank-out: comments and string literals become spaces, newlines kept, so an index
// into the result is the same index in the original AND no claim inside a comment counts as a reference.
function blank(s) {
  const a = s.split(''); const n = s.length; let i = 0;
  const kill = (f, t) => { for (let k = f; k < t && k < n; k++) if (a[k] !== '\n') a[k] = ' '; };
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
const lineOf = (i) => src.slice(0, i).split('\n').length;

test('no function is declared without a call site', () => {
  const fns = new Map();
  for (const m of src.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) if (!fns.has(m[1])) fns.set(m[1], lineOf(m.index));
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]{0,300}\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))
    if (!fns.has(m[1])) fns.set(m[1], lineOf(m.index));
  const dead = [];
  for (const [name, line] of fns) {
    const uses = [...src.matchAll(new RegExp(`(^|[^.\\w$])${name.replace(/\$/g, '\\$')}\\b`, 'g'))].length;
    if (uses <= 1) dead.push(`${name} (line ${line})`);
  }
  // `$` is the DOM helper and boot entry points are called from HTML, not from here.
  const EXEMPT = new Set(['$']);
  const real = dead.filter((d) => !EXEMPT.has(d.split(' ')[0]));
  assert.deepEqual(real, [], `dead code — declared and never called:\n  ${real.join('\n  ')}`);
});

test('every element the JS reaches for exists in the HTML', () => {
  // A handler bound to a missing element throws at load and silently kills every listener after it.
  const srcC = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const ids = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
  const missing = new Set();
  for (const m of srcC.matchAll(/\$\('([A-Za-z0-9_-]+)'\)\s*\.\s*(?:onclick|oninput|onchange|onkeydown)\s*=/g))
    if (!ids.has(m[1])) missing.add(m[1]);
  assert.deepEqual([...missing], [], `handler bound to an element the HTML does not define: ${[...missing].join(', ')}`);
});

test('the tested cores are actually loaded by the page', () => {
  // carve.js, select.js and palette.js carry the tested cores. If the page does not load them, those
  // tests guard nothing — palette.js in particular was written, committed and left unloaded for a week.
  assert.match(html, /<script src="carve\.js">/, 'stack-forge.html must load carve.js');
  assert.match(html, /<script src="select\.js">/, 'stack-forge.html must load select.js');
  assert.match(html, /<script src="palette\.js">/, 'stack-forge.html must load palette.js');
  assert.match(html, /<script src="\.\.\/\.\.\/src\/data\/factions\.js">/, 'stack-forge.html must load the faction registry');
  const iCarve = html.indexOf('carve.js'), iMain = html.indexOf('stack-forge.js"');
  assert.ok(iCarve < iMain, 'carve.js must load BEFORE stack-forge.js');
});

test('the front facing agrees with itself', () => {
  // The carve indexes a front mask by (y - oy). AX.front must map grid column -> the SAME world y, or an
  // asymmetric front elevation carves on one side and draws on the other.
  const m = src.match(/front:\s*\{[^\n]*toVox:\s*\(c, r, s\) => (\[[^\]]*\])/);
  assert.ok(m, 'AX.front not found');
  const toVox = new Function('c', 'r', 's', 'foot', 'layers', `return ${m[1]};`);
  const foot = 16, layers = 16;
  for (let y = 0; y < foot; y++) {
    let col = -1;
    for (let c = 0; c < foot; c++) if (toVox(c, 0, 0, foot, layers)[1] === y) { col = c; break; }
    assert.equal(col, y, `world y=${y}: the carve uses mask column ${y} but the Front grid draws it at column ${col}`);
  }
});
