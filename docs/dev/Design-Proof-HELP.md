<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Help</title>
<style>
  :root{
    --ink:#e8ecef;
    --ink-dim:#9aa7b2;
    --gold:#e7b53c;
    --gold-deep:#b9861f;
    --steel:#1a2530;
    --steel-2:#101820;
    --panel:rgba(14,22,30,.82);
    --panel-line:rgba(231,181,60,.22);
    --accent:#5fb0d6;
    --shadow:0 18px 48px rgba(0,0,0,.55);
    --f:"Segoe UI",system-ui,-apple-system,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:var(--f);
    color:var(--ink);
    background:var(--steel-2);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    overflow-x:hidden;
  }

  /* Backdrop */
  .backdrop{position:fixed;inset:0;z-index:0}
  .backdrop img{width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(1.05)}
  .backdrop::after{
    content:"";position:absolute;inset:0;
    background:
      radial-gradient(120% 80% at 20% 0%,rgba(12,18,26,.35),transparent 60%),
      linear-gradient(180deg,rgba(8,12,18,.78) 0%,rgba(8,12,18,.55) 35%,rgba(8,12,18,.85) 100%);
  }

  /* Top bar */
  .topbar{
    position:relative;z-index:2;
    display:flex;align-items:center;gap:16px;
    padding:18px clamp(16px,4vw,44px);
    border-bottom:1px solid var(--panel-line);
    background:linear-gradient(180deg,rgba(9,14,20,.9),rgba(9,14,20,.35));
    backdrop-filter:blur(6px);
  }
  .brand{display:flex;align-items:center;gap:12px}
  .crest{
    width:38px;height:38px;flex:0 0 auto;
    display:grid;place-items:center;
    background:linear-gradient(160deg,var(--gold),var(--gold-deep));
    clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
    color:#1a1206;font-weight:900;font-size:20px;
    box-shadow:0 0 18px rgba(231,181,60,.35);
  }
  .brand h1{
    font-size:clamp(18px,2.4vw,24px);
    letter-spacing:.32em;font-weight:800;
  }
  .brand .sub{
    letter-spacing:.34em;font-size:10px;color:var(--gold);
    text-transform:uppercase;margin-top:2px;
  }
  .back-menu{
    margin-left:auto;
    background:transparent;border:1px solid var(--panel-line);
    color:var(--ink-dim);cursor:pointer;
    padding:10px 18px;border-radius:6px;
    letter-spacing:.18em;font-size:12px;text-transform:uppercase;
    transition:.2s;
  }
  .back-menu:hover{color:var(--gold);border-color:var(--gold);background:rgba(231,181,60,.08)}

  /* Main */
  main{
    position:relative;z-index:1;flex:1;
    padding:clamp(24px,5vw,60px) clamp(16px,5vw,60px) 60px;
    display:flex;flex-direction:column;align-items:center;
  }
  .hero{
    max-width:820px;text-align:center;margin-bottom:clamp(28px,4vw,48px);
  }
  .hero .eyebrow{
    display:inline-block;letter-spacing:.4em;font-size:11px;
    color:var(--gold);text-transform:uppercase;
    border:1px solid var(--panel-line);border-radius:20px;
    padding:6px 16px;margin-bottom:18px;
  }
  .hero h2{
    font-size:clamp(28px,5vw,48px);letter-spacing:.06em;font-weight:800;
    text-shadow:0 4px 24px rgba(0,0,0,.6);
  }
  .hero p{
    margin-top:14px;color:var(--ink-dim);font-size:clamp(14px,1.6vw,16px);
    line-height:1.6;max-width:620px;margin-inline:auto;
  }

  /* Cards */
  .cards{
    display:grid;gap:18px;width:100%;max-width:1040px;
    grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  }
  .card{
    text-align:left;cursor:pointer;
    background:var(--panel);
    border:1px solid var(--panel-line);
    border-radius:14px;padding:26px 24px 24px;
    box-shadow:var(--shadow);
    position:relative;overflow:hidden;
    transition:.22s ease;
    color:inherit;font:inherit;
    display:flex;flex-direction:column;
  }
  .card::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:linear-gradient(180deg,var(--gold),transparent);
    opacity:.7;
  }
  .card:hover{
    transform:translateY(-4px);
    border-color:var(--gold);
    box-shadow:0 22px 54px rgba(0,0,0,.6),0 0 0 1px rgba(231,181,60,.25);
  }
  .card .ico{
    width:52px;height:52px;border-radius:11px;
    display:grid;place-items:center;font-size:24px;margin-bottom:18px;
    background:linear-gradient(160deg,rgba(231,181,60,.18),rgba(231,181,60,.04));
    border:1px solid var(--panel-line);
  }
  .card h3{
    font-size:16px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
    margin-bottom:10px;
  }
  .card p{color:var(--ink-dim);font-size:13.5px;line-height:1.55;flex:1}
  .card .go{
    margin-top:18px;display:inline-flex;align-items:center;gap:8px;
    color:var(--gold);font-size:12px;letter-spacing:.18em;text-transform:uppercase;
    font-weight:700;
  }
  .card .go::after{content:"→";transition:.2s}
  .card:hover .go::after{transform:translateX(5px)}
  .card .tag{
    position:absolute;top:18px;right:18px;
    font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--accent);border:1px solid rgba(95,176,214,.3);
    padding:4px 8px;border-radius:5px;
  }

  footer{
    position:relative;z-index:1;text-align:center;
    padding:20px;color:var(--ink-dim);font-size:11px;letter-spacing:.2em;
    text-transform:uppercase;border-top:1px solid var(--panel-line);
    background:rgba(9,14,20,.6);
  }
  .card:focus-visible,.back-menu:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style>
