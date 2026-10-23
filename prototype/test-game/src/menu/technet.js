/**
 * src/menu/technet.js — THE TECH NET: the Tech Tree drawn as a holographic 3D map [MM-story_mvkgjacw_e] and, since
 * [MM-story_mvkhed1f_h], the game menu's TECH TREE screen. Tech-Tree-Design §11, Menu-Progression-Design §1.
 *
 *   mountTechNet(THREE, addons, host, adapter) → { start(), stop(), refresh(), dispose() }
 *     addons  = { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } (vendor/three-addons, three r128)
 *     host    = an element the net fills (the caller sizes it — full screen in the menu)
 *     adapter = { mode: 'game' | 'sandbox', ctx() → techtree status context, buy(id) → bool, refund(id) → '' | reason,
 *                 sandbox only: addGold(n), reset(), toggle(id) · game only: onClose() }
 *
 * The data and the rules are src/data/techtree.js — this file only draws them. Presentation only: no sim, no save.
 */
import { DIVISIONS as DIV, DIV_ORDER, GROUPS, STAT_KEYS, STAT_NAMES, TECH_NODES, TECH_BY_ID as BY, BUYABLE, TECH_TOTAL,
  techPrice, techGates, techStatus, portalsOwned, countOwned } from '../data/techtree.js';

