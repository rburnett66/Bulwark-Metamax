/**
 * src/reveal/shipReveal.js — capital ships: first sight, first time aboard, exploring, departing [MM-story_mw56ve9g_6]
 * [MM-story_mw56vk3i_8] [MM-story_mw56vnks_9].
 *
 * Tech plan: docs/tech-plan/Content-Reveal.md §5.2–5.4. Owner 2026-11-06:
 *   "If this is the first time introduction the camera would pan to the side of the ship in a cinematic way and then
 *    we get the transition that reveals the rooms and crew of the ship. The very first character is introduced and the
 *    planets first missions are presented and added to the mission log. The player can then explore, depart, and hit
 *    play" · "Once a player completes Map 3 at 3 stars or better the capital ship arrives for that faction".
 *
 * Everything here is built from what exists:
 *   - the arrival: arrivalPlan.js / arrivalStage.js (the presentation kit the opening uses);
 *   - the board wipe and depart: the Long Ledger prototype's board() / depart(), as the opening plays them
 *     (a cyan scan line reveals the room view over the 3D hull, and closes it again);
 *   - rooms and crew: ship-interior/roomView.js with the ship layout (the Collective's layout is the only one so far —
 *     a faction ship reuses it with its own crew until its own layout is authored);
 *   - the character: the ship's captain from the mission catalog (content/missions/missions.json capitalShips), speaking
 *     their own voice-pack lines through the comm card (comm/commCard.js, comm/dialog.js characterCall);
 *   - the missions: offered as a contract on the contract card (render/contractModal.js), ACCEPT → onContract.
 *
 *   await playShipReveal({ planet, firstTime, tier, onSeen, onContract, missions, outpost })   // first sight (+ aboard) or coast-in
 *     outpost: { cardFor(shipName) → card, onAccept(key), onDecline(key) } — the outpost contract before the missions (O3)
 *   await boardShip({ planet })                                                        // re-board: explore, depart
 *   await playCollectiveIntroduces({ planet, onContract })                             // a new planet's contract
 */
import { openDirector } from './director.js';
import { loadThree, CONTENT, SHIP_MODEL } from './three.js';
import { createArrivalStage } from './arrivalStage.js';
import { FIRST_SIGHT_S, FLANK_S } from './arrivalPlan.js';
import { prepareLayout } from '../ship-interior/layout.js';
import { createRoomView } from '../ship-interior/roomView.js';
import { factionShipLayout } from '../ship-interior/shipRooms.js';
import '../data/factions.js';
import { createComm } from '../comm/commCard.js';
import { characterCall } from '../comm/dialog.js';
import { showContractModal } from '../render/contractModal.js';
import { contractFor } from '../data/collectiveContract.js';
import { PLANETS } from '../data/planets.js';
import { createStandingsScreen } from '../menu/standingsScreen.js';
import { loadSave, updateSave } from '../save/save.js';
import { noteRapportEvent, standingOf } from '../save/standings.js';