</head>
<body>
  <div class="backdrop"><img src="mm://backdrop" alt=""></div>

  <header class="topbar">
    <div class="brand">
      <div class="crest">B</div>
      <div>
        <h1>BULWARK</h1>
        <div class="sub">Field Manual</div>
      </div>
    </div>
    <button class="back-menu" data-action="navigate:scr_ab5f1vj">← Menu</button>
  </header>

  <main>
    <section class="hero">
      <span class="eyebrow">Help &amp; Briefing</span>
      <h2>Hold the Line.</h2>
      <p>Scout the fog, fortify your base, and defend through the Day Battle / Day Build loop. Choose a briefing below — a live guide, or a step-by-step walkthrough of the deploy loop.</p>
    </section>

    <section class="cards" aria-label="Help topics">

      <button class="card" data-action="navigate:scr_ab5f1vj">
        <span class="tag">Live</span>
        <div class="ico">🛡️</div>
        <h3>Ask a Guide</h3>
        <p>Summon a field advisor for real-time answers on factions, counters, and structure lifecycles. Ideal when you're mid-campaign and need a fast call.</p>
        <span class="go">Request Briefing</span>
      </button>

      <button class="card" data-action="navigate:scr_ab5f1vj">
        <span class="tag">Basics</span>
        <div class="ico">🎯</div>
        <h3>How to Play</h3>
        <p>Learn the core verb — pick, preview, confirm. Master the deploy loop, read the fog of war, and turn scouted terrain into a defensible bulwark.</p>
        <span class="go">Start Walkthrough</span>
      </button>

      <button class="card" data-action="navigate:scr_ab5f1vj">
        <span class="tag">Advanced</span>
        <div class="ico">⚔️</div>
        <h3>How to Play</h3>
        <p>Go deeper into counter graphs, armor classes, and damage-type matchups. Optimize your roster across tiers T1–T3 and win the balance war.</p>
        <span class="go">Open Tactics</span>
      </button>

    </section>
  </main>

  <footer>BULWARK — Vertical Slice · Presentation Firewall Active</footer>
</body>
</html>