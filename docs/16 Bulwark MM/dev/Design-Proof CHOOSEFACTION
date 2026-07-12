<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Choose Faction</title>
<style>
  :root{
    --bg-0:#0b0f12;
    --bg-1:#121a20;
    --bg-2:#1a252d;
    --panel:#16211a;
    --line:#2c3d42;
    --gold:#d9a441;
    --gold-bright:#f2c766;
    --ink:#e7eef0;
    --ink-dim:#8fa3a8;
    --steel:#5b7d86;
    --accent:#4a8f9c;
    --danger:#b5473a;
    --shadow:0 8px 28px rgba(0,0,0,.55);
    --fx-sweep:conic-gradient(from -20deg, transparent 0deg, rgba(217,164,65,.55) 34deg, transparent 68deg);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",Roboto,system-ui,sans-serif;
    background:
      radial-gradient(1200px 700px at 50% -10%, #1c2b33 0%, var(--bg-0) 60%),
      var(--bg-0);
    color:var(--ink);
    min-height:100vh;
    display:flex;flex-direction:column;
    letter-spacing:.02em;
    overflow-x:hidden;
  }
  /* scanline / grid texture */
  body::before{
    content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:
      linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px);
    background-size:44px 44px;
    mask-image:radial-gradient(circle at 50% 30%, #000 0%, transparent 85%);
  }

  /* ---------- header ---------- */
  header{
    position:relative;z-index:2;
    display:flex;align-items:center;justify-content:space-between;
    gap:16px;
    padding:18px 32px;
    border-bottom:1px solid var(--line);
    background:linear-gradient(180deg, rgba(26,37,45,.85), rgba(11,15,18,.4));
  }
  .brand{display:flex;align-items:center;gap:14px}
  .crest{
    width:38px;height:38px;flex:0 0 auto;
    background:linear-gradient(135deg,var(--gold-bright),var(--gold));
    clip-path:polygon(50% 0,100% 25%,100% 72%,50% 100%,0 72%,0 25%);
    box-shadow:0 0 18px rgba(217,164,65,.4);
  }
  .brand h1{
    font-size:1.5rem;font-weight:800;letter-spacing:.28em;
    color:var(--ink);
  }
  .brand small{
    display:block;font-size:.6rem;letter-spacing:.42em;
    color:var(--gold);font-weight:700;margin-top:2px;
  }
  .step{
    font-size:.7rem;letter-spacing:.24em;color:var(--ink-dim);
    text-transform:uppercase;
  }
  .step b{color:var(--gold)}

  /* ---------- back button ---------- */
  .btn{
    font-family:inherit;cursor:pointer;border:1px solid var(--line);
    background:var(--bg-2);color:var(--ink);
    padding:10px 18px;font-size:.72rem;font-weight:700;
    letter-spacing:.18em;text-transform:uppercase;
    border-radius:3px;transition:.18s;
    display:inline-flex;align-items:center;gap:8px;
  }
  .btn:hover{border-color:var(--gold);color:var(--gold-bright);
    box-shadow:0 0 0 1px rgba(217,164,65,.3)}
  .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .btn .arw{font-size:1rem;transform:translateY(-1px)}

  /* ---------- layout ---------- */
  main{
    position:relative;z-index:1;flex:1;
    padding:34px 32px 24px;
    display:flex;flex-direction:column;
  }
  .title-row{
    display:flex;align-items:baseline;gap:16px;margin-bottom:6px;
  }
  .title-row h2{
    font-size:1.7rem;font-weight:800;letter-spacing:.14em;
  }
  .title-row .rule{flex:1;height:1px;background:linear-gradient(90deg,var(--gold),transparent)}
  .sub{
    color:var(--ink-dim);font-size:.82rem;max-width:720px;
    margin-bottom:26px;line-height:1.5;
  }

  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
    gap:16px;
  }

  .faction{
    position:relative;
    border:1px solid var(--line);
    background:linear-gradient(160deg,var(--bg-1),var(--panel));
    border-radius:5px;overflow:hidden;
    cursor:pointer;
    min-height:186px;
    display:flex;flex-direction:column;
    transition:.2s transform,.2s border-color,.2s box-shadow;
  }
  .faction:hover{transform:translateY(-4px);
    border-color:var(--fc,var(--gold));
    box-shadow:var(--shadow),0 0 0 1px var(--fc,var(--gold))}
  .faction:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .faction .top{
    height:82px;position:relative;
    background:
      radial-gradient(80px 60px at 50% 40%, var(--fc,#3a4a52) 0%, transparent 70%),
      linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.35));
    display:flex;align-items:center;justify-content:center;
  }
  .glyph{
    width:52px;height:52px;
    display:flex;align-items:center;justify-content:center;
    font-size:1.7rem;font-weight:800;
    color:#0b0f12;
    background:var(--fc,var(--steel));
    clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);
    box-shadow:0 4px 14px rgba(0,0,0,.5);
  }
  /* gold pie-sweep on hover */
  .faction .top::after{
    content:"";position:absolute;inset:0;
    background:var(--fx-sweep);opacity:0;
    transition:opacity .25s;
    mix-blend-mode:screen;
  }
  .faction:hover .top::after{opacity:.9;animation:sweep 1.2s linear infinite}
  @keyframes sweep{to{transform:rotate(360deg)}}

  .faction .body{padding:14px 15px 16px;flex:1;display:flex;flex-direction:column}
  .faction .fname{
    font-size:1rem;font-weight:800;letter-spacing:.08em;margin-bottom:3px;
  }
  .faction .frole{
    font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;
    color:var(--fc,var(--gold));font-weight:700;margin-bottom:10px;
  }
  .faction .fdesc{font-size:.72rem;color:var(--ink-dim);line-height:1.45}
  .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto;padding-top:12px}
  .chip{
    font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;
    padding:3px 7px;border:1px solid var(--line);border-radius:2px;
    color:var(--steel);
  }
  .align{
    position:absolute;top:8px;right:8px;
    font-size:.52rem;letter-spacing:.14em;text-transform:uppercase;
    padding:2px 7px;border-radius:20px;font-weight:700;
    background:rgba(0,0,0,.4);border:1px solid var(--line);
  }
  .a-order{color:var(--accent)}
  .a-neutral{color:var(--gold)}
  .a-chaos{color:var(--danger)}

  footer{
    position:relative;z-index:2;
    padding:14px 32px;border-top:1px solid var(--line);
    font-size:.62rem;letter-spacing:.22em;color:var(--ink-dim);
    text-transform:uppercase;display:flex;justify-content:space-between;
  }
  footer b{color:var(--gold)}

  @media(max-width:560px){
    header{padding:14px 18px}
    main{padding:24px 18px}
    .brand h1{font-size:1.15rem}
    .step{display:none}
  }
