(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.screens=window.MMKit.screens||{};
MMKit.screens.ChooseDifficulty = function (state, config, game) {
  return function () {
    R.clearBtns();
    R.drawBg(state.cfg && state.cfg.asset, "#0b1220");

    var W = R.W, H = R.H;
    var next = (state.next && state.next.scr_zc7dhlv) || "scr_zc7dhlv";

    // Dim overlay for readability
    R.ctx.save();
    R.ctx.fillStyle = "rgba(6,10,18,0.58)";
    R.ctx.fillRect(0, 0, W, H);
    R.ctx.restore();

    // Title
    R.text("CHOOSE DIFFICULTY", W / 2, H * 0.115,
      "bold " + Math.round(H * 0.068) + "px sans-serif", "#f4e9c9", "center");
    R.text("BULWARK — Select your deployment leader", W / 2, H * 0.175,
      Math.round(H * 0.028) + "px sans-serif", "#9fb3d0", "center");

    // Four difficulty tiers, progressing in intensity.
    // Per spec: 4 PLAY controls, all navigate; second control target = '-' (null),
    // so it falls back to the play-loop target while remaining wired/enabled.
    var tiers = [
      { name: "RECRUIT",  sub: "Easy",   spr: "mothersporeilyaleaderoft", chip: "sheet",
        accent: "#4caf6a", stars: 1, target: next },
      { name: "SOLDIER",  sub: "Normal", spr: "tidepriestessmarenaleade", chip: "art17top",
        accent: "#3d7bd6", stars: 2, target: null },  // target '-' -> resolves to next
      { name: "VETERAN",  sub: "Hard",   spr: "chaplaingunnerruthbellam", chip: "art23top",
        accent: "#d68a2f", stars: 3, target: next },
      { name: "WARLORD",  sub: "Brutal", spr: "envoylyra9theleaderofthe", chip: "art29top",
        accent: "#d0433f", stars: 4, target: next }
    ];

    var cols = 4;
    var gap = W * 0.028;
    var margin = W * 0.055;
    var cardW = (W - margin * 2 - gap * (cols - 1)) / cols;
    var cardH = H * 0.56;
    var cardY = H * 0.24;

    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      var x = margin + i * (cardW + gap);

      // Card panel
      R.ctx.save();
      R.ctx.fillStyle = "rgba(16,22,34,0.90)";
      R.roundRect(x, cardY, cardW, cardH, 14);
      R.ctx.fill();
      R.ctx.lineWidth = 3;
      R.ctx.strokeStyle = t.accent;
      R.roundRect(x, cardY, cardW, cardH, 14);
      R.ctx.stroke();
      R.ctx.restore();

      // Accent header strip (visual hierarchy for tier)
      R.ctx.save();
      R.ctx.globalAlpha = 0.9;
      R.ctx.fillStyle = t.accent;
      R.roundRect(x, cardY, cardW, cardH * 0.055, 8);
      R.ctx.fill();
      R.ctx.restore();

      // Portrait sprite
      var pad = cardW * 0.11;
      var imgW = cardW - pad * 2;
      var imgH = imgW;
      var imgY = cardY + cardH * 0.10;
      R.drawSpr(t.spr, x + pad, imgY, imgW, imgH);

      // Tier terrain/unit chip (uses staged top-down art) bottom-left of portrait
      var chipS = cardW * 0.20;
      R.drawSpr(t.chip, x + pad, imgY + imgH - chipS, chipS, chipS);

      // Labels
      var textY = imgY + imgH + H * 0.045;
      R.text(t.name, x + cardW / 2, textY,
        "bold " + Math.round(H * 0.034) + "px sans-serif", "#ffffff", "center");
      R.text(t.sub, x + cardW / 2, textY + H * 0.032,
        Math.round(H * 0.026) + "px sans-serif", t.accent, "center");

      // Star rating for difficulty progression
      var starStr = "";
      for (var s = 0; s < 4; s++) starStr += (s < t.stars ? "\u2605" : "\u2606");
      R.text(starStr, x + cardW / 2, textY + H * 0.065,
        Math.round(H * 0.024) + "px sans-serif", t.accent, "center");

      // PLAY button
      var btnW = cardW * 0.76;
      var btnH = cardH * 0.13;
      var btnX = x + (cardW - btnW) / 2;
      var btnY = cardY + cardH - btnH - H * 0.028;

      (function (target, color) {
        var dest = target || next; // resolve '-'/null to the play-loop target
        R.addBtn(btnX, btnY, btnW, btnH, "PLAY", function () {
          R.go(dest);
        }, { bg: color, fill: color, color: "#ffffff", fg: "#ffffff", radius: 10,
             font: "bold " + Math.round(H * 0.03) + "px sans-serif" });
      })(t.target, t.accent);
    }

    R.drawBtns();
  };
};
})();