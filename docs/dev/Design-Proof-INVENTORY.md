<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Inventory</title>
<style>
  :root{
    --bg:#0d1116;
    --panel:#151b23;
    --panel-2:#1c242e;
    --edge:#2c3846;
    --edge-hi:#3d4d5e;
    --gold:#e3b04b;
    --gold-hi:#f4cf7d;
    --ink:#e8edf2;
    --muted:#8496a6;
    --blue:#4c86c8;
    --steel:#6b7f92;
    --danger:#c8543f;
    --organic:#6fae5b;
    --machine:#c9a24a;
    --air:#5b9fd4;
    --font: "Segoe UI",Roboto,-apple-system,system-ui,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    background:var(--bg);
    color:var(--ink);
    font-family:var(--font);
    display:flex;
    flex-direction:column;
    min-height:100vh;
  }

  /* HERO / BACKDROP */
  .hero{
    position:relative;
    overflow:hidden;
    border-bottom:1px solid var(--edge);
    flex:0 0 auto;
  }
  .hero img.backdrop{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:cover;
    filter:saturate(1.05) brightness(.72);
  }
  .hero .scrim{
    position:absolute;inset:0;
    background:
      linear-gradient(180deg, rgba(8,11,15,.55) 0%, rgba(8,11,15,.15) 40%, rgba(13,17,22,.92) 100%),
      linear-gradient(90deg, rgba(13,17,22,.85) 0%, rgba(13,17,22,0) 55%);
  }
  .hero .inner{
    position:relative;
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:20px;
    padding:26px 34px 22px;
    min-height:190px;
    flex-wrap:wrap;
  }
  .brandline{display:flex;align-items:center;gap:14px}
  .glyph{
    width:44px;height:44px;
    border:2px solid var(--gold);
    border-radius:6px;
    display:grid;place-items:center;
    color:var(--gold);
    font-weight:900;font-size:24px;
    box-shadow:0 0 22px rgba(227,176,75,.25) inset;
    background:rgba(13,17,22,.4);
  }
  .titles h1{
    margin:0;
    font-size:clamp(28px,4.5vw,44px);
    letter-spacing:.14em;
    font-weight:800;
  }
  .titles .sub{
    margin-top:4px;
    color:var(--muted);
    letter-spacing:.32em;
    font-size:12px;
    text-transform:uppercase;
  }

  .btn{
    font-family:inherit;
    cursor:pointer;
    border:1px solid var(--edge-hi);
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    color:var(--ink);
    padding:12px 22px;
    border-radius:6px;
    letter-spacing:.14em;
    font-size:13px;
    font-weight:700;
    text-transform:uppercase;
    transition:.15s;
    display:inline-flex;align-items:center;gap:10px;
  }
  .btn:hover{border-color:var(--gold);color:var(--gold-hi);transform:translateY(-1px)}
  .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .btn .arw{font-size:15px}

  /* MAIN */
  .wrap{
    flex:1 1 auto;
    max-width:1240px;
    width:100%;
    margin:0 auto;
    padding:26px 24px 40px;
    display:grid;
    grid-template-columns:230px 1fr 300px;
    gap:20px;
  }

  .panel{
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    border:1px solid var(--edge);
    border-radius:10px;
  }
  .panel-h{
    padding:14px 16px;
    border-bottom:1px solid var(--edge);
    letter-spacing:.22em;
    font-size:12px;
    color:var(--muted);
    text-transform:uppercase;
    display:flex;justify-content:space-between;align-items:center;
  }
  .panel-h .count{color:var(--gold)}

  /* filter rail */
  .rail{padding:10px}
  .filt{
    width:100%;
    text-align:left;
    background:transparent;
    border:1px solid transparent;
    color:var(--muted);
    font-family:inherit;
    padding:11px 14px;
    border-radius:6px;
    cursor:pointer;
    letter-spacing:.08em;
    font-size:13px;
    display:flex;align-items:center;gap:10px;
    transition:.13s;
  }
  .filt .dot{width:8px;height:8px;border-radius:50%;background:var(--steel)}
  .filt.org .dot{background:var(--organic)}
  .filt.mac .dot{background:var(--machine)}
  .filt.air .dot{background:var(--air)}
  .filt:hover{color:var(--ink);background:rgba(255,255,255,.03)}
  .filt.active{
    color:var(--gold-hi);
    background:rgba(227,176,75,.08);
    border-color:rgba(227,176,75,.35);
  }
  .rail .div{height:1px;background:var(--edge);margin:10px 6px}

  /* grid */
  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(118px,1fr));
    gap:12px;
    padding:14px;
  }
  .cell{
    position:relative;
    aspect-ratio:1;
    background:radial-gradient(120% 120% at 50% 20%, #202b36, #141a21);
    border:1px solid var(--edge);
    border-radius:8px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:8px;
    cursor:pointer;
    transition:.14s;
    overflow:hidden;
  }
  .cell:hover{border-color:var(--gold);transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.4)}
  .cell.selected{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset, 0 0 18px rgba(227,176,75,.2)}
  .cell.empty{
    background:repeating-linear-gradient(45deg,#131920,#131920 8px,#161d25 8px,#161d25 16px);
    border-style:dashed;
    cursor:default;
  }
  .cell.empty:hover{transform:none;border-color:var(--edge);box-shadow:none}
  .silhouette{
    font-size:30px;
    line-height:1;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));
  }
  .cell .nm{
    font-size:11px;
    letter-spacing:.04em;
    color:var(--ink);
    text-align:center;
    padding:0 4px;
  }
  .qty{
    position:absolute;top:6px;right:7px;
    background:rgba(13,17,22,.85);
    border:1px solid var(--edge-hi);
    color:var(--gold-hi);
    font-size:11px;font-weight:700;
    padding:1px 6px;border-radius:20px;
  }
  .tier{
    position:absolute;top:6px;left:7px;
    font-size:10px;font-weight:800;letter-spacing:.06em;
    color:var(--bg);
    background:var(--steel);
    padding:1px 5px;border-radius:4px;
  }
  .tier.t2{background:var(--blue)}
  .tier.t3{background:var(--gold)}

  /* detail */
  .detail{padding:0}
  .detail .art{
    height:150px;
    margin:14px;
    border-radius:8px;
    background:radial-gradient(120% 120% at 50% 25%, #24303c, #10151b);
    border:1px solid var(--edge);
    display:grid;place-items:center;
    font-size:64px;
    position:relative;
  }
  .detail .art .badge{
    position:absolute;bottom:10px;left:10px;
    font-size:10px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--muted);
    background:rgba(13,17,22,.7);
    padding:3px 8px;border-radius:4px;border:1px solid var(--edge);
  }
  .detail .body{padding:0 16px 16px}
  .detail h2{margin:2px 0 2px;font-size:20px;letter-spacing:.05em}
  .detail .role{color:var(--muted);font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px}
  .stat{margin:11px 0}
  .stat .lbl{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  .stat .lbl b{color:var(--ink)}
  .bar{height:7px;background:#0d1117;border:1px solid var(--edge);border-radius:5px;overflow:hidden}
  .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-hi))}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--steel);border:1px solid var(--edge);padding:3px 8px;border-radius:20px}
  .tag.dmg{color:var(--gold-hi);border-color:rgba(227,176,75,.4)}

  @media(max-width:1000px){
    .wrap{grid-template-columns:1fr 300px}
    .rail-panel{grid-column:1 / -1}
    .rail{display:flex;flex-wrap:wrap;gap:6px}
    .rail .filt{width:auto}
    .rail .div{display:none}
  }
  @media(max-width:720px){
    .wrap{grid-template-columns:1fr}
    .hero .inner{padding:20px}
  }