</style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="crest" aria-hidden="true"></div>
      <div>
        <h1>BULWARK</h1>
        <small>DEPLOYMENT COMMAND</small>
      </div>
    </div>
    <div class="step">STEP 01 · <b>CHOOSE FACTION</b> · 02 LOCATION · 03 GEAR</div>
    <button class="btn" data-action="navigate:scr_ab5f1vj" aria-label="Return to Menu">
      <span class="arw">‹</span> MENU
    </button>
  </header>

  <main>
    <div class="title-row">
      <h2>CHOOSE YOUR FACTION</h2>
      <span class="rule"></span>
    </div>
    <p class="sub">
      Nine factions — each a 72-unit doctrine across eight shape classes. Your choice seeds the
      counter graph, the armor bias, and the nine heroes across the alignment spectrum. Choose the
      silhouette you intend to master.
    </p>

    <div class="grid" role="list">

      <div class="faction" role="listitem" tabindex="0" style="--fc:#4a8f9c" data-action="navigate:scr_u4678ee">
        <span class="align a-order">Order</span>
        <div class="top"><div class="glyph">V</div></div>
        <div class="body">
          <div class="fname">VANGUARD</div>
          <div class="frole">Armored Line</div>
          <div class="fdesc">Machinery bias. Heavy tanks and shielded trucks trade speed for wall-breaking HP.</div>
          <div class="chips"><span class="chip">Kinetic</span><span class="chip">Machinery</span></div>
        </div>
      </div>

      <div class="faction" role="listitem" tabindex="0" style="--fc:#b5473a" data-action="navigate:scr_u4678ee">
        <span class="align a-chaos">Chaos</span>
        <div class="top"><div class="glyph">P</div></div>
        <div class="body">
          <div class="fname">PYRECLAD</div>
          <div class="frole">Scorch Doctrine</div>
          <div class="fdesc">Fire damage overwhelms organics. Fast trucks and artillery burn-down positions.</div>
          <div class="chips"><span class="chip">Fire</span><span class="chip">AoE</span></div>
        </div>
      </div>

      <div class="faction" role="listitem