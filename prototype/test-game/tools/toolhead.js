/**
 * toolhead — the one header every Bulwark tool wears.
 *
 * WHY. Eight tool pages, zero <header> elements, and eight different ad-hoc <h1>s — Stack Forge's said
 * "UNIT SET", which is a panel title, not the tool. There was no way to move between tools without
 * editing the URL, and no consistent place for file actions, so each page invented its own.
 *
 * WHAT IT GUARANTEES
 *   - Every page states WHICH TOOL you are in, in the same place, in the same style.
 *   - Every page can reach every other tool. Paths are resolved from the page's own depth, so a tool
 *     nested under tools/ links correctly without hardcoding ../../.
 *   - File actions live in one strip with one visual language. A tool declares what it can do; it does
 *     not lay out its own toolbar.
 *   - A live status slot, so "which store did that write" has a fixed home instead of one of eleven
 *     scattered status strings.
 *
 * USAGE
 *   <script src="../toolhead.js"></script>            // path depends on the page's depth
 *   ToolHead.mount({
 *     tool: 'stack-forge',
 *     actions: [{ label: '💾 Save', title: '…', on: () => openSaveModal() }, …],
 *   });
 *   ToolHead.status('WIP ✓ 11:42 · Manifest ✓ 11:40 · Disk ✗ 2 ahead');
 *
 * No framework, no build step, no dependency — the same constraints as the rest of the prototype.
 */
(function (root) {
  'use strict';

  // The tool registry. `at` is repo-relative from prototype/test-game/, resolved per page below.
  const TOOLS = [
    { id: 'index',       name: 'Game',          at: 'index.html',                      glyph: '🎮' },
    { id: 'stack-forge', name: 'Stack Forge',   at: 'tools/voxel-stack/stack-forge.html', glyph: '🧊' },
    { id: 'harness',     name: 'State Harness', at: 'harness.html',                    glyph: '🔧' },
    { id: 'terrain',     name: 'Terrain Forge', at: 'terrain.html',                    glyph: '🌿' },
    { id: 'maplab',      name: 'Map Lab',       at: 'maplab.html',                     glyph: '🗺' },
    { id: 'gallery',     name: 'Gallery',       at: 'gallery.html',                    glyph: '🖼' },
    { id: 'comm',        name: 'Comms',         at: 'comm.html',                       glyph: '📡' },
  ];

  // How deep is this page below prototype/test-game/? Derived from the URL, never hardcoded, so a tool
  // that moves directory does not silently get dead nav links.
  function prefix() {
    const parts = location.pathname.split('/').filter(Boolean);
    const i = parts.lastIndexOf('test-game');
    const depth = i < 0 ? 0 : parts.length - i - 2;      // -1 for the file itself, -1 for test-game
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  const CSS = `
  .th-bar{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:10px;
    padding:6px 12px;background:linear-gradient(#101c29,#0b141d);border-bottom:1px solid #24384f;
    font:12px/1.4 system-ui,sans-serif;color:#c8d8e8}
  .th-mark{font-weight:700;letter-spacing:.5px;color:#f2c869;white-space:nowrap}
  .th-tool{font-weight:600;color:#fff;white-space:nowrap}
  .th-nav{display:flex;gap:2px;margin-left:6px;flex-wrap:wrap}
  .th-nav a{display:inline-block;padding:4px 9px;border-radius:5px;text-decoration:none;
    color:#8fa7bd;border:1px solid transparent;white-space:nowrap}
  .th-nav a:hover{background:#16273a;color:#dbe8f5}
  .th-nav a.on{background:#16354d;color:#8fd0ff;border-color:#2f6f9f;cursor:default}
  .th-acts{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
  .th-acts button{padding:5px 11px;border-radius:5px;border:1px solid #2f6f4a;background:#1d3a2a;
    color:#dbe8f5;font:inherit;cursor:pointer}
  .th-acts button:hover{background:#244a35}
  .th-acts button[disabled]{opacity:.45;cursor:not-allowed}
  .th-acts button.th-ghost{background:#16273a;border-color:#2f4a66}
  .th-acts button.th-ghost:hover{background:#1e3a49}
  .th-status{margin-left:10px;color:#7f9bb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    max-width:38vw;font-variant-numeric:tabular-nums}
  @media (max-width:900px){.th-nav a span{display:none}.th-status{display:none}}
  `;

  let statusEl = null;

  function mount(opts) {
    opts = opts || {};
    const p = prefix();

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const bar = document.createElement('header');
    bar.className = 'th-bar';

    const mark = document.createElement('span');
    mark.className = 'th-mark';
    mark.textContent = 'BULWARK';
    bar.appendChild(mark);

    const me = TOOLS.find((t) => t.id === opts.tool);
    const tool = document.createElement('span');
    tool.className = 'th-tool';
    tool.textContent = me ? `${me.glyph} ${me.name}` : (opts.tool || 'Tool');
    bar.appendChild(tool);

    const nav = document.createElement('nav');
    nav.className = 'th-nav';
    for (const t of TOOLS) {
      const a = document.createElement('a');
      a.textContent = t.glyph + ' ';
      const label = document.createElement('span');
      label.textContent = t.name;
      a.appendChild(label);
      a.title = t.name;
      if (t.id === opts.tool) { a.className = 'on'; a.removeAttribute('href'); }
      else a.href = p + t.at;
      nav.appendChild(a);
    }
    bar.appendChild(nav);

    const acts = document.createElement('div');
    acts.className = 'th-acts';
    for (const a of (opts.actions || [])) {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.title) b.title = a.title;
      if (a.id) b.id = a.id;
      if (a.ghost) b.className = 'th-ghost';
      b.onclick = a.on || null;
      acts.appendChild(b);
    }
    bar.appendChild(acts);

    statusEl = document.createElement('span');
    statusEl.className = 'th-status';
    statusEl.textContent = opts.status || '';
    bar.appendChild(statusEl);

    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  /** the fixed home for "which store did that write" — one writer, one place */
  function status(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = kind === 'bad' ? '#ff6b6b' : kind === 'warn' ? '#e0975f' : kind === 'ok' ? '#57d98a' : '#7f9bb3';
  }

  root.ToolHead = { mount, status, TOOLS, prefix };
})(typeof window !== 'undefined' ? window : globalThis);
