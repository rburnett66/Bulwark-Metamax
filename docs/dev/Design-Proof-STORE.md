<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Store</title>
<style>
  :root{
    --gold:#d9a441;
    --gold-bright:#f2c86b;
    --steel:#8a97a6;
    --ink:#0c0f14;
    --ink2:#141922;
    --panel:#1a212c;
    --panel2:#212a37;
    --line:#33404f;
    --text:#e7ecf2;
    --muted:#95a3b3;
    --org:#7ec46a;
    --mach:#e0954a;
    --air:#6ab0e6;
    --font: "Segoe UI", system-ui, sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:var(--font);
    background:var(--ink);
    color:var(--text);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    overflow-x:hidden;
  }

  /* ---- Hero / backdrop ---- */
  .hero{
    position:relative;
    min-height:230px;
    display:flex;
    align-items:flex-end;
    overflow:hidden;
    border-bottom:2px solid var(--gold);
  }
  .hero img.backdrop{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:cover;
    filter:saturate(1.05) contrast(1.05);
    z-index:0;
  }
  .hero::after{
    content:"";position:absolute;inset:0;z-index:1;
    background:
      linear-gradient(180deg, rgba(12,15,20,.35) 0%, rgba(12,15,20,.05) 40%, rgba(12,15,20,.85) 100%),
      linear-gradient(90deg, rgba(12,15,20,.75) 0%, rgba(12,15,20,0) 55%);
  }
  .hero-inner{
    position:relative;z-index:2;
    width:100%;
    max-width:1200px;
    margin:0 auto;
    padding:26px 32px 22px;
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:20px;
    flex-wrap:wrap;
  }
  .brandline{display:flex;flex-direction:column;gap:6px}
  .kicker{
    font-size:.7rem;letter-spacing:.42em;text-transform:uppercase;
    color:var(--gold-bright);font-weight:700;
  }
  .brandline h1{
    font-size:clamp(2rem,5vw,3.4rem);
    letter-spacing:.06em;
    line-height:.95;
    text-shadow:0 3px 18px rgba(0,0,0,.6);
  }
  .brandline h1 b{color:var(--gold)}
  .subtitle{color:var(--muted);font-size:.85rem;max-width:44ch}

  .btn{
    font-family:var(--font);
    cursor:pointer;
    border:1px solid var(--line);
    background:var(--panel);
    color:var(--text);
    padding:12px 20px;
    font-size:.8rem;
    letter-spacing:.14em;
    text-transform:uppercase;
    font-weight:700;
    transition:all .16s ease;
    clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
  }
  .btn:hover{border-color:var(--gold);color:var(--gold-bright);background:var(--panel2)}
  .btn:focus-visible{outline:2px solid var(--gold-bright);outline-offset:2px}
  .btn-return{background:rgba(20,25,34,.7);backdrop-filter:blur(3px)}

  /* ---- Wallet strip ---- */
  .walletbar{
    background:linear-gradient(180deg,var(--ink2),var(--ink));
    border-bottom:1px solid var(--line);
  }
  .walletbar-inner{
    max-width:1200px;margin:0 auto;
    padding:12px 32px;
    display:flex;align-items:center;gap:26px;flex-wrap:wrap;
  }
  .wallet{display:flex;align-items:center;gap:10px}
  .coin{
    width:22px;height:22px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,var(--gold-bright),var(--gold) 60%,#8a6520);
    box-shadow:0 0 8px rgba(217,164,65,.5);
    display:grid;place-items:center;
    font-size:.7rem;font-weight:900;color:#4a3410;
  }
  .wallet .amt{font-weight:800;font-size:1.05rem;letter-spacing:.03em}
  .wallet .lbl{color:var(--muted);font-size:.68rem;letter-spacing:.2em;text-transform:uppercase}
  .tabs{margin-left:auto;display:flex;gap:4px}
  .tab{
    background:transparent;border:1px solid transparent;color:var(--muted);
    padding:8px 16px;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
    font-weight:700;cursor:pointer;transition:.15s;
  }
  .tab:hover{color:var(--text)}
  .tab.active{color:var(--ink);background:var(--gold);border-color:var(--gold)}

  /* ---- Main grid ---- */
  main{
    flex:1;
    max-width:1200px;width:100%;margin:0 auto;
    padding:32px;
  }
  .section-head{
    display:flex;align-items:baseline;gap:14px;margin-bottom:18px;
  }
  .section-head h2{
    font-size:1.1rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;
  }
  .section-head span{color:var(--muted);font-size:.75rem;letter-spacing:.1em}
  .rule{flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}

  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
    gap:18px;
  }
  .card{
    position:relative;
    background:linear-gradient(180deg,var(--panel2),var(--panel));
    border:1px solid var(--line);
    display:flex;flex-direction:column;
    overflow:hidden;
    transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;
  }
  .card:hover{transform:translateY(-4px);border-color:var(--gold);box-shadow:0 12px 30px rgba(0,0,0,.5)}
  .card-art{
    position:relative;
    height:130px;
    background:
      radial-gradient(circle at 50% 35%,rgba(217,164,65,.14),transparent 60%),
      repeating-linear-gradient(135deg,rgba(255,255,255,.02) 0 8px,transparent 8px 16px),
      var(--ink2);
    display:grid;place-items:center;
    border-bottom:1px solid var(--line);
  }
  .glyph{
    width:64px;height:64px;
    filter:drop-shadow(0 4px 8px rgba(0,0,0,.6));
    opacity:.92;
  }
  .badge{
    position:absolute;top:10px;left:10px;
    font-size:.6rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase;
    padding:4px 8px;color:var(--ink);
  }
  .b-t1{background:var(--org)} .b-t2{background:var(--air)} .b-t3{background:var(--gold-bright)}
  .b-struct{background:var(--mach)}
  .card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px;flex:1}
  .card-body h3{font-size:.95rem;letter-spacing:.03em}
  .card-body .role{color:var(--muted);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}
  .stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:2px}
  .stat{display:flex;flex-direction:column}
  .stat b{font-size:.9rem;color:var(--gold-bright)}
  .stat small{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .buyrow{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--line)}
  .price{display:flex;align-items:center;gap:6px;font-weight:800}
  .price .coin{width:16px;height:16px;font-size:.55rem}
  .buy{
    border:1px solid var(--gold);background:transparent;color:var(--gold-bright);
    padding:8px 14px;font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
    cursor:pointer;transition:.15s;
  }
  .buy:hover{background:var(--gold);color:var(--ink)}
  .owned{color:var(--muted);border-color:var(--line);cursor:default}
  .owned:hover{background:transparent;color:var(--muted)}

  .note{
    margin-top:34px;padding:16px 18px;
    border:1px dashed var(--line);
    background:rgba(20,25,34,.5);
    color:var(--muted);font-size:.74rem;line-height:1.6;letter-spacing:.02em;
  }
  .note b{color:var(--steel)}

  footer{
    border-top:1px solid var(--line);
    padding:16px 32px;
    text-align:center;
    color:var(--muted);
    font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;
  }

  @media(max-width:560px){
    .hero-inner,.walletbar-inner,main{padding-left:18px;padding-right:18px}
    .tabs{width:100%;order:3;flex-wrap:wrap}
  }