const CSS = `
.rv .rv-rooms { position:absolute; inset:0; width:100%; height:100%; display:block; clip-path:inset(0 100% 0 0); }
.rv .rv-scan { position:absolute; top:0; bottom:0; width:3px; margin-left:-1px; background:#38e1c8; box-shadow:0 0 18px 4px #38e1c8aa, 0 0 64px 14px #38e1c844; pointer-events:none; display:none; }
.rv .rv-lb { position:absolute; left:0; right:0; height:0; background:#000; pointer-events:none; }
.rv .rv-lb.t { top:0; } .rv .rv-lb.b { bottom:0; }
.rv .rv-plate { position:absolute; left:max(24px, env(safe-area-inset-left)); bottom:16%; font:700 clamp(18px,2.6vw,28px) "Chakra Petch", sans-serif; letter-spacing:.12em; color:#e9e2d6; opacity:0; pointer-events:none; text-shadow:0 2px 14px #000; }
.rv .rv-title { position:absolute; left:0; right:0; top:62%; text-align:center; opacity:0; pointer-events:none; }
.rv .rv-title b { display:block; font:700 clamp(28px,5vw,54px) "Chakra Petch", sans-serif; letter-spacing:.14em; padding-left:.14em; color:#f2c869; text-shadow:0 0 24px rgba(0,0,0,.8); }
.rv .rv-title span { display:block; margin-top:6px; font-size:clamp(12px,1.5vw,15px); letter-spacing:.24em; color:#cfc4b4; text-shadow:0 0 10px #000; }
.rv .rv-prompt { position:absolute; transform:translate(-50%, -100%); text-align:center; pointer-events:none; opacity:0; transition:opacity .4s; }
.rv .rv-prompt b { display:block; font:700 clamp(14px,2vw,20px) "Chakra Petch", sans-serif; letter-spacing:.3em; padding-left:.3em; color:#ffcf5c; text-shadow:0 0 14px rgba(255,207,92,.6); }
.rv .rv-prompt span { display:block; margin-top:4px; font-size:12px; letter-spacing:.2em; color:#e9e2d6; animation:rvPulse 2s ease-in-out infinite; }
@keyframes rvPulse { 0%,100% { opacity:.55 } 50% { opacity:1 } }
.rv .rv-bar { position:absolute; left:max(16px, env(safe-area-inset-left)); top:max(16px, env(safe-area-inset-top)); display:flex; gap:8px; }
.rv .rv-btn { font:600 12px "Chakra Petch", sans-serif; letter-spacing:.16em; color:#e9e2d6; background:rgba(14,9,8,.8); border:1px solid rgba(242,200,105,.4);
  border-radius:6px; padding:9px 13px; min-height:36px; cursor:pointer; }
.rv .rv-btn.primary { background:linear-gradient(160deg,#f2c869,#d9a441); color:#1a1208; border-color:#f2c869; }
.rv .rv-btn:focus-visible { outline:2px solid #f2c869; outline-offset:2px; }
.rv .rv-where { position:absolute; left:0; right:0; top:max(18px, env(safe-area-inset-top)); text-align:center; font:600 12px "Chakra Petch", sans-serif; letter-spacing:.3em; color:#cfc4b4; pointer-events:none; }
@media (prefers-reduced-motion: reduce) { .rv .rv-prompt span { animation:none; } }
`;

let catalogP = null, revealsP = null, packsP = null, manifestP = null, layoutP = null;
const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
const catalog = () => (catalogP ||= json(CONTENT + 'missions/missions.json'));
const revealsData = () => (revealsP ||= json(CONTENT + 'reveals/reveals.json'));
// the voice packs (as comm/dialog.js loadVoicePacks reads them), from this module's own path so the review page works too
const packs = () => (packsP ||= json(CONTENT + 'dialog/voicepacks.json').then((d) => (d && d.factions ? d : null), () => null));
const manifest = () => (manifestP ||= json(CONTENT + 'ships/ships.json'));
const shipLayout = () => (layoutP ||= json(CONTENT + 'ships/collective/ship-layout.json'));

/** The first missions granted aboard a planet's own ship (its lowest map past the Collective's), by title. */
export async function shipMissions(planet) {
  const P = PLANETS[planet] || {}, cat = await catalog();
  const collective = (cat.collective && cat.collective.ship) || 'the Collective ship';
  const own = (cat.missions || []).filter((m) => m.planet === P.name && m.collectAt !== collective && m.map && !m.variant);
  const first = Math.min(...own.map((m) => m.map || 99));
  return own.filter((m) => m.map === first).map((m) => m.title);
}

/** Who and what a planet's capital ship is: { key, name, captain, shipModel, room, isCollective }. */
async function shipOf(planet) {
  const P = PLANETS[planet] || {}, cat = await catalog(), R = await revealsData();
  if (planet === 'collective') return { key: 'collective', name: 'The Long Ledger', captain: R.collective.speaker.name, shipModel: 'collective', room: R.collective.room, isCollective: true };
  const cs = (cat.capitalShips || {})[P.name] || {};
  return { key: planet, name: cs.ship || (P.name + ' capital ship'), captain: cs.captain || '', shipModel: SHIP_MODEL[planet] || 'powder', room: R.factionShip.room, isCollective: false };
}

function ensureCss(doc) { if (!doc.getElementById('rv-ship-css')) { const st = doc.createElement('style'); st.id = 'rv-ship-css'; st.textContent = CSS; doc.head.appendChild(st); } }