const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap';
const CSS = `
.tn{position:absolute;inset:0;overflow:hidden;background:#02050c;color:#cfe9ff;font-family:Rajdhani,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --glass:rgba(6,14,28,.74);--line:rgba(90,200,255,.22);--line2:rgba(90,200,255,.45);--dim:#6f8aa6;--cyan:#34e1ff;--gold:#ffd34a;--ok:#5dffa8;--warn:#ffb340;--bad:#ff5a6e}
.tn *{box-sizing:border-box}
.tn canvas{display:block}
.tn .stage{position:absolute;inset:0}
.tn .labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tn .lbl{position:absolute;left:0;top:0;white-space:nowrap;font:600 12px/1.05 Rajdhani,sans-serif;letter-spacing:.06em;text-transform:uppercase;
  color:var(--c);text-shadow:0 0 6px var(--c),0 0 1px #000;will-change:transform,opacity;transition:opacity .15s}
.tn .lbl small{display:block;font:500 10px 'JetBrains Mono',monospace;color:#9fb6cc;text-shadow:none;letter-spacing:0;margin-top:2px}
.tn .lbl.own small{color:var(--ok)}
.tn .btitle{position:absolute;left:0;top:0;white-space:nowrap;pointer-events:auto;cursor:pointer;text-align:center;will-change:transform}
.tn .btitle b{display:block;font:900 22px Orbitron,sans-serif;letter-spacing:.22em;color:var(--c);text-shadow:0 0 14px var(--c),0 0 2px #000}
.tn .btitle span{font:500 11px 'JetBrains Mono',monospace;color:#9fb6cc;letter-spacing:.1em}
.tn .btitle.soon b{opacity:.55}
.tn .glabel{position:absolute;left:0;top:0;white-space:nowrap;font:700 10px Orbitron,sans-serif;letter-spacing:.3em;color:var(--c);opacity:.55}
.tn .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(120,200,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
.tn .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.65) 100%)}
.tn .glass{background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);position:absolute}
.tn .glass::before,.tn .glass::after{content:"";position:absolute;width:12px;height:12px;border:2px solid var(--cyan);opacity:.7;pointer-events:none}
.tn .glass::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.tn .glass::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.tn .hud{left:16px;right:16px;top:14px;display:flex;align-items:center;gap:16px;padding:10px 14px;flex-wrap:wrap}
.tn .brand .logo{font:900 18px Orbitron,sans-serif;letter-spacing:.18em;color:#fff;text-shadow:0 0 12px var(--cyan)}
.tn .brand .logo span{color:var(--cyan);margin:0 .35em}
.tn .brand .tag{font:500 10px 'JetBrains Mono',monospace;color:var(--dim);letter-spacing:.12em;margin-top:3px}
.tn .chips{display:flex;gap:6px;flex-wrap:wrap;flex:1;justify-content:center}
.tn .chip{font:700 11px Orbitron,sans-serif;letter-spacing:.14em;color:var(--c,#cfe9ff);background:rgba(255,255,255,.03);border:1px solid color-mix(in srgb,var(--c,#5ac8ff) 45%,transparent);
  padding:7px 10px;cursor:pointer;display:flex;gap:8px;align-items:center;transition:.15s}
.tn .chip:hover,.tn .chip.on{background:color-mix(in srgb,var(--c,#5ac8ff) 18%,transparent);box-shadow:0 0 14px color-mix(in srgb,var(--c,#5ac8ff) 40%,transparent)}
.tn .chip em{font:500 10px 'JetBrains Mono',monospace;font-style:normal;color:#9fb6cc;letter-spacing:0}
.tn .chip.soon{opacity:.6}
.tn .hud-r{display:flex;align-items:center;gap:12px}
.tn .bank{display:flex;align-items:center;gap:6px;font:700 18px 'JetBrains Mono',monospace;color:var(--gold);text-shadow:0 0 10px rgba(255,211,74,.5)}
.tn .bank label{font:700 9px Orbitron,sans-serif;letter-spacing:.2em;color:var(--dim)}
.tn .btn{font:700 10px Orbitron,sans-serif;letter-spacing:.12em;color:#cfe9ff;background:rgba(90,200,255,.06);border:1px solid var(--line2);padding:7px 9px;cursor:pointer;transition:.15s}
.tn .btn:hover{background:rgba(90,200,255,.18);box-shadow:0 0 12px rgba(52,225,255,.35)}
.tn .btn.close{font-size:11px;padding:8px 12px;border-color:var(--cyan);color:#fff}
.tn .prog{display:flex;align-items:center;gap:8px}
.tn .prog svg{width:38px;height:38px;transform:rotate(-90deg)}
.tn .prog b{font:700 15px 'JetBrains Mono',monospace;color:#fff}
.tn .prog label{display:block;font:700 8px Orbitron,sans-serif;letter-spacing:.2em;color:var(--dim)}
.tn .sub{left:16px;top:84px;display:flex;gap:10px;align-items:center;padding:7px 10px;font:500 11px 'JetBrains Mono',monospace;color:var(--dim)}
.tn .search{background:rgba(0,0,0,.35);border:1px solid var(--line);color:#cfe9ff;font:600 13px Rajdhani,sans-serif;padding:6px 9px;width:200px;outline:none;letter-spacing:.05em}
.tn .search:focus{border-color:var(--cyan);box-shadow:0 0 10px rgba(52,225,255,.3)}
.tn .spent b{color:var(--gold)}
.tn .panel{right:16px;top:150px;bottom:16px;width:360px;padding:18px 18px 14px;overflow:auto;transform:translateX(120%);transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.tn .panel.open{transform:none}
.tn .panel::-webkit-scrollbar{width:6px}.tn .panel::-webkit-scrollbar-thumb{background:var(--line2)}
.tn .p-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.tn .p-top .kind{font:700 9px Orbitron,sans-serif;letter-spacing:.2em;color:var(--dim)}
.tn .p-top .x{margin-left:auto;background:none;border:1px solid var(--line);color:#cfe9ff;width:28px;height:28px;cursor:pointer;font-size:14px}
.tn .panel h2{font:900 21px Orbitron,sans-serif;letter-spacing:.06em;margin:4px 0 2px;color:#fff;text-shadow:0 0 12px var(--c)}
.tn .panel .subl{font:600 14px Rajdhani,sans-serif;color:var(--c);letter-spacing:.08em;text-transform:uppercase}
.tn .srow{display:flex;align-items:center;gap:10px;margin:12px 0 8px}
.tn .badge{font:700 10px Orbitron,sans-serif;letter-spacing:.16em;padding:5px 8px;border:1px solid currentColor}
.tn .s-owned{color:var(--ok)}.tn .s-ready{color:var(--cyan)}.tn .s-short{color:var(--warn)}.tn .s-locked{color:#6a7d92}.tn .s-soon{color:#6a7d92}
.tn .price{font:700 20px 'JetBrains Mono',monospace;color:var(--gold);margin-left:auto;text-shadow:0 0 10px rgba(255,211,74,.4)}
.tn .desc{font:500 15px/1.35 Rajdhani,sans-serif;color:#b9d3ea;margin:6px 0 10px}
.tn .panel h4{font:700 10px Orbitron,sans-serif;letter-spacing:.22em;color:var(--dim);margin:16px 0 6px;border-bottom:1px solid var(--line);padding-bottom:5px}
.tn .ref{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:rgba(255,255,255,.02);border:1px solid transparent;color:#cfe9ff;
  font:600 14px Rajdhani,sans-serif;padding:5px 7px;cursor:pointer;margin:2px 0}
.tn .ref:hover{border-color:var(--line2);background:rgba(90,200,255,.07)}
.tn .ref .dot{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 6px currentColor;flex:none}
.tn .ref .rp{margin-left:auto;font:500 11px 'JetBrains Mono',monospace;color:var(--dim)}
.tn .gate{display:flex;gap:8px;align-items:center;font:600 14px Rajdhani,sans-serif;padding:3px 7px}
.tn .none{font:500 13px Rajdhani,sans-serif;color:var(--dim);padding:2px 7px}
.tn .actions{display:flex;gap:8px;margin-top:16px}
.tn .act{flex:1;font:900 12px Orbitron,sans-serif;letter-spacing:.16em;padding:12px;cursor:pointer;border:1px solid var(--c);color:#02050c;background:var(--c);box-shadow:0 0 18px color-mix(in srgb,var(--c) 50%,transparent)}
.tn .act:disabled{background:transparent;color:#6a7d92;border-color:#2b3b4e;box-shadow:none;cursor:not-allowed}
.tn .act.ghost{background:transparent;color:var(--c)}
.tn .msg{font:600 13px Rajdhani,sans-serif;color:var(--warn);margin-top:8px;min-height:18px}
.tn .note{font:500 12px Rajdhani,sans-serif;color:var(--dim);margin-top:6px}
.tn table.ws{width:100%;border-collapse:collapse;font:600 13px Rajdhani,sans-serif}
.tn table.ws td{padding:3px 6px;border-bottom:1px solid rgba(90,200,255,.08)}
.tn table.ws td:first-child{color:var(--dim);font:700 9px Orbitron,sans-serif;letter-spacing:.14em}
.tn .radar{display:block;margin:6px auto 2px}
.tn .bars{display:grid;grid-template-columns:56px 1fr 38px;gap:4px 8px;align-items:center;font:700 9px Orbitron,sans-serif;letter-spacing:.1em;color:var(--dim)}
.tn .bar{height:6px;background:rgba(255,255,255,.05);position:relative}
.tn .bar i{position:absolute;top:0;bottom:0;background:var(--c);box-shadow:0 0 8px var(--c)}
.tn .bar i.neg{background:var(--bad);box-shadow:0 0 8px var(--bad)}
.tn .bar::after{content:"";position:absolute;left:25%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.35)}
.tn .bv{font:700 11px 'JetBrains Mono',monospace;text-align:right;color:#fff}
.tn .tip{position:absolute;pointer-events:none;padding:7px 10px;font:600 13px Rajdhani,sans-serif;opacity:0;transition:opacity .12s;z-index:5;max-width:260px}
.tn .tip b{display:block;font:700 12px Orbitron,sans-serif;letter-spacing:.06em;color:var(--c)}
.tn .tip span{font:500 11px 'JetBrains Mono',monospace;color:#9fb6cc}
.tn .legend{left:16px;bottom:16px;padding:10px 12px;font:600 12px Rajdhani,sans-serif;display:grid;grid-template-columns:auto auto;gap:4px 14px}
.tn .legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:currentColor;box-shadow:0 0 8px currentColor;vertical-align:middle}
.tn .legend .wide{grid-column:1/-1;color:var(--dim);font-size:11px;margin-top:2px}
.tn .keys{position:absolute;right:16px;bottom:16px;font:500 10px 'JetBrains Mono',monospace;color:var(--dim);letter-spacing:.06em;text-align:right;line-height:1.6;pointer-events:none}
.tn .panel.open ~ .keys{opacity:0}
.tn .boot{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#02050c;z-index:20;transition:opacity .8s}
.tn .boot .t{font:900 20px Orbitron,sans-serif;letter-spacing:.35em;color:#fff;text-shadow:0 0 16px var(--cyan)}
.tn .boot .s{font:500 11px 'JetBrains Mono',monospace;letter-spacing:.2em;color:var(--dim)}
.tn .boot .b{width:260px;height:2px;background:rgba(90,200,255,.15);overflow:hidden}
.tn .boot .b i{display:block;height:100%;width:0;background:var(--cyan);box-shadow:0 0 10px var(--cyan);transition:width .25s}
.tn .boot.gone{opacity:0;pointer-events:none}
@media (max-width:820px){
  .tn .hud{left:8px;right:8px;top:8px;gap:8px;padding:8px}
  .tn .brand .tag,.tn .addgold{display:none}
  .tn .chips{order:3;flex-basis:100%;justify-content:flex-start;overflow-x:auto;flex-wrap:nowrap}
  .tn .chip{padding:6px 8px;font-size:10px;flex:none}
  .tn .sub{top:auto;bottom:8px;left:8px;right:8px}
  .tn .search{width:100%}
  .tn .sub .hint,.tn .spent{display:none}
  .tn .legend,.tn .keys{display:none}
  .tn .panel{left:8px;right:8px;top:auto;bottom:56px;width:auto;max-height:58vh;transform:translateY(130%)}
}`;

const STATUS_TXT = { owned: 'RESEARCHED', ready: 'AVAILABLE', short: 'NEEDS GOLD', locked: 'LOCKED', soon: 'COMING SOON' };
const KIND_TXT = { core: 'BASE MODEL · EQUIPPED', ult: 'CAPSTONE', tier: 'TOWER TIER', tower: 'NEW TOWER', pod: 'DEFENSE POD SLOT', podw: 'POD WEAPON', weapon: 'SUPER-CANNON',
  harv: 'HARVESTER', item: 'COMMAND', craft: 'BASE MODEL', milestone: 'MILESTONE', portal: 'PORTAL CODE', ghost: 'OUTPOST' };
const R0 = 8, STEP = 5, ULT_Y = 24;

