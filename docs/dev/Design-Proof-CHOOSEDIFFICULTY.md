<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Choose Difficulty</title>
<style>
  :root{
    --gold:#e8b64a;
    --gold-bright:#f6d47f;
    --steel:#8a96a3;
    --ink:#0c1116;
    --ink2:#131b23;
    --panel:#1a232d;
    --line:rgba(232,182,74,.28);
    --txt:#e6edf3;
    --muted:#93a1af;
    --danger:#c8503a;
    --shadow:0 12px 40px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
    background:var(--ink);
    color:var(--txt);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    overflow-x:hidden;
  }

  /* Backdrop */
  .backdrop{
    position:fixed;
    inset:0;
    z-index:0;
  }
  .backdrop img{
    width:100%;height:100%;
    object-fit:cover;
    filter:saturate(.85) brightness(.55);
  }
  .scrim{
    position:fixed;inset:0;z-index:1;
    background:
      radial-gradient(120% 80% at 50% 0%, rgba(12,17,22,.15) 0%, rgba(12,17,22,.75) 55%, rgba(12,17,22,.96) 100%),
      linear-gradient(180deg, rgba(12,17,22,.55) 0%, rgba(12,17,22,.2) 40%, rgba(12,17,22,.85) 100%);
  }

  .wrap{
    position:relative;z-index:2;
    flex:1;
    display:flex;
    flex-direction:column;
    padding:clamp(18px,4vw,44px);
    max-width:1240px;
    margin:0 auto;
    width:100%;
  }

  header{
    display:flex;
    align-items:center;
    gap:16px;
    margin-bottom:clamp(20px,5vh,48px);
  }
  .brand{
    display:flex;align-items:center;gap:14px;
  }
  .sigil{
    width:44px;height:44px;
    display:grid;place-items:center;
    background:linear-gradient(160deg,var(--gold-bright),var(--gold));
    color:var(--ink);
    font-weight:900;
    border-radius:6px;
    box-shadow:0 0 22px rgba(232,182,74,.35);
    transform:rotate(45deg);
  }
  .sigil span{transform:rotate(-45deg)}
  .brand-txt h1{
    font-size:22px;letter-spacing:.42em;font-weight:800;
    background:linear-gradient(90deg,var(--gold-bright),var(--gold));
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .brand-txt p{font-size:11px;letter-spacing:.32em;color:var(--muted);text-transform:uppercase;margin-top:3px}

  .heading{
    text-align:center;
    margin-bottom:clamp(24px,5vh,40px);
  }
  .heading .kicker{
    display:inline-block;
    font-size:11px;letter-spacing:.42em;text-transform:uppercase;
    color:var(--gold);
    border:1px solid var(--line);
    padding:6px 16px;
    border-radius:2px;
    margin-bottom:16px;
  }
  .heading h2{
    font-size:clamp(28px,5vw,48px);
    letter-spacing:.14em;
    font-weight:800;
    text-transform:uppercase;
  }
  .heading p{color:var(--muted);margin-top:10px;font-size:14px;letter-spacing:.03em}

  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
    gap:clamp(14px,2vw,22px);
    margin-top:auto;
    margin-bottom:auto;
  }

  .card{
    position:relative;
    display:flex;flex-direction:column;
    text-align:left;
    background:linear-gradient(165deg,rgba(26,35,45,.94),rgba(12,17,22,.92));
    border:1px solid var(--line);
    border-radius:10px;
    padding:26px 22px 22px;
    cursor:pointer;
    color:var(--txt);
    font-family:inherit;
    overflow:hidden;
    transition:transform .18s ease, border-color .18s, box-shadow .18s;
    box-shadow:var(--shadow);
  }
  .card::before{
    content:"";
    position:absolute;top:0;left:0;right:0;height:3px;
    background:var(--accent,var(--gold));
    opacity:.85;
  }
  .card:hover,.card:focus-visible{
    transform:translateY(-6px);
    border-color:var(--accent,var(--gold));
    box-shadow:0 18px 46px rgba(0,0,0,.6),0 0 0 1px var(--accent,var(--gold)) inset;
    outline:none;
  }
  .card .tier{
    font-size:11px;letter-spacing:.34em;text-transform:uppercase;
    color:var(--accent,var(--gold));
    font-weight:700;
  }
  .card h3{
    font-size:26px;letter-spacing:.06em;text-transform:uppercase;
    margin:6px 0 12px;font-weight:800;
  }
  .card .desc{
    font-size:13px;color:var(--muted);line-height:1.5;
    flex:1;margin-bottom:18px;
  }
  .threat{
    display:flex;gap:5px;margin-bottom:20px;align-items:center;
  }
  .threat span{font-size:10px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-right:6px}
  .pip{width:22px;height:5px;border-radius:2px;background:rgba(255,255,255,.12)}
  .pip.on{background:var(--accent,var(--gold))}

  .go{
    display:flex;align-items:center;justify-content:space-between;
    padding:11px 16px;
    border-radius:6px;
    background:linear-gradient(135deg,var(--accent,var(--gold)),color-mix(in srgb,var(--accent,var(--gold)) 65%, #000));
    color:var(--ink);
    font-weight:800;letter-spacing:.28em;font-size:13px;
    text-transform:uppercase;
  }
  .go svg{transition:transform .18s}
  .card:hover .go svg{transform:translateX(4px)}

  .stat{
    display:flex;justify-content:space-between;
    font-size:11px;color:var(--muted);
    padding:5px 0;
    border-top:1px dashed rgba(255,255,255,.08);
    letter-spacing:.05em;
  }
  .stat b{color:var(--txt);font-weight:600}

  footer{
    text-align:center;
    margin-top:clamp(20px,4vh,34px);
    font-size:11px;letter-spacing:.2em;color:var(--muted);
    text-transform:uppercase;
  }
  footer .fog{color:var(--gold)}
</style>
</head>
<body>
  <div class="backdrop"><img src="mm://backdrop" alt=""></div>
  <div class="scrim" aria-hidden="true"></div>

  <div class="wrap">
    <header>
      <div class="brand">
        <div class="sigil"><span>B</span></div>
        <div class="brand-txt">
          <h1>BULWARK</h1>
          <p>Deploy · Fortify · Defend</p>
        </div>
      </div>
    </header>

    <div class="heading">
      <span class="kicker">Pre-Deployment</span>
      <h2>Choose Difficulty</h2>
      <p>Set the wave pressure before you scout the fog and raise your bulwark.</p>
    </div>

    <div class="grid" role="group" aria-label="Difficulty options">

      <button class="card" style="--accent:#5fae7c" data-action="navigate:scr_zc7dhlv">
        <span class="tier">Tier I</span>
        <h3>Recruit</h3>
        <p class="desc">Sparse waves, generous bounties. Learn the deploy loop without losing the base.</p>
        <div class="threat"><span>Threat</span>
          <i class="pip on"></i><i class="pip"></i><i class="pip"></i><i class="pip"></i><i class="pip"></i>
        </div>
        <div class="stat"><span>Wave Density</span><b>×0.6</b></div>
        <div class="stat"><span>Bounty Yield</span><b>+50%</b></div>
        <div class="go">Play <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h13M13 6l6 6-6 6"/></svg></div>
      </button>

      <button class="card" style="--accent:#e8b64a" data-action="navigate:scr_zc7dhlv">
        <span class="tier">Tier II</span>
        <h3>Veteran</h3>
        <p class="desc">Balanced pressure. Counter-graph matchups matter — mix armor and damage types.</p>
        <div class="threat"><span>Threat</span>
          <i class="pip on"></i><i class="pip on"></i><i class="pip on"></i><i class="pip"></i><i class="pip"></i>
        </div>
        <div class="stat"><span>Wave Density</span><b>×1.0</b></div>
        <div class="stat"><span>Bounty Yield</span><b>Base</b></div>
        <div class="go">Play <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h13M13 6l6 6-6 6"/></svg></div>
      </button>

      <button class="card" style="--accent:#d98a3c" data-action="navigate:scr_zc7dhlv">
        <span class="tier">Tier III</span>
        <h3>Commander</h3>
        <p class="desc">Dense assaults, faster tiers. Artillery breaches punish soft structures fast.</p>
        <div class="threat"><span>Threat</span>
          <i class="pip on"></i><i class="pip on"></i><i class="pip on"></i><i class="pip on"></i><i class="pip"></i>
        </div>
        <div class="stat"><span>Wave Density</span><b>×1.5</b></div>
        <div class="stat"><span>Bounty Yield</span><b>+15%</b></div>
        <div class="go">Play <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h13M13 6l6 6-6 6"/></svg></div>
      </button>

      <button class="card" style="--accent:#c8503a" data-action="navigate:scr_zc7dhlv">
        <span class="tier">Tier X</span>
        <h3>Warlord</h3>
        <p class="desc">Relentless multi-domain onslaught. No mistakes — the bulwark holds or it falls.</p>
        <div class="threat"><span>Threat</span>
          <i class="pip on"></i><i class="pip on"></i><i class="pip on"></i><i class="pip on"></i><i class="pip on"></i>
        </div>
        <div class="stat"><span>Wave Density</span><b>×2.2</b></div>
        <div class="stat"><span>Bounty Yield</span><b>+40%</b></div>
        <div class="go">Play <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h13M13 6l6 6-6 6"/></svg></div>
      </button>

    </div>

    <footer>Fog of war means the enemy is <span class="fog">scouted, not free</span> — GDD §5</footer>
  </div>
</body>
</html>