<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BULWARK — Settings</title>
<style>
  :root{
    --bg:#0d1117;
    --panel:#151d29;
    --panel-2:#1c2736;
    --line:#2b3a4f;
    --gold:#e8b44a;
    --gold-dim:#a8802e;
    --steel:#7f96b3;
    --ink:#e7eef7;
    --ink-dim:#9fb0c6;
    --danger:#c85a4a;
    --shadow:0 12px 40px rgba(0,0,0,.55);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
    background:var(--bg);
    color:var(--ink);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    overflow-x:hidden;
  }
  .stage{
    position:relative;
    width:min(1100px,100%);
    border-radius:16px;
    overflow:hidden;
    box-shadow:var(--shadow);
    border:1px solid var(--line);
  }
  .backdrop{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    z-index:0;
    filter:saturate(.9) brightness(.7);
  }
  .scrim{
    position:absolute;
    inset:0;
    z-index:1;
    background:
      linear-gradient(180deg,rgba(9,13,20,.35) 0%,rgba(9,13,20,.72) 55%,rgba(9,13,20,.95) 100%),
      radial-gradient(120% 90% at 20% 10%,rgba(232,180,74,.10),transparent 60%);
  }
  .content{
    position:relative;
    z-index:2;
    padding:clamp(22px,4vw,44px);
    display:flex;
    flex-direction:column;
    gap:26px;
    min-height:600px;
  }
  header.top{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
  }
  .brand{display:flex;align-items:center;gap:14px}
  .crest{
    width:44px;height:44px;
    background:linear-gradient(145deg,var(--gold),var(--gold-dim));
    clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
    display:flex;align-items:center;justify-content:center;
    color:#20160a;font-weight:900;font-size:1.1rem;
    box-shadow:0 4px 14px rgba(0,0,0,.5);
  }
  .brand h1{
    font-size:clamp(1.3rem,3vw,1.9rem);
    letter-spacing:.28em;
    font-weight:800;
  }
  .brand small{
    display:block;
    letter-spacing:.4em;
    font-size:.62rem;
    color:var(--gold);
    margin-top:2px;
  }
  .crumb{
    font-size:.72rem;
    letter-spacing:.3em;
    color:var(--ink-dim);
    border:1px solid var(--line);
    padding:8px 16px;
    border-radius:999px;
    background:rgba(13,17,23,.5);
    text-transform:uppercase;
  }
  .crumb b{color:var(--gold)}

  .body{
    display:grid;
    grid-template-columns:1.4fr 1fr;
    gap:26px;
    align-items:start;
    flex:1;
  }
  @media(max-width:760px){.body{grid-template-columns:1fr}}

  .card{
    background:linear-gradient(180deg,rgba(28,39,54,.85),rgba(21,29,41,.9));
    border:1px solid var(--line);
    border-radius:14px;
    padding:26px;
    backdrop-filter:blur(3px);
  }
  .card h2{
    font-size:.82rem;
    letter-spacing:.28em;
    text-transform:uppercase;
    color:var(--gold);
    margin-bottom:6px;
  }
  .card p.desc{
    color:var(--ink-dim);
    font-size:.82rem;
    margin-bottom:22px;
    line-height:1.5;
  }

  .slider-row{margin-bottom:24px}
  .slider-row:last-child{margin-bottom:0}
  .slider-row label{
    display:flex;
    justify-content:space-between;
    font-size:.78rem;
    letter-spacing:.14em;
    text-transform:uppercase;
    margin-bottom:10px;
    color:var(--ink);
  }
  .slider-row label .val{color:var(--gold);font-variant-numeric:tabular-nums}

  input[type=range]{
    -webkit-appearance:none;appearance:none;
    width:100%;height:8px;border-radius:6px;
    background:linear-gradient(90deg,var(--gold) 0%,var(--gold) var(--p,60%),#26313f var(--p,60%),#26313f 100%);
    outline:none;cursor:pointer;
  }
  input[type=range]::-webkit-slider-thumb{
    -webkit-appearance:none;appearance:none;
    width:22px;height:22px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,#fff2cf,var(--gold) 55%,var(--gold-dim));
    border:2px solid #20160a;
    box-shadow:0 2px 8px rgba(0,0,0,.6);
    cursor:pointer;
  }
  input[type=range]::-moz-range-thumb{
    width:22px;height:22px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,#fff2cf,var(--gold) 55%,var(--gold-dim));
    border:2px solid #20160a;cursor:pointer;
  }
  input[type=range]:focus-visible{box-shadow:0 0 0 3px rgba(232,180,74,.35)}

  .aside{display:flex;flex-direction:column;gap:26px}

  .mute-btn{
    width:100%;
    display:flex;align-items:center;gap:14px;
    background:rgba(200,90,74,.08);
    border:1px solid rgba(200,90,74,.4);
    color:var(--ink);
    padding:16px 18px;
    border-radius:12px;
    cursor:pointer;
    font:inherit;
    letter-spacing:.16em;
    text-transform:uppercase;
    font-size:.8rem;
    transition:.18s;
  }
  .mute-btn:hover{background:rgba(200,90,74,.18);border-color:var(--danger)}
  .mute-btn .ic{
    width:34px;height:34px;flex:none;
    display:flex;align-items:center;justify-content:center;
    border-radius:8px;background:rgba(200,90,74,.22);
    color:var(--danger);font-size:1.1rem;
  }

  .quick{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .qbtn{
    position:relative;
    display:flex;flex-direction:column;gap:8px;
    align-items:flex-start;
    background:linear-gradient(180deg,rgba(43,58,79,.55),rgba(21,29,41,.7));
    border:1px solid var(--line);
    color:var(--ink);
    padding:16px 14px;
    border-radius:12px;
    cursor:pointer;font:inherit;text-align:left;
    transition:.18s;
    overflow:hidden;
  }
  .qbtn:hover{transform:translateY(-2px);border-color:var(--gold);box-shadow:0 8px 20px rgba(0,0,0,.4)}
  .qbtn .tag{font-size:.62rem;letter-spacing:.24em;color:var(--gold);text-transform:uppercase}
  .qbtn .lbl{font-size:.92rem;font-weight:700;letter-spacing:.06em}
  .qbtn .arr{position:absolute;right:12px;top:14px;color:var(--steel);font-size:1rem}

  footer.actions{
    display:flex;justify-content:flex-end;
    padding-top:6px;
  }
  .return{
    display:inline-flex;align-items:center;gap:10px;
    background:linear-gradient(145deg,var(--gold),var(--gold-dim));
    color:#20160a;
    border:none;
    padding:14px 30px;
    border-radius:10px;
    font:inherit;font-weight:800;
    letter-spacing:.2em;
    text-transform:uppercase;
    font-size:.82rem;
    cursor:pointer;
    box-shadow:0 6px 18px rgba(232,180,74,.28);
    transition:.18s;
  }
  .return:hover{transform:translateY(-2px);filter:brightness(1.08)}
  .return:focus-visible,.qbtn:focus-visible,.mute-btn:focus-visible{outline:3px solid rgba(232,180,74,.5);outline-offset:2px}
</style>
</head>
<body>
  <main class="stage">
    <img class="backdrop" src="mm://backdrop" alt="">
    <div class="scrim"></div>
    <div class="content">
      <header class="top">
        <div class="brand">
          <div class="crest">B</div>
          <div>
            <h1>BULWARK</h1>
            <small>SETTINGS</small>
          </div>
        </div>
        <div class="crumb">Menu <b>›</b> Volume Control</div>
      </header>

      <div class="body">
        <section class="card" aria-labelledby="vol-h">
          <h2 id="vol-h">Volume Control</h2>
          <p class="desc">Balance the theatre of war. Adjust the mix for the Day Battle / Day Build loop.</p>

          <div class="slider-row">
            <label for="master">Master Volume <span class="val" id="v-master">80%</span></label>
            <input type="range" id="master" min="0" max="100" value="80" style="--p:80%"
                   oninput="this.style.setProperty('--p',this.value+'%');document.getElementById('v-master').textContent=this.value+'%'">
          </div>
          <div class="slider-row">
            <label for="music">Music <span class="val" id="v-music">60%</span></label>
            <input type="range" id="music" min="0" max="100" value="60" style="--p:60%"
                   oninput="this.style.setProperty('--p',this.value+'%');document.getElementById('v-music').textContent=this.value+'%'">
          </div>
          <div class="slider-row">
            <label for="sfx">Combat SFX <span class="val" id="v-sfx">90%</span></label>
            <input type="range" id="sfx" min="0" max="100" value="90" style="--p:90%"
                   oninput="this.style.setProperty('--p',this.value+'%');document.getElementById('v-sfx').textContent=this.value+'%'">
          </div>
          <div class="slider-row">
            <label for="amb">Ambience <span class="val" id="v-amb">45%</span></label>
            <input type="range" id="amb" min="0" max="100" value="45" style="--p:45%"
                   oninput="this.style.setProperty('--p',this.value+'%');document.getElementById('v-amb').textContent=this.value+'%'">
          </div>
        </section>

        <div class="aside">
          <section class="card" aria-labelledby="audio-h">
            <h2 id="audio-h">Audio State</h2>
            <p class="desc">Silence all channels instantly.</p>
            <button class="mute-btn" data-action="navigate:scr_ab5f1vj">
              <span class="ic" aria-hidden="true">🔇</span>
              <span>Mute All</span>
            </button>
          </section>

          <section class="card" aria-labelledby="quick-h">
            <h2 id="quick-h">Quick Launch</h2>
            <p class="desc">Jump straight back into the fight.</p>
            <div class="quick">
              <button class="qbtn" data-action="cmd:Animate an inviting game scene">
                <span class="tag">Deploy</span>
                <span class="lbl">Play Game</span>
                <span class="arr" aria-hidden="true">→</span>
              </button>
              <button class="qbtn" data-action="cmd:Display the player's gear and loadout">
                <span class="tag">Loadout</span>
                <span class="lbl">Choose Gear</span>
                <span class="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer class="actions">
        <button class="return" data-action="navigate:scr_ab5f1vj">
          <span aria-hidden="true">◄</span> Return to Menu
        </button>
      </footer>
    </div>
  </main>
</body>
</html>