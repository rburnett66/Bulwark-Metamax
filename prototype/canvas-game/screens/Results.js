(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.Results = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset);

    var W = R.W, H = R.H;

    // Dim overlay for readability
    R.ctx.save();
    R.ctx.fillStyle = "rgba(6,10,20,0.62)";
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // ---- Title banner ----
    var titleY = H * 0.11;
    R.ctx.save();
    R.ctx.fillStyle = "rgba(0,0,0,0.30)";
    R.ctx.fillRect(0, titleY - H * 0.055, W, H * 0.10);
    R.ctx.restore();

    R.text("BATTLE RESULTS", W / 2, titleY, "bold " + Math.round(H * 0.07) + "px sans-serif", "#ffe8a3", "center");
    R.text("WAVE CLEARED  —  VICTORY", W / 2, titleY + H * 0.05, Math.round(H * 0.026) + "px sans-serif", "#9fd7ff", "center");

    // ---- Summary panel ----
    var panelW = Math.min(W * 0.74, 620);
    var panelH = H * 0.52;
    var panelX = (W - panelW) / 2;
    var panelY = H * 0.22;

    R.ctx.save();
    R.ctx.fillStyle = "rgba(14,22,38,0.86)";
    R.roundRect(panelX, panelY, panelW, panelH, 18);
    R.ctx.fill();
    R.ctx.lineWidth = 2;
    R.ctx.strokeStyle = "rgba(120,180,255,0.55)";
    R.roundRect(panelX, panelY, panelW, panelH, 18);
    R.ctx.stroke();
    R.ctx.restore();

    // ---- Hero portrait strip (staged sprites) ----
    var heroKeys = [
      "chaplaingunnerruthbellam",
      "mothersporeilyaleaderoft",
      "tidepriestessmarenaleade",
      "envoylyra9theleaderofthe"
    ];
    var portW = panelW * 0.16;
    var portH = portW;
    var gap = (panelW - portW * heroKeys.length) / (heroKeys.length + 1);
    var portY = panelY + panelH * 0.08;
    var i, px;
    for (i = 0; i < heroKeys.length; i++) {
      px = panelX + gap + i * (portW + gap);
      R.ctx.save();
      R.ctx.fillStyle = "rgba(0,0,0,0.35)";
      R.roundRect(px - 4, portY - 4, portW + 8, portH + 8, 10);
      R.ctx.fill();
      R.ctx.lineWidth = 1.5;
      R.ctx.strokeStyle = "rgba(120,180,255,0.35)";
      R.roundRect(px - 4, portY - 4, portW + 8, portH + 8, 10);
      R.ctx.stroke();
      R.ctx.restore();
      R.drawSpr(heroKeys[i], px, portY, portW, portH);
    }

    // ---- Section title ----
    var secY = portY + portH + panelH * 0.06;
    R.text("POST-BATTLE SUMMARY", W / 2, secY, "bold " + Math.round(H * 0.024) + "px sans-serif", "#ffffff", "center");

    // ---- Territory tiles (staged top-down sprites) as a captured-ground band ----
    var tileKeys = [
      "topdownviewof4typesofsep",
      "art8top",
      "art17top",
      "art23top",
      "art29top",
      "art34top"
    ];
    var tileBandY = secY + H * 0.02;
    var tileW = panelW * 0.11;
    var tileH = tileW * 0.7;
    var tGap = (panelW - tileW * tileKeys.length) / (tileKeys.length + 1);
    for (i = 0; i < tileKeys.length; i++) {
      var tx = panelX + tGap + i * (tileW + tGap);
      R.drawSpr(tileKeys[i], tx, tileBandY, tileW, tileH);
    }

    // ---- Stat rows ----
    var rowsY = tileBandY + tileH + panelH * 0.09;
    var rowH = panelH * 0.11;
    var labelX = panelX + panelW * 0.10;
    var valueX = panelX + panelW * 0.90;
    var lblFont = Math.round(H * 0.028) + "px sans-serif";
    var valFont = "bold " + Math.round(H * 0.032) + "px sans-serif";

    var gold = (game && typeof game.gold === "number") ? game.gold :
               (game && typeof game.bounty === "number") ? game.bounty : 0;
    var score = (game && typeof game.score === "number") ? game.score : 0;
    var captures = (game && typeof game.captures === "number") ? game.captures : 0;

    var rows = [
      ["BOUNTY EARNED", gold + " G", "#ffd76a"],
      ["CAPTURES", String(captures), "#8fe6a0"],
      ["STORY UNLOCKS", "+1", "#c8a6ff"],
      ["SCORE", String(score), "#9fd7ff"]
    ];

    for (i = 0; i < rows.length; i++) {
      var ry = rowsY + i * rowH;
      if (i % 2 === 0) {
        R.ctx.save();
        R.ctx.fillStyle = "rgba(255,255,255,0.045)";
        R.roundRect(panelX + panelW * 0.05, ry - rowH * 0.42, panelW * 0.9, rowH * 0.82, 6);
        R.ctx.fill();
        R.ctx.restore();
      }
      R.text(rows[i][0], labelX, ry, lblFont, "#d8e2f2", "left");
      R.text(rows[i][1], valueX, ry, valFont, rows[i][2], "right");
    }

    // ---- RETURN to MENU button ----
    var target = (state.next && (state.next.scr_ab5f1vj || state.next.MENU)) || "scr_ab5f1vj";
    var btnW = Math.min(W * 0.5, 360);
    var btnH = Math.max(H * 0.09, 54);
    var btnX = (W - btnW) / 2;
    var btnY = panelY + panelH + H * 0.055;

    R.addBtn(btnX, btnY, btnW, btnH, "RETURN to MENU", function () {
      R.go(target);
    }, {
      bg: "#2a5fae",
      fg: "#ffffff",
      color: "#ffffff",
      font: "bold " + Math.round(H * 0.036) + "px sans-serif",
      radius: 14
    });

    R.drawBtns();
  };
};
})();