</style>
</head>
<body>

  <header class="hero">
    <img class="backdrop" src="mm://backdrop" alt="">
    <div class="hero-inner">
      <div class="brandline">
        <span class="kicker">Quartermaster · Requisition</span>
        <h1><b>BULWARK</b> STORE</h1>
        <p class="subtitle">Spend your bounties on units, structures, and tier upgrades before the next wave breaks.</p>
      </div>
      <button class="btn btn-return" data-action="navigate:scr_ab5f1vj" aria-label="Return to main menu">◄ Return to Menu</button>
    </div>
  </header>

  <div class="walletbar">
    <div class="walletbar-inner">
      <div class="wallet">
        <span class="coin">G</span>
        <div>
          <div class="amt">4,820</div>
          <div class="lbl">Gold Bounty</div>
        </div>
      </div>
      <div class="wallet">
        <span class="coin" style="background:radial-gradient(circle at 35% 30%,#9fd4ff,#4d8fce 60%,#274a70)">C</span>
        <div>
          <div class="amt">37</div>
          <div class="lbl">Captures</div>
        </div>
      </div>
      <nav class="tabs" aria-label="Store categories">
        <button class="tab active">Units</button>
        <button class="tab">Structures</button>
        <button class="tab">Upgrades</button>
      </nav>
    </div>
  </div>

  <main>
    <div class="section-head">
      <h2>Field Units</h2>
      <span>9 factions · 8 shape classes · T1–T3</span>
      <div class="rule"></div>
    </div>

    <div class="grid">

      <article class="card">
        <div class="card-art">
          <span class="badge b-t1">T1</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#7ec46a" stroke-width="3"><circle cx="32" cy="18" r="8"/><path d="M20 56v-14a12 12 0 0124 0v14"/></svg>
        </div>
        <div class="card-body">
          <h3>Vanguard Troops</h3>
          <div class="role">Walker · Organic</div>
          <div class="stats">
            <div class="stat"><b>120</b><small>HP</small></div>
            <div class="stat"><b>18</b><small>DPS</small></div>
            <div class="stat"><b>Kinetic</b><small>Dmg</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>240</div>
            <button class="buy">Buy</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-art">
          <span class="badge b-t2">T2</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#e0954a" stroke-width="3"><rect x="12" y="30" width="40" height="16" rx="2"/><circle cx="22" cy="50" r="5"/><circle cx="42" cy="50" r="5"/><path d="M30 30l6-12h6"/></svg>
        </div>
        <div class="card-body">
          <h3>Ridgeback Tank</h3>
          <div class="role">Walker · Machinery</div>
          <div class="stats">
            <div class="stat"><b>640</b><small>HP</small></div>
            <div class="stat"><b>52</b><small>DPS</small></div>
            <div class="stat"><b>Kinetic</b><small>Dmg</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>980</div>
            <button class="buy">Buy</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-art">
          <span class="badge b-t2">T2</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#6ab0e6" stroke-width="3"><path d="M8 26h48"/><ellipse cx="32" cy="30" rx="12" ry="6"/><path d="M32 24v-8M20 40l-6 8M44 40l6 8"/></svg>
        </div>
        <div class="card-body">
          <h3>Hawkspine Copter</h3>
          <div class="role">Flyer · Aircraft · Both</div>
          <div class="stats">
            <div class="stat"><b>310</b><small>HP</small></div>
            <div class="stat"><b>44</b><small>DPS</small></div>
            <div class="stat"><b>Fire</b><small>Dmg</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>1,150</div>
            <button class="buy">Buy</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-art">
          <span class="badge b-t3">T3</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#f2c86b" stroke-width="3"><rect x="14" y="34" width="36" height="14" rx="2"/><circle cx="24" cy="52" r="4"/><circle cx="40" cy="52" r="4"/><path d="M28 34l22-16"/></svg>
        </div>
        <div class="card-body">
          <h3>Longbarrel Artillery</h3>
          <div class="role">Walker · Targets Structures</div>
          <div class="stats">
            <div class="stat"><b>420</b><small>HP</small></div>
            <div class="stat"><b>88</b><small>DPS</small></div>
            <div class="stat"><b>Concuss</b><small>Dmg</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>1,760</div>
            <button class="buy">Buy</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-art">
          <span class="badge b-t3">T3</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#f2c86b" stroke-width="3"><path d="M32 8l6 20h-12z"/><path d="M26 28h12v20h-12z"/><path d="M22 48l4 8M42 48l-4 8"/></svg>
        </div>
        <div class="card-body">
          <h3>Skyhammer Missile</h3>
          <div class="role">Flyer · Aircraft · Both</div>
          <div class="stats">
            <div class="stat"><b>90</b><small>HP</small></div>
            <div class="stat"><b>140</b><small>DPS</small></div>
            <div class="stat"><b>Electric</b><small>Dmg</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>2,300</div>
            <button class="buy">Buy</button>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-art">
          <span class="badge b-t1">T1</span>
          <svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="#7ec46a" stroke-width="3"><rect x="10" y="28" width="44" height="18" rx="3"/><circle cx="22" cy="50" r="5"/><circle cx="42" cy="50" r="5"/></svg>
        </div>
        <div class="card-body">
          <h3>Haulrig Truck</h3>
          <div class="role">Walker · Machinery</div>
          <div class="stats">
            <div class="stat"><b>280</b><small>HP</small></div>
            <div class="stat"><b>12</b><small>DPS</small></div>
            <div class="stat"><b>Utility</b><small>Role</small></div>
          </div>
          <div class="buyrow">
            <div class="price"><span class="coin">G</span>360</div>
            <button class="buy owned" aria-disabled="true">Owned</button>
          </div>
        </div>
      </article>

    </div>

    <div class="note">
      <b>Quartermaster note:</b> Prices, HP, DPS and effectiveness are read live from <b>bulwark-balance.xlsx</b> — no value shown here is hardcoded (GDD §18). Basic units path to and attack the enemy base; only Artillery-class units engage structures.
    </div>
  </main>

  <footer>BULWARK · Day Build Requisition · Deterministic Core v.SLICE</footer>

</body>
</html>