</style>
</head>
<body>

  <header class="hero">
    <img class="backdrop" src="mm://backdrop" alt="">
    <div class="scrim"></div>
    <div class="inner">
      <div class="brandline">
        <div class="glyph">B</div>
        <div class="titles">
          <h1>INVENTORY</h1>
          <div class="sub">Armory · Deployable Assets</div>
        </div>
      </div>
      <button class="btn" data-action="navigate:scr_ab5f1vj">
        <span class="arw">←</span> Return to Menu
      </button>
    </div>
  </header>

  <main class="wrap">

    <!-- FILTER RAIL -->
    <aside class="panel rail-panel">
      <div class="panel-h">Filter</div>
      <nav class="rail" aria-label="Inventory filters">
        <button class="filt active"><span class="dot"></span>All Assets</button>
        <div class="div"></div>
        <button class="filt org"><span class="dot"></span>Organic</button>
        <button class="filt mac"><span class="dot"></span>Machinery</button>
        <button class="filt air"><span class="dot"></span>Aircraft</button>
        <div class="div"></div>
        <button class="filt"><span class="dot"></span>Structures</button>
        <button class="filt"><span class="dot"></span>Missiles</button>
      </nav>
    </aside>

    <!-- ITEM GRID -->
    <section class="panel">
      <div class="panel-h">Roster Cache <span class="count">14 / 72</span></div>
      <div class="grid">
        <button class="cell selected"><span class="tier">T1</span><span class="qty">x8</span><span class="silhouette">🪖</span><span class="nm">Vanguard Troop</span></button>
        <button class="cell"><span class="tier t2">T2</span><span class="qty">x3</span><span class="silhouette">🚚</span><span class="nm">Supply Truck</span></button>
        <button class="cell"><span class="tier t2">T2</span><span class="qty">x4</span><span class="silhouette">🛡️</span><span class="nm">Iron Tank</span></button>
        <button class="cell"><span class="tier">T1</span><span class="qty">x2</span><span class="silhouette">🎯</span><span class="nm">Siege Artillery</span></button>
        <button class="cell"><span class="tier t3">T3</span><span class="qty">x1</span><span class="silhouette">⚙️</span><span class="nm">Heavy Tank</span></button>
        <button class="cell"><span class="tier t2">T2</span><span class="qty">x2</span><span class="silhouette">🚁</span><span class="nm">Recon Copter</span></button>
        <button class="cell"><span class="tier">T1</span><span class="qty">x3</span><span class="silhouette">✈️</span><span class="nm">Strike Plane</span></button>
        <button class="cell"><span class="tier t3">T3</span><span class="qty">x1</span><span class="silhouette">🚀</span><span class="nm">Cruise Missile</span></button>
        <button class="cell"><span class="tier">T1</span><span class="qty">x6</span><span class="silhouette">🏰</span><span class="nm">Bulwark Wall</span></button>
        <button class="cell"><span class="tier t2">T2</span><span class="qty">x2</span><span class="silhouette">📡</span><span class="nm">Radar Post</span></button>
        <button class="cell"><span class="tier">T1</span><span class="qty">x5</span><span class="silhouette">🔫</span><span class="nm">Turret Nest</span></button>
        <button class="cell"><span class="tier t3">T3</span><span class="qty">x1</span><span class="silhouette">💠</span><span class="nm">Energy Core</span></button>
        <button class="cell"><span class="tier t2">T2</span><span class="qty">x2</span><span class="silhouette">🚤</span><span class="nm">Patrol Floater</span></button>
        <button class="cell"><span class="tier">T1</span><span class="qty">x4</span><span class="silhouette">⛏️</span><span class="nm">Sapper Crew</span></button>
        <button class="cell empty"><span class="silhouette" style="opacity:.3">＋</span><span class="nm" style="color:var(--muted)">Empty</span></button>
        <button class="cell empty"><span class="silhouette" style="opacity:.3">＋</span><span class="nm" style="color:var(--muted)">Empty</span></button>
      </div>
    </section>

    <!-- DETAIL -->
    <aside class="panel detail">
      <div class="panel-h">Asset Detail</div>
      <div class="art">
        🪖
        <span class="badge">Walker · Organic</span>
      </div>
      <div class="body">
        <h2>Vanguard Troop</h2>
        <div class="role">Frontline · Tier 1</div>

        <div class="stat">
          <div class="lbl"><span>HP</span><b>620</b></div>
          <div class="bar"><i style="width:42%"></i></div>
        </div>
        <div class="stat">
          <div class="lbl"><span>DPS</span><b>85</b></div>
          <div class="bar"><i style="width:55%"></i></div>
        </div>
        <div class="stat">
          <div class="lbl"><span>Range</span><b>3.2</b></div>
          <div class="bar"><i style="width:30%"></i></div>
        </div>
        <div class="stat">
          <div class="lbl"><span>Speed</span><b>4.8</b></div>
          <div class="bar"><i style="width:68%"></i></div>
        </div>

        <div class="tags">
          <span class="tag dmg">Kinetic</span>
          <span class="tag">Targets: Base</span>
          <span class="tag">Ground Only</span>
          <span class="tag">Vision 5</span>
        </div>
      </div>
    </aside>

  </main>

</body>
</html>