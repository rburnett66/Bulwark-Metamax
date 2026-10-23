/**
 * src/menu/progressWidget.js — the main menu's PROGRESSION WIDGET [MM-story_mvkhef1t_i] and the BATTLE REWARDS that fly
 * into it [MM-story_mvkhegop_j]. Menu-Progression-Design §2–3.
 *
 *   createProgressWidget(doc, { onOpen }) → { el, render(values), playRewards(ledger, finalValues, layer) → Promise }
 *     values = { xp, gold, stars, research, techDot }   onOpen(key) — a tap on an indicator ('xp'|'gold'|'stars'|'research')
 *
 * DOM only (Web Animations API for the flight); the numbers come from the save. Presentation: nothing here changes a value.
 */
import { levelFromXp } from '../data/progression.js';
import { TECH_TOTAL } from '../data/techtree.js';

const CSS = `
.bwm-prog { margin-left:auto; display:flex; align-items:stretch; gap:8px; position:relative; z-index:8; }
.bwm-prog button { font:inherit; color:inherit; cursor:pointer; background:rgba(20,24,31,.82); border:1px solid #2e3846; position:relative;
  display:flex; align-items:center; gap:9px; padding:7px 12px; transition:border-color .12s, background .12s, transform .12s; }
.bwm-prog button:hover { border-color:#d9a441; background:#20262f; }
.bwm-prog .pw-ic { font-size:17px; line-height:1; width:20px; text-align:center; }
.bwm-prog .pw-v { display:flex; flex-direction:column; align-items:flex-start; line-height:1.05; }
.bwm-prog .pw-v b { font-size:16px; font-weight:800; letter-spacing:.04em; font-variant-numeric:tabular-nums; }
.bwm-prog .pw-v label { font-size:9px; letter-spacing:.28em; color:#8fa0b3; cursor:inherit; margin-top:2px; }
.bwm-prog [data-econ="gold"] .pw-ic, .bwm-prog [data-econ="gold"] b { color:#f2c869; }
.bwm-prog [data-econ="stars"] .pw-ic { color:#ffe08a; }
.bwm-prog [data-econ="research"] .pw-ic { color:#34e1ff; }
.bwm-prog .pw-rank { padding:5px 12px 5px 6px; min-width:200px; }
.bwm-prog .pw-hex { width:36px; height:40px; flex:none; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:16px; color:#0c0e12;
  background:linear-gradient(160deg,#7af0ff,#2aa8d8); clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.bwm-prog .pw-rk { flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; }
.bwm-prog .pw-rk i { font-style:normal; font-size:12px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; white-space:nowrap; }
.bwm-prog .pw-xpbar { height:5px; background:#0c0e12; border:1px solid #2e3846; position:relative; overflow:hidden; }
.bwm-prog .pw-xpbar span { position:absolute; left:0; top:0; bottom:0; width:0; background:linear-gradient(90deg,#2aa8d8,#7af0ff); box-shadow:0 0 8px #34e1ff; transition:width .25s; }
.bwm-prog .pw-rk em { font-style:normal; font-size:9px; letter-spacing:.14em; color:#8fa0b3; font-variant-numeric:tabular-nums; }
.bwm-prog .pulse { animation:pw-pulse .35s ease-out; }
@keyframes pw-pulse { 0%{transform:scale(1)} 40%{transform:scale(1.09); border-color:#f2c869; box-shadow:0 0 18px rgba(242,200,105,.55)} 100%{transform:scale(1)} }
.bwm-prog .pw-rank.rankup { animation:pw-rank 1.4s ease-out; }
@keyframes pw-rank { 0%,100%{box-shadow:none} 20%{box-shadow:0 0 0 2px #7af0ff,0 0 34px #34e1ff} 60%{box-shadow:0 0 0 1px #7af0ff,0 0 18px #34e1ff} }
.bwm-dot { position:absolute; top:-4px; right:-4px; width:11px; height:11px; border-radius:50%; background:#ff3b3b; border:2px solid #0c0e12;
  box-shadow:0 0 8px rgba(255,59,59,.8); display:none; z-index:2; pointer-events:none; animation:bwm-dot 2.4s ease-in-out infinite; }
.bwm-dot.on { display:block; }
@keyframes bwm-dot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
/* the rewards card + flying tokens */
.bwm-rw { position:absolute; inset:0; z-index:40; display:flex; align-items:center; justify-content:center; background:rgba(7,9,12,.55); cursor:pointer; animation:rw-in .3s ease-out; }
.bwm-rw.out { animation:rw-out .45s ease-in forwards; }
@keyframes rw-in { from{opacity:0} } @keyframes rw-out { to{opacity:0} }
.bwm-rw .card { min-width:min(380px,88vw); background:linear-gradient(180deg,#1a1f28,#12161d); border:1px solid #2e3846; box-shadow:0 0 0 1px rgba(242,200,105,.25),0 24px 60px rgba(0,0,0,.6);
  padding:22px 26px 18px; text-align:center; animation:rw-card .45s cubic-bezier(.2,.9,.3,1.2); }
@keyframes rw-card { from{transform:translateY(30px) scale(.92); opacity:0} }
.bwm-rw .k { font-size:10px; letter-spacing:.42em; color:#8fa0b3; }
.bwm-rw h3 { margin:6px 0 2px; font-size:30px; font-weight:900; letter-spacing:.2em; color:#f2c869; text-shadow:0 0 22px rgba(242,200,105,.45); }
.bwm-rw h3.lose { color:#e27a7a; text-shadow:0 0 22px rgba(226,122,122,.35); }
.bwm-rw .m { font-size:11px; letter-spacing:.24em; color:#8fa0b3; margin-bottom:14px; }
.bwm-rw .row { display:flex; align-items:center; gap:12px; padding:9px 12px; margin:6px 0; background:#0f1217; border:1px solid #232a34; text-align:left; }
.bwm-rw .row .ic { font-size:20px; width:26px; text-align:center; }
.bwm-rw .row b { font-size:18px; font-weight:800; letter-spacing:.04em; font-variant-numeric:tabular-nums; }
.bwm-rw .row span { font-size:10px; letter-spacing:.26em; color:#8fa0b3; margin-left:auto; }
.bwm-rw .r-gold .ic, .bwm-rw .r-gold b { color:#f2c869; } .bwm-rw .r-stars .ic { color:#ffe08a; } .bwm-rw .r-xp .ic, .bwm-rw .r-xp b { color:#7af0ff; }
.bwm-rw .up { margin-top:12px; font-size:13px; font-weight:900; letter-spacing:.3em; color:#7af0ff; text-shadow:0 0 16px #34e1ff; min-height:18px; }
.bwm-rw .tap { margin-top:10px; font-size:9px; letter-spacing:.3em; color:#5c6878; }
.bwm-tok { position:fixed; left:0; top:0; z-index:400; pointer-events:none; font-size:18px; line-height:1; will-change:transform,opacity; }
.bwm-tok.gold { color:#f2c869; text-shadow:0 0 10px rgba(242,200,105,.9); }
.bwm-tok.stars { color:#ffe08a; text-shadow:0 0 10px rgba(255,224,138,.9); }
.bwm-tok.xp { color:#7af0ff; text-shadow:0 0 10px #34e1ff; font-size:14px; }
@media (max-width: 900px) {
  .bwm-prog { gap:5px; }
  .bwm-prog button { padding:5px 7px; gap:5px; }
  .bwm-prog .pw-v label, .bwm-prog .pw-rk em { display:none; }
  .bwm-prog .pw-rank { min-width:0; }
  .bwm-prog .pw-rk i { font-size:10px; letter-spacing:.1em; }
  .bwm-prog .pw-v b { font-size:13px; }
  .bwm-prog .pw-hex { width:28px; height:32px; font-size:13px; }
}
@media (max-width: 560px) {
  .bwm-prog .pw-rk { display:none; } .bwm-prog .pw-ic { width:auto; }
  .bwm-top { padding:12px 12px; gap:8px; }                  /* phone: the crest stays, the wordmark makes room for the widget */
  .bwm-top > div:not(.bwm-crest):not(.bwm-prog) { display:none; }
}
`;

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ICON = { gold: '◆', stars: '★', xp: '⬢', research: '⬡' };

