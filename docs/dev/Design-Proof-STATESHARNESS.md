<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — States Harness</title>
<style>
  :root {
    --bg-0: #0a0e14;
    --bg-1: #121821;
    --bg-2: #1a2230;
    --bg-3: #232d3d;
    --line: #2e3a4d;
    --ink: #e6ecf5;
    --ink-dim: #8a97ac;
    --ink-faint: #5a6678;
    --gold: #e8b23a;
    --gold-dim: #a07d28;
    --steel: #4a90d9;
    --teal: #38c1b0;
    --danger: #d9524a;
    --success: #4fbf6a;
    --warn: #e0932c;
    --font: 'Segoe UI', 'Roboto', system-ui, sans-serif;
    --mono: 'SFMono-Regular', 'Consolas', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background:
      radial-gradient(ellipse at 20% -10%, #182231 0%, transparent 55%),
      radial-gradient(ellipse at 90% 110%, #14202c 0%, transparent 50%),
      var(--bg-0);
    color: var(--ink);
    min-height: 100vh;
    padding: 24px;
    line-height: 1.4;
  }
  .wrap { max-width: 1200px; margin: 0 auto; }

  /* Header bar */
  .topbar {
    display: flex; align-items: center; gap: 18px;
    padding: 16px 20px;
    background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.03);
  }
  .brand {
    display: flex; align-items: center; gap: 14px;
  }
  .crest {
    width: 44px; height: 44px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, var(--gold), var(--gold-dim));
    clip-path: polygon(50% 0, 100% 25%, 100% 72%, 50% 100%, 0 72%, 0 25%);
    color: #14100a; font-weight: 900; font-size: 20px;
    box-shadow: 0 2px 10px rgba(232,178,58,.35);
  }
  .brand h1 {
    font-size: 20px; font-weight: 800; letter-spacing: 4px;
  }
  .brand .sub {
    font-size: 10px; letter-spacing: 3px; color: var(--ink-dim);
    text-transform: uppercase;
  }
  .topbar .spacer { flex: 1; }
  .chip {
    font-family: var(--mono); font-size: 11px;
    color: var(--gold); border: 1px solid var(--gold-dim);
    padding: 5px 11px; border-radius: 20px;
    background: rgba(232,178,58,.07);
    letter-spacing: 1px;
  }

  /* Section intro */
  .intro { margin: 28px 4px 20px; }
  .intro h2 {
    font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
    color: var(--ink-dim); font-weight: 700;
  }
  .intro p { color: var(--ink-faint); font-size: 13px; margin-top: 6px; max-width: 640px; }

  /* State grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 16px;
  }
  .card {
    background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0,0,0,.35);
  }
  .card .head {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
    background: rgba(0,0,0,.15);
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; box-shadow: 0 0 8px currentColor; }
  .card .head .name { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; }
  .card .head .tag {
    margin-left: auto; font-family: var(--mono); font-size: 10px;
    color: var(--ink-faint); text-transform: uppercase;
  }
  .card .body { padding: 16px 14px; }
  .card .desc { font-size: 12px; color: var(--ink-dim); min-height: 34px; }

  /* State colors */
  .s-default .dot { color: var(--steel); }
  .s-loading .dot { color: var(--warn); }
  .s-empty   .dot { color: var(--ink-faint); }
  .s-success .dot { color: var(--success); }
  .s-error   .dot { color: var(--danger); }
  .s-disabled .dot { color: var(--ink-faint); }
  .s-active  .dot { color: var(--gold); }
  .s-focus   .dot { color: var(--teal); }

  /* Demo widget styles per card */
  .stat-row { display:flex; justify-content:space-between; font-family: var(--mono); font-size:12px; padding:6px 0; border-bottom:1px dashed var(--line); }
  .stat-row:last-child{border-bottom:none;}
  .stat-row span:first-child{ color: var(--ink-faint);}
  .stat-row span:last-child{ color: var(--ink);}

  .bar-outer{ height:8px; background: var(--bg-3); border-radius:6px; overflow:hidden; margin:8px 0 4px;}
  .bar-inner{ height:100%; border-radius:6px; }

  .skeleton{ background: linear-gradient(90deg, var(--bg-3) 25%, #2b3646 50%, var(--bg-3) 75%); background-size:200% 100%; animation: shimmer 1.4s infinite; border-radius:5px;}
  @keyframes shimmer{ 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
  .sk-line{ height:10px; margin:8px 0;}
  .sk-line.short{ width:55%; }

  .empty-icon{ width:46px; height:46px; margin:4px auto 10px; border:2px dashed var(--ink-faint); border-radius:10px; display:grid; place-items:center; color:var(--ink-faint); font-size:22px;}
  .empty-txt{ text-align:center; color:var(--ink-faint); font-size:12px;}

  .banner{ display:flex; gap:10px; align-items:center; padding:10px 12px; border-radius:8px; font-size:12px; }
  .banner.ok{ background: rgba(79,191,106,.1); border:1px solid rgba(79,191,106,.35); color:#bfeecb;}
  .banner.err{ background: rgba(217,82,74,.1); border:1px solid rgba(217,82,74,.35); color:#f2c3c0;}
  .banner b{ font-family:var(--mono);}

  .gearbtn{ width:100%; text-align:left; display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid var(--line); background:var(--bg-3); color:var(--ink); font-size:12px; }
  .gearbtn .g-ico{ width:26px;height:26px; border-radius:6px; display:grid; place-items:center; font-size:13px;}
  .gearbtn.disabled{ opacity:.45; }
  .gearbtn.active{ border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold-dim), 0 0 14px rgba(232,178,58,.25);}
  .gearbtn.focus{ outline: 2px solid var(--teal); outline-offset: 2px;}
  .price{ margin-left:auto; font-family:var(--mono); color: var(--gold); }

  /* Footer action bar */
  .actionbar {
    margin-top: 30px;
    display: flex; align-items: center; gap: 16px;
    padding: 18px 20px;
    background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,.4);
  }
  .actionbar .note { font-size: 12px; color: var(--ink-dim); }
  .actionbar .note strong{ color: var(--ink); }
  .actionbar .grow { flex: 1; }

  .btn {
    font-family: var(--font); cursor: pointer;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 700; letter-spacing: 1px;
    padding: 13px 26px;
    text-transform: uppercase;
    transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
  }
  .btn:active { transform: translateY(1px); }
  .btn-primary {
    color: #14100a;
    background: linear-gradient(135deg, var(--gold), var(--gold-dim));
    box-shadow: 0 4px 16px rgba(232,178,58,.35), inset 0 1px 0 rgba(255,255,255,.25);
  }
  .btn-primary:hover { filter: brightness(1.08); box-shadow: 0 6px 22px rgba(232,178,58,.5); }
  .btn-primary:focus-visible { outline: 3px solid var(--teal); outline-offset: 3px; }

  @media (max-width: 560px){
    .topbar{ flex-wrap:wrap; }
    .actionbar{ flex-direction:column; align-items:stretch; }
    .btn{ width:100%; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header class="topbar">
    <div class="brand">
      <div class="crest">B</div>
      <div>
        <h1>BULWARK</h1>
        <div class="sub">States Harness</div>
      </div>
    </div>
    <div class="spacer"></div>
    <span class="chip">C11–C19 · READ-ONLY</span>
    <span class="chip">SIM CORE OK</span>
  </header>

  <section class="intro">
    <h2>Component State Matrix</h2>
    <p>Canonical presentation states rendered against the same on-brand tokens. Every panel is a read-only consumer of the deterministic core (GDD §18) — no balance state is owned here.</p>
  </section>

  <div class="grid">

    <!-- DEFAULT -->
    <article class="card s-default">
      <div class="head"><span class="dot"></span><span class="name">Default</span><span class="tag">idle</span></div>
      <div class="body">
        <div class="desc">Nominal render. Unit stats resolved from workbook.</div>
        <div style="margin-top:8px">
          <div class="stat-row"><span>HP T2</span><span>1,240</span></div>
          <div class="stat-row"><span>DPS T2</span><span>96</span></div>
          <div class="stat-row"><span>RANGE</span><span>7.2</span></div>
        </div>
      </div>
    </article>

    <!-- LOADING -->
    <article class="card s-loading">
      <div class="head"><span class="dot"></span><span class="name">Loading</span><span class="tag">fetch</span></div>
      <div class="body">
        <div class="desc">Streaming atlas &amp; balance rows…</div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
        <div class="bar-outer"><div class="bar-inner skeleton" style="width:62%"></div></div>
      </div>
    </article>

    <!-- EMPTY -->
    <article class="card s-empty">
      <div class="head"><span class="dot"></span><span class="name">Empty</span><span class="tag">no data</span></div>
      <div class="body">
        <div class="empty-icon">▱</div>
        <div class="empty-txt">No units deployed to this slot.<br>Select gear to begin.</div>
      </div>
    </article>

    <!-- SUCCESS -->
    <article class="card s-success">
      <div class="head"><span class="dot"></span><span class="name">Success</span><span class="tag">confirmed</span></div>
      <div class="body">
        <div class="banner ok"><span>✓</span><span>Deploy confirmed — <b>−240 GOLD</b>. Wedge sweep played.</span></div>
        <div class="bar-outer" style="margin-top:12px"><div class="bar-inner" style="width:100%;background:linear-gradient(90deg,var(--success),#2f8f4c)"></div></div>
      </div>
    </article>

    <!-- ERROR -->
    <article class="card s-error">
      <div class="head"><span class="dot"></span><span class="name">Error</span><span class="tag">rejected</span></div>
      <div class="body">
        <div class="banner err"><span>!</span><span>Insufficient gold. Need <b>+80</b> to deploy Heavy Tank.</span></div>
        <div class="bar-outer" style="margin-top:12px"><div class="bar-inner" style="width:70%;background:linear-gradient(90deg,var(--danger),#8a332e)"></div></div>
      </div>
    </article>

    <!-- ACTIVE / SELECTED -->
    <article class="card s-active">
      <div class="head"><span class="dot"></span><span class="name">Active</span><span class="tag">selected</span></div>
      <div class="body">
        <div class="desc">Item picked in deploy loop — awaiting confirm.</div>
        <button class="gearbtn active" style="margin-top:8px" type="button">
          <span class="g-ico" style="background:rgba(232,178,58,.2);color:var(--gold)">◆</span>
          Artillery · T2 <span class="price">240g</span>
        </button>
      </div>
    </article>

    <!-- FOCUS -->
    <article class="card s-focus">
      <div class="head"><span class="dot"></span><span class="name">Focus</span><span class="tag">keyboard</span></div>
      <div class="body">
        <div class="desc">Keyboard focus ring for accessible traversal.</div>
        <button class="gearbtn focus" style="margin-top:8px" type="button">
          <span class="g-ico" style="background:rgba(56,193,176,.2);color:var(--teal)">▸</span>
          Copter · T1 <span class="price">150g</span>
        </button>
      </div>
    </article>

    <!-- DISABLED -->
    <article class="card s-disabled">
      <div class="head"><span class="dot"></span><span class="name">Disabled</span><span class="tag">locked</span></div>
      <div class="body">
        <div class="desc">Unavailable until tier unlocked.</div>
        <button class="gearbtn disabled" style="margin-top:8px" type="button" disabled aria-disabled="true">
          <span class="g-ico" style="background:var(--bg-2);color:var(--ink-faint)">✕</span>
          Missile · T3 <span class="price">—</span>
        </button>
      </div>
    </article>

  </div>

  <div class="actionbar">
    <div class="note">
      <strong>Harness ready.</strong> Proceed to volume &amp; system configuration to tune the presentation layer.
    </div>
    <div class="grow"></div>
    <button class="btn btn-primary" type="button" data-action="navigate:scr_er2mf9n">Open Settings</button>
  </div>

</div>
</body>
</html>