/** Open the director with the 3D ship stage loaded. → { d, THREE, addons, stage, renderer, ship, resize, dispose } */
async function openShipStage({ planet, tier, reduce, mount, label }) {
  const d = openDirector({ mount, label, reduce, solid: true });
  ensureCss(d.doc);
  const { THREE, addons } = await loadThree();
  const ship = await shipOf(planet), man = await manifest();
  const rec = man[ship.shipModel] || man.powder;
  const renderer = new THREE.WebGLRenderer({ canvas: d.canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier === 'low' ? 1 : tier === 'standard' ? 1.5 : 2));
  const stage = createArrivalStage(THREE, { renderer, addons, planet: planet === 'collective' ? 'ground' : planet, tier, reduced: d.reduce });
  await stage.load({
    ship: CONTENT + 'ships/' + rec.lods[tier === 'low' ? 1 : 0].file,
    tug: man.tug ? CONTENT + 'ships/' + man.tug.lods[0].file : null, engineColor: rec.engineColor,
  });
  const resize = () => stage.resize(d.root.clientWidth, d.root.clientHeight);
  addEventListener('resize', resize); resize();
  d.showGL(true);
  return {
    d, THREE, addons, stage, renderer, ship, resize,
    dispose() { removeEventListener('resize', resize); try { stage.dispose(); renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* best effort */ } },
  };
}

/** The comm card for a reveal: its own instance, lifted over the director (.rv-on), held lines, tap to close. */
/** A call with the character's portrait expression from the player's rating with them (standings.js). */
function withMood(call, name) {
  if (!call) return call;
  try { return { ...call, mood: standingOf(loadSave(), name).mood }; } catch (e) { return call; }
}

async function speak(doc, calls) {
  const comm = createComm(doc);
  try {
    for (const c of calls) {
      if (!c) continue;
      const closed = comm.waitForClose();
      comm.showCall({ ...c, hold: true, center: false });
      await closed;
    }
  } finally { comm.destroy(); }
}

/**
 * Inside the ship (F2–F8): the board wipe over the 3D flank, life, then either the path to the character, their
 * scene and the contract (story), or straight to exploring. Explore until DEPART; the depart wipe; resolve.
 */
