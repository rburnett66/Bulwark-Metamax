<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Leaderboard</title>
<style>
  :root{
    --gold:#e4b64c;
    --gold-hi:#f7d888;
    --ink:#0c1013;
    --panel:#141a20;
    --panel-2:#1b232b;
    --line:#2c3843;
    --text:#e6edf2;
    --muted:#8 da0af;
    --muted:#8da0af;
    --org:#4a86e8;
    --shadow:0 8px 32px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",Roboto,system-ui,sans-serif;
    background:var(--ink);
    color:var(--text);
    min-height:100vh;
    display:flex;
    flex-direction:column;
    overflow-x:hidden;
  }
  /* Backdrop */
  .backdrop{
    position:fixed;inset:0;z-index:0;
  }
  .backdrop img{
    width:100%;height:100%;object-fit:cover;
    filter:saturate(.85) brightness(.55);
  }
  .backdrop::after{
    content:"";position:absolute;inset:0;
    background:
      radial-gradient(120% 90% at 50% 0%, rgba(12,16,19,.15), rgba(12,16,19,.85) 70%, var(--ink) 100%),
      linear-gradient(90deg, rgba(12,16,19,.7), rgba(12,16,19,.25) 40%, rgba(12,16,19,.7));
  }

  .shell{
    position:relative;z-index:1;
    width:100%;max-width:1040px;
    margin:0 auto;
    padding:clamp(16px,3vw,40px);
    display:flex;flex-direction:column;
    flex:1;min-height:100vh;
  }

  /* Header */
  header{
    display:flex;align-items:center;justify-content:space-between;
    gap:16px;flex-wrap:wrap;
    padding-bottom:20px;
    border-bottom:1px solid var(--line);
  }
  .brand{display:flex;align-items:center;gap:14px}
  .crest{
    width:44px;height:44px;flex:none;
    background:linear-gradient(160deg,var(--gold-hi),var(--gold));
    clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
    box-shadow:0 0 0 1px rgba(0,0,0,.4), var(--shadow);
  }
  .titles h1{
    font-size:clamp(20px,3.4vw,30px);
    letter-spacing:.32em;font-weight:800;
    background:linear-gradient(180deg,#fff,var(--gold));
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .titles p{
    font-size:11px;letter-spacing:.42em;text-transform:uppercase;
    color:var(--muted);margin-top:4px;
  }

  /* Podium */
  .podium{
    display:grid;grid-template-columns:repeat(3,1fr);
    gap:14px;margin:28px 0 24px;
    align-items:end;
  }
  .pod{
    position:relative;
    background:linear-gradient(180deg,var(--panel-2),var(--panel));
    border:1px solid var(--line);border-radius:12px;
    padding:18px 14px 16px;text-align:center;
    box-shadow:var(--shadow);
  }
  .pod .rank{
    position:absolute;top:-16px;left:50%;transform:translateX(-50%);
    width:34px;height:34px;border-radius:50%;
    display:grid;place-items:center;font-weight:800;font-size:15px;
    background:var(--panel-2);border:2px solid var(--gold);color:var(--gold);
  }
  .pod.p1{padding-top:30px;border-color:var(--gold)}
  .pod.p1 .rank{background:linear-gradient(160deg,var(--gold-hi),var(--gold));color:var(--ink);border-color:var(--gold-hi);box-shadow:0 0 18px rgba(228,182,76,.5)}
  .avatar{
    width:56px;height:56px;margin:0 auto 10px;
    background:linear-gradient(160deg,#33414d,#1d262e);
    border:1px solid var(--line);border-radius:50%;
    display:grid;place-items:center;font-weight:800;font-size:20px;color:var(--gold);
  }
  .pod.p1 .avatar{width:66px;height:66px;border-color:var(--gold)}
  .pod .name{font-weight:700;font-size:14px;letter-spacing:.03em}
  .pod .faction{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:3px}
  .pod .score{
    margin-top:10px;font-size:18px;font-weight:800;color:var(--gold);
    font-variant-numeric:tabular-nums;
  }

  /* Table */
  .board{
    background:rgba(20,26,32,.72);
    backdrop-filter:blur(4px);
    border:1px solid var(--line);border-radius:12px;
    overflow:hidden;box-shadow:var(--shadow);
  }
  .board-head{
    display:grid;grid-template-columns:56px 1fr 130px 110px;
    padding:12px 18px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--muted);border-bottom:1px solid var(--line);
  }
  .row{
    display:grid;grid-template-columns:56px 1fr 130px 110px;
    align-items:center;
    padding:12px 18px;border-bottom:1px solid rgba(44,56,67,.5);
    transition:background .15s;
  }
  .row:last-child{border-bottom:none}
  .row:hover{background:rgba(228,182,76,.06)}
  .row .pos{font-weight:800;color:var(--muted);font-variant-numeric:tabular-nums}
  .row .player{display:flex;align-items:center;gap:12px;min-width:0}
  .mini{
    width:32px;height:32px;flex:none;border-radius:50%;
    background:linear-gradient(160deg,#2a353f,#1a222a);
    border:1px solid var(--line);display:grid;place-items:center;
    font-weight:700;font-size:12px;color:var(--gold);
  }
  .player .meta{min-width:0}
  .player .nm{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .player .fc{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
  .row .waves{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
  .row .sc{text-align:right;font-weight:800;color:var(--gold);font-variant-numeric:tabular-nums}
  .board-head .rt,.row .sc{text-align:right}
  .me{background:rgba(74,134,232,.12)}
  .me:hover{background:rgba(74,134,232,.18)}
  .me .pos{color:var(--org)}

  /* Actions */
  .actions{
    display:flex;gap:14px;flex-wrap:wrap;
    margin-top:auto;padding-top:26px;justify-content:center;
  }
  .btn{
    font:inherit;cursor:pointer;
    padding:14px 30px;border-radius:8px;
    font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
    border:1px solid var(--line);background:var(--panel-2);color:var(--text);
    transition:transform .12s, box-shadow .12s, border-color .12s;
  }
  .btn:hover{transform:translateY(-2px);border-color:var(--gold)}
  .btn:focus-visible{outline:2px solid var(--gold-hi);outline-offset:3px}
  .btn.primary{
    background:linear-gradient(160deg,var(--gold-hi),var(--gold));
    color:var(--ink);border-color:var(--gold-hi);
    box-shadow:0 4px 18px rgba(228,182,76,.28);
  }

  @media(max-width:640px){
    .board-head,.row{grid-template-columns:40px 1fr 88px}
    .waves,.board-head .rw{display:none}
    .podium{gap:10px}
    .pod .faction{display:none}
  }
</style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <img src="mm://backdrop" alt="">
  </div>

  <main class="shell">
    <header>
      <div class="brand">
        <div class="crest" aria-hidden="true"></div>
        <div class="titles">
          <h1>BULWARK</h1>
          <p>Global Leaderboard</p>
        </div>
      </div>
    </header>

    <section class="podium" aria-label="Top three commanders">
      <div class="pod p2">
        <div class="rank">2</div>
        <div class="avatar">VX</div>
        <div class="name">Vanguard_X</div>
        <div class="faction">Ironclad</div>
        <div class="score">184,220</div>
      </div>
      <div class="pod p1">
        <div class="rank">1</div>
        <div class="avatar">KR</div>
        <div class="name">KryosPrime</div>
        <div class="faction">Frostwake</div>
        <div class="score">241,905</div>
      </div>
      <div class="pod p3">
        <div class="rank">3</div>
        <div class="avatar">NM</div>
        <div class="name">Nomad_77</div>
        <div class="faction">Ashborne</div>
        <div class="score">176,540</div>
      </div>
    </section>

    <section class="board" aria-label="Leaderboard rankings">
      <div class="board-head">
        <span>#</span>
        <span>Commander</span>
        <span class="rw">Waves Cleared</span>
        <span class="rt">Score</span>
      </div>
      <div class="row"><span class="pos">4</span>
        <div class="player"><span class="mini">SG</span><div class="meta"><div class="nm">SteelGrid</div><div class="fc">Voltaic</div></div></div>
        <span class="waves">42 waves</span><span class="sc">168,110</span></div>
      <div class="row"><span class="pos">5</span>
        <div class="player"><span class="mini">HW</span><div class="meta"><div class="nm">HollowKnell</div><div class="fc">Blightborn</div></div></div>
        <span class="waves">39 waves</span><span class="sc">159,780</span></div>
      <div class="row"><span class="pos">6</span>
        <div class="player"><span class="mini">TT</span><div class="meta"><div class="nm">TitanTread</div><div class="fc">Ironclad</div></div></div>
        <span class="waves">37 waves</span><span class="sc">151,340</span></div>
      <div class="row"><span class="pos">7</span>
        <div class="player"><span class="mini">AZ</span><div class="meta"><div class="nm">AzureStorm</div><div class="fc">Skyreach</div></div></div>
        <span class="waves">35 waves</span><span class="sc">144,905</span></div>
      <div class="row me"><span class="pos">8</span>
        <div class="player"><span class="mini">YU</span><div class="meta"><div class="nm">You — Commander</div><div class="fc">Ashborne</div></div></div>
        <span class="waves">33 waves</span><span class="sc">138,620</span></div>
      <div class="row"><span class="pos">9</span>
        <div class="player"><span class="mini">RB</span><div class="meta"><div class="nm">RadBunker</div><div class="fc">Voltaic</div></div></div>
        <span class="waves">31 waves</span><span class="sc">129,470</span></div>
      <div class="row"><span class="pos">10</span>
        <div class="player"><span class="mini">GC</span><div class="meta"><div class="nm">GraniteCore</div><div class="fc">Frostwake</div></div></div>
        <span class="waves">29 waves</span><span class="sc">121,050</span></div>
    </section>

    <div class="actions">
      <button class="btn" type="button" data-action="navigate:scr_ab5f1vj">Choose Character</button>
      <button class="btn primary" type="button" data-action="navigate:scr_ab5f1vj">Go to Menu</button>
    </div>
  </main>
</body>
</html>