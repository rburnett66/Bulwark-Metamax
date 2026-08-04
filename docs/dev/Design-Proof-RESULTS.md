<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Results</title>
<style>
  :root{
    --ink:#0c1116;
    --panel:#141c24;
    --panel-2:#1b2630;
    --edge:#2e3d4a;
    --steel:#8fa6b4;
    --steel-dim:#5f7484;
    --gold:#e0a437;
    --gold-bright:#f6c860;
    --victory:#5fd08b;
    --text:#dfe8ee;
    --muted:#8397a4;
    --font: "Rajdhani","Segoe UI",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:var(--font);
    background:var(--ink);
    color:var(--text);
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    overflow-x:hidden;
  }

  .stage{
    position:relative;
    width:100%;
    max-width:960px;
    border:1px solid var(--edge);
    border-radius:6px;
    overflow:hidden;
    background:var(--panel);
    box-shadow:0 24px 80px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.02);
  }

  /* ---- HERO / BACKDROP ---- */
  .hero{
    position:relative;
    min-height:300px;
    display:flex;
    flex-direction:column;
    justify-content:flex-end;
    padding:32px 34px 26px;
    isolation:isolate;
  }
  .hero .backdrop{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    z-index:-2;
    filter:saturate(1.05) contrast(1.05);
  }
  .hero::before{
    content:"";
    position:absolute;
    inset:0;
    z-index:-1;
    background:
      radial-gradient(120% 90% at 78% 10%, rgba(224,164,55,.14), transparent 55%),
      linear-gradient(to top, rgba(8,12,16,.96) 8%, rgba(8,12,16,.65) 44%, rgba(8,12,16,.15) 100%);
  }

  .eyebrow{
    display:flex;
    align-items:center;
    gap:10px;
    font-size:.72rem;
    letter-spacing:.42em;
    text-transform:uppercase;
    color:var(--muted);
    margin-bottom:8px;
  }
  .eyebrow .dot{
    width:8px;height:8px;border-radius:50%;
    background:var(--victory);
    box-shadow:0 0 12px var(--victory);
  }
  .title{
    font-size:clamp(2.6rem,7vw,4.4rem);
    font-weight:700;
    line-height:.92;
    letter-spacing:.02em;
    text-transform:uppercase;
    color:var(--victory);
    text-shadow:0 4px 30px rgba(95,208,139,.35),0 2px 0 rgba(0,0,0,.6);
  }
  .subtitle{
    margin-top:6px;
    font-size:.9rem;
    letter-spacing:.28em;
    text-transform:uppercase;
    color:var(--steel);
  }

  /* ---- BODY ---- */
  .body{
    padding:26px 34px 32px;
    background:
      linear-gradient(180deg,var(--panel) 0%, var(--ink) 100%);
  }

  .rewards{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:14px;
    margin-bottom:26px;
  }
  .card{
    position:relative;
    background:var(--panel-2);
    border:1px solid var(--edge);
    border-radius:5px;
    padding:16px 16px 15px;
    overflow:hidden;
  }
  .card::after{
    content:"";
    position:absolute;
    top:0;left:0;
    width:3px;height:100%;
    background:var(--gold);
  }
  .card .lbl{
    font-size:.68rem;
    letter-spacing:.24em;
    text-transform:uppercase;
    color:var(--muted);
    margin-bottom:8px;
  }
  .card .val{
    font-size:1.9rem;
    font-weight:700;
    color:var(--text);
    display:flex;
    align-items:baseline;
    gap:6px;
    line-height:1;
  }
  .card .val .coin{color:var(--gold-bright)}
  .card .sub{
    margin-top:6px;
    font-size:.74rem;
    color:var(--steel-dim);
    letter-spacing:.06em;
  }

  .stats{
    border-top:1px solid var(--edge);
    border-bottom:1px solid var(--edge);
    padding:18px 0;
    margin-bottom:28px;
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:8px;
  }
  .stat{
    text-align:center;
    padding:2px 6px;
    border-right:1px solid var(--edge);
  }
  .stat:last-child{border-right:none}
  .stat .n{
    font-size:1.5rem;
    font-weight:700;
    color:var(--steel);
    line-height:1.1;
  }
  .stat .k{
    font-size:.64rem;
    letter-spacing:.18em;
    text-transform:uppercase;
    color:var(--muted);
    margin-top:4px;
  }

  .unlock{
    display:flex;
    align-items:center;
    gap:14px;
    background:linear-gradient(90deg, rgba(224,164,55,.1), transparent);
    border:1px solid rgba(224,164,55,.35);
    border-radius:5px;
    padding:14px 18px;
    margin-bottom:28px;
  }
  .unlock .badge{
    flex:0 0 auto;
    width:44px;height:44px;
    display:grid;place-items:center;
    border-radius:50%;
    border:2px solid var(--gold);
    color:var(--gold-bright);
    font-size:1.2rem;
    box-shadow:0 0 18px rgba(224,164,55,.3);
  }
  .unlock .txt .u-lbl{
    font-size:.66rem;
    letter-spacing:.28em;
    text-transform:uppercase;
    color:var(--gold);
    margin-bottom:3px;
  }
  .unlock .txt .u-name{
    font-size:1.05rem;
    font-weight:600;
    color:var(--text);
    letter-spacing:.04em;
  }

  .actions{
    display:flex;
    justify-content:center;
  }
  .btn{
    font-family:var(--font);
    cursor:pointer;
    border:none;
    font-size:.92rem;
    font-weight:600;
    letter-spacing:.22em;
    text-transform:uppercase;
    color:var(--ink);
    background:linear-gradient(180deg,var(--gold-bright),var(--gold));
    padding:15px 46px;
    border-radius:4px;
    position:relative;
    transition:transform .12s ease, box-shadow .12s ease, filter .12s ease;
    box-shadow:0 6px 20px rgba(224,164,55,.3),inset 0 1px 0 rgba(255,255,255,.4);
  }
  .btn:hover{transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 10px 28px rgba(224,164,55,.42)}
  .btn:active{transform:translateY(0)}
  .btn:focus-visible{outline:3px solid var(--steel);outline-offset:3px}

  @media(max-width:620px){
    .rewards{grid-template-columns:1fr}
    .stats{grid-template-columns:repeat(2,1fr)}
    .stat:nth-child(2n){border-right:none}
    .stat{border-bottom:1px solid var(--edge);padding-bottom:10px;margin-bottom:2px}
    .body{padding:22px 20px 26px}
    .hero{padding:26px 22px 22px}
  }
