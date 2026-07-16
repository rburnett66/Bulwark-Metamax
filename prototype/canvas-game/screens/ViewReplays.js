(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.ViewReplays = function (state, config, game) {

  // ---------- deterministic, factory-time content (no per-frame R.rand flicker) ----------
  var CHAR_SPRITES = [
    'chars_1_mother', 'chars_2_mother', 'chars_3_mother',
    'chars_1_chaplain', 'chars_2_chaplain', 'chars_3_chaplain',
    'chars_1_tide', 'chars_2_tide', 'chars_3_tide',
    'chars_4_mother', 'chars_5_mother', 'chars_6_mother'
  ];
  var SECTORS = [
    'NORDHAV RIDGE', 'ASHFEN DELTA', 'KARST HOLLOW',
    'VELDT CROSSING', 'MIRE OF SALT', 'COLD HARBOR',
    'BRACKEN LINE', 'IRON SHOAL'
  ];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function makeRows() {
    var rows = [];
    var used = {};
    for (var i = 0; i < 6; i++) {
      var sIdx = Math.floor(R.rand() * SECTORS.length);
      var guard = 0;
      while (used[sIdx] && guard < 20) { sIdx = (sIdx + 1) % SECTORS.length; guard++; }
      used[sIdx] = true;
      var win = R.rand() < 0.6;
      var mins = 3 + Math.floor(R.rand() * 11);
      var secs = Math.floor(R.rand() * 60);
      rows.push({
        id: 'RB-' + (1000 + Math.floor(R.rand() * 9000)),
        sector: SECTORS[sIdx],
        wave: 1 + Math.floor(R.rand() * 12),
        result: win ? 'VICTORY' : 'DEFEAT',
        win: win,
        time: mins + ':' + pad2(secs),
        spr: CHAR_SPRITES[Math.floor(R.rand() * CHAR_SPRITES.length)]
      });
    }
    rows.sort(function (a, b) { return b.wave - a.wave; });
    return rows;
  }

  // UI-scoped cache on shared state so re-entry keeps the same log
  if (!game.ui_viewreplays_rows) game.ui_viewreplays_rows = makeRows();
  var ROWS = game.ui_viewreplays_rows;

  // ---------- robust navigation resolution (targets come from state.next) ----------
  var FALLBACK = 'scr_ab5f1vj';

  function norm(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function candidatePairs() {
    var next = state && state.next;
    var pairs = [];
    var i, k;
    if (!next) return pairs;
    if (typeof next === 'string') {
      pairs.push({ label: next, target: next });
      return pairs;
    }
    if (Object.prototype.toString.call(next) === '[object Array]') {
      for (i = 0; i < next.length; i++) {
        var it = next[i];
        if (typeof it === 'string') {
          pairs.push({ label: it, target: it });
        } else if (it && typeof it === 'object') {
          var lbl = it.label || it.name || it.id || it.target || '';
          var tgt = it.target || it.to || it.id || it.screen || it.name || lbl;
          if (tgt) pairs.push({ label: String(lbl), target: String(tgt) });
        }
      }
      return pairs;
    }
    if (typeof next === 'object') {
      for (k in next) {
        if (Object.prototype.hasOwnProperty.call(next, k)) {
          var v = next[k];
          if (typeof v === 'string') pairs.push({ label: k, target: v });
          else if (v && typeof v === 'object') {
            var t2 = v.target || v.to || v.id || v.screen || v.name || k;
            pairs.push({ label: k, target: String(t2) });
          } else pairs.push({ label: k, target: k });
        }
      }
    }
    return pairs;
  }

  function resolveTarget(keywords) {
    var pairs = candidatePairs();
    var i, j;
    for (j = 0; j < keywords.length; j++) {
      var kw = norm(keywords[j]);
      if (!kw) continue;
      for (i = 0; i < pairs.length; i++) {
        if (norm(pairs[i].label).indexOf(kw) !== -1 || norm(pairs[i].target).indexOf(kw) !== -1) {
          return pairs[i].target;
        }
      }
    }
    if (pairs.length > 0) return pairs[0].target;
    return FALLBACK;
  }

  function nav(keywords) {
    return function () {
      var t = resolveTarget(keywords);
      R.go(t || FALLBACK);
    };
  }

  var NAV_ITEMS = [
    { label: 'CHOOSE CHARACTER', primary: false, go: nav(['CHOOSECHARACTER', 'CHARACTER', 'CHOOSE']) },
    { label: 'PLAY',             primary: true,  go: nav(['PLAY', 'GAME', 'BATTLE']) },
    { label: 'STORE',            primary: false, go: nav(['STORE', 'SHOP']) },
    { label: 'INVENTORY',        primary: false, go: nav(['INVENTORY', 'ITEMS']) },
    { label: 'SETTINGS',         primary: false, go: nav(['SETTINGS', 'OPTIONS']) },
    { label: 'LEADERBOARD',      primary: false, go: nav(['LEADERBOARD', 'RANK', 'SCORES']) }
  ];

  // ---------- palette (BULWARK: cold steel + amber signal accent) ----------
  var COL = {
    scrim:      'rgba(5,9,13,0.60)',
    panel:      'rgba(10,16,22,0.88)',
    panelEdge:  'rgba(120,150,175,0.45)',
    stripe:     'rgba(255,255,255,0.035)',
    header:     'rgba(140,170,195,0.95)',
    rule:       'rgba(140,170,195,0.35)',
    ink:        '#e8eef2',
    dim:        '#9db0be',
    faint:      '#6d7f8c',
    amber:      '#f0b429',
    amberDim:   'rgba(240,180,41,0.35)',
    win:        '#5dd39e',
    loss:       '#e05252',
    thumb:      'rgba(30,44,56,0.9)'
  };

  function corner(ctx, x, y, dx, dy, s) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * s);
    ctx.stroke();
  }

  // ---------- one frame ----------
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;
    var u = Math.min(W / 960, H / 540);
    var ctx = R.ctx;
    var pad = 28 * u;

    // scrim + vignette for legibility over backdrop
    ctx.save();
    ctx.fillStyle = COL.scrim;
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(0.18, 'rgba(0,0,0,0)');
    g.addColorStop(0.85, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ===== TITLE BLOCK (hierarchy level 1) =====
    var titleY = pad + 30 * u;
    R.text('VIEW REPLAYS', pad, titleY, 'bold ' + Math.round(34 * u) + 'px monospace', COL.ink, 'left');
    ctx.save();
    ctx.fillStyle = COL.amber;
    ctx.fillRect(pad, titleY + 12 * u, 210 * u, 3 * u);
    ctx.restore();
    R.text('C19 · DETERMINISTIC BATTLE LOG — ARCHIVED EVENT STREAMS', pad, titleY + 32 * u,
      Math.round(12 * u) + 'px monospace', COL.dim, 'left');

    // ===== LAYOUT COLUMNS =====
    var navW = 252 * u;
    var navX = W - navW - pad;
    var panelX = pad;
    var panelY = titleY + 50 * u;
    var panelW = navX - pad - panelX - 20 * u;
    var panelH = H - panelY - pad - 6 * u;
    if (panelW < 240 * u) panelW = 240 * u;

    // ===== REPLAY LOG PANEL (hierarchy level 2: content) =====
    ctx.save();
    ctx.fillStyle = COL.panel;
    R.roundRect(panelX, panelY, panelW, panelH, 10 * u);
    ctx.fill();
    ctx.strokeStyle = COL.panelEdge;
    ctx.lineWidth = Math.max(1, 1.5 * u);
    R.roundRect(panelX, panelY, panelW, panelH, 10 * u);
    ctx.stroke();
    // amber corner brackets
    ctx.strokeStyle = COL.amber;
    ctx.lineWidth = Math.max(1, 2 * u);
    var cs = 12 * u;
    corner(ctx, panelX + 6 * u, panelY + 6 * u, 1, 1, cs);
    corner(ctx, panelX + panelW - 6 * u, panelY + 6 * u, -1, 1, cs);
    corner(ctx, panelX + 6 * u, panelY + panelH - 6 * u, 1, -1, cs);
    corner(ctx, panelX + panelW - 6 * u, panelY + panelH - 6 * u, -1, -1, cs);
    ctx.restore();

    var innerX = panelX + 16 * u;
    var innerW = panelW - 32 * u;

    // column anchors
    var colThumb  = innerX;
    var colId     = innerX + 46 * u;
    var colSector = innerX + 128 * u;
    var colWave   = innerX + innerW * 0.62;
    var colResult = innerX + innerW * 0.78;
    var colTime   = innerX + innerW;

    // header row
    var headY = panelY + 26 * u;
    var hFont = 'bold ' + Math.round(11 * u) + 'px monospace';
    R.text('REPLAY',  colId,     headY, hFont, COL.header, 'left');
    R.text('SECTOR',  colSector, headY, hFont, COL.header, 'left');
    R.text('WAVE',    colWave,   headY, hFont, COL.header, 'center');
    R.text('RESULT',  colResult, headY, hFont, COL.header, 'center');
    R.text('TIME',    colTime,   headY, hFont, COL.header, 'right');

    ctx.save();
    ctx.strokeStyle = COL.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, headY + 10 * u);
    ctx.lineTo(innerX + innerW, headY + 10 * u);
    ctx.stroke();
    ctx.restore();

    // rows
    var rowsTop = headY + 18 * u;
    var footerH = 34 * u;
    var rowH = (panelH - (rowsTop - panelY) - footerH) / ROWS.length;
    if (rowH > 58 * u) rowH = 58 * u;
    if (rowH < 30 * u) rowH = 30 * u;

    var rFont = Math.round(13 * u) + 'px monospace';
    var rBold = 'bold ' + Math.round(13 * u) + 'px monospace';
    var i, row, ry, cy;
    for (i = 0; i < ROWS.length; i++) {
      row = ROWS[i];
      ry = rowsTop + i * rowH;
      cy = ry + rowH / 2 + 4 * u;

      if (i % 2 === 0) {
        ctx.save();
        ctx.fillStyle = COL.stripe;
        ctx.fillRect(innerX - 6 * u, ry, innerW + 12 * u, rowH);
        ctx.restore();
      }

      // hero thumbnail with frame
      var ts = Math.min(rowH - 8 * u, 36 * u);
      var ty = ry + (rowH - ts) / 2;
      ctx.save();
      ctx.fillStyle = COL.thumb;
      R.roundRect(colThumb, ty, ts, ts, 4 * u);
      ctx.fill();
      ctx.strokeStyle = COL.amberDim;
      ctx.lineWidth = 1;
      R.roundRect(colThumb, ty, ts, ts, 4 * u);
      ctx.stroke();
      ctx.restore();
      R.drawSpr(row.spr, colThumb + 2 * u, ty + 2 * u, ts - 4 * u, ts - 4 * u);

      R.text(row.id,         colId,     cy, rBold, COL.ink,  'left');
      R.text(row.sector,     colSector, cy, rFont, COL.dim,  'left');
      R.text('W' + row.wave, colWave,   cy, rFont, COL.ink,  'center');
      R.text(row.result,     colResult, cy, rBold, row.win ? COL.win : COL.loss, 'center');
      R.text(row.time,       colTime,   cy, rFont, COL.dim,  'right');
    }

    // determinism footnote (hierarchy level 4: fine print)
    R.text('REPLAYS REPRODUCE IDENTICAL OUTCOMES FROM THE EVENT STREAM — GDD §18',
      panelX + panelW / 2, panelY + panelH - 12 * u,
      Math.round(10 * u) + 'px monospace', COL.faint, 'center');

    // ===== COMMAND NAV COLUMN (hierarchy level 3: actions; PLAY is primary) =====
    var navHeadY = panelY + 14 * u;
    R.text('COMMAND', navX + navW / 2, navHeadY,
      'bold ' + Math.round(13 * u) + 'px monospace', COL.header, 'center');
    ctx.save();
    ctx.strokeStyle = COL.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(navX, navHeadY + 10 * u);
    ctx.lineTo(navX + navW, navHeadY + 10 * u);
    ctx.stroke();
    ctx.restore();

    var btnH = 44 * u;
    var gap = 13 * u;
    var by = navHeadY + 24 * u;
    var j, item;
    for (j = 0; j < NAV_ITEMS.length; j++) {
      item = NAV_ITEMS[j];

      if (item.primary) {
        // amber emphasis glow + edge behind the primary action
        ctx.save();
        ctx.fillStyle = 'rgba(240,180,41,0.14)';
        R.roundRect(navX - 4 * u, by - 4 * u, navW + 8 * u, btnH + 8 * u, 8 * u);
        ctx.fill();
        ctx.strokeStyle = COL.amber;
        ctx.lineWidth = Math.max(1, 1.5 * u);
        R.roundRect(navX - 4 * u, by - 4 * u, navW + 8 * u, btnH + 8 * u, 8 * u);
        ctx.stroke();
        ctx.restore();
      }

      R.addBtn(navX, by, navW, btnH, item.label, item.go, {
        enabled: true,
        primary: item.primary
      });

      by += btnH + gap;
    }

    R.drawBtns();
  };
};
})();