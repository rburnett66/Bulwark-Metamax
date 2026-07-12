<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Faction & Characters</title>
<style>
  :root{
    --bg:#0a0e14;
    --panel:#121824;
    --panel-2:#182131;
    --edge:#2a3648;
    --gold:#e5b13a;
    --gold-dim:#8c6d24;
    --ink:#e8edf5;
    --ink-dim:#8b98ab;
    --organic:#5fbf6a;
    --machine:#5f8fbf;
    --air:#c07adb;
    --danger:#d05555;
    --shadow:0 8px 28px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    background:var(--bg);
    color:var(--ink);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    overflow-x:hidden;
  }

  /* ---- HERO / BACKDROP ---- */
  .hero{
    position:relative;
    min-height:230px;
    display:flex;
    align-items:flex-end;
    overflow:hidden;
    border-bottom:2px solid var(--edge);
  }
  .hero img.backdrop{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:cover;
    filter:saturate(.9) contrast(1.05);
  }
  .hero::after{
    content:"";position:absolute;inset:0;
    background:
      linear-gradient(180deg,rgba(10,14,20,.35) 0%,rgba(10,14,20,.15) 40%,rgba(10,14,20,.92) 100%),
      linear-gradient(90deg,rgba(10,14,20,.7) 0%,rgba(10,14,20,0) 55%);
    pointer-events:none;
  }
  .hero-inner{
    position:relative;z-index:2;
    width:100%;
    padding:22px clamp(16px,4vw,48px);
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    gap:20px;
    flex-wrap:wrap;
  }
  .titleblk{max-width:640px}
  .kicker{
    font-size:.72rem;letter-spacing:.42em;text-transform:uppercase;
    color:var(--gold);font-weight:700;margin-bottom:6px;
  }
  .brand{
    font-size:clamp(2rem,6vw,3.4rem);
    font-weight:900;letter-spacing:.06em;
    line-height:.95;
    text-shadow:0 2px 12px rgba(0,0,0,.8);
  }
  .brand span{color:var(--gold)}
  .subtitle{
    margin-top:8px;color:var(--ink-dim);font-size:.9rem;max-width:520px;
    text-shadow:0 1px 4px rgba(0,0,0,.9);
  }

  .btn{
    font-family:inherit;cursor:pointer;
    display:inline-flex;align-items:center;gap:8px;
    padding:12px 20px;
    border:1px solid var(--gold-dim);
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    color:var(--gold);
    font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:.78rem;
    border-radius:4px;
    transition:.18s;
    box-shadow:var(--shadow);
    white-space:nowrap;
  }
  .btn:hover{background:var(--gold);color:#0a0e14;border-color:var(--gold);transform:translateY(-1px)}
  .btn:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  .btn .arw{font-size:1rem}

  /* ---- FACTION BAR ---- */
  .factionbar{
    display:flex;align-items:center;gap:16px;
    padding:14px clamp(16px,4vw,48px);
    background:var(--panel);
    border-bottom:1px solid var(--edge);
    flex-wrap:wrap;
  }
  .crest{
    width:54px;height:54px;flex:0 0 auto;
    border:2px solid var(--gold-dim);border-radius:8px;
    background:radial-gradient(circle at 40% 30%,#25324a,#0d131e);
    display:flex;align-items:center;justify-content:center;
    color:var(--gold);font-weight:900;font-size:1.5rem;
  }
  .fmeta h2{font-size:1.15rem;letter-spacing:.16em;text-transform:uppercase}
  .fmeta p{color:var(--ink-dim);font-size:.8rem;margin-top:2px}
  .fstats{margin-left:auto;display:flex;gap:22px;flex-wrap:wrap}
  .fstat{text-align:center}
  .fstat b{display:block;font-size:1.3rem;color:var(--gold)}
  .fstat span{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim)}

  /* ---- ALIGNMENT SPECTRUM ---- */
  main{
    flex:1;
    padding:24px clamp(16px,4vw,48px) 48px;
  }
  .sec-head{
    display:flex;align-items:baseline;gap:12px;margin-bottom:6px;
  }
  .sec-head h3{font-size:.85rem;letter-spacing:.28em;text-transform:uppercase;color:var(--ink)}
  .sec-head .hint{color:var(--ink-dim);font-size:.75rem}
  .spectrum{
    display:flex;justify-content:space-between;
    font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-dim);margin:14px 2px 20px;
  }
  .spectrum::before{
    content:"";position:absolute;
  }
  .spectrum-wrap{position:relative}
  .spectrum-bar{
    height:4px;border-radius:2px;
    background:linear-gradient(90deg,var(--organic),var(--gold),var(--danger));
    margin:8px 2px 4px;
  }

  /* ---- HERO GRID ---- */
  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(210px,1fr));
    gap:16px;
    margin-top:20px;
  }
  .card{
    position:relative;
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    border:1px solid var(--edge);
    border-radius:8px;
    overflow:hidden;
    transition:.18s;
    cursor:pointer;
    box-shadow:var(--shadow);
  }
  .card:hover{border-color:var(--gold-dim);transform:translateY(-3px)}
  .card:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .card .top{
    height:118px;position:relative;
    background:
      radial-gradient(circle at 50% 40%,rgba(229,177,58,.14),transparent 60%),
      repeating-linear-gradient(45deg,#131c2a 0 10px,#101825 10px 20px);
    display:flex;align-items:center;justify-content:center;
  }
  .silhouette{
    width:70px;height:70px;border-radius:50%;
    background:radial-gradient(circle at 40% 30%,#33425c,#0c1119);
    border:2px solid rgba(229,177,58,.4);
    display:flex;align-items:center;justify-content:center;
    font-size:1.7rem;font-weight:900;color:var(--ink);
  }
  .align-tag{
    position:absolute;top:8px;left:8px;
    font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;
    padding:3px 7px;border-radius:3px;font-weight:700;
    background:rgba(10,14,20,.7);border:1px solid currentColor;
  }
  .a-org{color:var(--organic)}
  .a-neu{color:var(--gold)}
  .a-cha{color:var(--danger)}
  .a-mac{color:var(--machine)}
  .a-air{color:var(--air)}
  .card .body{padding:12px 14px}
  .card .body h4{font-size:.98rem;letter-spacing:.04em}
  .card .body .role{color:var(--gold);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;margin-top:2px}
  .card .body p{color:var(--ink-dim);font-size:.76rem;margin-top:8px;line-height:1.4}
  .chips{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
  .chip{
    font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;
    padding:3px 7px;border-radius:3px;
    background:var(--bg);border:1px solid var(--edge);color:var(--ink-dim);
  }

  footer{
    padding:16px clamp(16px,4vw,48px);
    border-top:1px solid var(--edge);
    color:var(--ink-dim);font-size:.72rem;
    display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
  }
  @media(max-width:560px){
    .fstats{width:100%;margin-left:0;justify-content:space-around}
  }
</style>
</head>
<body>

  <header class="hero">
    <img class="backdrop" src="mm://backdrop" alt="Faction battlefield">
    <div class="hero-inner">
      <div class="titleblk">
        <div class="kicker">Faction &amp; Characters</div>
        <h1 class="brand">BUL<span>WARK</span></h1>
        <p class="subtitle">Review your faction's nine heroes across the alignment spectrum — from disciplined order to unbound chaos.</p>
      </div>
      <button class="btn" data-action="navigate:scr_ab5f1vj" aria-label="Return to Menu">
        <span class="arw">←</span> Return to Menu
      </button>
    </div>
  </header>

  <div class="factionbar">
    <div class="crest" aria-hidden="true">◈</div>
    <div class="fmeta">
      <h2>Iron Concord</h2>
      <p>Machinery-aligned · Defensive doctrine · Tier III unlocked</p>
    </div>
    <div class="fstats">
      <div class="fstat"><b>9</b><span>Heroes</span></div>
      <div class="fstat"><b>8</b><span>Shapes</span></div>
      <div class="fstat"><b>T3</b><span>Max Tier</span></div>
      <div class="fstat"><b>+12%</b><span>HP Mod</span></div>
    </div>
  </div>

  <main>
    <div class="sec-head">
      <h3>Alignment Spectrum</h3>
      <span class="hint">GDD §10–§11 · nine heroes mapped by relationship model</span>
    </div>
    <div class="spectrum-wrap">
      <div class="spectrum-bar"></div>
      <div class="spectrum">
        <span>Order</span><span>Guardian</span><span>Neutral</span><span>Zealot</span><span>Chaos</span>
      </div>
    </div>

    <div class="grid">

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">▲</div><span class="align-tag a-org">Order</span></div>
        <div class="body">
          <h4>Marshal Vane</h4>
          <div class="role">Warden · Tanks</div>
          <p>Anchors the line. Grants nearby structures a defensive shield during Day Build.</p>
          <div class="chips"><span class="chip">Kinetic</span><span class="chip">Machinery</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">✚</div><span class="align-tag a-org">Order</span></div>
        <div class="body">
          <h4>Sister Ovid</h4>
          <div class="role">Medic · Troops</div>
          <p>Restores organic units between waves. Extends vision at the base perimeter.</p>
          <div class="chips"><span class="chip">Frost</span><span class="chip">Organic</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">◆</div><span class="align-tag a-mac">Guardian</span></div>
        <div class="body">
          <h4>Cogsmith Rell</h4>
          <div class="role">Engineer · Trucks</div>
          <p>Reduces structure build cost. Repairs machinery armor class in the field.</p>
          <div class="chips"><span class="chip">Electric</span><span class="chip">Machinery</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">✈</div><span class="align-tag a-air">Guardian</span></div>
        <div class="body">
          <h4>Kestrel Dane</h4>
          <div class="role">Ace · Planes</div>
          <p>Aerial scout — reveals fog over a wide radar arc. Targets both ground and air.</p>
          <div class="chips"><span class="chip">Fire</span><span class="chip">Aircraft</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">●</div><span class="align-tag a-neu">Neutral</span></div>
        <div class="body">
          <h4>Broker Sael</h4>
          <div class="role">Quartermaster · Utility</div>
          <p>Boosts bounty gold from cleared waves. Balances the alignment ledger.</p>
          <div class="chips"><span class="chip">Concussion</span><span class="chip">Energy</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">◎</div><span class="align-tag a-neu">Neutral</span></div>
        <div class="body">
          <h4>Ranger Coy</h4>
          <div class="role">Sniper · Artillery</div>
          <p>Long-range structure siege specialist. High range, low HP power budget.</p>
          <div class="chips"><span class="chip">Kinetic</span><span class="chip">Structure</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">✦</div><span class="align-tag a-cha">Zealot</span></div>
        <div class="body">
          <h4>Pyre Halloran</h4>
          <div class="role">Firebrand · Heavy Tanks</div>
          <p>Trades survivability for burst DPS. Applies Fire status on impact.</p>
          <div class="chips"><span class="chip">Fire</span><span class="chip">Organic</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">✜</div><span class="align-tag a-cha">Zealot</span></div>
        <div class="body">
          <h4>Venn Skoll</h4>
          <div class="role">Toxin · Copters</div>
          <p>Poison AoE over the base approach. Detects and floods traversal lanes.</p>
          <div class="chips"><span class="chip">Poison</span><span class="chip">Aircraft</span></div>
        </div>
      </article>

      <article class="card" tabindex="0">
        <div class="top"><div class="silhouette">✷</div><span class="align-tag a-cha">Chaos</span></div>
        <div class="body">
          <h4>The Unbound</h4>
          <div class="role">Warlord · Missiles</div>
          <p>Volatile finisher. Concussion salvos ignore counter-graph advantages.</p>
          <div class="chips"><span class="chip">Concussion</span><span class="chip">Energy</span></div>
        </div>
      </article>

    </div>
  </main>

  <footer>
    <span>BULWARK — Alignment &amp; Hero Roster · Heroes read-only from balance workbook</span>
    <span>9 / 9 heroes unlocked</span>
  </footer>

</body>
</html>