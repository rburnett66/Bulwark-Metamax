// src/hud/hud.js
// HUD root: base HP bar, money readout, wave counter, controls wiring.
// Screen-space DOM overlay (never rotates), reads sim state, dispatches commands.

import { createDom } from './dom.js';
import { createBuildPanel } from './buildPanel.js';
import { createSelectionPanel } from './selectionPanel.js';

export function createHUD(opts) {
  const {
    sim,          // sim state + accessors
    commands,     // command dispatch (place/select/upgrade/sell/deploy/startWave)
    input,        // input/placement manager (optional)
    mount,        // DOM element to mount overlay into (defaults to body)
  } = opts || {};

  const root = createDom('div', {
    className: 'bulwark-hud',
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      fontFamily: 'monospace',
      color: '#e6e6e6',
      zIndex: '10',
      userSelect: 'none',
    },
  });
  (mount || document.body).appendChild(root);

  // ---- Top bar: money, wave, controls ---------------------------------
  const topBar = createDom('div', {
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      padding: '8px 12px',
      boxSizing: 'border-box',
      background: 'rgba(12,16,22,0.72)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      pointerEvents: 'auto',
    },
  });
  root.appendChild(topBar);

  // Money readout with animated delta
  const moneyWrap = createDom('div', {
    style: { display: 'flex', flexDirection: 'column', minWidth: '120px' },
  });
  const moneyLabel = createDom('div', {
    text: 'GOLD',
    style: { fontSize: '10px', opacity: '0.6', letterSpacing: '1px' },
  });
  const moneyValue = createDom('div', {
    text: '0',
    style: { fontSize: '20px', fontWeight: 'bold', color: '#ffd257' },
  });
  const moneyDelta = createDom('div', {
    text: '',
    style: { fontSize: '11px', height: '13px', color: '#8dff8d', transition: 'opacity 0.4s' },
  });
  moneyWrap.appendChild(moneyLabel);
  moneyWrap.appendChild(moneyValue);
  moneyWrap.appendChild(moneyDelta);
  topBar.appendChild(moneyWrap);

  // Wave counter
  const waveWrap = createDom('div', {
    style: { display: 'flex', flexDirection: 'column', minWidth: '110px' },
  });
  const waveLabel = createDom('div', {
    text: 'WAVE',
    style: { fontSize: '10px', opacity: '0.6', letterSpacing: '1px' },
  });
  const waveValue = createDom('div', {
    text: '0 / 0',
    style: { fontSize: '20px', fontWeight: 'bold', color: '#9ec5ff' },
  });
  const wavePhase = createDom('div', {
    text: '—',
    style: { fontSize: '11px', height: '13px', opacity: '0.7' },
  });
  waveWrap.appendChild(waveLabel);
  waveWrap.appendChild(waveValue);
  waveWrap.appendChild(wavePhase);
  topBar.appendChild(waveWrap);

  // Base HP bar
  const hpWrap = createDom('div', {
    style: { display: 'flex', flexDirection: 'column', flex: '1', maxWidth: '360px' },
  });
  const hpLabel = createDom('div', {
    text: 'BASE HP',
    style: { fontSize: '10px', opacity: '0.6', letterSpacing: '1px' },
  });
  const hpBarOuter = createDom('div', {
    style: {
      position: 'relative',
      height: '20px',
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '3px',
      overflow: 'hidden',
      marginTop: '2px',
    },
  });
  const hpBarFill = createDom('div', {
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      height: '100%',
      width: '100%',
      background: 'linear-gradient(90deg,#3ddc84,#2fae67)',
      transition: 'width 0.2s, background 0.3s',
    },
  });
  const hpBarText = createDom('div', {
    text: '0 / 0',
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: 'bold',
      textShadow: '0 1px 2px #000',
    },
  });
  hpBarOuter.appendChild(hpBarFill);
  hpBarOuter.appendChild(hpBarText);
  hpWrap.appendChild(hpLabel);
  hpWrap.appendChild(hpBarOuter);
  topBar.appendChild(hpWrap);

  // Controls
  const controls = createDom('div', {
    style: { display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' },
  });
  topBar.appendChild(controls);

  function mkBtn(label, onClick, color) {
    const b = createDom('button', {
      text: label,
      style: {
        pointerEvents: 'auto',
        cursor: 'pointer',
        padding: '6px 12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color: '#fff',
        background: color || 'rgba(60,90,140,0.9)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '4px',
      },
    });
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    controls.appendChild(b);
    return b;
  }

  const startBtn = mkBtn('START WAVE', () => {
    dispatch({ type: 'startWave' });
  }, 'rgba(60,140,80,0.95)');

  const pauseBtn = mkBtn('PAUSE', () => {
    togglePause();
  }, 'rgba(90,90,110,0.95)');

  // ---- Message banner (win/lose/bankrupt) -----------------------------
  const banner = createDom('div', {
    style: {
      position: 'absolute',
      left: '50%',
      top: '40%',
      transform: 'translate(-50%,-50%)',
      padding: '20px 40px',
      fontSize: '32px',
      fontWeight: 'bold',
      textAlign: 'center',
      background: 'rgba(0,0,0,0.8)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '8px',
      display: 'none',
      pointerEvents: 'none',
    },
  });
  root.appendChild(banner);

  // ---- Sub-panels ------------------------------------------------------
  const buildPanel = createBuildPanel({
    sim,
    parent: root,
    onSelectBuildItem: (item) => {
      // route to placement/input system if present
      if (input && typeof input.beginPlacement === 'function') {
        input.beginPlacement(item);
      }
      dispatch({ type: 'beginPlace', item });
    },
    onSelectDeployItem: (item) => {
      if (input && typeof input.beginDeploy === 'function') {
        input.beginDeploy(item);
      }
      dispatch({ type: 'beginDeploy', item });
    },
  });

  const selectionPanel = createSelectionPanel({
    sim,
    parent: root,
    onUpgrade: (id) => dispatch({ type: 'upgrade', id }),
    onSell: (id) => dispatch({ type: 'sell', id }),
    onRepair: (id) => dispatch({ type: 'repair', id }),
  });

  // ---- Command dispatch helper ----------------------------------------
  function dispatch(cmd) {
    if (!cmd) return;
    if (commands && typeof commands.dispatch === 'function') {
      commands.dispatch(cmd);
    } else if (typeof commands === 'function') {
      commands(cmd);
    }
  }

  // ---- Pause handling --------------------------------------------------
  let paused = false;
  function togglePause() {
    paused = !paused;
    pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
    if (sim) sim.paused = paused;
    dispatch({ type: 'setPaused', paused });
  }
  function setPaused(p) {
    if (paused !== !!p) togglePause();
  }
  function isPaused() { return paused; }

  // ---- State reading helpers ------------------------------------------
  function readState() {
    // support both a raw state object and a sim wrapper w/ .state
    if (!sim) return null;
    if (sim.state) return sim.state;
    return sim;
  }

  // ---- Money delta animation ------------------------------------------
  let lastMoney = null;
  let deltaTimer = 0;

  function fmtMoney(v) {
    return Math.floor(v).toString();
  }

  // ---- Per-frame update -----------------------------------------------
  let bannerShown = false;

  function update(dt) {
    const st = readState();
    if (!st) return;

    const econ = st.economy || {};
    const money = (econ.money != null) ? econ.money : (st.money != null ? st.money : 0);

    // money readout + delta
    if (lastMoney == null) lastMoney = money;
    const diff = money - lastMoney;
    if (Math.abs(diff) >= 1) {
      const sign = diff > 0 ? '+' : '';
      moneyDelta.textContent = sign + fmtMoney(diff);
      moneyDelta.style.color = diff > 0 ? '#8dff8d' : '#ff8d8d';
      moneyDelta.style.opacity = '1';
      deltaTimer = 1.0;
      lastMoney = money;
    } else if (deltaTimer > 0) {
      deltaTimer -= (dt || 0.016);
      if (deltaTimer <= 0) {
        moneyDelta.style.opacity = '0';
      }
    }
    moneyValue.textContent = fmtMoney(money);
    // bankruptcy tint
    if (money <= 0) {
      moneyValue.style.color = '#ff6b6b';
    } else if (econ.bankrupt) {
      moneyValue.style.color = '#ff6b6b';
    } else {
      moneyValue.style.color = '#ffd257';
    }

    // wave counter
    const waves = st.waves || {};
    const cur = (waves.current != null) ? waves.current : (waves.index != null ? waves.index : 0);
    const total = (waves.total != null) ? waves.total : (waves.count != null ? waves.count : 0);
    waveValue.textContent = `${cur} / ${total}`;
    const phase = waves.phase || (waves.active ? 'COMBAT' : 'BUILD');
    wavePhase.textContent = phase;
    // start button availability
    const canStart = !waves.active && cur < total && !isGameOver(st);
    startBtn.disabled = !canStart;
    startBtn.style.opacity = canStart ? '1' : '0.4';
    startBtn.style.cursor = canStart ? 'pointer' : 'default';

    // base HP
    const base = st.base || {};
    const hp = (base.hp != null) ? base.hp : 0;
    const maxHp = (base.maxHp != null) ? base.maxHp : (base.hpMax != null ? base.hpMax : Math.max(hp, 1));
    const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    hpBarFill.style.width = (frac * 100).toFixed(1) + '%';
    hpBarText.textContent = `${Math.max(0, Math.ceil(hp))} / ${Math.ceil(maxHp)}`;
    if (frac > 0.5) {
      hpBarFill.style.background = 'linear-gradient(90deg,#3ddc84,#2fae67)';
    } else if (frac > 0.25) {
      hpBarFill.style.background = 'linear-gradient(90deg,#ffd257,#e0a020)';
    } else {
      hpBarFill.style.background = 'linear-gradient(90deg,#ff6b6b,#c03030)';
    }

    // win/lose banner
    const over = gameOverState(st);
    if (over && !bannerShown) {
      bannerShown = true;
      if (over === 'win') {
        banner.textContent = 'VICTORY';
        banner.style.color = '#8dff8d';
        banner.style.borderColor = '#8dff8d';
      } else {
        banner.textContent = 'DEFEAT';
        banner.style.color = '#ff6b6b';
        banner.style.borderColor = '#ff6b6b';
      }
      banner.style.display = 'block';
    } else if (!over && bannerShown) {
      bannerShown = false;
      banner.style.display = 'none';
    }

    // sub-panels
    if (buildPanel && buildPanel.update) buildPanel.update(dt);
    if (selectionPanel && selectionPanel.update) selectionPanel.update(dt);
  }

  function isGameOver(st) {
    return !!gameOverState(st);
  }

  function gameOverState(st) {
    if (!st) return null;
    if (st.result === 'win' || st.won === true) return 'win';
    if (st.result === 'lose' || st.lost === true) return 'lose';
    const waves = st.waves || {};
    if (waves.result === 'win') return 'win';
    if (waves.result === 'lose') return 'lose';
    const base = st.base || {};
    if (base.hp != null && base.hp <= 0) return 'lose';
    return null;
  }

  // ---- Selection wiring -----------------------------------------------
  // Allow the input system to notify selection changes.
  function setSelected(entityId) {
    if (selectionPanel && selectionPanel.setSelected) {
      selectionPanel.setSelected(entityId);
    }
  }

  function destroy() {
    if (buildPanel && buildPanel.destroy) buildPanel.destroy();
    if (selectionPanel && selectionPanel.destroy) selectionPanel.destroy();
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return {
    root,
    update,
    setSelected,
    setPaused,
    isPaused,
    buildPanel,
    selectionPanel,
    destroy,
  };
}

export default createHUD;