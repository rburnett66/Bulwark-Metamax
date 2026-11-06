/**
 * src/reveal/planetReveal.js — NEW PLANET DISCOVERED: the galaxy, the fly-in, the transport's arrival and survey
 * [MM-story_mw56vccl_5] [MM-story_mw56vi32_7].
 *
 * Tech plan: docs/tech-plan/Content-Reveal.md §5.1. The beats:
 *   P0  the banner over the menu: NEW PLANET DISCOVERED, the planet's name types on;
 *   P1  the menu's own galaxy view flies out from the current planet (menu hook zoomOut);
 *   P2  the new system lights up (its UNSURVEYED tag gives way to NEW SIGNAL);
 *   P3  the camera flies in to it (menu hook flyTo — the galaxy's real fly);
 *   P4  the player's transport arrives (17 s, the Orbital Survey prototype's path, the generic transport hull);
 *   P5  the survey scan: a sweep, each site scanned and rated, the best LOCKED — the commit beat (onSurveyed);
 *   P6  fade back to the menu, the planet in view with the transport in orbit.
 * Without menu hooks (the review page) P1–P3 are a held banner. Skipping any timed beat jumps to its end, so the planet
 * is always surveyed.
 *
 *   await playPlanetReveal({ planet: 'air', menu: hooks, tier, onSurveyed })
 */
import { openDirector } from './director.js';
import { loadThree } from './three.js';
import { createSurveyStage } from './surveyStage.js';
import { ARRIVE_S, createSurvey, TARGET_TIERS } from './surveyPlan.js';
import { PLANET_ORDER } from '../save/reveals.js';
import { PLANETS } from '../data/planets.js';

const CSS = `
.rv-sv { position:absolute; right:max(16px, env(safe-area-inset-right)); top:max(16px, env(safe-area-inset-top)); width:min(318px, 46vw);
  background:rgba(12,18,20,.72); border:1px solid rgba(170,214,206,.18); border-radius:4px; padding:14px 16px 12px; display:grid; gap:9px;
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); color:#e6ebe3; font:13px/1.4 "IBM Plex Sans Condensed", system-ui, sans-serif; }
.rv-sv header { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
.rv-sv .ship { font:600 17px "Chakra Petch", sans-serif; letter-spacing:.08em; text-transform:uppercase; }
.rv-sv .mode, .rv-sv .th, .rv-sv .st { font:500 10px ui-monospace, Menlo, monospace; letter-spacing:.1em; text-transform:uppercase; color:#6fd3c8; }
.rv-sv .th { color:#8f9c97; }
.rv-sv ol, .rv-sv ul { list-style:none; margin:0; padding:0; display:grid; gap:4px; }
.rv-sv .tg li { display:grid; grid-template-columns:70px 1fr auto; gap:8px; align-items:baseline; font:11px ui-monospace, Menlo, monospace; opacity:0; transform:translateX(8px); transition:opacity .45s, transform .45s; }
.rv-sv .tg li.on { opacity:1; transform:none; }
.rv-sv .tg .tier { font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--tc); }
.rv-sv .tg .nm { font:600 14px "Chakra Petch", sans-serif; letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rv-sv .tg .val { font-size:10px; color:#8f9c97; text-transform:uppercase; }
.rv-sv .sites li { display:grid; grid-template-columns:18px 1fr 30px; gap:2px 8px; align-items:center; font:11px ui-monospace, Menlo, monospace; color:#8f9c97; }
.rv-sv .sites .id { font:700 14px "Chakra Petch", sans-serif; color:#f2c869; text-align:center; }
.rv-sv .sites .sc { text-align:right; color:#e6ebe3; }
.rv-sv .sites .bar { grid-column:2 / span 2; height:3px; background:rgba(255,255,255,.07); border-radius:2px; overflow:hidden; }
.rv-sv .sites .bar i { display:block; height:100%; width:0; background:#f2c869; }
.rv-sv .sites li[data-s="scanning"] { color:#e6ebe3; } .rv-sv .sites li[data-s="scanning"] .bar i { background:#6fd3c8; }
.rv-sv .sites li[data-s="locked"] { color:#eafffb; } .rv-sv .sites li[data-s="locked"] .id { color:#eafffb; background:rgba(111,211,200,.22); border-radius:2px; }
.rv-sv .st { border-top:1px solid rgba(170,214,206,.18); padding-top:8px; min-height:2.6em; }
.rv-sv .st b { color:#eafffb; font-weight:500; }
.rv-pn { position:absolute; left:max(16px, env(safe-area-inset-left)); top:max(16px, env(safe-area-inset-top)); pointer-events:none; }
.rv-pn .k { font:500 11px ui-monospace, Menlo, monospace; letter-spacing:.14em; text-transform:uppercase; color:#6fd3c8; }
.rv-pn h1 { margin:2px 0 0; font:700 clamp(30px,5.4vw,58px) "Chakra Petch", sans-serif; letter-spacing:.04em; text-transform:uppercase; line-height:.92; text-shadow:0 2px 18px rgba(0,0,0,.6); }
.rv-pn .s { margin-top:6px; color:#c3cdc6; max-width:42ch; font-size:13px; text-shadow:0 1px 10px rgba(0,0,0,.8); }
@media (max-width: 760px) { .rv-sv { top:auto; bottom:max(12px, env(safe-area-inset-bottom)); width:min(300px, 60vw); padding:10px 12px; gap:6px; } .rv-sv .sites .meta { display:none; } }
@media (max-height: 460px) { .rv-sv .tg .val, .rv-sv .sites { display:none; } .rv-pn .s { display:none; } }
`;

