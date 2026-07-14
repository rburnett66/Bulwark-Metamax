<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Loading</title>
<style>
  :root{
    --ink:#0c1116;
    --steel:#1a2530;
    --gold:#e7b23c;
    --gold-hi:#ffd873;
    --cyan:#4fd0e0;
    --line:rgba(231,178,60,.35);
    --txt:#dfe6ec;
    --muted:#8ea1b0;
    --font: "Rajdhani","Segoe UI",system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:var(--font);
    background:var(--ink);
    color:var(--txt);
    overflow:hidden;
    display:flex;
    min-height:100vh;
  }

  .stage{
    position:relative;
    flex:1;
    display:flex;
    flex-direction:column;
    justify-content:flex-end;
  }

  .backdrop{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    z-index:0;
    filter:saturate(.9) contrast(1.05);
  }

  /* scrims for legibility */
  .scrim{
    position:absolute;
    inset:0;
    z-index:1;
    background:
      radial-gradient(120% 80% at 50% 0%, rgba(12,17,22,.25), rgba(12,17,22,.75) 70%),
      linear-gradient(180deg, rgba(12,17,22,.55) 0%, rgba(12,17,22,0) 30%, rgba(12,17,22,.85) 100%);
    pointer-events:none;
  }
  .grain{
    position:absolute;inset:0;z-index:1;pointer-events:none;
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,.015) 0 1px, transparent 1px 3px);
    mix-blend-mode:overlay;
  }

  /* top brand bar */
  .topbar{
    position:absolute;top:0;left:0;right:0;z-index:3;
    display:flex;align-items:center;justify-content:space-between;
    padding:22px 32px;
  }
  .brand{
    display:flex;align-items:center;gap:14px;
  }
  .crest{
    width:40px;height:40px;
    background:
      linear-gradient(145deg,var(--gold-hi),var(--gold) 60%,#9a7420);
    clip-path:polygon(50% 0,100% 25%,100% 72%,50% 100%,0 72%,0 25%);
    box-shadow:0 0 18px rgba(231,178,60,.45);
  }
  .wordmark{
    font-size:26px;font-weight:700;letter-spacing:.32em;
    color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6);
  }
  .wordmark b{color:var(--gold)}
  .build{
    font-size:11px;letter-spacing:.28em;color:var(--muted);
    text-transform:uppercase;
  }

  /* main content */
  .content{
    position:relative;z-index:3;
    padding:0 32px 46px;
    max-width:920px;
  }
  .tag{
    display:inline-flex;align-items:center;gap:9px;
    font-size:11px;letter-spacing:.3em;text-transform:uppercase;
    color:var(--cyan);margin-bottom:14px;
  }
  .tag::before{
    content:"";width:8px;height:8px;border-radius:50%;
    background:var(--cyan);box-shadow:0 0 10px var(--cyan);
    animation:pulse 1.4s infinite;
  }
  @keyframes pulse{50%{opacity:.25}}

  .headline{
    font-size:clamp(30px,6vw,58px);
    font-weight:700;line-height:1;letter-spacing:.04em;
    color:#fff;text-shadow:0 3px 20px rgba(0,0,0,.7);
    text-transform:uppercase;
  }
  .headline span{color:var(--gold)}
  .sub{
    margin-top:12px;max-width:560px;
    font-size:15px;color:var(--muted);letter-spacing:.02em;line-height:1.5;
  }

  /* progress */
  .progress-wrap{
    margin-top:30px;
    display:flex;align-items:center;gap:18px;flex-wrap:wrap;
  }
  .bar{
    flex:1;min-width:220px;height:10px;
    background:rgba(255,255,255,.08);
    border:1px solid var(--line);
    border-radius:2px;overflow:hidden;position:relative;
  }
  .bar::after{
    content:"";position:absolute;inset:0;left:-40%;width:40%;
    background:linear-gradient(90deg,transparent,var(--gold),var(--gold-hi),transparent);
    box-shadow:0 0 16px var(--gold);
    animation:sweep 1.9s cubic-bezier(.5,0,.3,1) infinite;
  }
  @keyframes sweep{to{left:100%}}
  .pct{
    font-size:14px;letter-spacing:.24em;color:var(--gold);font-weight:600;
    min-width:56px;text-align:right;
  }
  .status{
    margin-top:12px;font-size:12px;letter-spacing:.14em;
    color:var(--muted);text-transform:uppercase;
    display:flex;align-items:center;gap:8px;
  }
  .status .dot{
    width:6px;height:6px;background:var(--gold);border-radius:50%;
    animation:pulse 1s infinite;
  }

  /* tips row */
  .tips{
    margin-top:26px;
    border-top:1px solid rgba(255,255,255,.08);
    padding-top:16px;
    display:flex;gap:26px;flex-wrap:wrap;
  }
  .tip{max-width:230px}
  .tip .k{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--cyan);margin-bottom:5px}
  .tip .v{font-size:13px;color:var(--muted);line-height:1.4}

  /* enter action */
  .enter{
    margin-top:34px;
    display:flex;align-items:center;gap:16px;
  }
  .btn{
    appearance:none;border:none;cursor:pointer;font-family:var(--font);
    font-size:15px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
    color:var(--ink);
    padding:15px 40px;
    background:linear-gradient(140deg,var(--gold-hi),var(--gold) 55%,#b4841f);
    border:1px solid var(--gold-hi);
    clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
    box-shadow:0 6px 24px rgba(231,178,60,.35), inset 0 1px 0 rgba(255,255,255,.5);
    transition:transform .12s ease, box-shadow .12s ease, filter .12s;
  }
  .btn:hover{transform:translateY(-2px);filter:brightness(1.07);box-shadow:0 10px 30px rgba(231,178,60,.5), inset 0 1px 0 rgba(255,255,255,.5)}
  .btn:active{transform:translateY(0)}
  .btn:focus-visible{outline:3px solid var(--cyan);outline-offset:3px}
  .hint{font-size:11px;letter-spacing:.2em;color:var(--muted);text-transform:uppercase}

  @media (max-width:560px){
    .topbar{padding:16px 20px}
    .content{padding:0 20px 32px}
    .wordmark{font-size:20px}
    .btn{width:100%;justify-content:center}
    .enter{flex-direction:column;align-items:stretch}
  }
</style>
</head>
<body>
  <main class="stage">
    <img class="backdrop" src="mm://backdrop" alt="">
    <div class="scrim"></div>
    <div class="grain"></div>

    <header class="topbar">
      <div class="brand">
        <div class="crest" aria-hidden="true"></div>
        <div class="wordmark">BUL<b>WARK</b></div>
      </div>
      <div class="build">Vertical Slice · v0.9</div>
    </header>

    <section class="content">
      <span class="tag">Deploying Theater</span>
      <h1 class="headline">Fortify the <span>Line</span></h1>
      <p class="sub">Scouting biome atlases, seeding fog of war, and warming the deterministic core. Hold the base — the wave is inbound.</p>

      <div class="progress-wrap" role="progressbar" aria-label="Loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="78">
        <div class="bar"></div>
        <div class="pct">78%</div>
      </div>
      <div class="status"><span class="dot" aria-hidden="true"></span> Loading shape atlases · resolving pathing grid</div>

      <div class="tips">
        <div class="tip">
          <div class="k">Field Doctrine</div>
          <div class="v">Basic units path straight to your base — only Artillery breaks structures.</div>
        </div>
        <div class="tip">
          <div class="k">Counterplay</div>
          <div class="v">Anti-air targets Both. Match armor class to damage type to hold the wave.</div>
        </div>
        <div class="tip">
          <div class="k">Vision</div>
          <div class="v">Fog hides the biome you chose — radar reveals what walkers can't see.</div>
        </div>
      </div>

      <div class="enter">
        <button class="btn" type="button" data-action="navigate:scr_ab5f1vj">Enter Command</button>
        <span class="hint">Press to continue when ready</span>
      </div>
    </section>
  </main>
</body>
</html>