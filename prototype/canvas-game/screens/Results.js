(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Results = function (state, config, game) {
  var UI_KEY = "ui_results_v1";

  // Full roster of staged character art — hero portrait is drawn from here.
  var HERO_ART = [
    "chars_6_mother", "chars_5_mother", "chars_4_mother",
    "chars_3_mother", "chars_2_mother", "chars_1_mother",
    "chars_3_chaplain", "chars_2_chaplain", "chars_1_chaplain"
  ];
  var TIDE_ART = ["chars_1_tide", "chars_2_tide", "chars_3_tide"];

  // ---- navigation: RETURN to MENU -> scr_ab5f1vj via state.next ----
  function resolveMenuTarget() {
    var n = state && state.next;
    if (!n) return "scr_ab5f1vj";
    if (typeof n === "string") return n;
    if (Object.prototype.toString.call(n) === "[object Array]") {
      for (var a = 0; a < n.length; a++) {
        var e = n[a];
        if (e === "scr_ab5f1vj" || (e && e.target === "scr_ab5f1vj")) {
          return e.target || e;
        }
      }
      return n.length ? (n[0] && n[0].target ? n[0].target : n[0]) : "scr_ab5f1vj";
    }
    if (typeof n === "object") {
      var keys = [], k;
      for (k in n) { if (Object.prototype.hasOwnProperty.call(n, k)) keys.push(k); }
      for (var i = 0; i < keys.length; i++) {
        var v = n[keys[i]];
        if (v === "scr_ab5f1vj") return v;
        if (/menu/i.test(keys[i]) || /menu/i.test(String(v))) {
          return typeof v === "string" ? v : keys[i];
        }
      }
      if (keys.length) {
        var f = n[keys[0]];
        return typeof f === "string" ? f : keys[0];
      }
    }
    return "scr_ab5f1vj";
  }

  // ---- deterministic summary data (reads shared battle state; R.rand fallback) ----
  function initUI() {
    if (game[UI_KEY]) return game[UI_KEY];
    var wave = (typeof game.wave === "number" && game.wave > 0)
      ? Math.floor(game.wave) : (3 + Math.floor(R.rand() * 7));
    var score = (typeof game.score === "number") ? game.score : null;
    var bounty = (typeof game.bounties === "number") ? Math.max(0, Math.floor(game.bounties))
      : (score !== null ? Math.max(0, Math.floor(score))
        : 600 + Math.floor(R.rand() * 1800));
    bounty = Math.floor(bounty / 5) * 5;
    var captures = (typeof game.captures === "number") ? Math.max(0, Math.floor(game.captures))
      : 1 + Math.floor(R.rand() * 4);
    var unlocks = (typeof game.storyUnlocks === "number") ? Math.max(0, Math.floor(game.storyUnlocks))
      : (R.rand() < 0.6 ? 1 : (R.rand() < 0.5 ? 2 : 0));
    var repelled = 8 + wave * 3 + Math.floor(R.rand() * 10);

    var total = (score !== null) ? Math.floor(score)
      : (bounty + captures * 250 + unlocks * 500 + wave * 100);

    var rank, rankColor;
    if (total >= 1500)      { rank = "S"; rankColor = "#ffd76a"; }
    else if (total >= 1000) { rank = "A"; rankColor = "#9fe08a"; }
    else if (total >= 600)  { rank = "B"; rankColor = "#8fd3ff"; }
    else                    { rank = "C"; rankColor = "#c9c9c9"; }

    var ui = {
      t: 0,
      wave: wave,
      hero: HERO_ART[Math.floor(R.rand() * HERO_ART.length)],
      rows: [
        { label: "BOUNTIES COLLECTED", value: bounty,   suffix: " g", color: "#f4c04a" },
        { label: "TIDE REPELLED",      value: repelled, suffix: "",   color: "#8fd3ff" },
        { label: "CAPTURES SECURED",   value: captures, suffix: "",   color: "#9fe08a" },
        { label: "STORY UNLOCKS",      value: unlocks,  suffix: "",   color: "#d9a6ff" }
      ],
      total: total,
      rank: rank,
      rankColor: rankColor,
      dispTotal: 0
    };
    game[UI_KEY] = ui;
    return ui;
  }

  function fmt(n) {
    var s = String(Math.max(0, Math.floor(n))), out = "", c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = "," + out;
    }
    return out;
  }

  function easeOut(u) {
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    return 1 - Math.pow(1 - u, 3);
  }

  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var ui = initUI();
    ui.t++;

    var ctx = R.ctx;
    var W = R.W, H = R.H;

    // ---- dim scrim so the summary owns the eye ----
    ctx.save();
    ctx.fillStyle = "rgba(6,10,16,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ---- panel geometry ----
    var pw = Math.min(W * 0.9, 620);
    var ph = Math.min(H * 0.86, 470);
    var px = (W - pw) / 2;
    var py = (H - ph) / 2;
    var pad = Math.max(14, pw * 0.035);

    var enter = easeOut(ui.t / 18);
    var slide = (1 - enter) * 26;

    ctx.save();
    ctx.globalAlpha = enter;
    ctx.translate(0, slide);

    // ---- panel body ----
    ctx.fillStyle = "rgba(14,20,28,0.92)";
    R.roundRect(px, py, pw, ph, 12);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f4c04a";
    R.roundRect(px, py, pw, ph, 12);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(244,192,74,0.25)";
    R.roundRect(px + 5, py + 5, pw - 10, ph - 10, 9);
    ctx.stroke();

    // HUD corner brackets
    var cb = 16, off = 7;
    function corner(x, y, dx, dy) {
      ctx.strokeStyle = "#d9a441";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + dx * cb, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * cb);
      ctx.stroke();
    }
    corner(px - off, py - off, 1, 1);
    corner(px + pw + off, py - off, -1, 1);
    corner(px - off, py + ph + off, 1, -1);
    corner(px + pw + off, py + ph + off, -1, -1);

    // ---- header band ----
    var headH = Math.max(56, ph * 0.15);
    ctx.fillStyle = "rgba(244,192,74,0.10)";
    R.roundRect(px + 6, py + 6, pw - 12, headH, 8);
    ctx.fill();

    var titleFont = "bold " + Math.round(Math.min(32, pw * 0.06)) + "px monospace";
    R.text("RESULTS", W / 2, py + 8 + headH * 0.42, titleFont, "#f4c04a", "center");

    var pulse = 0.65 + 0.35 * Math.sin(ui.t * 0.09);
    R.text(
      "WAVE " + ui.wave + " CLEARED \u2014 THE BULWARK HOLDS",
      W / 2, py + 8 + headH * 0.78,
      Math.round(Math.min(14, pw * 0.028)) + "px monospace",
      "rgba(143,211,255," + pulse.toFixed(2) + ")",
      "center"
    );

    // divider under header
    ctx.strokeStyle = "rgba(217,164,65,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 20, py + headH + 10);
    ctx.lineTo(px + pw - 20, py + headH + 10);
    ctx.stroke();

    // ---- hero portrait (left column) ----
    var bodyTop = py + headH + pad + 8;
    var portW = Math.min(140, pw * 0.26);
    var portH = portW * 1.26;
    var portX = px + pad;
    var portY = bodyTop;

    ctx.fillStyle = "rgba(8,12,18,0.9)";
    R.roundRect(portX, portY, portW, portH, 8);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(143,211,255,0.6)";
    R.roundRect(portX, portY, portW, portH, 8);
    ctx.stroke();

    R.drawSpr(ui.hero, portX + portW * 0.08, portY + portH * 0.06, portW * 0.84, portH * 0.76);

    ctx.fillStyle = "rgba(244,192,74,0.14)";
    ctx.fillRect(portX + 4, portY + portH - 22, portW - 8, 18);
    R.text("FIELD COMMAND", portX + portW / 2, portY + portH - 13,
      "bold 10px monospace", "#f4c04a", "center");

    // rank emblem below portrait
    var rp = easeOut((ui.t - 60) / 30);
    if (rp > 0) {
      var rx = portX + portW / 2;
      var ry = portY + portH + 34;
      var rr = 22 * (0.6 + 0.4 * rp);
      ctx.save();
      ctx.globalAlpha = enter * rp;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14,20,28,0.9)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ui.rankColor;
      ctx.stroke();
      R.text(ui.rank, rx, ry + 1, "bold 24px monospace", ui.rankColor, "center");
      R.text("FIELD RATING", rx, ry + rr + 12, "9px monospace", "#8a99a8", "center");
      ctx.restore();
    }

    // ---- stat rows (right column, staggered count-up) ----
    var colX = portX + portW + pad;
    var colW = px + pw - pad - colX;
    var rowH = Math.min(42, portH / ui.rows.length);
    var labelFont = Math.round(Math.min(13, pw * 0.026)) + "px monospace";
    var valFont = "bold " + Math.round(Math.min(19, pw * 0.036)) + "px monospace";

    for (var i = 0; i < ui.rows.length; i++) {
      var row = ui.rows[i];
      var ry2 = bodyTop + i * rowH;
      var delay = 12 + i * 12;
      var prog = easeOut((ui.t - delay) / 36);
      var shown = Math.floor(row.value * prog);

      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      R.roundRect(colX, ry2 + 3, colW, rowH - 6, 6);
      ctx.fill();

      ctx.fillStyle = row.color;
      ctx.fillRect(colX + 8, ry2 + rowH * 0.3, 4, rowH * 0.4);

      ctx.save();
      ctx.globalAlpha = enter * Math.max(prog, 0.25);
      R.text(row.label, colX + 20, ry2 + rowH / 2, labelFont, "#c8d4e0", "left");
      R.text(fmt(shown) + row.suffix, colX + colW - 12, ry2 + rowH / 2, valFont, row.color, "right");
      ctx.restore();
    }

    // ---- total band ----
    var totY = bodyTop + ui.rows.length * rowH + 10;
    var totDelay = 12 + ui.rows.length * 12 + 8;
    var totP = easeOut((ui.t - totDelay) / 36);
    ui.dispTotal = Math.floor(ui.total * totP);

    ctx.fillStyle = "rgba(242,193,78,0.12)";
    R.roundRect(colX, totY, colW, 46, 8);
    ctx.fill();
    ctx.strokeStyle = "#f4c04a";
    ctx.lineWidth = 1.5;
    R.roundRect(colX, totY, colW, 46, 8);
    ctx.stroke();

    R.text("TOTAL SCORE", colX + 14, totY + 23, "bold 13px monospace", "#f4c04a", "left");
    R.text(fmt(ui.dispTotal), colX + colW - 14, totY + 23, "bold 24px monospace", "#ffd76a", "right");

    // ---- repelled-tide strip (decorative art row) ----
    var stripY = Math.max(portY + portH + 62, totY + 56);
    var stripH = Math.min(58, ph * 0.14);
    var stripBottomLimit = py + ph - 86;
    if (stripY + stripH > stripBottomLimit) stripY = stripBottomLimit - stripH;

    ctx.fillStyle = "rgba(8,12,18,0.75)";
    R.roundRect(px + pad, stripY, pw - pad * 2, stripH, 8);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    R.roundRect(px + pad, stripY, pw - pad * 2, stripH, 8);
    ctx.stroke();

    R.text("THE TIDE, TURNED BACK:", px + pad + 12, stripY + stripH / 2,
      labelFont, "#8fa0b4", "left");

    var sprS = stripH * 0.7;
    var sprBaseX = px + pw - pad - 12 - TIDE_ART.length * (sprS + 8);
    for (var s = 0; s < TIDE_ART.length; s++) {
      var sx = sprBaseX + s * (sprS + 8);
      var bob = Math.sin(ui.t * 0.07 + s * 1.4) * 2;
      ctx.save();
      ctx.globalAlpha = enter * 0.9;
      R.drawSpr(TIDE_ART[s], sx, stripY + (stripH - sprS) / 2 + bob, sprS, sprS);
      ctx.restore();
      // struck-through: defeated
      ctx.strokeStyle = "rgba(244,90,74,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 3, stripY + stripH - 8);
      ctx.lineTo(sx + sprS - 3, stripY + 8);
      ctx.stroke();
    }

    ctx.restore(); // end panel transform/alpha

    // ---- sole control: RETURN to MENU (always enabled) ----
    var bw = Math.min(300, pw * 0.55);
    var bh = 50;
    var bx = (W - bw) / 2;
    var by = py + ph - bh - pad * 0.9 + slide;

    // pulsing focus ring so the single CTA is unmistakable (frame-driven, deterministic)
    var cta = 0.5 + 0.5 * Math.sin(ui.t * 0.08);
    ctx.save();
    ctx.strokeStyle = "rgba(242,193,78," + (0.25 + 0.45 * cta).toFixed(3) + ")";
    ctx.lineWidth = 3;
    R.roundRect(bx - 6, by - 6, bw + 12, bh + 12, 12);
    ctx.stroke();
    ctx.restore();

    var target = resolveMenuTarget();
    R.addBtn(bx, by, bw, bh, "RETURN to MENU", function () {
      game[UI_KEY] = null; // reset count-up for next visit
      R.go(target);
    }, { primary: true });

    R.drawBtns();
  };
};
})();