<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK</title>
<style>
  :root{
    --gold:#d9a441;
    --gold-bright:#f2c869;
    --ink:#0c0e12;
    --ink-2:#14181f;
    --panel:#1a1f28;
    --panel-line:#2e3846;
    --steel:#8fa0b3;
    --text:#e6ecf3;
    --danger:#b8482f;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
    background:var(--ink);
    color:var(--text);
    overflow:hidden;
  }
  .stage{
    position:relative;
    width:100%;
    height:100vh;
    display:flex;
    flex-direction:column;
  }
  .backdrop{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    z-index:0;
    filter:saturate(1.05) contrast(1.02);
  }
  .scrim{
    position:absolute;inset:0;z-index:1;
    background:
      radial-gradient(120% 90% at 15% 20%, rgba(12,14,18,.15), rgba(12,14,18,.85) 75%),
      linear-gradient(90deg, rgba(12,14,18,.92) 0%, rgba(12,14,18,.55) 42%, rgba(12,14,18,.15) 100%),
      linear-gradient(0deg, rgba(12,14,18,.9) 0%, rgba(12,14,18,0) 40%);
  }
  .grain{
    position:absolute;inset:0;z-index:2;pointer-events:none;
    background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px);
    mix-blend-mode:overlay;
  }

  /* Top bar */
  .topbar{
    position:relative;z-index:5;
    display:flex;align-items:center;justify-content:space-between;
    padding:20px 30px;
  }
  .brand{display:flex;align-items:center;gap:14px}
  .crest{
    width:42px;height:42px;
    background:linear-gradient(160deg,var(--gold-bright),var(--gold));
    clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
    display:flex;align-items:center;justify-content:center;
    color:var(--ink);font-weight:900;font-size:20px;
    box-shadow:0 0 18px rgba(217,164,65,.35);
  }
  .wordmark{
    font-size:26px;font-weight:800;letter-spacing:.32em;
    color:var(--text);
  }
  .wordmark b{color:var(--gold-bright)}
  .tag{
    font-size:10px;letter-spacing:.4em;color:var(--steel);
    margin-top:2px;padding-left:2px;
  }
  .status{
    display:flex;gap:10px;align-items:center;
    font-size:11px;letter-spacing:.16em;color:var(--steel);
  }
  .dot{width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold)}

  /* Main layout */
  .main{
    position:relative;z-index:5;
    flex:1;
    display:flex;
    align-items:center;
    padding:0 clamp(24px,6vw,90px);
    gap:40px;
  }
  .hero-col{max-width:560px}
  .kicker{
    display:inline-block;
    font-size:11px;letter-spacing:.42em;color:var(--gold);
    border:1px solid var(--panel-line);
    padding:6px 14px;margin-bottom:22px;
    background:rgba(20,24,31,.6);
  }
  .title{
    font-size:clamp(44px,8vw,86px);
    font-weight:900;line-height:.92;letter-spacing:.02em;
    text-shadow:0 6px 30px rgba(0,0,0,.7);
  }
  .title span{color:var(--gold-bright)}
  .sub{
    margin-top:18px;max-width:440px;
    color:var(--steel);font-size:15px;line-height:1.6;
  }

  /* Menu */
  .menu{
    position:relative;z-index:5;
    margin-left:auto;
    width:min(360px,42vw);
    display:flex;flex-direction:column;gap:12px;
    padding:24px;
    background:linear-gradient(180deg,rgba(26,31,40,.82),rgba(12,14,18,.9));
    border:1px solid var(--panel-line);
    border-radius:4px;
    backdrop-filter:blur(6px);
    box-shadow:0 24px 60px rgba(0,0,0,.55);
  }
  .menu-h{
    font-size:11px;letter-spacing:.34em;color:var(--steel);
    padding-bottom:12px;border-bottom:1px solid var(--panel-line);margin-bottom:4px;
  }
  .btn{
    position:relative;
    display:flex;align-items:center;gap:14px;
    width:100%;
    padding:15px 18px;
    background:rgba(20,24,31,.7);
    border:1px solid var(--panel-line);
    color:var(--text);
    font-family:inherit;font-size:15px;font-weight:700;
    letter-spacing:.16em;text-align:left;
    cursor:pointer;
    transition:all .16s ease;
    overflow:hidden;
  }
  .btn::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:var(--panel-line);transition:all .16s ease;
  }
  .btn .ic{
    width:24px;height:24px;flex:none;
    display:flex;align-items:center;justify-content:center;
    color:var(--steel);transition:color .16s ease;
  }
  .btn .lbl{flex:1}
  .btn .arw{color:transparent;font-size:13px;transition:.16s}
  .btn:hover,.btn:focus-visible{
    background:rgba(38,46,58,.9);
    border-color:var(--gold);
    color:#fff;outline:none;
    transform:translateX(4px);
  }
  .btn:hover::before,.btn:focus-visible::before{background:var(--gold-bright);box-shadow:0 0 12px var(--gold)}
  .btn:hover .ic,.btn:focus-visible .ic{color:var(--gold-bright)}
  .btn:hover .arw,.btn:focus-visible .arw{color:var(--gold-bright)}

  .btn.primary{
    background:linear-gradient(150deg,var(--gold-bright),var(--gold));
    color:var(--ink);border-color:var(--gold-bright);
    font-size:18px;font-weight:900;padding:18px;
    box-shadow:0 0 24px rgba(217,164,65,.3);
  }
  .btn.primary .ic{color:var(--ink)}
  .btn.primary::before{background:var(--ink)}
  .btn.primary:hover,.btn.primary:focus-visible{
    filter:brightness(1.08);transform:translateX(4px) scale(1.01);
    box-shadow:0 0 34px rgba(242,200,105,.5);
  }
  .btn.primary:hover .ic{color:var(--ink)}
  .btn.primary:hover .arw{color:var(--ink)}

  .footer{
    position:relative;z-index:5;
    display:flex;justify-content:space-between;align-items:center;
    padding:14px 30px;
    font-size:10px;letter-spacing:.2em;color:var(--steel);
    border-top:1px solid rgba(46,56,70,.5);
    background:rgba(12,14,18,.6);
  }
  .footer .r{display:flex;gap:18px}

  @media(max-width:860px){
    .main{flex-direction:column;justify-content:center;padding:0 22px;gap:24px}
    .hero-col{text-align:center;max-width:100%}
    .menu{margin:0;width:100%;max-width:420px}
    .status{display:none}
  }
