<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — View Replays</title>
<style>
  :root{
    --bg:#0c1116;
    --panel:#141c25;
    --panel-2:#1b2531;
    --line:#2a3846;
    --gold:#e8b23a;
    --gold-dim:#a8842c;
    --ink:#e6edf3;
    --muted:#8395a6;
    --blue:#3d6ea5;
    --frost:#5fb3c7;
    --fire:#d4632a;
    --electric:#e8d13a;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    background:var(--bg);
    color:var(--ink);
    display:flex;
    flex-direction:column;
    min-height:100vh;
    letter-spacing:.02em;
  }
  /* ===== Top bar ===== */
  header{
    display:flex;
    align-items:center;
    gap:24px;
    padding:14px 28px;
    background:linear-gradient(180deg,#101821,#0b1015);
    border-bottom:2px solid var(--line);
    position:sticky;top:0;z-index:20;
  }
  .brand{
    font-weight:900;
    font-size:26px;
    letter-spacing:.18em;
    color:var(--gold);
    text-shadow:0 2px 0 #000;
    display:flex;align-items:center;gap:12px;
  }
  .brand::before{
    content:"";width:22px;height:22px;
    background:
      linear-gradient(135deg,var(--gold),var(--gold-dim));
    clip-path:polygon(50% 0,100% 30%,100% 75%,50% 100%,0 75%,0 30%);
    box-shadow:inset 0 0 0 3px #0b1015;
  }
  nav{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
  .nav-btn{
    background:transparent;
    color:var(--muted);
    border:1px solid transparent;
    font:inherit;font-weight:700;font-size:13px;
    letter-spacing:.12em;
    padding:10px 16px;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:4px;
    transition:.15s;
  }
  .nav-btn:hover,.nav-btn:focus-visible{
    color:var(--ink);
    border-color:var(--line);
    background:var(--panel-2);
    outline:none;
  }
  .nav-btn.primary{
    color:#0b1015;
    background:linear-gradient(180deg,var(--gold),var(--gold-dim));
    box-shadow:0 2px 0 #6b5417,0 0 18px rgba(232,178,58,.25);
  }
  .nav-btn.primary:hover{filter:brightness(1.08)}

  /* ===== Hero backdrop ===== */
  .hero{
    position:relative;
    min-height:230px;
    display:flex;
    align-items:flex-end;
    overflow:hidden;
    border-bottom:2px solid var(--line);
  }
  .hero img{
    position:absolute;inset:0;
    width:100%;height:100%;
    object-fit:cover;
    filter:saturate(.9) brightness(.7);
  }
  .hero .scrim{
    position:absolute;inset:0;
    background:
      linear-gradient(90deg,rgba(9,13,17,.92) 0%,rgba(9,13,17,.4) 55%,rgba(9,13,17,.75) 100%),
      linear-gradient(0deg,rgba(9,13,17,.95),transparent 65%);
  }
  .hero-inner{
    position:relative;z-index:2;
    padding:34px 30px 26px;
    width:100%;
    display:flex;
    align-items:flex-end;
    gap:20px;
    flex-wrap:wrap;
  }
  .hero-inner h1{
    font-size:clamp(28px,5vw,46px);
    font-weight:900;
    letter-spacing:.06em;
    line-height:1;
    text-shadow:0 3px 0 #000;
  }
  .hero-inner h1 span{color:var(--gold)}
  .hero-tag{
    color:var(--muted);
    font-size:14px;
    max-width:420px;
    margin-top:8px;
  }
  .badge{
    margin-left:auto;
    display:flex;gap:10px;align-items:center;
    background:rgba(20,28,37,.8);
    border:1px solid var(--line);
    padding:8px 14px;border-radius:6px;
    font-size:12px;letter-spacing:.14em;
    color:var(--frost);font-weight:700;
  }
  .rec-dot{width:9px;height:9px;border-radius:50%;background:var(--fire);box-shadow:0 0 8px var(--fire)}

  /* ===== Body ===== */
  main{
    flex:1;
    padding:26px 30px 40px;
    display:grid;
    grid-template-columns:minmax(0,1fr) 300px;
    gap:24px;
    max-width:1400px;margin:0 auto;width:100%;
  }
  .section-title{
    font-size:13px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--muted);font-weight:800;
    margin-bottom:14px;display:flex;align-items:center;gap:10px;
  }
  .section-title::before{content:"";width:16px;height:2px;background:var(--gold)}

  .replay-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
    gap:16px;
  }
  .replay{
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:8px;
    overflow:hidden;
    cursor:pointer;
    transition:.15s;
    display:flex;flex-direction:column;
  }
  .replay:hover,.replay:focus-visible{
    border-color:var(--gold);
    transform:translateY(-3px);
    box-shadow:0 8px 22px rgba(0,0,0,.45);
    outline:none;
  }
  .thumb{
    height:118px;position:relative;
    background:linear-gradient(135deg,#1f2c39,#0f1720);
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;
  }
  .thumb::after{
    content:"";position:absolute;inset:0;
    background:radial-gradient(circle at 30% 20%,rgba(93,179,199,.15),transparent 60%);
  }
  .terrain{
    position:absolute;bottom:0;left:0;right:0;height:52%;
    background:
      linear-gradient(0deg,#243c2a,#1a2b1f);
    clip-path:polygon(0 40%,15% 25%,30% 45%,48% 20%,66% 42%,82% 22%,100% 38%,100% 100%,0 100%);
  }
  .play-ico{
    position:relative;z-index:2;
    width:44px;height:44px;border-radius:50%;
    background:rgba(232,178,58,.9);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 20px rgba(232,178,58,.4);
    transition:.15s;
  }
  .replay:hover .play-ico{transform:scale(1.12)}
  .play-ico::before{
    content:"";margin-left:4px;
    border-style:solid;border-width:9px 0 9px 15px;
    border-color:transparent transparent transparent #0b1015;
  }
  .dur{
    position:absolute;bottom:7px;right:8px;z-index:2;
    background:rgba(9,13,17,.85);
    color:var(--ink);font-size:11px;font-weight:700;
    padding:2px 7px;border-radius:3px;letter-spacing:.06em;
  }
  .r-body{padding:12px 13px 14px}
  .r-title{font-weight:800;font-size:14px;margin-bottom:5px}
  .r-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted)}
  .win{color:#6fce8a;font-weight:800;letter-spacing:.08em}
  .loss{color:#d47070;font-weight:800;letter-spacing:.08em}
  .tags{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
  .tag{
    font-size:10px;letter-spacing:.08em;font-weight:700;
    padding:3px 8px;border-radius:3px;
    background:var(--panel-2);border:1px solid var(--line);
    color:var(--muted);text-transform:uppercase;
  }
  .tag.frost{color:var(--frost);border-color:#2c4a54}
  .tag.fire{color:var(--fire);border-color:#4a2c22}
  .tag.elec{color:var(--electric);border-color:#4a4522}

  /* Sidebar */
  aside{display:flex;flex-direction:column;gap:20px}
  .card{
    background:var(--panel);
    border:1px solid var(--line);
    border-radius:8px;
    padding:18px;
  }
  .card h3{
    font-size:12px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--gold);margin-bottom:14px;font-weight:800;
  }
  .stat{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
  .stat:last-child{border-bottom:none}
  .stat b{color:var(--gold);font-weight:800}
  .filter-list{display:flex;flex-direction:column;gap:8px}
  .filter{
    background:var(--panel-2);border:1px solid var(--line);
    color:var(--muted);font:inherit;font-weight:700;font-size:12px;
    letter-spacing:.08em;text-align:left;padding:10px 12px;
    border-radius:5px;cursor:pointer;transition:.15s;text-transform:uppercase;
  }
  .filter:hover,.filter[aria-pressed="true"]{border-color:var(--gold);color:var(--ink);background:#22303e}
  .filter:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

  footer{
    text-align:center;padding:16px;
    color:var(--muted);font-size:11px;letter-spacing:.14em;
    border-top:1px solid var(--line);
  }
  @media(max-width:860px){
    main{grid-template-columns:1fr}
    aside{order:-1}
    nav{gap:4px}
    .nav-btn{padding:8px 10px;font-size:11px}
  }
</style>
</head>
<body>

<header>
  <div class="brand">BULWARK</div>
  <nav aria-label="Primary">
    <button class="nav-btn" data-action="navigate:scr_ab5f1vj">Choose Character</button>
    <button class="nav-btn primary" data-action="navigate:scr_ab5f1vj">Play</button>
    <button class="nav-btn" data-action="navigate:scr_ab5f1vj">Store</button>
    <button class="nav-btn" data-action="navigate:scr_ab5f1vj">Inventory</button>
    <button class="nav-btn" data-action="navigate:scr_ab5f1vj">Leaderboard</button>
    <button class="nav-btn" data-action="navigate:scr_ab5f1vj">Settings</button>
  </nav>
</header>

<section class="hero">
  <img src="mm://backdrop" alt="">
  <div class="scrim"></div>
  <div class="hero-inner">
    <div>
      <h1>VIEW <span>REPLAYS</span></h1>
      <p class="hero-tag">Deterministic event streams reproduced frame-for-frame by the audit core — every defense, exactly as it happened.</p>
    </div>
    <div class="badge"><span class="rec-dot"></span> C19 · BATTLE LOG</div>
  </div>
</section>

<main>
  <div>
    <div class="section-title">Recent Defenses</div>
    <div class="replay-grid">

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Ironmarsh Hold">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">4:12</span></div>
        <div class="r-body">
          <div class="r-title">Ironmarsh Hold</div>
          <div class="r-meta"><span>Wave 7 · Swamp</span><span class="win">VICTORY</span></div>
          <div class="tags"><span class="tag frost">Frost</span><span class="tag">Artillery</span></div>
        </div>
      </div>

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Ashfall Ridge">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">6:38</span></div>
        <div class="r-body">
          <div class="r-title">Ashfall Ridge</div>
          <div class="r-meta"><span>Wave 12 · Highland</span><span class="loss">BREACHED</span></div>
          <div class="tags"><span class="tag fire">Fire</span><span class="tag">Copters</span></div>
        </div>
      </div>

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Coldvein Delta">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">3:47</span></div>
        <div class="r-body">
          <div class="r-title">Coldvein Delta</div>
          <div class="r-meta"><span>Wave 5 · Coastal</span><span class="win">VICTORY</span></div>
          <div class="tags"><span class="tag elec">Electric</span><span class="tag">Swimmers</span></div>
        </div>
      </div>

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Grey Bastion">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">8:03</span></div>
        <div class="r-body">
          <div class="r-title">Grey Bastion</div>
          <div class="r-meta"><span>Wave 15 · Tundra</span><span class="win">VICTORY</span></div>
          <div class="tags"><span class="tag frost">Frost</span><span class="tag">Heavy Tanks</span></div>
        </div>
      </div>

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Emberfront">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">5:21</span></div>
        <div class="r-body">
          <div class="r-title">Emberfront</div>
          <div class="r-meta"><span>Wave 9 · Desert</span><span class="loss">BREACHED</span></div>
          <div class="tags"><span class="tag fire">Fire</span><span class="tag">Planes</span></div>
        </div>
      </div>

      <div class="replay" tabindex="0" role="button" aria-label="Play replay: Verdant Line">
        <div class="thumb"><div class="terrain"></div><div class="play-ico"></div><span class="dur">4:55</span></div>
        <div class="r-body">
          <div class="r-title">Verdant Line</div>
          <div class="r-meta"><span>Wave 8 · Forest</span><span class="win">VICTORY</span></div>
          <div class="tags"><span class="tag">Poison</span><span class="tag">Troops</span></div>
        </div>
      </div>

    </div>
  </div>

  <aside>
    <div class="card">
      <h3>Log Stats</h3>
      <div class="stat"><span>Replays Stored</span><b>24</b></div>
      <div class="stat"><span>Victories</span><b>17</b></div>
      <div class="stat"><span>Breaches</span><b>7</b></div>
      <div class="stat"><span>Best Wave</span><b>15</b></div>
      <div class="stat"><span>Total Runtime</span><b>2h 14m</b></div>
    </div>
    <div class="card">
      <h3>Filter</h3>
      <div class="filter-list">
        <button class="filter" aria-pressed="true">All Battles</button>
        <button class="filter" aria-pressed="false">Victories</button>
        <button class="filter" aria-pressed="false">Breaches</button>
        <button class="filter" aria-pressed="false">By Faction</button>
      </div>
    </div>
  </aside>
</main>

<footer>BULWARK · REPLAY &amp; BATTLE LOG (C19) — deterministic playback of the C6 event stream</footer>

<script>
  document.querySelectorAll('.filter').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.filter').forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
    });
  });
</script>
</body>
</html>