async function aboard(S, { story = false, onContract = () => {}, missions = [], outpost = null, missionsCard = true } = {}) {
  const { d, THREE, stage, ship } = S, doc = d.doc, reduce = d.reduce;
  const roomCanvas = doc.createElement('canvas'); roomCanvas.className = 'rv-rooms';
  const scanEl = doc.createElement('div'); scanEl.className = 'rv-scan';
  const promptEl = doc.createElement('div'); promptEl.className = 'rv-prompt'; promptEl.innerHTML = '<b></b><span>TAP TO ENTER</span>';
  d.root.insertBefore(roomCanvas, d.root.querySelector('.rv-fade'));
  d.root.insertBefore(scanEl, d.root.querySelector('.rv-fade'));
  d.ui.appendChild(promptEl);
  const roomR = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true });
  roomR.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); roomR.outputEncoding = THREE.sRGBEncoding;
  // the ship's layout: the Long Ledger as authored, or a faction ship's — every neutral room plus its own (shipRooms.js)
  const base = await shipLayout();
  const raw = ship.isCollective ? JSON.parse(JSON.stringify(base)) : factionShipLayout(base, ship.key, (globalThis.BulwarkFactions && (globalThis.BulwarkFactions.find(ship.key) || {}).name) || ship.key);
  const layout = prepareLayout(raw);
  const roomOf = (id) => raw.rooms.find((r) => r.id === id) || {};
  const patron = { room: ship.room, fac: ship.isCollective ? 'collective' : ship.key, name: ship.captain, captain: !ship.isCollective };
  const view = createRoomView(THREE, { renderer: roomR, layout, reduce, patron });
  const resize = () => { const w = d.root.clientWidth, h = d.root.clientHeight; roomR.setSize(w, h, false); view.resize(w, h); S.resize(); };
  addEventListener('resize', resize); resize();
  const flankT = FLANK_S;
  const portrait = () => d.root.clientWidth < d.root.clientHeight;

  // F2 — board: the scan line wipes the hull away, left → right
  await d.timed(reduce ? 0.2 : 3.6, (t, dt) => {
    const k = reduce ? 1 : Math.min(1, t / 3.4), e = k * k * (3 - 2 * k);
    roomCanvas.style.clipPath = e >= 1 ? 'none' : `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`;
    scanEl.style.display = e > 0 && e < 1 ? 'block' : 'none'; scanEl.style.left = (e * 100).toFixed(2) + '%';
    if (e < 1) stage.frame(flankT, dt);
    view.focus(null); view.frame(dt, { flash: 0, camEase: 2.4 });
  }, { skippable: false });
  scanEl.style.display = 'none';
  // F3 — life inside
  await d.timed(reduce ? 0.2 : 3, (t, dt) => { view.frame(dt, { flash: 0, camEase: 2.4 }); });

  if (story) {
    // F4 — the path to the character: every other room dims, theirs glows, they flash; tap or wait
    const R = roomOf(ship.room);
    view.ship.setAll('dim', ship.room); view.ship.setState(ship.room, 'highlight');
    promptEl.querySelector('b').textContent = (R.name || ship.room).toUpperCase();
    let entered = false;
    const onTap = (e) => { const hit = view.pick(e.clientX, e.clientY, roomCanvas.getBoundingClientRect()); if (hit && hit.id === ship.room) entered = true; };
    roomCanvas.addEventListener('pointerup', onTap); roomCanvas.style.pointerEvents = 'auto';
    await d.timed(reduce ? 0.4 : 6, (t, dt) => {
      view.focus(ship.room, portrait() ? 0.9 : 0.55);
      const flash = reduce ? 1 : (Math.sin(t * 6) > 0 ? 1 : 0.35);
      view.frame(dt, { flash, camEase: 2.4 });
      const box = view.screenBox(ship.room, { left: 0, top: 0, width: d.root.clientWidth, height: d.root.clientHeight });
      promptEl.style.left = (box.left + box.width / 2) + 'px'; promptEl.style.top = Math.max(60, box.top - 8) + 'px'; promptEl.style.opacity = '1';
      return entered;
    }, { skippable: false });
    roomCanvas.removeEventListener('pointerup', onTap);
    promptEl.style.opacity = '0';
    // walk in, the camera pushes in, the character turns
    let arrived = false;
    view.focus(ship.room, portrait() ? 0.96 : 0.78);
    view.walkPlayerTo(ship.room, () => { arrived = true; view.patronTurn(); });
    await d.timed(12, (t, dt) => { view.frame(dt, { flash: 0.35, camEase: 2.4 }); return arrived; }, { skippable: false });
    // F5 — the story: the character's lines on the comm card (the room keeps living under it)
    const L = d.loop((dt) => view.frame(dt, { flash: 0, camEase: 2.4 }));
    const pk = await packs(), R2 = await revealsData();
    const P = PLANETS[ship.key] || {};
    const greet = ship.isCollective ? null : withMood(characterCall(pk, ship.key, ship.captain, R2.factionShip.greet, 'CAPTAIN'), ship.captain);
    const offer = ship.isCollective ? null : withMood(characterCall(pk, ship.key, ship.captain, R2.factionShip.offer, 'CAPTAIN'), ship.captain);
    // the outpost contract comes first on every faction ship (Outpost-Design §2.1–2.3) [MM-story_mw5oe8km_k]: the
    // captain's outpost lines (their own greeting replaces the generic one), then its card; LATER keeps it in the
    // Mission Log, where it can be accepted. Then the generic offer line and the ship's missions, as before.
    const outpostLines = outpost && outpost.card
      ? ((R2.factionShip.outpost || {})[ship.key] || []).map((l) => withMood(characterCall(pk, ship.key, ship.captain, { line: l.line, intent: l.intent || 'statement' }, 'CAPTAIN'), ship.captain)).filter(Boolean)
      : [];
    if (outpost && outpost.card) {
      await speak(doc, outpostLines.length ? outpostLines : [greet]);
      await new Promise((res) => {
        const done = (fn) => () => { try { fn(ship.key); } catch (e) { console.warn('[reveal] outpost', e); } res(); };
        showContractModal(d.root, { ...outpost.card, character: { name: ship.captain, phrase: '' } },
          { onAccept: done(outpost.onAccept || (() => {})), onDecline: done(outpost.onDecline || (() => {})) });
      });
      if (offer) await speak(doc, [offer]);
    } else if (greet || offer) await speak(doc, [greet, offer]);
    // F6 — the missions, offered as a contract (not on a later boarding, which only carries the outpost offer)
    if (missionsCard) await new Promise((res) => {
      const list = missions.length ? '<br>' + missions.slice(0, 5).map((m) => '· ' + m).join('<br>') : '';
      showContractModal(d.root, {
        kicker: 'CONTRACT — ' + ship.name.toUpperCase(),
        character: { name: ship.captain, phrase: '' },
        task: `Take ${P.name || 'the planet'}'s campaign from here. Missions on this planet are granted and collected aboard the <b>${ship.name}</b> from now on.`,
        terms: (missions.length ? 'New in your Mission Log:' : 'Your Mission Log has been updated.') + list,
        acceptLabel: 'ACCEPT',
      }, { onAccept: () => { try { onContract(ship.key); } catch (e) { console.warn('[reveal] onContract', e); } res(); } });
    });
    L.stop();
    view.ship.setAll('normal');
  }

  // the captain greets the player on every visit, +1 to their rating once a day (owner 2026-11-09: "greeting the player
  // on a ship visit is +1" · "greeting limit is 1 per day": standings.noteRapportEvent keeps the day). A story boarding has spoken the greeting above; a free boarding shows it now and does not wait on it.
  if (!ship.isCollective && ship.captain) {
    if (!story) {
      Promise.all([packs(), revealsData()]).then(([pk, R2]) => {
        const g = withMood(characterCall(pk, ship.key, ship.captain, R2.factionShip.greet, 'CAPTAIN'), ship.captain);
        if (g) speak(doc, [g]).catch((e) => console.warn('[reveal] greeting', e));
      }).catch((e) => console.warn('[reveal] greeting', e));
    }
    try { updateSave((sv) => noteRapportEvent(sv, ship.captain, ship.key, 'greet')); } catch (e) { console.warn('[reveal] greeting rating', e); }
  }

  // F7 — explore: leave the room, walk anywhere, DEPART when ready
  const where = doc.createElement('div'); where.className = 'rv-where'; where.textContent = ship.name.toUpperCase();
  const bar = doc.createElement('div'); bar.className = 'rv-bar';
  bar.innerHTML = '<button class="rv-btn primary" type="button" data-depart>◂ DEPART</button><button class="rv-btn" type="button" data-standings aria-pressed="false">STANDINGS</button><button class="rv-btn" type="button" data-leave>◂ LEAVE ROOM</button>';
  d.ui.appendChild(where); d.ui.appendChild(bar);
  // STANDINGS: every character's rating and every faction's relationship, only aboard a capital ship (owner 2026-11-09)
  const standBtn = bar.querySelector('[data-standings]');
  const setStand = (on) => { standBtn.textContent = on ? '✕ CLOSE STANDINGS' : 'STANDINGS'; standBtn.setAttribute('aria-pressed', String(on)); };
  const standings = createStandingsScreen({ doc, host: d.root, onClose: () => { standings.close(); setStand(false); } });
  standBtn.addEventListener('click', () => { if (standings.isOpen()) { standings.close(); setStand(false); } else { standings.open(); setStand(true); } });
  const leaveBtn = bar.querySelector('[data-leave]'); leaveBtn.style.display = 'none';
  let inRoom = null, departing = false, walking = false;
  leaveBtn.addEventListener('click', () => { inRoom = null; view.focus(null); leaveBtn.style.display = 'none'; where.textContent = ship.name.toUpperCase(); });
  const onPick = (e) => {
    if (departing || walking || standings.isOpen()) return;
    const hit = view.pick(e.clientX, e.clientY, roomCanvas.getBoundingClientRect()); if (!hit) return;
    walking = true; inRoom = hit.id; view.focus(hit.id, portrait() ? 0.9 : 0.6);
    where.textContent = ship.name.toUpperCase() + ' · ' + (roomOf(hit.id).name || hit.id).toUpperCase();
    leaveBtn.style.display = '';
    view.walkPlayerTo(hit.id, async () => {
      walking = false;
      const r = roomOf(hit.id);
      // the Collective's rooms carry their occupant's line (ship-layout.json); a faction ship's own lines come with its layout
      if (ship.isCollective && r.who && r.line) await speak(doc, [{ factionKey: 'collective', name: r.who.split('·')[0].trim(), sub: r.who, line: r.line, gender: 'female', intent: 'statement' }]);
    });
  };
  roomCanvas.addEventListener('pointerup', onPick); roomCanvas.style.pointerEvents = 'auto';
  if (story) { inRoom = ship.room; leaveBtn.style.display = ''; }
  const L2 = d.loop((dt) => view.frame(dt, { flash: 0, camEase: 2.4 }));
  await new Promise((res) => bar.querySelector('[data-depart]').addEventListener('click', res, { once: true }));
  departing = true; L2.stop(); where.remove(); bar.remove(); standings.dispose();
  roomCanvas.removeEventListener('pointerup', onPick);
  // F8 — depart: the hull closes behind the scan line (the wipe in reverse) over the 3D flank, then black
  view.focus(null);
  await d.timed(reduce ? 0.3 : 3.2, (t, dt) => {
    const k = reduce ? 1 : Math.min(1, t / 1.6);
    roomCanvas.style.clipPath = `inset(0 0 0 ${(k * 100).toFixed(2)}%)`;
    scanEl.style.display = k > 0 && k < 1 ? 'block' : 'none'; scanEl.style.left = (k * 100).toFixed(2) + '%';
    stage.frame(flankT, dt); view.frame(dt, { flash: 0, camEase: 2.4 });
    d.caption('DEPARTING ' + ship.name.toUpperCase(), t > 1.2);
  }, { skippable: false });
  await d.fade(1, 0.6);
  removeEventListener('resize', resize);
  try { view.dispose(); roomR.dispose(); roomR.forceContextLoss(); } catch (e) { /* best effort */ }
  roomCanvas.remove(); scanEl.remove(); promptEl.remove(); d.caption('', false);
}