</style>
</head>
<body>
<div class="stage">
  <img class="backdrop" src="mm://backdrop" alt="">
  <div class="scrim"></div>
  <div class="grain"></div>

  <header class="topbar">
    <div class="brand">
      <div class="crest">B</div>
      <div>
        <div class="wordmark"><b>BUL</b>WARK</div>
        <div class="tag">FORTIFY · DEFEND · COLLECT</div>
      </div>
    </div>
    <div class="status">
      <span class="dot"></span> DETERMINISTIC CORE ONLINE — v1.0 SLICE
    </div>
  </header>

  <div class="main">
    <div class="hero-col">
      <span class="kicker">DAY BATTLE · DAY BUILD</span>
      <h1 class="title">HOLD THE<br><span>LINE.</span></h1>
      <p class="sub">Scout the fog, raise your structures, and command 72 units across nine factions. Every wave repelled buys the next bounty.</p>
    </div>

    <nav class="menu" aria-label="Main menu">
      <div class="menu-h">COMMAND CONSOLE</div>

      <button class="btn primary" data-action="navigate:scr_u4678ee">
        <span class="ic" aria-hidden="true">▶</span>
        <span class="lbl">PLAY</span>
        <span class="arw">›</span>
      </button>

      <button class="btn" data-action="navigate:scr_m8rpgxd">
        <span class="ic" aria-hidden="true">☗</span>
        <span class="lbl">CHOOSE CHARACTER</span>
        <span class="arw">›</span>
      </button>

      <button class="btn" data-action="navigate:scr_rskt6dn">
        <span class="ic" aria-hidden="true">⌂</span>
        <span class="lbl">STORE</span>
        <span class="arw">›</span>
      </button>

      <button class="btn" data-action="navigate:scr_ae09vxa">
        <span class="ic" aria-hidden="true">▤</span>
        <span class="lbl">INVENTORY</span>
        <span class="arw">›</span>
      </button>

      <button class="btn" data-action="navigate:scr_wp1ium2">
        <span class="ic" aria-hidden="true">≡</span>
        <span class="lbl">LEADERBOARD</span>
        <span class="arw">›</span>
      </button>

      <button class="btn" data-action="navigate:scr_u4678ee">
        <span class="ic" aria-hidden="true">⚙</span>
        <span class="lbl">SETTINGS</span>
        <span class="arw">›</span>
      </button>
    </nav>
  </div>

  <footer class="footer">
    <span>© BULWARK — VERTICAL SLICE BUILD</span>
    <span class="r">
      <span>9 FACTIONS</span>
      <span>72 UNITS</span>
      <span>ALIGNMENT SPECTRUM</span>
    </span>
  </footer>
</div>
</body>
</html>