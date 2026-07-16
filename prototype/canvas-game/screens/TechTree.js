(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.TechTree = function (state, config, game) {

  // ---------- static tech data (UI-scoped design content; icons use staged art) ----------
  var TECHS = [
    { id: "u1", branch: 0, tier: 0, req: null, name: "Composite Armor", cost: 100,
      icon: "art_2_rocks", desc: "Layered plating for ground units. Boosts unit survivability against kinetic fire across all shape classes." },
    { id: "u2", branch: 0, tier: 1, req: "u1", name: "AP Munitions", cost: 200,
      icon: "art_3_trees", desc: "Armor-piercing rounds for Troops and Tanks. Greatly improves effectiveness versus Machinery armor." },
    { id: "u3", branch: 0, tier: 2, req: "u2", name: "Heavy Chassis", cost: 350,
      icon: "art_1_tall", desc: "Unlocks reinforced Heavy Tank frames. The pinnacle of the unit research line." },
    { id: "s1", branch: 1, tier: 0, req: null, name: "Radar Array", cost: 100,
      icon: "art_2_ocean", desc: "Ship-mounted radar sweep. Extends vision range and pierces fog of war around the ship." },
    { id: "s2", branch: 1, tier: 1, req: "s1", name: "Hull Plating", cost: 200,
      icon: "art_1_palm", desc: "Reinforced Structure-class hull sections. Hardens the ship against artillery and missile strikes." },
    { id: "s3", branch: 1, tier: 2, req: "s2", name: "Missile Bay", cost: 350,
      icon: "art_4_grass", desc: "Vertical launch Missile-shape ordnance: long range, high EffDPS versus all armor classes." }
  ];
  var BRANCH_NAMES = ["UNIT SYSTEMS", "SHIP SYSTEMS"];

  var byId = {};
  for (var bi = 0; bi < TECHS.length; bi++) byId[TECHS[bi].id] = TECHS[bi];

  // ---------- UI-scoped shared state ----------
  function getUI() {
    if (!game.uiTechTree) {
      var bonus = (typeof game.score === "number" && game.score > 0) ? Math.floor(game.score) : 0;
      game.uiTechTree = { points: 500 + bonus, researched: {}, selected: "u1", msg: "", t: 0 };
    }
    return game.uiTechTree;
  }

  // ---------- helpers ----------
  function isResearched(ui, t) { return !!ui.researched[t.id]; }
  function isUnlocked(ui, t) { return !t.req || !!ui.researched[t.req]; }
  function statusOf(ui, t) {
    if (isResearched(ui, t)) return "done";
    if (!isUnlocked(ui, t)) return "locked";
    return (ui.points >= t.cost) ? "ready" : "poor";
  }
  function countDone(ui) {
    var c = 0;
    for (var j = 0; j < TECHS.length; j++) if (ui.researched[TECHS[j].id]) c++;
    return c;
  }
  function nextTarget() {
    var n = state && state.next;
    if (!n) return null;
    if (typeof n === "string") return n;
    if (Object.prototype.toString.call(n) === "[object Array]") {
      var f = n.length ? n[0] : null;
      if (!f) return null;
      if (typeof f === "string") return f;
      return f.to || f.target || f.name || null;
    }
    for (var k in n) {
      if (Object.prototype.hasOwnProperty.call(n, k)) {
        var v = n[k];
        return (typeof v === "string") ? v : (v && (v.to || v.target || v.name)) || null;
      }
    }
    return null;
  }
  function wrapText(ctx, text, maxW, font) {
    ctx.font = font;
    var words = String(text).split(" "), lines = [], cur = "";
    for (var w = 0; w < words.length; w++) {
      var test = cur ? cur + " " + words[w] : words[w];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[w]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- one frame ----------
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var ui = getUI();
    ui.t = (ui.t || 0) + 1;
    var W = R.W, H = R.H, ctx = R.ctx;
    var pulse = 0.55 + 0.35 * Math.sin(ui.t * 0.09);

    // ---------- readability scrim + tactical grid ----------
    ctx.save();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(6,12,18,0.84)");
    grad.addColorStop(0.5, "rgba(8,16,24,0.70)");
    grad.addColorStop(1, "rgba(4,10,16,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(90,150,180,0.07)";
    ctx.lineWidth = 1;
    var gs = Math.max(36, Math.floor(W / 20)), gx, gy;
    ctx.beginPath();
    for (gx = 0; gx <= W; gx += gs) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
    for (gy = 0; gy <= H; gy += gs) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();
    ctx.restore();

    // ---------- header ----------
    ctx.save();
    ctx.fillStyle = "rgba(10,20,28,0.92)";
    ctx.fillRect(0, 0, W, 56);
    ctx.strokeStyle = "rgba(120,200,230,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(W, 56); ctx.stroke();
    ctx.restore();

    R.text("TECH TREE", W / 2, 27, "bold " + Math.max(18, Math.floor(W / 30)) + "px monospace", "#e8f4fa", "center");
    R.text("DIRECT RESEARCH \u2014 UNITS & SHIP", W / 2, 46, "10px monospace", "rgba(150,200,220,0.78)", "center");

    // R&D points chip (top-right)
    var chipW = 132, chipX = W - chipW - 12, chipY = 12;
    ctx.save();
    ctx.fillStyle = "rgba(20,40,52,0.95)";
    R.roundRect(chipX, chipY, chipW, 30, 8); ctx.fill();
    ctx.strokeStyle = "rgba(120,220,255,0.5)"; ctx.lineWidth = 1.5;
    R.roundRect(chipX, chipY, chipW, 30, 8); ctx.stroke();
    ctx.restore();
    R.text("R&D", chipX + 12, chipY + 20, "bold 11px monospace", "#7fd4ff", "left");
    R.text(String(ui.points), chipX + chipW - 12, chipY + 21, "bold 15px monospace", "#ffe58a", "right");
    R.text(countDone(ui) + " / " + TECHS.length + " researched", chipX + chipW / 2, chipY + 42, "10px monospace", "#7f93ab", "center");

    // back to MENU (transition out via state.next)
    R.addBtn(12, 11, 96, 34, "\u25C0 MENU", function () {
      var tgt = nextTarget();
      if (tgt) R.go(tgt);
    }, { color: "#cfe8ff" });

    // ---------- layout metrics ----------
    var dh = Math.max(104, Math.min(140, Math.floor(H * 0.22)));  // detail panel height
    var panelY = H - dh - 8;
    var y0 = 56 + 34;                                              // first tier top
    var availH = panelY - y0 - 12;
    var gap = Math.floor(availH / 3);
    var s = Math.max(38, Math.min(52, Math.floor(gap * 0.44)));    // icon plaque size
    var colX = [Math.floor(W * 0.28), Math.floor(W * 0.72)];
    var bw = Math.min(176, Math.floor(W * 0.34)), bh = 26;
    var i, t;

    function nodePos(tt) { return { cx: colX[tt.branch], py: y0 + tt.tier * gap }; }

    // branch headers
    for (i = 0; i < 2; i++) {
      R.text(BRANCH_NAMES[i], colX[i], y0 - 16, "bold 13px monospace", "rgba(160,220,245,0.92)", "center");
      ctx.save();
      ctx.strokeStyle = "rgba(120,200,230,0.3)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX[i] - bw / 2, y0 - 8);
      ctx.lineTo(colX[i] + bw / 2, y0 - 8);
      ctx.stroke();
      ctx.restore();
    }

    // tier rail labels
    for (i = 0; i < 3; i++) {
      R.text("T" + (i + 1), Math.max(14, Math.floor(W * 0.035)), y0 + i * gap + s / 2 + 4, "bold 12px monospace", "rgba(140,180,200,0.6)", "left");
    }

    // ---------- connectors (under nodes) ----------
    ctx.save();
    for (i = 0; i < TECHS.length; i++) {
      t = TECHS[i];
      if (!t.req) continue;
      var parent = byId[t.req];
      var pp = nodePos(parent), cp = nodePos(t);
      var x = pp.cx, yA = pp.py + s + bh + 20, yB = cp.py - 6;
      ctx.beginPath();
      ctx.moveTo(x, yA); ctx.lineTo(x, yB);
      if (isResearched(ui, t)) {
        ctx.strokeStyle = "rgba(120,230,150,0.85)"; ctx.setLineDash([]); ctx.lineWidth = 3;
      } else if (isResearched(ui, parent)) {
        ctx.strokeStyle = "rgba(255,210,110," + (0.55 + 0.3 * pulse) + ")"; ctx.setLineDash([]); ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "rgba(130,160,180,0.35)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(x - 5, yB - 6); ctx.lineTo(x, yB); ctx.lineTo(x + 5, yB - 6);
      ctx.stroke();
    }
    ctx.restore();

    // ---------- nodes ----------
    for (i = 0; i < TECHS.length; i++) {
      (function (node) {
        var st = statusOf(ui, node);
        var p = nodePos(node);
        var px = p.cx - s / 2, py = p.py;
        var sel = (ui.selected === node.id);

        ctx.save();
        // selection glow ring
        if (sel) {
          ctx.strokeStyle = "rgba(255,211,92," + (0.55 + 0.4 * pulse) + ")";
          ctx.lineWidth = 3;
          R.roundRect(px - 6, py - 6, s + 12, s + 12, 12); ctx.stroke();
        }
        // "ready" glow — draws the eye to actionable nodes
        if (st === "ready" && !sel) {
          ctx.strokeStyle = "rgba(120,220,140," + (0.3 + 0.35 * pulse) + ")";
          ctx.lineWidth = 2;
          R.roundRect(px - 3, py - 3, s + 6, s + 6, 10); ctx.stroke();
        }
        // plaque
        R.roundRect(px, py, s, s, 9);
        ctx.fillStyle = (st === "done") ? "rgba(24,58,38,0.95)"
          : (st === "ready" || st === "poor") ? "rgba(46,42,20,0.95)" : "rgba(26,32,40,0.92)";
        ctx.fill();
        ctx.strokeStyle = (st === "done") ? "#5fe08a"
          : (st === "ready") ? "#ffd25f"
          : (st === "poor") ? "#c88a4a" : "rgba(120,150,170,0.45)";
        ctx.lineWidth = sel ? 3 : 2;
        ctx.stroke();

        // icon art clipped inside plaque
        ctx.save();
        R.roundRect(px + 4, py + 4, s - 8, s - 8, 6);
        ctx.clip();
        R.drawSpr(node.icon, px + 4, py + 4, s - 8, s - 8);
        if (st === "locked") {
          ctx.fillStyle = "rgba(10,16,22,0.62)";
          ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
        }
        ctx.restore();

        // researched check / lock badge
        if (st === "done") {
          R.text("\u2714", px + s - 8, py + 14, "bold 12px monospace", "#5fe08a", "center");
        } else if (st === "locked") {
          R.text("\uD83D\uDD12", p.cx, py + s / 2 + 4, "12px monospace", "#8ea3b5", "center");
        }
        ctx.restore();

        // name button (select node) below the plaque
        R.addBtn(p.cx - bw / 2, py + s + 4, bw, bh, node.name, function () {
          ui.selected = node.id;
          ui.msg = "";
        }, {
          color: (st === "done") ? "#7ddc8c" : (st === "locked") ? "#6a7a88" : "#e8f4ff",
          font: "11px monospace"
        });

        // status caption (kept clear of button rect)
        var cap, capCol;
        if (st === "done") { cap = "\u2714 RESEARCHED"; capCol = "#7ddc8c"; }
        else if (st === "locked") { cap = "LOCKED \u2014 needs " + byId[node.req].name; capCol = "#66788e"; }
        else if (st === "poor") { cap = node.cost + " R&D \u2014 not enough"; capCol = "#d98a5f"; }
        else { cap = node.cost + " R&D \u2014 ready"; capCol = "#ffd35c"; }
        R.text(cap, p.cx, py + s + bh + 15, "9px monospace", capCol, "center");
      })(TECHS[i]);
    }

    // ---------- detail panel ----------
    var pxp = 10, pw = W - 20;
    ctx.save();
    ctx.fillStyle = "rgba(14,22,34,0.94)";
    R.roundRect(pxp, panelY, pw, dh, 10); ctx.fill();
    ctx.strokeStyle = "#33506f"; ctx.lineWidth = 1.5;
    R.roundRect(pxp, panelY, pw, dh, 10); ctx.stroke();
    ctx.restore();

    var selNode = ui.selected ? byId[ui.selected] : null;
    if (!selNode) {
      R.text("SELECT A TECHNOLOGY", W / 2, panelY + dh / 2 - 6, "bold 15px monospace", "#eaf2ff", "center");
      R.text("Tap any node above to inspect it, then confirm your research here.", W / 2, panelY + dh / 2 + 16, "11px monospace", "#93a9c4", "center");
    } else {
      var st2 = statusOf(ui, selNode);
      var btnW = 150, btnH = 40;
      var textW = pw - btnW - 60;

      // sprite thumb
      ctx.save();
      R.roundRect(pxp + 12, panelY + 12, dh - 24, dh - 24, 8);
      ctx.clip();
      R.drawSpr(selNode.icon, pxp + 12, panelY + 12, dh - 24, dh - 24);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "#33506f"; ctx.lineWidth = 1;
      R.roundRect(pxp + 12, panelY + 12, dh - 24, dh - 24, 8); ctx.stroke();
      ctx.restore();

      var tx = pxp + dh + 2;
      R.text(selNode.name.toUpperCase(), tx, panelY + 26, "bold 15px monospace", "#eaf2ff", "left");
      R.text(BRANCH_NAMES[selNode.branch] + "  \u00B7  TIER " + (selNode.tier + 1) + "  \u00B7  COST " + selNode.cost + " R&D",
        tx, panelY + 43, "10px monospace", "#7fd4ff", "left");

      var lines = wrapText(ctx, selNode.desc, textW - (dh - 10), "11px monospace");
      for (var li = 0; li < lines.length && li < 3; li++) {
        R.text(lines[li], tx, panelY + 60 + li * 14, "11px monospace", "#a9bdd4", "left");
      }

      // action zone (right side)
      var bx2 = pxp + pw - btnW - 14, by2 = panelY + dh / 2 - btnH / 2 - 8;
      if (st2 === "done") {
        R.text("\u2714 RESEARCH COMPLETE", bx2 + btnW / 2, panelY + dh / 2, "bold 12px monospace", "#7ddc8c", "center");
      } else if (st2 === "locked") {
        R.text("LOCKED", bx2 + btnW / 2, panelY + dh / 2 - 8, "bold 12px monospace", "#66788e", "center");
        R.text("Requires " + byId[selNode.req].name, bx2 + btnW / 2, panelY + dh / 2 + 10, "9px monospace", "#66788e", "center");
      } else if (st2 === "poor") {
        R.text("INSUFFICIENT R&D", bx2 + btnW / 2, panelY + dh / 2 - 8, "bold 12px monospace", "#d98a5f", "center");
        R.text("Need " + selNode.cost + " (have " + ui.points + ")", bx2 + btnW / 2, panelY + dh / 2 + 10, "9px monospace", "#d98a5f", "center");
      } else {
        // pulsing frame around the confirm button
        ctx.save();
        ctx.strokeStyle = "rgba(120,220,140," + (0.35 + 0.4 * pulse) + ")";
        ctx.lineWidth = 2;
        R.roundRect(bx2 - 4, by2 - 4, btnW + 8, btnH + 8, 10); ctx.stroke();
        ctx.restore();
        R.addBtn(bx2, by2, btnW, btnH, "RESEARCH (" + selNode.cost + ")", (function (node) {
          return function () {
            if (statusOf(ui, node) !== "ready") return;
            ui.points -= node.cost;
            ui.researched[node.id] = true;
            ui.msg = node.name + " researched (-" + node.cost + " R&D).";
          };
        })(selNode), { color: "#7ddc8c", font: "bold 12px monospace" });
      }

      // status / feedback message line
      if (ui.msg) {
        R.text(ui.msg, tx, panelY + dh - 10, "bold 10px monospace", "#ffe58a", "left");
      }
    }

    R.drawBtns();
  };
};
})();