function readout(d, planet) {
  const doc = d.doc, P = PLANETS[planet] || {}, R = P.resources || {};
  if (!doc.getElementById('rv-sv-css')) { const st = doc.createElement('style'); st.id = 'rv-sv-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const pn = doc.createElement('div'); pn.className = 'rv-pn';
  pn.innerHTML = `<div class="k">Orbital survey</div><h1>${P.name || planet}</h1><div class="s">${P.type || ''}${P.type ? '. ' : ''}A new signal. Your transport goes to look.</div>`;
  const el = doc.createElement('section'); el.className = 'rv-sv'; el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<header><span class="ship">Transport</span><span class="mode">Inbound</span></header>
    <div class="th">Resource targets</div><ol class="tg">${TARGET_TIERS.map((t) => `<li style="--tc:${t.color}"><span class="tier">${t.label}</span><span class="nm">${(R[t.key] && R[t.key].name) || '—'}</span><span class="val">${t.val}</span></li>`).join('')}</ol>
    <ul class="sites"></ul><div class="st">Inbound</div>`;
  d.ui.appendChild(pn); d.ui.appendChild(el);
  const $ = (s) => el.querySelector(s), tgs = [...el.querySelectorAll('.tg li')];
  return {
    arrival(r) { $('.mode').textContent = r.mode; $('.st').textContent = r.status; tgs.forEach((li, i) => li.classList.toggle('on', i < r.targets)); },
    survey(st) {
      tgs.forEach((li) => li.classList.add('on'));
      $('.mode').textContent = st.mode;
      $('.st').innerHTML = st.locked ? `<b>${st.status}</b>` : st.status;
      const ul = $('.sites');
      if (ul.children.length !== st.sites.length) ul.innerHTML = st.sites.map(() => '<li><span class="id"></span><span class="meta"></span><span class="sc"></span><span class="bar"><i></i></span></li>').join('');
      st.sites.forEach((s, i) => {
        const li = ul.children[i], known = s.state === 'rated' || s.state === 'locked', scanning = s.state === 'scanning';
        li.dataset.s = s.state; li.querySelector('.id').textContent = s.id;
        li.querySelector('.meta').textContent = s.state === 'hidden' ? 'no contact' : s.state === 'queued' ? 'queued'
          : `yield ${scanning ? Math.round(s.yield * s.shown) : s.yield} · slope ${s.slope}°`;
        li.querySelector('.sc').textContent = known ? s.score : scanning ? Math.round(s.score * s.shown) : '';
        li.querySelector('.bar i').style.width = (known ? s.score : scanning ? s.score * s.shown : 0) + '%';
      });
    },
    remove() { el.remove(); pn.remove(); },
  };
}

/**
 * Play the reveal. menu (optional): { zoomOut(), ignite(key), flyTo(key) → Promise, settle(key) } — the menu's galaxy.
 * onSurveyed(planet) runs at the site lock (or on skip / close), exactly once. → Promise (resolves when done).
 */
export async function playPlanetReveal({ planet, menu = null, tier = 'high', reduce = null, mount, onSurveyed = () => {} } = {}) {
  const P = PLANETS[planet] || { name: planet };
  const d = openDirector({ mount, label: 'New planet discovered: ' + P.name, reduce });
  let committed = false;
  const commit = () => { if (committed) return; committed = true; try { onSurveyed(planet); } catch (e) { console.warn('[reveal] onSurveyed', e); } };
  try {
    // P0 — the banner over the menu
    d.banner('NEW PLANET DISCOVERED', '', '', { dark: true });
    const title = P.name.toUpperCase(), tEl = d.root.querySelector('.rv-banner .t');
    await d.timed(2.5, (t) => { tEl.textContent = title.slice(0, Math.ceil(Math.min(1, t / 1.1) * title.length)); });
    // P1–P3 — the galaxy: out, the system lights up, in
    if (menu) {
      d.root.querySelector('.rv-banner .s').textContent = 'NEW SIGNAL · ' + (PLANET_ORDER.indexOf(planet) + 1) + ' OF ' + PLANET_ORDER.length;
      menu.zoomOut();
      await d.timed(1.8, () => {});
      d.hideBanner(); menu.ignite(planet);
      await d.timed(2.4, () => {});
      await Promise.race([menu.flyTo(planet), d.wait(4)]);
    } else {
      await d.timed(2.0, () => {});
      d.hideBanner();
    }
    await d.fade(1, 0.5);
    // P4 — the transport arrives
    const { THREE } = await loadThree();
    const renderer = new THREE.WebGLRenderer({ canvas: d.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier === 'low' ? 1 : 2));
    const st = createSurveyStage(THREE, { renderer, planet, tier, seed: 7 + PLANET_ORDER.indexOf(planet) });
    const resize = () => st.resize(d.root.clientWidth, d.root.clientHeight);
    addEventListener('resize', resize); resize();
    d.setSolid(true); d.showGL(true); d.hideBanner();
    const ro = readout(d, planet);
    await d.fade(0, 0.6);
    if (d.reduce) { ro.arrival(st.arrive(1)); st.render(0); }
    else await d.timed(ARRIVE_S, (t, dt) => { ro.arrival(st.arrive(t / ARRIVE_S)); st.render(dt); });
    // P5 — the survey scan, to the lock
    const resName = (P.resources && P.resources.common && P.resources.common.name) || 'resources';
    const sv = createSurvey(17 + PLANET_ORDER.indexOf(planet) * 101, { resourceName: resName });
    if (d.reduce) { const s = sv.finish(); st.survey(s); ro.survey(s); st.render(0); commit(); await d.wait(1.5); }
    else {
      await d.timed(30, (t, dt, end) => {
        const s = end && !sv.state.done ? sv.finish() : sv.step(dt);
        st.survey(s); ro.survey(s); st.render(dt);
        if (s.locked) commit();
        return s.done;
      });
    }
    commit();
    d.caption((P.name || '').toUpperCase() + ' SURVEYED', true);
    await d.wait(1.4);
    // P6 — back to the menu
    await d.fade(1, 0.6);
    removeEventListener('resize', resize);
    ro.remove(); st.dispose(); renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    if (menu && menu.settle) menu.settle(planet);
    d.showGL(false); d.setSolid(false); d.caption('', false);
    await d.fade(0, 0.6);
  } finally {
    commit();
    d.close();
  }
}
