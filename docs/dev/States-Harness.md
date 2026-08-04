<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Systems &amp; States</title>
<style>
  :root {
    --bg: #0d1117;
    --panel: #161b22;
    --panel-2: #1c2330;
    --border: #2d3644;
    --accent: #4dd0e1;
    --accent-2: #ff7043;
    --text: #e6edf3;
    --text-dim: #8b98a9;
    --good: #7ee787;
    --slot-bg: repeating-conic-gradient(#1a2230 0% 25%, #141a24 0% 50%) 50% / 20px 20px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.4;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 24px;
    background: linear-gradient(90deg, #10161f, #161b22);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,.4);
  }
  header h1 {
    font-size: 18px;
    margin: 0;
    letter-spacing: .5px;
  }
  header h1 span { color: var(--accent); }
  .sub { font-size: 12px; color: var(--text-dim); }
  .btn {
    background: var(--accent);
    color: #062025;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    letter-spacing: .3px;
    transition: filter .15s, transform .05s;
  }
  .btn:hover { filter: brightness(1.1); }
  .btn:active { transform: translateY(1px); }
  main { padding: 24px; max-width: 1400px; margin: 0 auto; }
  .system {
    margin-bottom: 28px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--panel);
  }
  .system > h2 {
    margin: 0;
    padding: 12px 18px;
    font-size: 15px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .system > h2::before {
    content: "";
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent-2);
    box-shadow: 0 0 8px var(--accent-2);
  }
  .system .desc { font-size: 12px; color: var(--text-dim); font-weight: 400; margin-left: auto; }
  .states {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    padding: 18px;
  }
  .state {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .state h3 {
    margin: 0;
    font-size: 13px;
    letter-spacing: .3px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .state h3 .tag {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .slot {
    aspect-ratio: 16 / 10;
    border-radius: 6px;
    background: var(--slot-bg);
    border: 1px dashed var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .slot [data-sprite] {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slot.no-art::after {
    content: "no art";
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .controls { display: flex; flex-direction: column; gap: 10px; }
  .ctrl { display: flex; flex-direction: column; gap: 4px; }
  .ctrl .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-dim);
  }
  .ctrl .row .val {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  input[type=range] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 3px;
    background: #2d3644;
    outline: none;
    cursor: pointer;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #0d1117;
    box-shadow: 0 0 4px rgba(77,208,225,.6);
  }
  input[type=range]::-moz-range-thumb {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #0d1117;
  }
  .ctrl.color .row2 { display: flex; align-items: center; gap: 8px; }
  input[type=color] {
    -webkit-appearance: none;
    appearance: none;
    width: 32px; height: 24px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: none;
    cursor: pointer;
    padding: 0;
  }
  input[type=color]::-webkit-color-swatch-wrapper { padding: 2px; }
  input[type=color]::-webkit-color-swatch { border: none; border-radius: 3px; }
  .swatch-hex { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  footer {
    padding: 16px 24px;
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
  }
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(120px);
    background: var(--good);
    color: #062010;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    transition: transform .3s;
    z-index: 100;
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>
<header>
  <div>
    <h1>Systems &amp; <span>States</span></h1>
    <div class="sub">Visual tuning surface — sprites loaded by host</div>
  </div>
  <button class="btn" id="saveBtn">Save tuning</button>
</header>

<main id="root"></main>

<footer>Dev tool · values POST to <code>/api/tuning</code> (stubbed)</footer>
<div class="toast" id="toast">Tuning saved ✓</div>

<script>window.MM_PROJECT_ID = 16;

/* Design model: systems -> states -> params. No sprite keys are staged, so
   every slot renders as an empty slot placeholder (no data-sprite key). */
const MODEL = [{"id": "structure-lifecycle", "name": "Structure Lifecycle", "desc": "Tower/wall/moat states from placement through destruction.", "states": [{"id": "placing", "name": "Placing", "spriteKey": null, "params": [{"k": "ghost_opacity", "label": "Ghost Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "valid_tint", "label": "Valid Placement Tint", "type": "color", "val": "#3fd977"}, {"k": "invalid_tint", "label": "Invalid Placement Tint", "type": "color", "val": "#e0453a"}, {"k": "grid_snap", "label": "Grid Snap Pulse", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}, {"id": "building", "name": "Building", "spriteKey": null, "params": [{"k": "build_time", "label": "Build Time", "type": "range", "min": 1, "max": 20, "step": 1, "val": 5, "unit": "s"}, {"k": "scaffold_opacity", "label": "Scaffold Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "progress_glow", "label": "Progress Glow", "type": "color", "val": "#f2c744"}, {"k": "dust_intensity", "label": "Dust Intensity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}]}, {"id": "active", "name": "Active", "spriteKey": null, "params": [{"k": "idle_sway", "label": "Idle Sway", "type": "range", "min": 0, "max": 100, "step": 5, "val": 10, "unit": "%"}, {"k": "barrel_glow", "label": "Barrel Glow", "type": "color", "val": "#ffd27a"}, {"k": "hp_bar_opacity", "label": "HP Bar Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 80, "unit": "%"}]}, {"id": "repair", "name": "Repair", "spriteKey": null, "params": [{"k": "spark_rate", "label": "Spark Rate", "type": "range", "min": 0, "max": 100, "step": 5, "val": 55, "unit": "%"}, {"k": "repair_tint", "label": "Repair Tint", "type": "color", "val": "#5ad1e0"}, {"k": "heal_flash", "label": "Heal Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}]}, {"id": "upgrade", "name": "Upgrade (T1→T3)", "spriteKey": null, "params": [{"k": "upgrade_burst", "label": "Upgrade Burst", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "tier_glow", "label": "Tier Glow", "type": "color", "val": "#c58cff"}, {"k": "scale_pop", "label": "Scale Pop", "type": "range", "min": 0, "max": 50, "step": 1, "val": 12, "unit": "%"}, {"k": "pop_duration", "label": "Pop Duration", "type": "range", "min": 0, "max": 2, "step": 0.1, "val": 0.4, "unit": "s"}]}, {"id": "damaged", "name": "Damaged", "spriteKey": null, "params": [{"k": "smoke_intensity", "label": "Smoke Intensity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}, {"k": "crack_overlay", "label": "Crack Overlay", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "ember_tint", "label": "Ember Tint", "type": "color", "val": "#ff6a2c"}, {"k": "flicker_rate", "label": "Flicker Rate", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}]}, {"id": "destroyed", "name": "Destroyed", "spriteKey": null, "params": [{"k": "explosion_scale", "label": "Explosion Scale", "type": "range", "min": 0, "max": 200, "step": 10, "val": 100, "unit": "%"}, {"k": "debris_count", "label": "Debris Count", "type": "range", "min": 0, "max": 40, "step": 1, "val": 16, "unit": ""}, {"k": "rubble_tint", "label": "Rubble Tint", "type": "color", "val": "#5a5148"}, {"k": "shockwave", "label": "Shockwave", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}]}, {"id": "sell", "name": "Sell", "spriteKey": null, "params": [{"k": "refund_pct", "label": "Refund Percent", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "fade_duration", "label": "Fade Duration", "type": "range", "min": 0, "max": 2, "step": 0.1, "val": 0.5, "unit": "s"}, {"k": "coin_tint", "label": "Coin Sparkle Tint", "type": "color", "val": "#ffe066"}]}]}, {"id": "battle-phase", "name": "Battle Phase", "desc": "Wave spawn, combat, and outcome states.", "states": [{"id": "spawning", "name": "Spawning", "spriteKey": null, "params": [{"k": "spawn_fade", "label": "Spawn Fade-In", "type": "range", "min": 0, "max": 2, "step": 0.1, "val": 0.4, "unit": "s"}, {"k": "portal_tint", "label": "Spawn Portal Tint", "type": "color", "val": "#7ac043"}, {"k": "spawn_interval", "label": "Spawn Interval", "type": "range", "min": 0, "max": 5, "step": 0.1, "val": 1, "unit": "s"}]}, {"id": "engaged", "name": "Engaged", "spriteKey": null, "params": [{"k": "combat_shake", "label": "Combat Shake", "type": "range", "min": 0, "max": 100, "step": 5, "val": 25, "unit": "%"}, {"k": "hit_flash", "label": "Hit Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}, {"k": "tracer_tint", "label": "Tracer Tint", "type": "color", "val": "#ffd27a"}]}, {"id": "wave-cleared", "name": "Wave Cleared", "spriteKey": null, "params": [{"k": "victory_flash", "label": "Victory Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "banner_tint", "label": "Banner Tint", "type": "color", "val": "#4fd1a0"}, {"k": "fanfare_zoom", "label": "Camera Zoom", "type": "range", "min": 50, "max": 150, "step": 5, "val": 110, "unit": "%"}]}, {"id": "defeat", "name": "Defeat", "spriteKey": null, "params": [{"k": "desaturate", "label": "Desaturation", "type": "range", "min": 0, "max": 100, "step": 5, "val": 80, "unit": "%"}, {"k": "fail_tint", "label": "Fail Overlay Tint", "type": "color", "val": "#8a2222"}, {"k": "slowmo", "label": "Slow-Motion", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "shake", "label": "Impact Shake", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}]}, {"id": "tower-firing", "name": "Tower Firing", "desc": "Auto-targeting tower weapon states.", "states": [{"id": "idle-scan", "name": "Idle Scan", "spriteKey": null, "params": [{"k": "turret_speed", "label": "Turret Rotation Speed", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}, {"k": "range_ring", "label": "Range Ring Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 20, "unit": "%"}, {"k": "ring_tint", "label": "Range Ring Tint", "type": "color", "val": "#6fb7ff"}]}, {"id": "kinetic-fire", "name": "Kinetic Fire", "spriteKey": null, "params": [{"k": "muzzle_flash", "label": "Muzzle Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "recoil", "label": "Recoil", "type": "range", "min": 0, "max": 100, "step": 5, "val": 45, "unit": "%"}, {"k": "tracer_tint", "label": "Tracer Tint", "type": "color", "val": "#fff0c0"}, {"k": "fire_rate", "label": "Fire Rate Cadence", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}, {"id": "aa-fire", "name": "Anti-Air Fire", "spriteKey": null, "params": [{"k": "burst_count", "label": "Burst Count", "type": "range", "min": 1, "max": 10, "step": 1, "val": 3, "unit": ""}, {"k": "lead_arc", "label": "Lead Arc Glow", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}, {"k": "flak_tint", "label": "Flak Puff Tint", "type": "color", "val": "#dbe4ec"}]}, {"id": "target-lock", "name": "Target Lock", "spriteKey": null, "params": [{"k": "lock_pulse", "label": "Lock Pulse", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "lock_tint", "label": "Lock Marker Tint", "type": "color", "val": "#ff5a5a"}]}]}, {"id": "attacker-units", "name": "Attacker Units", "desc": "Greenies (Chem) enemy unit states along the lane.", "states": [{"id": "marching", "name": "Marching", "spriteKey": null, "params": [{"k": "walk_cycle", "label": "Walk Cycle Speed", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "body_tint", "label": "Body Tint", "type": "color", "val": "#7ac043"}, {"k": "bob_amount", "label": "Bob Amount", "type": "range", "min": 0, "max": 100, "step": 5, "val": 20, "unit": "%"}]}, {"id": "attacking-base", "name": "Attacking Base", "spriteKey": null, "params": [{"k": "strike_intensity", "label": "Strike Intensity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}, {"k": "poison_tint", "label": "Poison Splash Tint", "type": "color", "val": "#9fe04a"}, {"k": "strike_rate", "label": "Strike Rate", "type": "range", "min": 0, "max": 100, "step": 5, "val": 55, "unit": "%"}]}, {"id": "artillery-siege", "name": "Artillery Siege", "spriteKey": null, "params": [{"k": "aoe_radius", "label": "AoE Radius Glow", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "stagger_shake", "label": "Stagger Shake", "type": "range", "min": 0, "max": 100, "step": 5, "val": 45, "unit": "%"}, {"k": "concussion_tint", "label": "Concussion Tint", "type": "color", "val": "#e0b84a"}, {"k": "arc_height", "label": "Projectile Arc Height", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}, {"id": "dying", "name": "Dying", "spriteKey": null, "params": [{"k": "death_fade", "label": "Death Fade", "type": "range", "min": 0, "max": 2, "step": 0.1, "val": 0.4, "unit": "s"}, {"k": "bounty_tint", "label": "Bounty Coin Tint", "type": "color", "val": "#ffe066"}, {"k": "gib_amount", "label": "Gib Amount", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}]}]}, {"id": "vision-fog", "name": "Vision, Fog & Radar", "desc": "Fog-of-war and radar detection presentation.", "states": [{"id": "fogged", "name": "Fogged", "spriteKey": null, "params": [{"k": "fog_opacity", "label": "Fog Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 75, "unit": "%"}, {"k": "fog_tint", "label": "Fog Tint", "type": "color", "val": "#2a3340"}, {"k": "edge_softness", "label": "Edge Softness", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}]}, {"id": "scouted", "name": "Scouted", "spriteKey": null, "params": [{"k": "reveal_speed", "label": "Reveal Speed", "type": "range", "min": 0, "max": 2, "step": 0.1, "val": 0.6, "unit": "s"}, {"k": "vision_tint", "label": "Vision Tint", "type": "color", "val": "#a8c8e0"}, {"k": "clarity", "label": "Clarity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 90, "unit": "%"}]}, {"id": "radar-detect", "name": "Radar Detect", "spriteKey": null, "params": [{"k": "ping_rate", "label": "Ping Rate", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "ping_tint", "label": "Radar Ping Tint", "type": "color", "val": "#4fd1a0"}, {"k": "sweep_opacity", "label": "Sweep Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 35, "unit": "%"}]}]}, {"id": "pathing", "name": "Pathing & Domain", "desc": "Walker/Flyer lane traversal and blocking visualisation.", "states": [{"id": "walker-open", "name": "Walker Open Lane", "spriteKey": null, "params": [{"k": "path_tint", "label": "Path Tint", "type": "color", "val": "#c8b98a"}, {"k": "path_opacity", "label": "Path Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 30, "unit": "%"}]}, {"id": "blocked-reroute", "name": "Blocked / Reroute", "spriteKey": null, "params": [{"k": "block_tint", "label": "Blocked Tile Tint", "type": "color", "val": "#e0453a"}, {"k": "reroute_flash", "label": "Reroute Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "arrow_opacity", "label": "Reroute Arrow Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}, {"id": "flyer-overpass", "name": "Flyer Overpass", "spriteKey": null, "params": [{"k": "shadow_opacity", "label": "Ground Shadow Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}, {"k": "altitude_offset", "label": "Altitude Offset", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}]}]}, {"id": "build-phase", "name": "Build Phase UX", "desc": "Paused build screen slot and economy states.", "states": [{"id": "slot-empty", "name": "Empty Slot", "spriteKey": null, "params": [{"k": "slot_pulse", "label": "Slot Pulse", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}, {"k": "slot_tint", "label": "Slot Tint", "type": "color", "val": "#5a8cc0"}, {"k": "outline_opacity", "label": "Outline Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 55, "unit": "%"}]}, {"id": "slot-occupied", "name": "Occupied Slot", "spriteKey": null, "params": [{"k": "highlight", "label": "Selected Highlight", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "highlight_tint", "label": "Highlight Tint", "type": "color", "val": "#ffd27a"}]}, {"id": "ready-prompt", "name": "Ready Prompt", "spriteKey": null, "params": [{"k": "button_pulse", "label": "Ready Button Pulse", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}, {"k": "button_tint", "label": "Button Tint", "type": "color", "val": "#4fd1a0"}, {"k": "glow_radius", "label": "Glow Radius", "type": "range", "min": 0, "max": 100, "step": 5, "val": 45, "unit": "%"}]}]}, {"id": "economy", "name": "Economy & Gold", "desc": "Gold balance, bounty, and reward feedback.", "states": [{"id": "gold-idle", "name": "Gold Balance", "spriteKey": null, "params": [{"k": "counter_tint", "label": "Counter Tint", "type": "color", "val": "#ffe066"}, {"k": "counter_opacity", "label": "Counter Opacity", "type": "range", "min": 0, "max": 100, "step": 5, "val": 90, "unit": "%"}]}, {"id": "bounty-gain", "name": "Bounty Gain", "spriteKey": null, "params": [{"k": "popup_scale", "label": "Popup Scale", "type": "range", "min": 0, "max": 200, "step": 10, "val": 100, "unit": "%"}, {"k": "float_speed", "label": "Float Speed", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}, {"k": "gain_tint", "label": "Gain Tint", "type": "color", "val": "#7fe07f"}]}, {"id": "insufficient", "name": "Insufficient Funds", "spriteKey": null, "params": [{"k": "warn_flash", "label": "Warning Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 65, "unit": "%"}, {"k": "warn_tint", "label": "Warning Tint", "type": "color", "val": "#e0453a"}, {"k": "shake", "label": "Counter Shake", "type": "range", "min": 0, "max": 100, "step": 5, "val": 40, "unit": "%"}]}, {"id": "wave-reward", "name": "Wave Reward", "spriteKey": null, "params": [{"k": "reward_burst", "label": "Reward Burst", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "coin_shower", "label": "Coin Shower", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}, {"k": "reward_tint", "label": "Reward Tint", "type": "color", "val": "#ffd27a"}]}]}, {"id": "base-castle", "name": "Castle Base", "desc": "Defensive base HP and damage states (HP 2000).", "states": [{"id": "intact", "name": "Intact", "spriteKey": null, "params": [{"k": "banner_sway", "label": "Banner Sway", "type": "range", "min": 0, "max": 100, "step": 5, "val": 25, "unit": "%"}, {"k": "stone_tint", "label": "Stone Tint", "type": "color", "val": "#9a9488"}]}, {"id": "under-attack", "name": "Under Attack", "spriteKey": null, "params": [{"k": "alarm_flash", "label": "Alarm Flash", "type": "range", "min": 0, "max": 100, "step": 5, "val": 55, "unit": "%"}, {"k": "alarm_tint", "label": "Alarm Tint", "type": "color", "val": "#e0453a"}, {"k": "hp_bar_pulse", "label": "HP Bar Pulse", "type": "range", "min": 0, "max": 100, "step": 5, "val": 50, "unit": "%"}]}, {"id": "critical", "name": "Critical HP", "spriteKey": null, "params": [{"k": "smoke_columns", "label": "Smoke Columns", "type": "range", "min": 0, "max": 100, "step": 5, "val": 70, "unit": "%"}, {"k": "crit_tint", "label": "Critical Tint", "type": "color", "val": "#8a2222"}, {"k": "vignette", "label": "Screen Vignette", "type": "range", "min": 0, "max": 100, "step": 5, "val": 60, "unit": "%"}]}, {"id": "destroyed", "name": "Destroyed", "spriteKey": null, "params": [{"k": "collapse_scale", "label": "Collapse Scale", "type": "range", "min": 0, "max": 200, "step": 10, "val": 120, "unit": "%"}, {"k": "dust_cloud", "label": "Dust Cloud", "type": "range", "min": 0, "max": 100, "step": 5, "val": 80, "unit": "%"}, {"k": "rubble_tint", "label": "Rubble Tint", "type": "color", "val": "#5a5148"}]}]}];

const root = document.getElementById("root");

MODEL.forEach(sys => {
  const sec = document.createElement("section");
  sec.className = "system";
  sec.innerHTML = `<h2>${sys.name}<span class="desc">${sys.desc}</span></h2>`;
  const states = document.createElement("div");
  states.className = "states";

  sys.states.forEach(st => {
    const cell = document.createElement("div");
    cell.className = "state";

    const slotInner = st.spriteKey
      ? `<div data-sprite="${st.spriteKey}"></div>`
      : "";
    const slotClass = st.spriteKey ? "slot" : "slot no-art";

    let ctrlsHtml = "";
    st.params.forEach(p => {
      const id = `${sys.id}.${st.id}.${p.k}`;
      if (p.type === "color") {
        ctrlsHtml += `
          <div class="ctrl color">
            <div class="row"><span>${p.label}</span></div>
            <div class="row2">
              <input type="color" data-id="${id}" value="${p.val}">
              <span class="swatch-hex">${p.val}</span>
            </div>
          </div>`;
      } else {
        const unit = p.unit ? " " + p.unit : "";
        ctrlsHtml += `
          <div class="ctrl">
            <div class="row"><span>${p.label}</span><span class="val">${p.val}${unit}</span></div>
            <input type="range" data-id="${id}" data-unit="${p.unit||''}"
              min="${p.min}" max="${p.max}" step="${p.step}" value="${p.val}">
          </div>`;
      }
    });

    cell.innerHTML = `
      <h3>${st.name}<span class="tag">${st.id}</span></h3>
      <div class="${slotClass}">${slotInner}</div>
      <div class="controls">${ctrlsHtml}</div>`;
    states.appendChild(cell);
  });

  sec.appendChild(states);
  root.appendChild(sec);
});

// Live label updates
root.addEventListener("input", e => {
  const t = e.target;
  if (t.type === "range") {
    const unit = t.dataset.unit ? " " + t.dataset.unit : "";
    t.closest(".ctrl").querySelector(".val").textContent = t.value + unit;
  } else if (t.type === "color") {
    t.closest(".row2").querySelector(".swatch-hex").textContent = t.value;
  }
});

// Gather + save (stub)
function collect() {
  const data = {};
  root.querySelectorAll("input[data-id]").forEach(i => {
    data[i.dataset.id] = i.type === "range" ? Number(i.value) : i.value;
  });
  return data;
}

const toast = document.getElementById("toast");
document.getElementById("saveBtn").addEventListener("click", () => {
  const payload = collect();
  // REAL save (mmdev-e29-s8): persists to the project's tuning overlay — the next build reads it
  // as config.data.tables.tuning. Fail LOUD: the toast reports the actual outcome, never fakes it.
  const pid = window.MM_PROJECT_ID;
  const base = window.MM_API_BASE || "";
  if (!pid) { toast.textContent = "Save failed: no project bound"; toast.classList.add("show"); return; }
  fetch(base + "/api/projects/" + pid + "/tuning", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => {
    toast.textContent = r.ok ? "Tuning saved ✓ (feeds the next build)" : "Save FAILED (" + r.status + ")";
    toast.style.background = r.ok ? "var(--good)" : "#e05252";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }).catch(e => {
    toast.textContent = "Save FAILED: " + e;
    toast.style.background = "#e05252";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  });
});
</script>

<script>
(function(){
  var els = [].slice.call(document.querySelectorAll('[data-sprite]'));
  var i = 0, base = 'content/sprites/';
  function next(){
    if (i >= els.length) return;
    var el = els[i++], key = el.getAttribute('data-sprite');
    var img = new Image();
    img.style.maxWidth = '100%'; img.alt = key;
    img.onload = img.onerror = function(){ setTimeout(next, 0); };  // strictly one at a time
    img.src = base + encodeURIComponent(key) + '.png';
    el.appendChild(img);
  }
  next();
})();
</script>

</body>
</html>