export function mountTechNet(THREE, addons, host, adapter) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const sandbox = adapter.mode !== 'game';
  if (!doc.getElementById('tn-style')) { const st = doc.createElement('style'); st.id = 'tn-style'; st.textContent = CSS; doc.head.appendChild(st); }
  if (!doc.getElementById('tn-fonts')) { const l = doc.createElement('link'); l.id = 'tn-fonts'; l.rel = 'stylesheet'; l.href = FONTS; doc.head.appendChild(l); }

  // per-node view state lives here (the data nodes are frozen)
  const V = new Map(TECH_NODES.map((n) => [n.id, { n, st: 'locked', dim: 1 }]));
  const vv = (id) => V.get(id);
  let ctx = adapter.ctx();
  const status = (n) => techStatus(n, ctx), priceOf = (n) => techPrice(n, ctx);

  // ── DOM
  const root = doc.createElement('div'); root.className = 'tn';
  root.innerHTML = `
    <div class="stage"></div><div class="labels"></div><div class="scan"></div><div class="vig"></div>
    <header class="hud glass">
      <div class="brand"><div class="logo">BULWARK<span>//</span>TECH NET</div><div class="tag">${sandbox ? 'SANDBOX · ' : ''}57 UPGRADES · 4 DIVISIONS</div></div>
      <nav class="chips"></nav>
      <div class="hud-r">
        <div class="bank"><label>BANK</label><b data-bank>0</b><span>g</span></div>
        ${sandbox ? '<button class="btn addgold" data-add="1000">+1K</button><button class="btn addgold" data-add="10000">+10K</button>' : ''}
        <div class="prog"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(90,200,255,.15)" stroke-width="3"/><circle data-ring cx="20" cy="20" r="16" fill="none" stroke="#34e1ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>
          <div><b data-owned>0</b><b style="color:#6f8aa6">/${TECH_TOTAL}</b><label>RESEARCHED</label></div></div>
        ${sandbox ? '<button class="btn" data-reset>RESET</button>' : '<button class="btn close" data-close-net>← MENU</button>'}
      </div>
    </header>
    <div class="sub glass"><input class="search" list="tn-names" placeholder="Search upgrades…" autocomplete="off"><datalist id="tn-names"></datalist>
      <span class="spent">SPENT <b>0g</b></span><span class="hint">0 overview · 1–4 divisions · drag to orbit</span></div>
    <aside class="panel glass"></aside>
    <div class="tip glass"></div>
    <div class="legend glass">
      <span class="s-owned"><i></i>Researched</span><span class="s-ready"><i></i>Available</span>
      <span class="s-short"><i></i>Needs gold</span><span class="s-locked"><i></i>Locked</span>
      <span class="wide">Energy flows along a link once its prerequisite is researched.</span>
    </div>
    <div class="keys">CLICK A NODE · DRAG ORBIT · SCROLL ZOOM<br>${sandbox ? 'SANDBOX — PURCHASES STAY IN THIS BROWSER' : 'SPENDS YOUR BANKED GOLD · FULL REFUNDS'}</div>
    <div class="boot"><div class="t">TECH NET</div><div class="b"><i></i></div><div class="s">ESTABLISHING UPLINK</div></div>`;
  host.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const bootbar = $('.boot .b i');
  const W = () => root.clientWidth || win.innerWidth, H = () => root.clientHeight || win.innerHeight;
  bootbar.style.width = '35%';

  // ── renderer, scene, camera
  const col = (h) => new THREE.Color(h);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
  renderer.setSize(W(), H());
  $('.stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = col('#02050c');
  scene.fog = new THREE.FogExp2(0x02050c, 0.0065);
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 1500);
  const HOME = { pos: new THREE.Vector3(0, 62, 82), tgt: new THREE.Vector3(0, 5, 0) };
  camera.position.set(0, 150, 190);
  const controls = new addons.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.minDistance = 8; controls.maxDistance = 190;
  controls.maxPolarAngle = 1.48; controls.target.copy(HOME.tgt); controls.rotateSpeed = 0.6;
  scene.add(new THREE.AmbientLight(0x406080, 0.6));
  const key = new THREE.DirectionalLight(0x9fd8ff, 0.9); key.position.set(30, 60, 20); scene.add(key);
  const glowLight = new THREE.PointLight(0x34e1ff, 1.4, 80); glowLight.position.set(0, 8, 0); scene.add(glowLight);
  let composer = null, bloom = null;
  try {
    composer = new addons.EffectComposer(renderer);
    composer.addPass(new addons.RenderPass(scene, camera));
    bloom = new addons.UnrealBloomPass(new THREE.Vector2(W(), H()), 1.05, 0.55, 0.14);
    composer.addPass(bloom);
  } catch (e) { composer = null; }

  const polar = (divKey, lane, d, y) => {
    const dv = DIV[divKey], a = THREE.MathUtils.degToRad(dv.a0 + (lane + 1) / 2 * (dv.a1 - dv.a0)), r = R0 + d * STEP;
    return new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a));
  };
  const nodePos = (n) => {
    if (n.kind === 'core') return new THREE.Vector3(0, 1.5, 0);
    if (n.kind === 'ult') return new THREE.Vector3(0, ULT_Y, 0);
    return polar(n.div, n.lane, n.d, 1.4 + n.d * 0.55 + (n.kind === 'craft' ? 2.4 : 0));
  };
  const glowTex = (() => {
    const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  // seeded randomness (presentation only — keeps the starfield the same every open)
  let sd = 12345; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

  // starfield
  {
    const n = 2600, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 380 + rnd() * 380, s = Math.sqrt(1 - u * u);
      p[i * 3] = r * s * Math.cos(th); p[i * 3 + 1] = Math.abs(r * u) * 0.9 - 40; p[i * 3 + 2] = r * s * Math.sin(th);
      const k = 0.5 + rnd() * 0.5, b = rnd() < 0.3; c[i * 3] = k * (b ? 0.6 : 1); c[i * 3 + 1] = k * (b ? 0.8 : 1); c[i * 3 + 2] = k;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  }
  // holographic floor: polar grid, division tints, boundaries, scan pulse
  const floorU = { uTime: { value: 0 }, uR0: { value: R0 }, uStep: { value: STEP }, uCol: { value: DIV_ORDER.map((k) => col(DIV[k].color)) },
    uA: { value: [0, DIV.units.a1, DIV.bases.a1, DIV.map.a1, 360, 360] } };
  {
    const m = new THREE.ShaderMaterial({
      uniforms: floorU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, extensions: { derivatives: true },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        uniform float uTime, uR0, uStep; uniform vec3 uCol[4]; uniform float uA[6]; varying vec2 vP;
        float gl(float v, float sp, float w){ float g = abs(fract(v/sp + 0.5) - 0.5)*sp; float fw = fwidth(v); return 1.0 - smoothstep(w, w + fw*1.5, g); }
        void main(){
          float r = length(vP);
          float ang = degrees(atan(vP.y, vP.x)); if (ang < 0.0) ang += 360.0;
          vec3 c = uCol[0];
          for (int i = 0; i < 4; i++) { if (ang >= uA[i] && ang < uA[i+1]) c = uCol[i]; }
          float rings = r > uR0 - 0.2 ? gl(r - uR0, uStep, 0.05) : 0.0;
          float fine = gl(r, 1.0, 0.02) * 0.10;
          float rad = gl(ang, 5.0, 0.03*57.3/max(r,1.0)) * 0.18;
          float bound = 0.0;
          for (int i = 0; i < 4; i++) { float d = abs(ang - uA[i]); d = min(d, 360.0 - d); bound = max(bound, 1.0 - smoothstep(0.0, 0.16*57.3/max(r,1.0), d)); }
          float scan = mod(uTime*13.0, 95.0); float s = exp(-abs(r - scan)*0.9) * (1.0 - scan/95.0);
          float fade = 1.0 - smoothstep(34.0, 64.0, r);
          float inner = smoothstep(uR0 - 3.0, uR0, r);
          float tint = 0.045 * (1.0 - smoothstep(10.0, 46.0, r));
          float hub = (1.0 - smoothstep(0.0, uR0 - 1.0, r)) * 0.06 + gl(r, 2.2, 0.04) * (1.0 - inner) * 0.35;
          vec3 o = c * ((rings*0.32 + fine*0.6 + rad*0.6 + bound*0.55 + tint) * inner + s*0.4) + vec3(0.2,0.8,1.0)*hub;
          gl_FragColor = vec4(o * fade, 1.0);
        }`,
    });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), m); f.rotation.x = -Math.PI / 2; scene.add(f);
  }
  // nodes
  const GEO = {
    hex: new THREE.CylinderGeometry(0.85, 0.85, 0.55, 6), hex3: new THREE.CylinderGeometry(1.0, 1.0, 0.8, 6),
    tower: new THREE.CylinderGeometry(0.75, 1.0, 1.1, 6), pod: new THREE.CylinderGeometry(0.8, 0.95, 0.7, 8),
    podw: new THREE.DodecahedronGeometry(0.72), weapon: new THREE.ConeGeometry(0.75, 1.3, 6), harv: new THREE.BoxGeometry(1.35, 0.6, 0.95),
    item: new THREE.IcosahedronGeometry(0.8), craft: new THREE.OctahedronGeometry(1.3), mile: new THREE.OctahedronGeometry(0.9),
    ghost: new THREE.IcosahedronGeometry(0.9, 0), halo: new THREE.RingGeometry(1.35, 1.5, 48), hit: new THREE.SphereGeometry(1.7, 10, 8),
  };
  GEO.halo.rotateX(-Math.PI / 2);
  const hitMeshes = [];
  function makeNode(v) {
    const n = v.n, g = new THREE.Group(), c = col(n.kind === 'ult' ? '#ffd34a' : DIV[n.div].color);
    const body = new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: c.clone(), emissiveIntensity: 0.3, metalness: 0.55, roughness: 0.32, transparent: true });
    const edgeM = new THREE.LineBasicMaterial({ color: c.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    let geo = null, spin = null; const extras = [];
    switch (n.kind) {
      case 'core': {
        geo = new THREE.SphereGeometry(1.6, 32, 20);
        const ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.8, 1)), edgeM); g.add(ico); extras.push(['spinY', ico, 0.25]);
        for (let i = 0; i < 3; i++) {
          const t = new THREE.Mesh(new THREE.TorusGeometry(3.6 + i * 0.55, 0.045, 8, 96), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
          t.rotation.x = Math.PI / 2 + i * 0.5; t.rotation.y = i * 0.9; g.add(t); extras.push(['gimbal', t, 0.3 + i * 0.17]);
        }
        break;
      }
      case 'ult': {
        geo = new THREE.OctahedronGeometry(2.3); geo.scale(1, 2.1, 1);
        const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.2, 1)), edgeM); g.add(shell); extras.push(['spinY', shell, -0.15]);
        for (let i = 0; i < 6; i++) {
          const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), body); sh.scale.y = 2.2; const a = i / 6 * Math.PI * 2;
          sh.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6); g.add(sh); extras.push(['orbit', sh, a]);
        }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, ULT_Y, 12, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = -ULT_Y / 2; g.add(beam); v.beam = beam;
        spin = 0.4; break;
      }
      case 'tier': geo = n.tier === 3 ? GEO.hex3 : GEO.hex; break;
      case 'tower': geo = GEO.tower; spin = 0.3; break;
      case 'pod': geo = GEO.pod; break;
      case 'podw': geo = GEO.podw; spin = 0.6; break;
      case 'weapon': geo = GEO.weapon; break;
      case 'harv': geo = GEO.harv; break;
      case 'item': geo = GEO.item; spin = 0.4; break;
      case 'craft': {
        geo = GEO.craft; spin = 0.5;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
        ring.rotation.x = Math.PI / 2; g.add(ring); extras.push(['tilt', ring, 0.6]);
        break;
      }
      case 'milestone': geo = GEO.mile; spin = 0.8; break;
      case 'portal': {
        g.add(new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 10, 48), body));
        const pm = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uCol: { value: c.clone() }, uI: { value: 0.3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader: `uniform float uTime, uI; uniform vec3 uCol; varying vec2 vUv;
            void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
              float s = sin(a*3.0 + r*11.0 - uTime*3.2)*0.5+0.5; float v = (1.0-r)*0.5 + s*(1.0-r)*0.6 + smoothstep(0.75,1.0,r)*0.3;
              gl_FragColor = vec4(uCol*v*uI, 1.0); }`,
        });
        g.add(new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), pm)); v.portalMat = pm;
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(1.05, 0.12, 4, 24)), edgeM));
        break;
      }
      case 'ghost': geo = GEO.ghost; spin = 0.2; body.wireframe = true; break;
    }
    let mesh = null;
    if (geo) {
      mesh = new THREE.Mesh(geo, body); g.add(mesh);
      if (n.kind !== 'core' && n.kind !== 'ult') g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeM));
    }
    const halo = new THREE.Mesh(GEO.halo, new THREE.MeshBasicMaterial({ color: c.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    halo.position.y = n.kind === 'craft' ? -1.6 : -0.6; if (n.kind === 'core' || n.kind === 'ult') halo.scale.setScalar(3);
    g.add(halo);
    const hit = new THREE.Mesh(GEO.hit, new THREE.MeshBasicMaterial({ visible: false })); hit.userData.id = n.id;
    if (n.kind === 'core' || n.kind === 'ult') hit.scale.setScalar(2.4);
    g.add(hit); hitMeshes.push(hit);
    const p = nodePos(n); g.position.copy(p);
    if (n.kind === 'portal') g.lookAt(0, p.y, 0);
    g.scale.setScalar(0.001);
    scene.add(g);
    Object.assign(v, { g, body, edgeM, mesh, halo, spin, extras, color: c, pos: p, appear: 0.6 + (n.d || 0) * 0.28 + (n.kind === 'ult' ? 2.6 : 0) });
  }
  V.forEach(makeNode);
  bootbar.style.width = '60%';

  // links
  const EDGES = [];
  function curveBetween(a, b, kind) {
    if (kind === 'ult') {
      const c1 = new THREE.Vector3(a.x * 0.6, a.y + 10, a.z * 0.6), c2 = new THREE.Vector3(b.x + a.x * 0.12, b.y - 6, b.z + a.z * 0.12);
      return new THREE.CubicBezierCurve3(a.clone(), c1, c2, b.clone());
    }
    const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    mid.y += Math.min(9, len * (kind === 'trunk' ? 0.12 : 0.22));
    return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  }
  function addEdge(a, b, kind) {
    const va = vv(a), vb = vv(b);
    const curve = curveBetween(va.pos, vb.pos, kind);
    const c = kind === 'ult' ? col('#ffd34a') : kind === 'cross' ? col(DIV[va.n.div].color).lerp(col(DIV[vb.n.div].color), 0.5) : col(DIV[vb.n.div].color);
    const mat = new THREE.MeshBasicMaterial({ color: c.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, kind === 'ult' ? 64 : 36, kind === 'trunk' ? 0.035 : 0.06, 5, false), mat));
    EDGES.push({ a, b, kind, mat, lut: curve.getSpacedPoints(80), color: c, op: 0, len: curve.getLength() });
  }
  for (const n of TECH_NODES) {
    if (n.kind === 'core' || n.soon) continue;
    if (n.kind === 'ult') { for (const r of n.req) addEdge(r, n.id, 'ult'); continue; }
    if (!n.req.length) addEdge('pathfinder', n.id, 'trunk');
    for (const r of n.req) addEdge(r, n.id, BY[r].div !== n.div ? 'cross' : 'link');
  }
  for (const n of TECH_NODES) if (n.soon) {
    const curve = curveBetween(vv('pathfinder').pos, vv(n.id).pos, 'trunk');
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
      new THREE.LineDashedMaterial({ color: col(DIV.outpost.color), dashSize: 0.6, gapSize: 0.5, transparent: true, opacity: 0.35 }));
    l.computeLineDistances(); scene.add(l);
  }
  const PER = (e) => (e.kind === 'ult' ? 7 : e.kind === 'trunk' ? 2 : 3);
  const PCOUNT = EDGES.reduce((s, e) => s + PER(e), 0);
  const pPos = new Float32Array(PCOUNT * 3), pCol = new Float32Array(PCOUNT * 3), pMeta = [];
  EDGES.forEach((e, ei) => { for (let k = 0; k < PER(e); k++) pMeta.push({ ei, off: k / PER(e) + rnd() * 0.05, spd: 0.18 + 6 / (e.len + 8) }); });
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.15, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  // selection reticle
  const reticle = new THREE.Group();
  {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) { const arc = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.38, 24, 1, i * Math.PI / 2 + 0.25, Math.PI / 2 - 0.5), m); arc.rotation.x = -Math.PI / 2; reticle.add(arc); }
    reticle.visible = false; scene.add(reticle);
  }
  bootbar.style.width = '80%';

  // ── labels
  const LBL = $('.labels');
  for (const v of V.values()) {
    const el = doc.createElement('div'); el.className = 'lbl';
    el.style.setProperty('--c', v.n.kind === 'ult' ? '#ffd34a' : DIV[v.n.div].color);
    LBL.appendChild(el); v.lbl = el;
  }
  const TITLES = DIV_ORDER.map((k) => {
    const dv = DIV[k], el = doc.createElement('div'); el.className = 'btitle' + (dv.soon ? ' soon' : ''); el.style.setProperty('--c', dv.color);
    el.innerHTML = '<b>' + dv.label + '</b><span></span>'; el.addEventListener('click', () => flyToDiv(k)); LBL.appendChild(el);
    const a = THREE.MathUtils.degToRad((dv.a0 + dv.a1) / 2), r = R0 + 6.9 * STEP;
    return { k, el, pos: new THREE.Vector3(r * Math.cos(a), 1, -r * Math.sin(a)) };
  });
  const GLBL = GROUPS.map((gq) => {
    const el = doc.createElement('div'); el.className = 'glabel'; el.style.setProperty('--c', DIV[gq.div].color); el.textContent = gq.text; LBL.appendChild(el);
    return { el, pos: polar(gq.div, gq.lane, 0.15, 0.2) };
  });
  function labelText(v) {
    const n = v.n, st = v.st;
    v.lbl.classList.toggle('own', st === 'owned');
    const pr = n.soon ? 'COMING SOON' : n.milestone ? (st === 'owned' ? (sandbox ? '✓ CLEARED' : '✓ WON') : 'MILESTONE')
      : st === 'owned' ? '✓ ' + (n.free ? 'OWNED' : 'RESEARCHED') : n.free ? 'FREE' : priceOf(n).toLocaleString() + 'g';
    v.lbl.innerHTML = n.name + '<small>' + pr + '</small>';
    v.lblW = n.name.length * 8 + 14;
  }
  const tmpV = new THREE.Vector3(), lblOff = new THREE.Vector3();
  const project = (p) => { tmpV.copy(p).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * W(), y: (-tmpV.y * 0.5 + 0.5) * H(), z: tmpV.z }; };
  const lblAnchor = (v) => lblOff.copy(v.pos).setY(v.pos.y + (v.n.kind === 'core' ? 4.6 : v.n.kind === 'ult' ? 7 : v.n.kind === 'craft' ? 2.0 : 1.6));
  function layoutLabels(focusSet) {
    const items = [];
    for (const v of V.values()) {
      const s = project(lblAnchor(v)), dist = camera.position.distanceTo(v.pos);
      if (s.z > 1 || s.x < -50 || s.x > W() + 50 || s.y < -30 || s.y > H() + 30 || v.g.scale.x < 0.5) { v.lbl.style.opacity = 0; continue; }
      const inF = focusSet && focusSet.has(v.n.id);
      const pri = (v.n.id === selId || v.n.id === hovId ? -1e6 : 0) + (inF ? -1e5 : 0) + (v.n.kind === 'core' || v.n.kind === 'ult' ? -5e4 : 0) + (v.st === 'owned' || v.st === 'ready' ? -50 : 0) + dist;
      items.push({ v, s, pri, dist, inF });
    }
    items.sort((a, b) => a.pri - b.pri);
    const placed = [];
    for (const it of items) {
      const { v, s } = it, w = v.lblW, h = 28, x = s.x - w / 2, y = s.y - h;
      let hide = it.dist > 120 && !it.inF && v.n.id !== selId;
      if (!hide) for (const r of placed) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) { hide = true; break; }
      if (hide) { v.lbl.style.opacity = 0; continue; }
      placed.push({ x, y, w, h });
      v.lbl.style.opacity = (Math.max(0.35, Math.min(1, 1.6 - it.dist / 110)) * (focusSet && !it.inF ? 0.25 : 1)).toFixed(2);
      v.lbl.style.transform = 'translate3d(' + (x | 0) + 'px,' + (y | 0) + 'px,0)';
    }
    for (const t of TITLES) {
      const s = project(t.pos);
      if (s.z > 1) { t.el.style.opacity = 0; continue; }
      t.el.style.opacity = 1; t.el.style.transform = 'translate3d(' + ((s.x - t.el.offsetWidth / 2) | 0) + 'px,' + ((s.y - 20) | 0) + 'px,0)';
    }
    for (const gq of GLBL) {
      const s = project(gq.pos);
      gq.el.style.opacity = s.z > 1 ? 0 : 0.6;
      gq.el.style.transform = 'translate3d(' + ((s.x - gq.el.offsetWidth / 2) | 0) + 'px,' + ((s.y - 6) | 0) + 'px,0)';
    }
  }

  // ── HUD + panel
  const chips = $('.chips');
  chips.innerHTML = '<button class="chip on" data-div="all" style="--c:#cfe9ff">ALL</button>' +
    DIV_ORDER.map((k) => '<button class="chip' + (DIV[k].soon ? ' soon' : '') + '" data-div="' + k + '" style="--c:' + DIV[k].color + '">' + DIV[k].label + ' <em data-cnt="' + k + '"></em></button>').join('');
  chips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; b.dataset.div === 'all' ? flyHome() : flyToDiv(b.dataset.div); });
  const setChip = (k) => chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.div === k));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { adapter.addGold(+b.dataset.add); refresh(); }));
  const rs = $('[data-reset]'); if (rs) rs.addEventListener('click', () => { adapter.reset(); refresh(); });
  const cl = $('[data-close-net]'); if (cl) cl.addEventListener('click', () => adapter.onClose && adapter.onClose());
  $('#tn-names').innerHTML = TECH_NODES.filter((n) => !n.soon).map((n) => '<option value="' + n.name + '">').join('');
  const search = $('.search');
  search.addEventListener('change', () => {
    const q = search.value.trim().toLowerCase();
    const n = TECH_NODES.find((m) => !m.soon && m.name.toLowerCase() === q) || TECH_NODES.find((m) => !m.soon && m.name.toLowerCase().includes(q));
    if (n) { select(n.id, true); search.blur(); }
  });
  const panel = $('.panel');
  function radar(stats, color) {
    const R = 74, cx = 110, cy = 92, k = STAT_KEYS.length, ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / k;
    const pt = (i, val) => { const r = (val + 10) / 40 * R; return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r]; };
    let s = '<svg class="radar" width="220" height="186" viewBox="0 0 220 186">';
    for (const lv of [-10, 0, 10, 20, 30]) s += '<polygon points="' + STAT_KEYS.map((_, i) => pt(i, lv).join(',')).join(' ') + '" fill="none" stroke="' + (lv === 0 ? 'rgba(255,255,255,.45)' : 'rgba(90,200,255,.14)') + '" stroke-width="' + (lv === 0 ? 1.2 : 1) + '"' + (lv === 0 ? ' stroke-dasharray="3 3"' : '') + '/>';
    STAT_KEYS.forEach((t, i) => { const [x, y] = pt(i, 30); const [lx, ly] = pt(i, 37);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="rgba(90,200,255,.14)"/><text x="' + lx + '" y="' + (ly + 3) + '" fill="#8aa4bd" font-family="Orbitron" font-size="8" font-weight="700" text-anchor="middle" letter-spacing="1">' + t + '</text>'; });
    s += '<polygon points="' + stats.map((val, i) => pt(i, val).join(',')).join(' ') + '" fill="' + color + '33" stroke="' + color + '" stroke-width="2" style="filter:drop-shadow(0 0 6px ' + color + ')"/>';
    stats.forEach((val, i) => { const [x, y] = pt(i, val); s += '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + (val < 0 ? '#ff5a6e' : color) + '"/>'; });
    return s + '</svg>';
  }
  const bars = (stats) => '<div class="bars">' + stats.map((val, i) => {
    const w = Math.abs(val) / 40 * 100, left = val < 0 ? 25 - w : 25;
    return '<span>' + STAT_KEYS[i] + '</span><div class="bar" title="' + STAT_NAMES[i] + '"><i class="' + (val < 0 ? 'neg' : '') + '" style="left:' + left + '%;width:' + w + '%"></i></div><span class="bv">' + (val > 0 ? '+' : '') + val + '%</span>';
  }).join('') + '</div>';
  const refBtn = (id) => { const st = vv(id).st; return '<button class="ref" data-go="' + id + '"><i class="dot s-' + st + '"></i>' + BY[id].name + '<span class="rp">' + STATUS_TXT[st] + '</span></button>'; };
  let panelMsg = '';
  function renderPanel() {
    if (!selId) { panel.classList.remove('open'); return; }
    const n = BY[selId], st = vv(selId).st, c = n.kind === 'ult' ? '#ffd34a' : DIV[n.div].color;
    panel.style.setProperty('--c', c);
    let h = '<div class="p-top"><span class="chip" style="--c:' + DIV[n.div].color + ';pointer-events:none">' + DIV[n.div].label + '</span><span class="kind">' + KIND_TXT[n.kind] + '</span><button class="x" data-close aria-label="Close">✕</button></div>';
    h += '<h2>' + n.name + '</h2>' + (n.sub ? '<div class="subl">' + n.sub + '</div>' : '');
    const pr = n.soon || n.milestone ? '' : n.free ? 'FREE' : priceOf(n).toLocaleString() + 'g';
    h += '<div class="srow"><span class="badge s-' + st + '">' + STATUS_TXT[st] + '</span><span class="price">' + pr + '</span></div>';
    h += '<p class="desc">' + n.desc + '</p>';
    if (n.stats) h += '<h4>BONUS PROFILE</h4>' + radar(n.stats, c) + bars(n.stats);
    if (n.ws) h += '<h4>POD WEAPON</h4><table class="ws">' + n.ws.map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('') + '</table>';
    if (n.portal && !ctx.owned.has(n.id)) { const k = portalsOwned(ctx.owned); h += '<h4>PRICE BY COUNT</h4><div class="none">You hold ' + k + ' code' + (k === 1 ? '' : 's') + ' — the next costs ' + priceOf(n).toLocaleString() + 'g.</div>'; }
    if (!n.soon && n.kind !== 'core') {
      h += '<h4>REQUIRES</h4>' + (n.req.length ? n.req.map(refBtn).join('') : '<div class="none">Nothing — a root of its line.</div>');
      const gs = techGates(n, ctx); if (gs.length) h += '<h4>GATES</h4>' + gs.map((gq) => '<div class="gate ' + (gq.ok ? 's-owned' : 's-locked') + '">' + (gq.ok ? '◆' : '◇') + ' ' + gq.txt + '</div>').join('');
    }
    if (n.kids.length) h += '<h4>UNLOCKS</h4>' + n.kids.map(refBtn).join('');
    if (n.kind === 'core') h += '<h4>BASE MODELS</h4>' + TECH_NODES.filter((m) => m.kind === 'craft').map((m) => refBtn(m.id)).join('');
    if (!n.soon && !n.start) {
      if (n.milestone) h += sandbox ? '<div class="actions"><button class="act" data-toggle>' + (ctx.owned.has(n.id) ? 'MARK NOT CLEARED' : 'MARK CLEARED') + '</button></div>'
        : '<div class="note">' + (ctx.owned.has(n.id) ? 'Won — the portal codes are open.' : 'Win Map 3 on any planet to open the portal codes.') + '</div>';
      else if (n.free) h += '<div class="actions"><button class="act" disabled>' + (ctx.owned.has(n.id) ? 'INCLUDED' : 'COMES WITH ' + BY[n.req[0]].name.toUpperCase()) + '</button></div>';
      else if (st === 'owned') h += '<div class="actions"><button class="act ghost" data-refund>REFUND ' + ((ctx.paid && ctx.paid[n.id]) || 0).toLocaleString() + 'g</button></div>';
      else h += '<div class="actions"><button class="act" data-buy ' + (st === 'ready' ? '' : 'disabled') + '>' + (st === 'short' ? 'NEED ' + (priceOf(n) - ctx.bank).toLocaleString() + 'g MORE' : st === 'locked' ? 'LOCKED' : 'RESEARCH · ' + priceOf(n).toLocaleString() + 'g') + '</button></div>';
      if (!sandbox && !n.milestone && !n.free) h += '<div class="note">Research is recorded now; its effect reaches battle with the Tech Tree build.</div>';
    }
    h += '<div class="msg">' + panelMsg + '</div>';
    panel.innerHTML = h; panel.classList.add('open');
  }
  panel.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go) { select(go.dataset.go, true); return; }
    if (e.target.closest('[data-close]')) { select(null); return; }
    if (e.target.closest('[data-toggle]')) { adapter.toggle(selId); refresh(); return; }
    if (e.target.closest('[data-buy]')) { panelMsg = ''; const id = selId; if (adapter.buy(id)) burst(vv(id)); refresh(); return; }
    if (e.target.closest('[data-refund]')) { panelMsg = adapter.refund(selId) || ''; refresh(); }
  });
  function refresh() {
    ctx = adapter.ctx();
    $('[data-bank]').textContent = ctx.bank.toLocaleString();
    const own = countOwned(ctx.owned);
    $('[data-owned]').textContent = own;
    $('[data-ring]').style.strokeDashoffset = (100.5 * (1 - own / TECH_TOTAL)).toFixed(1);
    $('.spent').innerHTML = 'SPENT <b>' + Object.entries(ctx.paid || {}).reduce((a, [id, g]) => a + (ctx.owned.has(id) ? g : 0), 0).toLocaleString() + 'g</b>';
    for (const k of DIV_ORDER) {
      const dv = DIV[k], o = countOwned(ctx.owned, k);
      root.querySelector('[data-cnt="' + k + '"]').textContent = dv.soon ? 'SOON' : o + '/' + dv.total;
      TITLES.find((t) => t.k === k).el.querySelector('span').textContent = dv.soon ? 'COMING SOON' : o + ' / ' + dv.total + ' RESEARCHED';
    }
    for (const v of V.values()) { v.st = status(v.n); labelText(v); }
    renderPanel();
  }

  // ── interaction
  let selId = null, hovId = null, lastInput = 0, fly = null, running = false, raf = 0, introDone = false;
  const clock = new THREE.Clock();
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9);
  const tip = $('.tip');
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const flyTo = (pos, tgt, dur = 1.1) => { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt, s: clock.getElapsedTime(), dur }; };
  function flyHome() { setChip('all'); flyTo(HOME.pos.clone(), HOME.tgt.clone(), 1.3); }
  function flyToDiv(k) {
    setChip(k); const dv = DIV[k], a = THREE.MathUtils.degToRad((dv.a0 + dv.a1) / 2), span = dv.a1 - dv.a0;
    const tr = R0 + 3.2 * STEP, t = new THREE.Vector3(tr * Math.cos(a), 3, -tr * Math.sin(a)), back = 22 + span * 0.28;
    flyTo(new THREE.Vector3(Math.cos(a) * (tr + back), 30 + span * 0.12, -Math.sin(a) * (tr + back)), t, 1.3);
  }
  function select(id, doFly) {
    selId = id; panelMsg = '';
    if (id && doFly) {
      const p = vv(id).pos, n = BY[id], out = new THREE.Vector3(p.x, 0, p.z).normalize();
      const drop = new THREE.Vector3(0, W() < 820 ? (n.kind === 'ult' ? 9 : 5) : 0, 0);   // phones: keep the node above the bottom sheet
      if (n.kind === 'core' || n.kind === 'ult') flyTo(new THREE.Vector3(0, p.y + 14, W() < 820 ? 50 : 30).sub(drop), p.clone().sub(drop), 1.0);
      else flyTo(p.clone().add(out.multiplyScalar(15)).add(new THREE.Vector3(0, 10, 0)).sub(drop), p.clone().sub(drop), 1.0);
    }
    renderPanel();
  }
  const canvas = renderer.domElement;
  let down = null;
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointermove', (e) => { const [x, y] = rel(e); mouse.set(x / W() * 2 - 1, -(y / H()) * 2 + 1); tip.style.left = x + 16 + 'px'; tip.style.top = y + 14 + 'px'; lastInput = clock.getElapsedTime(); });
  canvas.addEventListener('pointerleave', () => mouse.set(-9, -9));
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; lastInput = clock.getElapsedTime(); fly = null; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null; const [x, y] = rel(e); mouse.set(x / W() * 2 - 1, -(y / H()) * 2 + 1);
    const id = pick(); select(id, !!id);
  });
  canvas.addEventListener('wheel', () => { lastInput = clock.getElapsedTime(); fly = null; }, { passive: true });
  const onKey = (e) => {
    if (!running || (e.target && e.target.tagName === 'INPUT')) return;
    if (e.key === 'Escape') { if (selId) select(null); else if (adapter.onClose) adapter.onClose(); }
    if (e.key === '0') flyHome();
    const i = '1234'.indexOf(e.key); if (i >= 0) flyToDiv(DIV_ORDER[i]);
  };
  win.addEventListener('keydown', onKey);
  function pick() { ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(hitMeshes, false)[0]; return hit ? hit.object.userData.id : null; }
  function chainOf(id) {
    const set = new Set([id]);
    const up = (x) => BY[x].req.forEach((r) => { if (!set.has(r)) { set.add(r); up(r); } });
    const dn = (x) => BY[x].kids.forEach((k) => { if (!set.has(k)) { set.add(k); dn(k); } });
    up(id); dn(id); return set;
  }
  const bursts = [];
  function burst(v) {
    if (!v || !v.g) return;
    const k = 40, p = new Float32Array(k * 3), vel = [];
    for (let i = 0; i < k; i++) { const a = rnd() * Math.PI * 2, u = rnd() * 2 - 1; vel.push(new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - u * u), u, Math.sin(a) * Math.sqrt(1 - u * u)).multiplyScalar(4 + rnd() * 5)); p.set([v.pos.x, v.pos.y, v.pos.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.1, map: glowTex, color: v.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(pts); bursts.push({ pts, vel, t: 0 });
  }

  // ── loop
  const LOCKED_C = col('#2b3c52'), AMBER = col('#ffb340'), WHITE = col('#ffffff'), tc = new THREE.Color();
  const introFrom = camera.position.clone();
  refresh();
  bootbar.style.width = '100%';
  setTimeout(() => $('.boot').classList.add('gone'), 350);
  function frame() {
    if (!running) return;
    raf = win.requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    floorU.uTime.value = t;
    if (!introDone) { const k = ease(Math.min(1, t / 3.2)); camera.position.lerpVectors(introFrom, HOME.pos, k); if (k >= 1) { introDone = true; lastInput = t; } }
    if (fly) { const k = ease(Math.min(1, (t - fly.s) / fly.dur)); camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (k >= 1) fly = null; }
    controls.autoRotate = introDone && !fly && !selId && t - lastInput > 9; controls.autoRotateSpeed = 0.35;
    controls.update();
    if (introDone) {
      const h = pick();
      if (h !== hovId) { hovId = h; canvas.style.cursor = h ? 'pointer' : 'grab'; }
      if (hovId) {
        const n = BY[hovId], st = vv(hovId).st;
        tip.style.setProperty('--c', n.kind === 'ult' ? '#ffd34a' : DIV[n.div].color);
        tip.innerHTML = '<b>' + n.name + '</b><span>' + STATUS_TXT[st] + (n.soon || n.milestone || n.free || st === 'owned' ? '' : ' · ' + priceOf(n).toLocaleString() + 'g') + '</span>';
        tip.style.opacity = 1;
      } else tip.style.opacity = 0;
    }
    const fid = hovId || selId, focusSet = fid ? chainOf(fid) : null;
    for (const v of V.values()) {
      const n = v.n, k = ease(Math.max(0, Math.min(1, (t - v.appear) / 0.7)));
      v.g.scale.setScalar(Math.max(0.001, k * (n.id === hovId ? 1.18 : 1)));
      v.dim += ((focusSet ? (focusSet.has(n.id) ? 1 : 0.16) : 1) - v.dim) * 0.15;
      const st = v.st, pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + v.pos.x * 0.3);
      let I, eop, c = v.color;
      if (st === 'owned') { I = n.kind === 'core' ? 1.6 : 1.45; eop = 1; }
      else if (st === 'ready') { I = 0.5 + 0.5 * pulse; eop = 0.85; }
      else if (st === 'short') { I = 0.35 + 0.15 * pulse; eop = 0.6; c = tc.copy(v.color).lerp(AMBER, 0.55); }
      else if (st === 'soon') { I = 0.12 + 0.06 * pulse; eop = 0.3; }
      else { I = 0.22; eop = 0.3; c = tc.copy(v.color).lerp(LOCKED_C, 0.6); }
      v.body.emissive.copy(c); v.body.emissiveIntensity = I * v.dim; v.body.opacity = 0.25 + 0.75 * v.dim;
      v.edgeM.color.copy(c); v.edgeM.opacity = eop * v.dim;
      if (v.portalMat) { v.portalMat.uniforms.uTime.value = t; v.portalMat.uniforms.uI.value = (st === 'owned' ? 1.2 : st === 'ready' ? 0.55 + 0.3 * pulse : 0.12) * v.dim; v.portalMat.uniforms.uCol.value.copy(c); }
      const hm = v.halo.material, big = n.kind === 'core' || n.kind === 'ult' ? 3 : 1;
      if (st === 'ready' || st === 'short') { const ph = (t * 0.8 + v.pos.z * 0.05) % 1; v.halo.scale.setScalar(big * (1 + ph * 0.7)); hm.opacity = (1 - ph) * 0.8 * v.dim; hm.color.copy(c); }
      else if (st === 'owned') { v.halo.scale.setScalar(big); hm.opacity = 0.35 * v.dim; hm.color.copy(c); }
      else hm.opacity = 0;
      if (v.spin && v.mesh) v.mesh.rotation.y += v.spin * 0.016;
      if (n.kind === 'ult') { v.g.rotation.y += 0.004; v.g.position.y = ULT_Y + Math.sin(t * 0.8) * 0.6; if (v.beam) v.beam.material.opacity = (st === 'owned' ? 0.35 : 0.08 + 0.05 * pulse) * v.dim; }
      if (n.kind === 'craft') v.g.position.y = v.pos.y + Math.sin(t * 1.3 + v.pos.x) * 0.25;
      for (const [type, o, val] of v.extras) {
        if (type === 'spinY') o.rotation.y += val * 0.016;
        else if (type === 'gimbal') { o.rotation.z += val * 0.016; o.rotation.x += val * 0.007; }
        else if (type === 'tilt') o.rotation.z = Math.sin(t * val) * 0.4;
        else if (type === 'orbit') { const a = val + t * 0.5; o.position.set(Math.cos(a) * 6, Math.sin(t * 1.5 + val) * 1.2, Math.sin(a) * 6); o.rotation.y += 0.02; }
      }
    }
    if (selId) {
      const v = vv(selId), big = v.n.kind === 'core' || v.n.kind === 'ult';
      reticle.visible = true; reticle.position.copy(v.g.position); reticle.position.y -= v.n.kind === 'craft' ? 1.7 : 0.7;
      reticle.rotation.y = t * 0.9; reticle.scale.setScalar((big ? 2.4 : 1) * (1 + Math.sin(t * 4) * 0.04));
    } else reticle.visible = false;
    let pi = 0;
    for (const e of EDGES) {
      const va = vv(e.a), vb = vv(e.b);
      const visible = Math.min(va.g.scale.x, vb.g.scale.x) > 0.6 ? 1 : 0;
      const aOwn = va.st === 'owned', bOwn = vb.st === 'owned', inF = focusSet && focusSet.has(e.a) && focusSet.has(e.b);
      let target = (bOwn && aOwn ? 0.75 : aOwn ? 0.4 : 0.09) * (e.kind === 'trunk' ? 0.6 : 1);
      if (focusSet) target = inF ? Math.max(0.55, target * 1.3) : target * 0.12;
      e.op += (target * visible - e.op) * 0.12; e.mat.opacity = e.op;
      e.mat.color.copy(e.color); if (inF) e.mat.color.lerp(WHITE, 0.35);
      const flow = (aOwn ? (bOwn ? 1 : 0.75) : 0.08) * visible * (focusSet ? (inF ? 1.4 : 0.08) : 1);
      for (let k = 0; k < PER(e); k++, pi++) {
        const m = pMeta[pi], u = (t * m.spd + m.off) % 1, f = u * (e.lut.length - 1), i0 = f | 0, fr = f - i0, A = e.lut[i0], B = e.lut[Math.min(i0 + 1, e.lut.length - 1)];
        pPos[pi * 3] = A.x + (B.x - A.x) * fr; pPos[pi * 3 + 1] = A.y + (B.y - A.y) * fr; pPos[pi * 3 + 2] = A.z + (B.z - A.z) * fr;
        const tail = Math.sin(u * Math.PI);
        pCol[pi * 3] = e.color.r * flow * tail; pCol[pi * 3 + 1] = e.color.g * flow * tail; pCol[pi * 3 + 2] = e.color.b * flow * tail;
      }
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += 0.016; const arr = b.pts.geometry.attributes.position.array;
      b.vel.forEach((vl, j) => { arr[j * 3] += vl.x * 0.016; arr[j * 3 + 1] += vl.y * 0.016; arr[j * 3 + 2] += vl.z * 0.016; vl.multiplyScalar(0.96); });
      b.pts.geometry.attributes.position.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.t / 1.1);
      if (b.t > 1.1) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
    glowLight.intensity = 1.2 + Math.sin(t * 2) * 0.25;
    layoutLabels(focusSet);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  function resize() {
    camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H());
    if (composer) { composer.setSize(W(), H()); if (bloom) bloom.setSize(W(), H()); }
  }
  win.addEventListener('resize', resize);

  const api = {
    start() { if (running) return; running = true; controls.enabled = true; resize(); refresh(); raf = win.requestAnimationFrame(frame); },
    stop() { running = false; controls.enabled = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; selId = null; hovId = null; tip.style.opacity = 0; renderPanel(); },
    refresh,
    select: (id) => select(id, true),
    dispose() { api.stop(); win.removeEventListener('keydown', onKey); win.removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); root.remove(); },
    debug: { V, BY, BUYABLE, get ctx() { return ctx; } },
  };
  return api;
}

/** Load three.js + the addons the net needs (vendored, three r128). */
export async function loadTechNetDeps(base = new URL('../../vendor/', import.meta.url).href) {
  const [THREE, oc, ec, rp, ub] = await Promise.all([
    import(base + 'three.module.js'), import(base + 'three-addons/controls/OrbitControls.js'),
    import(base + 'three-addons/postprocessing/EffectComposer.js'), import(base + 'three-addons/postprocessing/RenderPass.js'),
    import(base + 'three-addons/postprocessing/UnrealBloomPass.js')]);
  return { THREE, addons: { OrbitControls: oc.OrbitControls, EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: ub.UnrealBloomPass } };
}