/** Draw the letterbox, the name plate and the title card from the arrival's state. */
function arrivalOverlay(d, ship) {
  const lbT = d.doc.createElement('div'), lbB = d.doc.createElement('div');
  lbT.className = 'rv-lb t'; lbB.className = 'rv-lb b';
  const plate = d.doc.createElement('div'); plate.className = 'rv-plate'; plate.textContent = ship.name;
  const title = d.doc.createElement('div'); title.className = 'rv-title';
  title.innerHTML = `<b>${ship.name.toUpperCase()}</b><span>${ship.captain ? 'COMMANDED BY ' + ship.captain.toUpperCase() : ''}</span>`;
  for (const e of [lbT, lbB, plate, title]) d.root.insertBefore(e, d.root.querySelector('.rv-ui'));
  return {
    set(o) {
      const landscape = d.root.clientWidth >= d.root.clientHeight, w = d.root.clientWidth, h = d.root.clientHeight;
      const bar = landscape ? Math.max(0, (h - w / 2.39) / 2) * o.letterbox : 0;
      lbT.style.height = lbB.style.height = bar + 'px';
      plate.style.opacity = o.plate.toFixed(3); title.style.opacity = o.title.toFixed(3);
    },
    remove() { for (const e of [lbT, lbB, plate, title]) e.remove(); },
  };
}