</style>
</head>
<body>
  <main class="stage" role="main" aria-label="Battle results">
    <section class="hero">
      <img class="backdrop" src="mm://backdrop" alt="">
      <p class="eyebrow"><span class="dot"></span> Wave Cleared · Day Battle</p>
      <h1 class="title">Victory</h1>
      <p class="subtitle">Bulwark Holds — Sector 07 Secured</p>
    </section>

    <section class="body">
      <div class="rewards">
        <div class="card">
          <div class="lbl">Bounty</div>
          <div class="val"><span class="coin">◈</span>4,820</div>
          <div class="sub">+620 flawless bonus</div>
        </div>
        <div class="card">
          <div class="lbl">Captures</div>
          <div class="val">3</div>
          <div class="sub">Units salvaged to roster</div>
        </div>
        <div class="card">
          <div class="lbl">Rating</div>
          <div class="val">S<span style="font-size:1rem;color:var(--steel-dim)">-tier</span></div>
          <div class="sub">Defense held at 96%</div>
        </div>
      </div>

      <div class="stats" aria-label="Battle statistics">
        <div class="stat"><div class="n">41</div><div class="k">Kills</div></div>
        <div class="stat"><div class="n">7</div><div class="k">Losses</div></div>
        <div class="stat"><div class="n">12</div><div class="k">Structures</div></div>
        <div class="stat"><div class="n">6:24</div><div class="k">Time</div></div>
      </div>

      <div class="unlock">
        <div class="badge">★</div>
        <div class="txt">
          <div class="u-lbl">Story Unlocked</div>
          <div class="u-name">Chapter II — The Floaters' Advance</div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn" data-action="navigate:scr_ab5f1vj">Return to Menu</button>
      </div>
    </section>
  </main>
</body>
</html>