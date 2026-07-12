<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — PLAY</title>
<style>
  :root{
    --bg-void:#0a0d12;
    --bg-panel:#141a22;
    --bg-panel-2:#1c242e;
    --edge:#2b3745;
    --edge-lit:#3d4f61;
    --gold:#e8b437;
    --gold-dim:#a37d24;
    --steel:#7f93a6;
    --ice:#5ec8e0;
    --text:#e6edf3;
    --text-dim:#93a3b4;
    --danger:#d64b4b;
    --ok:#4bd68a;
    --shadow:0 8px 24px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
    background:var(--bg-void);
    color:var(--text);
    overflow:hidden;
    letter-spacing:.02em;
  }
  .stage{
    position:relative;
    height:100vh;
    width:100vw;
    display:flex;
    flex-direction:column;
  }

  /* ---------- Top HUD Bar ---------- */
  .hud-top{
    position:relative;
    z-index:20;
    display:flex;
    align-items:center;
    gap:16px;
    padding:10px 18px;
    background:linear-gradient(180deg,rgba(10,13,18,.96),rgba(10,13,18,.72));
    border-bottom:1px solid var(--edge);
    backdrop-filter:blur(6px);
  }
  .brand{
    display:flex;align-items:center;gap:10px;
    font-weight:800;font-size:20px;letter-spacing:.28em;
    color:var(--gold);
    text-shadow:0 0 14px rgba(232,180,55,.35);
  }
  .brand .chev{
    width:0;height:0;
    border-top:9px solid transparent;
    border-bottom:9px solid transparent;
    border-left:14px solid var(--gold);
    filter:drop-shadow(0 0 6px rgba(232,180,55,.5));
  }
  .phase{
    display:flex;align-items:center;gap:8px;
    padding:5px 12px;
    background:var(--bg-panel);
    border:1px solid var(--edge-lit);
    border-radius:4px;
    font-size:12px;font-weight:700;letter-spacing:.14em;
    text-transform:uppercase;
    color:var(--ice);
  }
  .phase .dot{width:8px;height:8px;border-radius:50%;background:var(--ice);box-shadow:0 0 8px var(--ice);animation:pulse 1.6s infinite}
  @keyframes pulse{50%{opacity:.35}}

  .resources{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}
  .res{
    display:flex;align-items:center;gap:7px;
    padding:6px 12px;
    background:var(--bg-panel);
    border:1px solid var(--edge);
    border-radius:4px;
    min-width:96px;
  }
  .res .ic{
    width:22px;height:22px;border-radius:4px;
    display:grid;place-items:center;font-size:12px;font-weight:800;
  }
  .res.gold .ic{background:linear-gradient(135deg,var(--gold),var(--gold-dim));color:#231a06}
  .res.wave .ic{background:linear-gradient(135deg,#3d5266,#25313d);color:var(--ice)}
  .res.pow  .ic{background:linear-gradient(135deg,#5a6c7e,#333f4b);color:#dbe6ef}
  .res .val{display:flex;flex-direction:column;line-height:1.05}
  .res .val b{font-size:14px;font-weight:800}
  .res .val small{font-size:9px;letter-spacing:.12em;color:var(--text-dim);text-transform:uppercase}

  /* ---------- Battlefield surface ---------- */
  .field-wrap{
    position:relative;
    flex:1;
    min-height:0;
    overflow:hidden;
  }
  .field-wrap>img.backdrop{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:cover;
    z-index:0;
  }
  .scrim{
    position:absolute;inset:0;z-index:1;pointer-events:none;
    background:
      radial-gradient(ellipse at 50% 30%,transparent 30%,rgba(6,9,13,.55) 100%),
      linear-gradient(180deg,rgba(10,13,18,.5) 0%,transparent 22%,transparent 62%,rgba(10,13,18,.78) 100%);
  }
  [data-mm-surface]{
    position:absolute;
    inset:0;
    z-index:2;
    width:100%;
    height:100%;
  }

  /* ---------- Center Play prompt ---------- */
  .play-cluster{
    position:absolute;
    left:50%;top:50%;
    transform:translate(-50%,-50%);
    z-index:6;
    display:flex;flex-direction:column;align-items:center;gap:18px;
    text-align:center;
    pointer-events:none;
  }
  .play-cluster .tag{
    font-size:12px;letter-spacing:.42em;font-weight:700;
    color:var(--text-dim);text-transform:uppercase;
    text-shadow:0 2px 10px #000;
  }
  .play-cluster h1{
    font-size:clamp(30px,6vw,58px);font-weight:900;letter-spacing:.12em;
    color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.75);
    line-height:1;
  }
  .btn-play{
    pointer-events:auto;
    display:inline-flex;align-items:center;gap:14px;
    padding:16px 40px;
    font-size:19px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
    color:#231a06;cursor:pointer;
    background:linear-gradient(135deg,#f4c74a,var(--gold-dim));
    border:1px solid #f6d67a;
    border-radius:6px;
    box-shadow:0 10px 30px rgba(232,180,55,.35),inset 0 1px 0 rgba(255,255,255,.4);
    transition:transform .12s ease,box-shadow .12s ease;
  }
  .btn-play:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(232,180,55,.5),inset 0 1px 0 rgba(255,255,255,.5)}
  .btn-play:active{transform:translateY(0)}
  .btn-play .tri{
    width:0;height:0;
    border-top:11px solid transparent;
    border-bottom:11px solid transparent;
    border-left:18px solid #231a06;
  }
  .btn-play:focus-visible{outline:3px solid var(--ice);outline-offset:4px}

  /* corner minimap chrome */
  .minimap{
    position:absolute;right:16px;bottom:96px;z-index:7;
    width:150px;height:110px;
    background:linear-gradient(160deg,rgba(20,26,34,.9),rgba(10,13,18,.9));
    border:1px solid var(--edge-lit);border-radius:6px;
    box-shadow:var(--shadow);
    overflow:hidden;
  }
  .minimap .mm-head{
    font-size:9px;letter-spacing:.2em;color:var(--text-dim);
    padding:5px 8px;border-bottom:1px solid var(--edge);text-transform:uppercase;font-weight:700;
  }
  .minimap .mm-body{position:relative;height:calc(100% - 24px)}
  .minimap .fog{
    position:absolute;inset:0;
    background:
      radial-gradient(circle at 60% 55%,transparent 18%,rgba(10,13,18,.85) 55%),
      repeating-linear-gradient(45deg,rgba(46,58,72,.25) 0 6px,transparent 6px 12px);
  }
  .minimap .base{position:absolute;left:56%;top:50%;width:9px;height:9px;transform:translate(-50%,-50%);background:var(--gold);border-radius:2px;box-shadow:0 0 8px var(--gold)}
  .minimap .foe{position:absolute;width:5px;height:5px;background:var(--danger);border-radius:50%;box-shadow:0 0 6px var(--danger)}

  /* ---------- Bottom command dock ---------- */
  .dock{
    position:relative;z-index:20;
    display:flex;align-items:center;gap:14px;
    padding:12px 18px;
    background:linear-gradient(0deg,rgba(10,13,18,.98),rgba(10,13,18,.78));
    border-top:1px solid var(--edge);
    backdrop-filter:blur(6px);
  }
  .loadout{display:flex;gap:8px;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
  .slot{
    flex:0 0 auto;
    width:58px;height:58px;
    background:var(--bg-panel);
    border:1px solid var(--edge);
    border-radius:6px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    position:relative;
    color:var(--text-dim);
  }
  .slot .sh{font-size:20px}
  .slot .lbl{font-size:8px;letter-spacing:.06em;text-transform:uppercase}
  .slot .cost{
    position:absolute;top:-6px;right:-6px;
    background:var(--gold);color:#231a06;
    font-size:9px;font-weight:800;padding:1px 5px;border-radius:8px;
  }
  .slot.locked{opacity:.4}
  .slot.locked::after{content:"🔒";position:absolute;font-size:16px}

  .btn-gear{
    flex:0 0 auto;
    display:inline-flex;align-items:center;gap:12px;
    padding:14px 24px;
    font-size:14px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
    color:var(--text);cursor:pointer;
    background:linear-gradient(135deg,var(--bg-panel-2),var(--bg-panel));
    border:1px solid var(--edge-lit);
    border-radius:6px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
    transition:border-color .12s,transform .12s,background .12s;
  }
  .btn-gear:hover{border-color:var(--gold);transform:translateY(-2px);background:linear-gradient(135deg,#232d38,#1a222c)}
  .btn-gear:active{transform:translateY(0)}
  .btn-gear:focus-visible{outline:3px solid var(--ice);outline-offset:3px}
  .btn-gear .g-ic{
    width:26px;height:26px;border-radius:5px;
    background:linear-gradient(135deg,var(--gold),var(--gold-dim));
    display:grid;place-items:center;color:#231a06;font-size:15px;
  }

  @media (max-width:640px){
    .hud-top{gap:10px;padding:8px 12px}
    .brand{font-size:15px;letter-spacing:.18em}
    .res{min-width:0;padding:5px 9px}
    .res .val small{display:none}
    .phase span:last-child{display:none}
    .minimap{display:none}
    .btn-gear{padding:12px 16px}
    .btn-gear span{display:none}
    .dock{gap:8px}
  }
</style>
</head>
<body>
<div class="stage">

  <!-- ===== TOP HUD ===== -->
  <header class="hud-top">
    <div class="brand"><span class="chev"></span>BULWARK</div>
    <div class="phase"><span class="dot"></span><span>Day Build</span></div>
    <div class="resources" role="group" aria-label="Resources">
      <div class="res gold"><div class="ic">◆</div><div class="val"><b>2,480</b><small>Gold</small></div></div>
      <div class="res wave"><div class="ic">⚑</div><div class="val"><b>03 / 12</b><small>Wave</small></div></div>
      <div class="res pow"><div class="ic">⚡</div><div class="val"><b>74 / 100</b><small>Power</small></div></div>
    </div>
  </header>

  <!-- ===== BATTLEFIELD ===== -->
  <div class="field-wrap">
    <img class="backdrop" src="mm://backdrop" alt="Battlefield terrain">
    <div class="scrim"></div>

    <!-- LIVE GAME VIEW MOUNTS HERE -->
    <div data-mm-surface></div>

    <!-- Center prompt -->
    <div class="play-cluster">
      <span class="tag">Fortify · Defend · Collect</span>
      <h1>HOLD THE LINE</h1>
      <button class="btn-play" data-action="cmd:Animate an inviting game scene" aria-label="Play game">
        <span class="tri"></span>DEPLOY
      </button>
    </div>

    <!-- Minimap chrome -->
    <div class="minimap" aria-hidden="true">
      <div class="mm-head">Radar — Sector 4</div>
      <div class="mm-body">
        <div class="fog"></div>
        <div class="base"></div>
        <div class="foe" style="left:22%;top:30%"></div>
        <div class="foe" style="left:34%;top:62%"></div>
        <div class="foe" style="left:18%;top:48%"></div>
      </div>
    </div>
  </div>

  <!-- ===== BOTTOM DOCK ===== -->
  <footer class="dock">
    <div class="loadout" role="group" aria-label="Deployable loadout">
      <div class="slot"><span class="sh">🪖</span><span class="lbl">Troops</span><span class="cost">40</span></div>
      <div class="slot"><span class="sh">🚚</span><span class="lbl">Truck</span><span class="cost">65</span></div>
      <div class="slot"><span class="sh">🛡️</span><span class="lbl">Tank</span><span class="cost">120</span></div>
      <div class="slot"><span class="sh">🎯</span><span class="lbl">Artillery</span><span class="cost">180</span></div>
      <div class="slot locked" aria-label="Locked slot"><span class="sh">🚁</span><span class="lbl">Copter</span></div>
      <div class="slot locked" aria-label="Locked slot"><span class="sh">✈️</span><span class="lbl">Plane</span></div>
    </div>

    <button class="btn-gear" data-action="cmd:Display the player's gear and loadout" aria-label="Choose gear and loadout">
      <span class="g-ic">⚙</span><span>Choose Gear</span>
    </button>
  </footer>

</div>
</body>
</html>