/**
 * A capital ship presents itself. firstTime: the 22 s first-sight arrival (title card = the commit beat → onSeen),
 * the pan to the flank, then aboard with the story (the character, the contract → onContract), explore, depart.
 * Otherwise: the 3.5 s coast-in into its orbit. → Promise.
 */
export async function playShipReveal({ planet, firstTime = true, tier = 'high', reduce = null, mount, onSeen = () => {}, onContract = () => {}, missions = [], start = 0, outpost = null } = {}) {
  if (firstTime && !missions.length) missions = await shipMissions(planet).catch(() => []);
  const S = await openShipStage({ planet, tier, reduce, mount, label: 'Capital ship arriving' });
  const { d, stage, ship } = S;
  let seen = false;
  const commit = () => { if (seen) return; seen = true; try { onSeen(planet); } catch (e) { console.warn('[reveal] onSeen', e); } };
  try {
    if (!firstTime) {
      await d.timed(d.reduce ? 0.3 : 3.5, (t, dt) => { stage.frame(20, dt, { drift: d.reduce ? 0 : 1.6 * Math.pow(1 - t / 3.5, 2) }); });
      await d.wait(0.8);
      await d.fade(1, 0.5);
      return;
    }
    const ov = arrivalOverlay(d, ship);
    d.caption('LONG-RANGE CONTACT — ' + ((PLANETS[planet] || {}).name || '').toUpperCase() + ' ORBIT', true);
    const t0 = Math.max(0, Math.min(FIRST_SIGHT_S, start));   // review page: ?t= starts later in the arrival
    await d.timed(FIRST_SIGHT_S - t0, (tt, dt, end) => {
      const t = t0 + tt;
      const o = stage.frame(end ? FIRST_SIGHT_S : t, dt); if (!o) return;
      ov.set(o);
      if (t > 1.6) d.caption('', false);
      if (o.commit || end) commit();
    });
    commit(); ov.remove(); d.caption('', false);
    // F1 — the pan to the flank
    await d.timed(d.reduce ? 0.2 : FLANK_S - FIRST_SIGHT_S, (t, dt) => { stage.frame(FIRST_SIGHT_S + t, dt); });
    await aboard(S, { story: true, onContract, missions, outpost: outpost && outpost.card ? outpost : (outpost && outpost.cardFor ? { ...outpost, card: outpost.cardFor(ship.name) } : null) });
  } finally {
    commit();
    S.dispose(); d.close();
  }
}

