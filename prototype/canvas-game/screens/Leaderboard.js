(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Leaderboard = function (state, config, game) {

  // ---------- palette ----------
  var INK    = "#0d1108";
  var TEXT   = "#e8eef6";
  var DIM    = "#8fa2b8";
  var GOLD   = "#f0c34a";
  var ACCENT = "#57d7e0";
  var MEDALS = ["#f0c34a", "#c8d3e0", "#c98a4b"];

  // ---------- art / roster data ----------
  var AVATARS = [
    "chars_1_chaplain", "chars_2_chaplain", "chars_3_chaplain",
    "chars_1_mother", "chars_2_mother", "chars_3_mother",
    "chars_4_mother", "chars_5_mother", "chars_6_mother",
    "chars_1_tide", "chars_2_tide", "chars_3_tide"
  ];
  var NAMES = [
    "IRONVEIL", "STORMWARDEN", "ASHBRAND", "PALEBANNER",
    "GRIMHOLT", "VANTAGE-9", "REDOUBT", "SABLETIDE",
    "OATHKEEPER", "CINDERMARK", "HALCYON", "BULWARK-PRIME"
  ];
  var FACTIONS = ["CHAPLAIN", "MOTHER", "TIDE"];

  // ---------- navigation resolution (targets come from state.next) ----------
  function candidates() {
    var n = state && state.next, out = [], k;
    if (!n) return out;
    if (typeof n === "string") return [n];
    if (Object.prototype.toString.call(n) === "[object Array]") {
      for (k = 0; k < n.length; k++) if (n[k]) out.push(String(n[k]));
      return out;
    }
    if (typeof n === "object") {
      for (k in n) {
        if (!Object.prototype.hasOwnProperty.call(n, k)) continue;
        if (typeof n[k] === "string" && n[k]) out.push(n[k]);
        else out.push(k);
      }
    }
    return out;
  }
  function goTo(hint, fallbackIdx) {
    var list = candidates(), i, c;
    for (i = 0; i < list.length; i++) {
      c = String(list[i]).toLowerCase();
      if (c.indexOf(hint) !== -1) { R.go(list[i]); return; }
    }
    if (list.length) {
      var idx = Math.min(fallbackIdx || 0, list.length - 1);
      R.go(list[idx]);
    }
  }

  // ---------- deterministic one-time roster (UI-scoped key) ----------
  function buildRows() {
    var rows = [], used = {}, i, ni;
    var score = 98000 + Math.floor(R.rand() * 9000);
    for (i = 0; i < 8; i++) {
      do { ni = Math.floor(R.rand() * NAMES.length); } while (used[ni]);
      used[ni] = 1;
      var fac = FACTIONS[Math.floor(R.rand() * FACTIONS.length)];
      rows.push({
        name: NAMES[ni],
        fac: fac,
        spr: AVATARS[Math.floor(R.rand() * AVATARS.length)],
        score: score,
        waves: 30 - i * 2 - Math.floor(R.rand() * 3),
        you: false
      });
      score -= 3200 + Math.floor(R.rand() * 6200);
      if (score < 500) score = 500 + Math.floor(R.rand() * 400);
    }
    // slot the player's run in if a live score exists in shared state
    var ps = (game && typeof game.score === "number") ? game.score : null;
    if (ps !== null) {
      for (i = 0; i < rows.length; i++) {
        if (ps >= rows[i].score) {
          rows.splice(i, 0, {
            name: "YOU", fac: "PLAYER",
            spr: game.character || game.selectedChar || AVATARS[Math.floor(R.rand() * AVATARS.length)],
            score: ps, waves: Math.max(1, Math.floor(ps / 4000)), you: true
          });
          rows.pop();
          break;
        }
      }
    }
    return rows;
  }
  if (!game.__lbRows) game.__lbRows = buildRows();
  if (typeof game.__lbTick !== "number") game.__lbTick = 0;

  function fmt(n) {
    var s = String(Math.max(0, Math.floor(n || 0))), out = "", c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = "," + out;
    }
    return out;
  }

  // ---------- frame ----------
  return function () {
    game.__lbTick++;
    var t = game.__lbTick;
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var ctx = R.ctx;
    var W = R.W, H = R.H;
    var rows = game.__lbRows;

    // command-console scrim so type reads over any backdrop
    ctx.save();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(6,10,18,0.80)");
    grad.addColorStop(0.5, "rgba(8,13,22,0.62)");
    grad.addColorStop(1, "rgba(4,7,13,0.86)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ---------- header ----------
    var titleFS = Math.max(20, Math.round(H * 0.048));
    var subFS = Math.max(10, Math.round(H * 0.017));
    R.text("LEADERBOARD", W / 2 + 2, H * 0.058 + 2, "bold " + titleFS + "px sans-serif", "rgba(0,0,0,0.7)", "center");
    R.text("LEADERBOARD", W / 2, H * 0.058, "bold " + titleFS + "px sans-serif", GOLD, "center");
    R.text("BULWARK COMMAND \u2014 TOP FIELD MARSHALS", W / 2, H * 0.058 + titleFS * 0.85, subFS + "px sans-serif", DIM, "center");

    // pulsing header rule
    var pulse = 0.5 + 0.5 * Math.sin(t * 0.06);
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.4 * pulse;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H * 0.105);
    ctx.lineTo(W * 0.88, H * 0.105);
    ctx.stroke();
    ctx.restore();

    // ---------- panel geometry ----------
    var btnH = Math.max(44, Math.round(H * 0.062));
    var btnY = H - btnH - Math.round(H * 0.028);
    var pw = Math.min(W * 0.9, 680);
    var px = (W - pw) / 2;
    var py = H * 0.125;
    var ph = btnY - 14 - py;

    ctx.save();
    ctx.fillStyle = "rgba(12,18,30,0.88)";
    R.roundRect(px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,150,190,0.35)";
    ctx.lineWidth = 2;
    R.roundRect(px, py, pw, ph, 14);
    ctx.stroke();
    ctx.restore();

    // ---------- column headers ----------
    var headH = Math.max(24, ph * 0.06);
    var colFS = Math.max(9, Math.round(H * 0.015));
    var padX = pw * 0.035;
    R.text("RANK", px + padX, py + headH * 0.55, "bold " + colFS + "px sans-serif", "#7e93ad", "left");
    R.text("COMMANDER", px + pw * 0.30, py + headH * 0.55, "bold " + colFS + "px sans-serif", "#7e93ad", "left");
    R.text("SCORE", px + pw - padX, py + headH * 0.55, "bold " + colFS + "px sans-serif", "#7e93ad", "right");

    ctx.save();
    ctx.strokeStyle = "rgba(120,150,190,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + padX * 0.5, py + headH);
    ctx.lineTo(px + pw - padX * 0.5, py + headH);
    ctx.stroke();
    ctx.restore();

    // ---------- rows ----------
    var stripH = Math.max(26, ph * 0.075); // "your best" strip at panel bottom
    var listTop = py + headH + 4;
    var listH = ph - headH - stripH - 14;
    var rowH = listH / rows.length;
    var nameFS = Math.max(11, Math.round(rowH * 0.30));
    var facFS = Math.max(9, Math.round(rowH * 0.20));
    var scoreFS = Math.max(12, Math.round(rowH * 0.32));
    var topScore = rows[0].score || 1;

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ry = listTop + i * rowH;
      var cy = ry + rowH / 2;

      // row background
      ctx.save();
      if (r.you) {
        ctx.fillStyle = "rgba(87,215,224,0.16)";
      } else if (i === 0) {
        ctx.fillStyle = "rgba(240,195,74," + (0.12 + 0.08 * pulse).toFixed(3) + ")";
      } else {
        ctx.fillStyle = (i % 2 === 0) ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.015)";
      }
      R.roundRect(px + padX * 0.5, ry + 2, pw - padX, rowH - 4, 8);
      ctx.fill();
      if (r.you) {
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        R.roundRect(px + padX * 0.5, ry + 2, pw - padX, rowH - 4, 8);
        ctx.stroke();
      }
      ctx.restore();

      // rank medal / number
      var medR = Math.min(rowH * 0.30, 15);
      var medX = px + padX + medR;
      ctx.save();
      if (i < 3) {
        ctx.fillStyle = MEDALS[i];
        ctx.beginPath();
        ctx.arc(medX, cy, medR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (i === 0) {
          ctx.globalAlpha = 0.25 + 0.3 * pulse;
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(medX, cy, medR + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        R.text(String(i + 1), medX, cy, "bold " + Math.round(medR * 1.1) + "px sans-serif", "#1a1408", "center");
      } else {
        ctx.restore();
        R.text(String(i + 1), medX, cy, "bold " + Math.round(medR * 1.1) + "px sans-serif", DIM, "center");
      }

      // avatar sprite in framed slot (character art in the leaderboard)
      var avS = rowH - 10;
      var avX = px + pw * 0.135;
      var avY = ry + 5;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      R.roundRect(avX, avY, avS, avS, 6);
      ctx.fill();
      ctx.beginPath();
      R.roundRect(avX, avY, avS, avS, 6);
      ctx.clip();
      R.drawSpr(r.spr, avX, avY, avS, avS);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = r.you ? ACCENT : (i === 0 ? "rgba(240,195,74,0.8)" : "rgba(120,150,190,0.5)");
      ctx.lineWidth = 1.5;
      R.roundRect(avX, avY, avS, avS, 6);
      ctx.stroke();
      ctx.restore();

      // name + faction/wave line
      var nameX = px + pw * 0.30;
      R.text(r.name, nameX, cy - rowH * 0.16,
        "bold " + nameFS + "px sans-serif",
        r.you ? ACCENT : (i === 0 ? "#ffe9a8" : TEXT), "left");
      R.text(r.fac + " \u00B7 WAVE " + r.waves, nameX, cy + rowH * 0.20, facFS + "px sans-serif", DIM, "left");

      // score bar (relative to top score)
      var barW = pw * 0.16;
      var barX = px + pw * 0.60;
      var barH = Math.max(4, rowH * 0.12);
      var frac = Math.max(0.06, Math.min(1, r.score / topScore));
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      R.roundRect(barX, cy - barH / 2, barW, barH, barH / 2);
      ctx.fill();
      ctx.fillStyle = r.you ? ACCENT : (i < 3 ? MEDALS[i] : "#4f7fae");
      R.roundRect(barX, cy - barH / 2, barW * frac, barH, barH / 2);
      ctx.fill();
      ctx.restore();

      // score value
      R.text(fmt(r.score), px + pw - padX, cy,
        "bold " + scoreFS + "px sans-serif",
        r.you ? ACCENT : (i === 0 ? GOLD : "#d7e2ef"), "right");
    }

    // ---------- "your best" strip pinned inside panel bottom ----------
    var youY = py + ph - stripH - 6;
    ctx.save();
    ctx.fillStyle = "rgba(34,42,54,0.92)";
    R.roundRect(px + padX * 0.5, youY, pw - padX, stripH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(87,215,224,0.35)";
    ctx.lineWidth = 1;
    R.roundRect(px + padX * 0.5, youY, pw - padX, stripH, 6);
    ctx.stroke();
    ctx.restore();
    R.text("YOUR BEST", px + padX + 6, youY + stripH * 0.62, "bold " + Math.max(10, colFS) + "px sans-serif", ACCENT, "left");
    R.text(fmt(game.score || game.bestScore || 0), px + pw - padX - 6, youY + stripH * 0.62, "bold " + Math.max(13, colFS + 4) + "px sans-serif", TEXT, "right");

    // ---------- controls (the ONLY interactive elements) ----------
    var gap = Math.min(W * 0.04, 20);
    var bw = Math.min(260, (pw - gap) / 2);
    var totalBW = bw * 2 + gap;
    var bx = (W - totalBW) / 2;

    R.addBtn(bx, btnY, bw, btnH, "CHOOSE CHARACTER", function () {
      goTo("char", 0);
    }, { primary: true, bg: GOLD, color: INK });

    R.addBtn(bx + bw + gap, btnY, bw, btnH, "GO TO MENU", function () {
      goTo("menu", 0);
    }, { bg: "#232c3a", color: TEXT });

    R.drawBtns();
  };
};
})();