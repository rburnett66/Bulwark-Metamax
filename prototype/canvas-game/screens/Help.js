(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Help = function (state, config, game) {
  // ---- resolve navigation target from state.next (only declared exit: HELP -> scr_ab5f1vj) ----
  function resolveTarget(label) {
    var n = state && state.next;
    if (!n) return "Menu";
    if (typeof n === "string") return n;
    if (Object.prototype.toString.call(n) === "[object Array]") {
      return n.length ? n[0] : "Menu";
    }
    if (typeof n === "object") {
      var k, lk = String(label || "").toLowerCase();
      for (k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k) &&
            String(k).toLowerCase() === lk) return n[k];
      }
      for (k in n) {
        if (Object.prototype.hasOwnProperty.call(n, k)) {
          var v = n[k];
          return (typeof v === "string" && v) ? v : k;
        }
      }
    }
    return "Menu";
  }

  // ---- guide roster (art assets staged for this screen) ----
  var GUIDES = [
    { key: "chars_1_chaplain", name: "THE CHAPLAIN", role: "Doctrine & Alignment" },
    { key: "chars_2_chaplain", name: "THE CHAPLAIN", role: "Doctrine & Alignment" },
    { key: "chars_3_chaplain", name: "THE CHAPLAIN", role: "Doctrine & Alignment" },
    { key: "chars_1_mother",   name: "THE MOTHER",   role: "Base & Fortification" },
    { key: "chars_2_mother",   name: "THE MOTHER",   role: "Base & Fortification" },
    { key: "chars_3_mother",   name: "THE MOTHER",   role: "Base & Fortification" },
    { key: "chars_1_tide",     name: "THE TIDE",     role: "Waves & Warfronts" },
    { key: "chars_2_tide",     name: "THE TIDE",     role: "Waves & Warfronts" }
  ];

  // pick a guide once per session (deterministic via R.rand), UI-scoped key only
  if (!game._helpUI || typeof game._helpUI.guideIdx !== "number") {
    game._helpUI = { guideIdx: Math.floor(R.rand() * GUIDES.length) % GUIDES.length };
  }
  var guide = GUIDES[game._helpUI.guideIdx] || GUIDES[0];

  // ---- palette (BULWARK field-command chrome, single amber accent) ----
  var COL = {
    dim:      "rgba(8,12,16,0.62)",
    panel:    "rgba(16,22,28,0.88)",
    panelHi:  "rgba(26,34,42,0.92)",
    edge:     "rgba(226,178,74,0.85)",
    edgeSoft: "rgba(226,178,74,0.30)",
    amber:    "#E2B24A",
    ink:      "#E8E4D8",
    sub:      "#9AA6AE",
    tealHdr:  "rgba(46,84,92,0.35)"
  };

  function panel(x, y, w, h, fill, edge) {
    var ctx = R.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    R.roundRect(x, y, w, h, Math.min(12, h * 0.08));
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = edge || COL.edgeSoft;
    R.roundRect(x, y, w, h, Math.min(12, h * 0.08));
    ctx.stroke();
    ctx.restore();
  }

  function cornerTicks(x, y, w, h, s, c) {
    var ctx = R.ctx;
    ctx.save();
    ctx.strokeStyle = c || COL.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + s, y); ctx.lineTo(x, y); ctx.lineTo(x, y + s);
    ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s);
    ctx.moveTo(x, y + h - s); ctx.lineTo(x, y + h); ctx.lineTo(x + s, y + h);
    ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h);
    ctx.stroke();
    ctx.restore();
  }

  function hairline(x1, y, x2, c) {
    var ctx = R.ctx;
    ctx.save();
    ctx.strokeStyle = c || COL.edgeSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  // ---- render one frame ----
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H, ctx = R.ctx;

    // legibility scrim over backdrop
    ctx.save();
    ctx.fillStyle = COL.dim;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    var pad = Math.round(W * 0.045);
    var fBig  = "bold " + Math.round(H * 0.055) + "px sans-serif";
    var fHead = "bold " + Math.round(H * 0.032) + "px sans-serif";
    var fTiny = Math.round(H * 0.019) + "px sans-serif";
    var fBtn  = "bold " + Math.round(H * 0.026) + "px sans-serif";

    // ---- header band ----
    var headH = Math.round(H * 0.13);
    ctx.save();
    ctx.fillStyle = COL.tealHdr;
    ctx.fillRect(0, 0, W, headH);
    ctx.restore();
    hairline(pad, headH, W - pad, COL.edge);
    R.text("FIELD MANUAL", pad, Math.round(headH * 0.42), fBig, COL.ink, "left");
    R.text("HELP  //  BULWARK COMMAND BRIEFING", pad, Math.round(headH * 0.78), fTiny, COL.amber, "left");
    R.text("DOC. C18-UX", W - pad, Math.round(headH * 0.42), fTiny, COL.sub, "right");

    // ---- layout metrics ----
    var top = headH + Math.round(H * 0.03);
    var bodyH = H - top - Math.round(H * 0.045);
    var leftW = Math.round(W * 0.29);
    var gap = Math.round(W * 0.028);
    var rightX = pad + leftW + gap;
    var rightW = W - rightX - pad;
    var cardW = Math.round((rightW - gap) / 2);
    var btnH = Math.round(H * 0.085);

    // ================= LEFT: GUIDE PANEL =================
    panel(pad, top, leftW, bodyH, COL.panel, COL.edgeSoft);
    cornerTicks(pad, top, leftW, bodyH, Math.round(W * 0.012), COL.edge);

    var inPad = Math.round(leftW * 0.09);
    R.text("YOUR GUIDE", pad + leftW / 2, top + Math.round(H * 0.035), fHead, COL.amber, "center");
    hairline(pad + inPad, top + Math.round(H * 0.058), pad + leftW - inPad, COL.edgeSoft);

    // portrait frame + sprite art
    var pw = leftW - inPad * 2;
    var ph = Math.round(bodyH * 0.42);
    var px = pad + inPad;
    var py = top + Math.round(H * 0.075);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    R.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.restore();
    R.drawSpr(guide.key, px + pw * 0.06, py + ph * 0.04, pw * 0.88, ph * 0.92);
    cornerTicks(px, py, pw, ph, Math.round(pw * 0.09), COL.edge);

    R.text(guide.name, pad + leftW / 2, py + ph + Math.round(H * 0.032), fHead, COL.ink, "center");
    R.text(guide.role, pad + leftW / 2, py + ph + Math.round(H * 0.062), fTiny, COL.sub, "center");
    R.text("Field questions answered", pad + leftW / 2, py + ph + Math.round(H * 0.095), fTiny, COL.sub, "center");
    R.text("between waves.", pad + leftW / 2, py + ph + Math.round(H * 0.120), fTiny, COL.sub, "center");

    // CONTROL 1 — ASK A GUIDE (primary; enabledWhen=always)
    var b1w = leftW - inPad * 2;
    var b1x = pad + inPad;
    var b1y = top + bodyH - btnH - inPad;
    ctx.save();
    ctx.strokeStyle = COL.edge;
    ctx.lineWidth = 2;
    R.roundRect(b1x - 3, b1y - 3, b1w + 6, btnH + 6, 10);
    ctx.stroke();
    ctx.restore();
    R.addBtn(b1x, b1y, b1w, btnH, "ASK A GUIDE", function () {
      R.go(resolveTarget("ASK A GUIDE"));
    }, { font: fBtn, primary: true, color: COL.amber });

    // ================= RIGHT: TWO BRIEFING CARDS (each with HOW TO PLAY) =================
    var cards = [
      {
        tag: "BRIEFING 01",
        title: "DAY BATTLE",
        spr: "chars_1_tide",
        lines: [
          "Hold the line. Enemy units",
          "path to your BASE and strike",
          "it — not your structures.",
          "",
          "Only Artillery targets",
          "buildings. Anti-air marks",
          "read \"Targets: Both\".",
          "",
          "Match damage type to armor",
          "class for full effect."
        ]
      },
      {
        tag: "BRIEFING 02",
        title: "DAY BUILD",
        spr: "chars_1_mother",
        lines: [
          "Scout the fog — vision is",
          "earned, never free. Radar",
          "reveals what eyes cannot.",
          "",
          "Fortify between waves:",
          "place structures, choose",
          "gear, spend bounties.",
          "",
          "Collect captures and story",
          "unlocks after each clear."
        ]
      }
    ];

    for (var i = 0; i < 2; i++) {
      var c = cards[i];
      var cx = rightX + i * (cardW + gap);
      panel(cx, top, cardW, bodyH, COL.panelHi, COL.edgeSoft);
      cornerTicks(cx, top, cardW, bodyH, Math.round(W * 0.012), COL.edge);

      var cpad = Math.round(cardW * 0.075);

      // small emblem art in card header
      var emS = Math.round(H * 0.075);
      R.drawSpr(c.spr, cx + cardW - cpad - emS, top + Math.round(H * 0.018), emS, emS);

      R.text(c.tag, cx + cpad, top + Math.round(H * 0.032), fTiny, COL.amber, "left");
      R.text(c.title, cx + cpad, top + Math.round(H * 0.068), fHead, COL.ink, "left");
      hairline(cx + cpad, top + Math.round(H * 0.095), cx + cardW - cpad, COL.edgeSoft);

      // body text lines
      var ly = top + Math.round(H * 0.125);
      var lstep = Math.round(H * 0.028);
      for (var j = 0; j < c.lines.length; j++) {
        if (c.lines[j]) {
          R.text(c.lines[j], cx + cpad, ly + j * lstep, fTiny, COL.ink, "left");
        }
      }

      // CONTROLS 2 & 3 — HOW TO PLAY (one per briefing card; enabledWhen=always)
      var bbx = cx + cpad;
      var bbw = cardW - cpad * 2;
      var bby = top + bodyH - btnH - cpad;
      R.addBtn(bbx, bby, bbw, btnH, "HOW TO PLAY", function () {
        R.go(resolveTarget("HOW TO PLAY"));
      }, { font: fBtn });
    }

    // footer strip
    R.text("ALL BRIEFING VALUES SOURCED FROM BULWARK-BALANCE.XLSX — NO HARDCODED BALANCE (GDD \u00A718)",
      W / 2, H - Math.round(H * 0.018), Math.round(H * 0.014) + "px sans-serif", COL.sub, "center");

    R.drawBtns();
  };
};
})();