export function createProgressWidget(doc, { onOpen } = {}) {
  if (!doc.getElementById('bwm-prog-style')) { const st = doc.createElement('style'); st.id = 'bwm-prog-style'; st.textContent = CSS; doc.head.appendChild(st); }
  const el = doc.createElement('div'); el.className = 'bwm-prog'; el.setAttribute('aria-label', 'Your progress');
  el.innerHTML = `
    <button class="pw-rank" data-econ="xp" title="Commander rank"><span class="pw-hex"><span data-lvl>1</span></span>
      <span class="pw-rk"><i data-title>Recruit</i><span class="pw-xpbar"><span data-bar></span></span><em data-xp>0 / 300 XP</em></span></button>
    <button data-econ="gold" title="Banked gold — spend it in the Tech Tree"><span class="pw-ic">${ICON.gold}</span><span class="pw-v"><b data-v>0</b><label>GOLD</label></span></button>
    <button data-econ="stars" title="Best stars over every map"><span class="pw-ic">${ICON.stars}</span><span class="pw-v"><b data-v>0</b><label>STARS</label></span></button>
    <button data-econ="research" title="Tech Tree upgrades researched"><span class="pw-ic">${ICON.research}</span><span class="pw-v"><b data-v>0/${TECH_TOTAL}</b><label>RESEARCH</label></span><i class="bwm-dot" data-dot></i></button>`;
  const btn = (k) => el.querySelector('[data-econ="' + k + '"]');
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-econ]'); if (b && onOpen) onOpen(b.dataset.econ); });
  const shown = { xp: 0, gold: 0, stars: 0, research: 0 };

  function setValue(key, v) {
    shown[key] = v;
    if (key === 'xp') {
      const L = levelFromXp(v);
      el.querySelector('[data-lvl]').textContent = L.level;
      el.querySelector('[data-title]').textContent = L.title;
      el.querySelector('[data-bar]').style.width = (L.frac * 100).toFixed(1) + '%';
      el.querySelector('[data-xp]').textContent = fmt(L.into) + ' / ' + fmt(L.need) + ' XP';
      btn('xp').title = 'Commander rank — level ' + L.level + ' ' + L.title + ' · ' + fmt(v) + ' XP total';
    } else if (key === 'research') btn('research').querySelector('[data-v]').textContent = v + '/' + TECH_TOTAL;
    else btn(key).querySelector('[data-v]').textContent = fmt(v);
  }
  function render(values) {
    for (const k of ['xp', 'gold', 'stars', 'research']) if (values[k] != null) setValue(k, values[k]);
    el.querySelector('[data-dot]').classList.toggle('on', !!values.techDot);
  }
  const pulse = (key) => { const b = btn(key); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); };

  /**
   * Play a battle's rewards: the card, then tokens flying into the indicators while the counters step from the
   * ledger's from-values to its to-values. `layer` = the element the card covers (the menu root). Resolves when done
   * or skipped. finalValues = the widget's values once the rewards are in (rendered at the end, whatever happened).
   */
  function playRewards(ledger, finalValues, layer) {
    return new Promise((resolve) => {
      const win = doc.defaultView;
      const rows = [];
      if (ledger.gold && ledger.gold.earned > 0) rows.push({ key: 'gold', n: ledger.gold.earned, label: 'GOLD BANKED', from: ledger.gold.from, to: ledger.gold.to });
      if (ledger.stars && ledger.stars.to > ledger.stars.from) rows.push({ key: 'stars', n: ledger.stars.to - ledger.stars.from, label: 'NEW STARS', from: ledger.stars.from, to: ledger.stars.to });
      if (ledger.xp && ledger.xp.earned > 0) rows.push({ key: 'xp', n: ledger.xp.earned, label: 'COMMANDER XP', from: ledger.xp.from, to: ledger.xp.to });
      if (!rows.length) { render(finalValues); resolve(); return; }
      for (const r of rows) setValue(r.key, r.from);   // start from where the player left off
      const lvFrom = levelFromXp(ledger.xp ? ledger.xp.from : 0), lvTo = levelFromXp(ledger.xp ? ledger.xp.to : 0);
      const win1 = ledger.result === 'win';
      const ov = doc.createElement('div'); ov.className = 'bwm-rw';
      ov.innerHTML = '<div class="card"><div class="k">BATTLE REWARDS' + (ledger.battles > 1 ? ' · ' + ledger.battles + ' BATTLES' : '') + '</div>' +
        '<h3 class="' + (win1 ? '' : 'lose') + '">' + (win1 ? 'VICTORY' : 'DEFEAT') + '</h3><div class="m">MAP ' + (ledger.mapId || '—') + '</div>' +
        rows.map((r) => '<div class="row r-' + r.key + '" data-row="' + r.key + '"><span class="ic">' + ICON[r.key] + '</span><b>+' + fmt(r.n) + '</b><span>' + r.label + '</span></div>').join('') +
        '<div class="up" data-up></div><div class="tap">TAP TO SKIP</div></div>';
      layer.appendChild(ov);
      const anims = [], timers = [];
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        timers.forEach((t) => win.clearTimeout(t)); anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } });
        doc.querySelectorAll('.bwm-tok').forEach((t) => t.remove());
        render(finalValues);
        ov.classList.add('out'); win.setTimeout(() => { ov.remove(); resolve(); }, 450);
      };
      ov.addEventListener('click', finish);
      const reduced = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || typeof doc.body.animate !== 'function') {
        render(finalValues);
        if (lvTo.level > lvFrom.level) ov.querySelector('[data-up]').textContent = 'RANK UP — ' + lvTo.title.toUpperCase();
        timers.push(win.setTimeout(finish, 1800));
        return;
      }
      let pending = 0;
      rows.forEach((r, ri) => {
        const count = Math.max(4, Math.min(14, r.key === 'stars' ? r.n : Math.ceil(r.n / (r.key === 'gold' ? 150 : 25))));
        let arrived = 0;
        pending += count;
        timers.push(win.setTimeout(() => {
          const src = ov.querySelector('[data-row="' + r.key + '"] .ic').getBoundingClientRect();
          const dst = btn(r.key).getBoundingClientRect();
          const sx = src.left + src.width / 2, sy = src.top + src.height / 2, dx = dst.left + 22 - sx, dy = dst.top + dst.height / 2 - sy;
          for (let i = 0; i < count; i++) {
            const t = doc.createElement('span'); t.className = 'bwm-tok ' + r.key; t.textContent = ICON[r.key];
            t.style.left = sx + 'px'; t.style.top = sy + 'px';
            doc.body.appendChild(t);
            const jx = (i % 2 ? 1 : -1) * (12 + (i * 37) % 40), lift = 70 + (i * 23) % 60;
            const a = t.animate([
              { transform: 'translate(-50%,-50%) translate(0px,0px) scale(.4)', opacity: 0 },
              { transform: `translate(-50%,-50%) translate(${jx}px,${-lift * 0.6}px) scale(1.15)`, opacity: 1, offset: 0.18 },
              { transform: `translate(-50%,-50%) translate(${dx * 0.55 + jx * 0.5}px,${dy * 0.55 - lift}px) scale(1)`, opacity: 1, offset: 0.6 },
              { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.55)`, opacity: 0.9 },
            ], { duration: 850 + (i * 53) % 250, delay: i * 65, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
            anims.push(a);
            a.onfinish = () => {
              t.remove(); if (finished) return;
              arrived += 1; pending -= 1;
              setValue(r.key, r.from + (r.to - r.from) * (arrived / count));
              pulse(r.key);
              if (pending === 0) {
                if (lvTo.level > lvFrom.level) {
                  ov.querySelector('[data-up]').textContent = 'RANK UP — ' + lvTo.title.toUpperCase();
                  const rb = btn('xp'); rb.classList.remove('rankup'); void rb.offsetWidth; rb.classList.add('rankup');
                  timers.push(win.setTimeout(finish, 1700));
                } else timers.push(win.setTimeout(finish, 900));
              }
            };
          }
        }, 650 + ri * 380));
      });
    });
  }
  return { el, render, playRewards, setValue };
}