/** Re-board a ship already met (tap its station): the flank, the board wipe, explore, depart. */
export async function boardShip({ planet, tier = 'high', reduce = null, mount, outpost = null } = {}) {
  const S = await openShipStage({ planet, tier, reduce, mount, label: 'Boarding' });
  try {
    await S.d.timed(S.d.reduce ? 0.2 : 1.2, (t, dt) => { S.stage.frame(FLANK_S, dt); });
    // the outpost contract is still on offer (put off, or the ship came before outposts existed) [MM-story_mw5oe8km_k]:
    // boarding walks to the captain and makes the offer again; otherwise boarding is free exploring
    const card = outpost && (outpost.card || (outpost.cardFor && outpost.cardFor(S.ship.name)));
    if (card) await aboard(S, { story: true, outpost: { ...outpost, card }, missionsCard: false });
    else await aboard(S, { story: false });
  } finally { S.dispose(); S.d.close(); }
}

/**
 * The Collective introduces a new planet (owner 2026-11-06: "The Collective always introduces new planets"): the Long
 * Ledger coasts in, the Factor calls, and the planet's maps 1–3 are offered as the Collective contract → onContract.
 * Drawn over the menu (no 3D of its own: the menu shows the Long Ledger at its station).
 */
export async function playCollectiveIntroduces({ planet, reduce = null, mount, onContract = () => {} } = {}) {
  const d = openDirector({ mount, label: 'The Collective', reduce });
  ensureCss(d.doc);
  try {
    const R = await revealsData(), P = PLANETS[planet] || { name: planet };
    const sp = R.collective.speaker;
    await d.wait(0.6);
    await speak(d.doc, [{ ...sp, line: R.collective.newPlanet.replace('{planet}', P.name), intent: 'statement', voiceSeed: 7 }]);
    const rows = [1, 2, 3].map((m) => { const c = contractFor(planet, m); return c ? `Map ${m}: <b>${c.common.toLocaleString('en-US')}</b> common · <b>${c.uncommon.toLocaleString('en-US')}</b> uncommon` : ''; }).filter(Boolean);
    d.setSolid(false);
    await new Promise((res) => {
      showContractModal(d.root, {
        kicker: 'THE COLLECTIVE — ' + P.name.toUpperCase(),
        character: { name: sp.name, phrase: '' },
        task: `${P.name}'s first three maps are posted. The Collective buys the common and uncommon you lift, up to each map's quota; everything past it, and every rare find, is yours.`,
        terms: rows.join('<br>'),
        acceptLabel: 'ACCEPT',
      }, { onAccept: () => { try { onContract(planet); } catch (e) { console.warn('[reveal] onContract', e); } res(); } });
    });
  } finally { d.close(); }
}
