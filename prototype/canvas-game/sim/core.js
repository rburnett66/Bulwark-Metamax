(function(){'use strict';var G=(typeof window!=='undefined'?window:globalThis);G.MMKit=G.MMKit||{};var MMKit=G.MMKit;
MMKit.sim = (function () {
  "use strict";

  // ================= PRNG: mulberry32 =================
  function makePRNG(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ================= FNV-1a hashing =================
  function fnvInit() { return 0x811c9dc5 >>> 0; }
  function fnvByte(h, b) { h ^= (b & 0xff); h = Math.imul(h, 0x01000193) >>> 0; return h; }
  function fnvInt(h, v) {
    v = v | 0;
    h = fnvByte(h, v & 0xff);
    h = fnvByte(h, (v >>> 8) & 0xff);
    h = fnvByte(h, (v >>> 16) & 0xff);
    h = fnvByte(h, (v >>> 24) & 0xff);
    return h;
  }
  function fnvFloat(h, f) {
    if (typeof f !== "number" || !isFinite(f)) f = 0;
    return fnvInt(h, Math.round(f * 1000) | 0);
  }
  function fnvStr(h, s) {
    if (typeof s !== "string") s = String(s == null ? "" : s);
    for (var i = 0; i < s.length; i++) h = fnvByte(h, s.charCodeAt(i) & 0xff);
    return h;
  }

  // ================= module scope =================
  var rng = makePRNG(0);
  var T = null;       // tables
  var A = null;       // resolved assumptions
  var state = null;

  // ================= safe helpers =================
  function num(v, d) {
    v = +v;
    return (typeof v === "number" && isFinite(v)) ? v : (d || 0);
  }
  function has(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k); }
  function get(o, k, d) { return has(o, k) ? o[k] : d; }
  function arr(v) { return (v && v.length !== undefined) ? v : []; }

  // ================= Assumptions resolution =================
  function resolveAssumptions() {
    var a = (T && T.assumptions) || {};
    // Accept either raw parameter keys or a {Parameter:Value} map
    function pick() {
      for (var i = 0; i < arguments.length - 1; i++) {
        var k = arguments[i];
        if (has(a, k)) return num(a[k], undefined);
      }
      return arguments[arguments.length - 1];
    }
    return {
      HP_per_point: pick("HP_per_point", 10),
      DPS_per_point: pick("DPS_per_point", 1.5),
      Range_per_point: pick("Range_per_point", 0.25),
      Speed_per_point: pick("Speed_per_point", 0.08),
      Vision_base: pick("Vision_base", 4),
      Vision_per_util_point: pick("Vision_per_util_point", 0.1),
      Cost_per_power_gold: pick("Cost_per_power_gold", 3),
      // upgrade / cost curve multipliers (T1..T3), default flat 1/2/3-ish
      UpgradeMult_T1: pick("UpgradeMult_T1", "Upgrade_T1", 1.0),
      UpgradeMult_T2: pick("UpgradeMult_T2", "Upgrade_T2", 1.6),
      UpgradeMult_T3: pick("UpgradeMult_T3", "Upgrade_T3", 2.4),
      CostMult_T1: pick("CostMult_T1", "Cost_T1_mult", 1.0),
      CostMult_T2: pick("CostMult_T2", "Cost_T2_mult", 2.0),
      CostMult_T3: pick("CostMult_T3", "Cost_T3_mult", 3.5)
    };
  }

  function upgradeMult(tier) {
    if (tier <= 1) return A.UpgradeMult_T1;
    if (tier === 2) return A.UpgradeMult_T2;
    return A.UpgradeMult_T3;
  }
  function costMult(tier) {
    if (tier <= 1) return A.CostMult_T1;
    if (tier === 2) return A.CostMult_T2;
    return A.CostMult_T3;
  }

  // ================= table lookups =================
  function factionDef(id) { return (T && T.factions && T.factions[id]) || null; }
  function archetypeDef(id) { return (T && T.archetypes && T.archetypes[id]) || null; }
  function factionModDef(id) { return (T && T.factionMods && T.factionMods[id]) || null; }
  function damageTypeDef(id) { return (T && T.damageTypes && T.damageTypes[id]) || null; }
  function structureDef(id) { return (T && T.structures && T.structures[id]) || null; }
  function unitDef(id) { return (T && T.units && T.units[id]) || null; }

  // ================= effectiveness matrix =================
  function effMultiplier(dmgType, armorClass) {
    if (!T || !T.effectiveness) return 1;
    var row = T.effectiveness[dmgType];
    if (!row) return 1;
    if (has(row, armorClass)) {
      var m = +row[armorClass];
      return (isFinite(m)) ? m : 1;
    }
    return 1;
  }

  // ================= power-budget -> stats =================
  // An archetype budget: {HP, DPS, Range, Speed, Utility} points summing ~100.
  // Faction mods: {hpMul,dpsMul,rangeMul,speedMul,visionMul, signatureDamage, armorClass, domain}.
  function derivePower(power) {
    var p = power || {};
    return {
      hpPts: num(p.HP, p.hp),
      dpsPts: num(p.DPS, p.dps),
      rangePts: num(p.Range, p.range),
      speedPts: num(p.Speed, p.speed),
      utilPts: num(p.Utility, num(p.util, 0)),
      total: num(p.HP, p.hp) + num(p.DPS, p.dps) + num(p.Range, p.range) +
        num(p.Speed, p.speed) + num(p.Utility, num(p.util, 0))
    };
  }

  // Resolve full base stats for a unit from archetype + faction mod, applying tier & assumptions.
  function resolveEntityStats(def, tier) {
    tier = tier || 1;
    // Direct explicit stat keys take precedence when present.
    var stats = { hp: 0, dps: 0, range: 0, speed: 0, vision: 0, power: 0 };

    var archId = def.archetype || def.Archetype;
    var arche = archId ? archetypeDef(archId) : null;
    var factId = def.faction || def.Faction;
    var fmod = factId ? factionModDef(factId) : null;

    // 1) base from archetype power budget if available
    if (arche) {
      var pw = derivePower(arche.power || arche.budget || arche);
      stats.hp = pw.hpPts * A.HP_per_point;
      stats.dps = pw.dpsPts * A.DPS_per_point;
      stats.range = pw.rangePts * A.Range_per_point;
      stats.speed = pw.speedPts * A.Speed_per_point;
      stats.vision = A.Vision_base + pw.utilPts * A.Vision_per_util_point;
      stats.power = pw.total;
    }

    // 2) explicit per-unit overrides (raw stats or per-tier keys)
    function tierKey(prefix) {
      var kT = prefix + "_T" + tier;
      if (has(def, kT)) return num(def[kT], undefined);
      var kLow = prefix.toLowerCase();
      if (has(def, kLow)) return num(def[kLow], undefined);
      if (has(def, prefix)) return num(def[prefix], undefined);
      return undefined;
    }
    var oHP = tierKey("HP"), oDPS = tierKey("DPS"), oRange = tierKey("Range"),
      oSpeed = tierKey("Speed"), oVision = tierKey("Vision");
    if (oHP !== undefined) stats.hp = oHP;
    if (oDPS !== undefined) stats.dps = oDPS;
    if (oRange !== undefined) stats.range = oRange;
    if (oSpeed !== undefined) stats.speed = oSpeed;
    if (oVision !== undefined) stats.vision = oVision;

    // 3) faction modifiers (mild net-neutral tilts)
    if (fmod) {
      stats.hp *= num(fmod.hpMul, 1);
      stats.dps *= num(fmod.dpsMul, 1);
      stats.range *= num(fmod.rangeMul, 1);
      stats.speed *= num(fmod.speedMul, 1);
      stats.vision *= num(fmod.visionMul, 1);
    }

    // 4) tier scaling (only if no explicit per-tier keys existed)
    var mult = upgradeMult(tier);
    if (oHP === undefined) stats.hp *= mult;
    if (oDPS === undefined) stats.dps *= mult;

    // resolve damage type / armor / domain (unit -> faction signature -> default)
    var dmgType = def.DamageType || def.damageType ||
      (fmod && (fmod.signatureDamage || fmod.signatureDamageType)) || "Kinetic";
    var armorClass = def.ArmorClass || def.armorClass ||
      (fmod && fmod.armorClass) || "Organic";
    var domain = def.Domain || def.domain ||
      (fmod && fmod.domain) || "Walker";

    stats.hp = Math.max(0, stats.hp);
    stats.dps = Math.max(0, stats.dps);
    stats.range = Math.max(0, stats.range);
    stats.speed = Math.max(0, stats.speed);
    stats.dmgType = dmgType;
    stats.armorClass = armorClass;
    stats.domain = domain;
    return stats;
  }

  // ================= cost resolution =================
  // cost = power * Cost_per_power_gold * costMult(tier), unless explicit cost keys present.
  function resolveCost(def, tier) {
    tier = tier || 1;
    var kT = "Cost_T" + tier;
    if (has(def, kT)) return num(def[kT], 0);
    if (has(def, "costT" + tier)) return num(def["costT" + tier], 0);
    if (has(def, "Cost")) return num(def.Cost, 0) * costMult(tier);
    if (has(def, "cost")) return num(def.cost, 0) * costMult(tier);
    // derive from power
    var archId = def.archetype || def.Archetype;
    var arche = archId ? archetypeDef(archId) : null;
    var power = arche ? derivePower(arche.power || arche.budget || arche).total : num(def.power, 0);
    if (!power) {
      var st = resolveEntityStats(def, tier);
      power = st.power || 0;
    }
    return Math.round(power * A.Cost_per_power_gold * costMult(tier));
  }

  // ================= laneLength / geometry =================
  function laneLength() {
    if (T && T.lane && isFinite(+T.lane.length)) return +T.lane.length;
    if (T && T.map && isFinite(+T.map.laneLength)) return +T.map.laneLength;
    return 40;
  }
  function baseArmorClass() {
    return (T && T.base && (T.base.armorClass || T.base.ArmorClass)) || "Structure";
  }

  // ================= init =================
  function init(seed, tables) {
    T = tables || {};
    var s = seed >>> 0;
    rng = makePRNG(s);
    A = resolveAssumptions();

    var econ = T.economy || {};
    var LL = laneLength();

    state = {
      seed: s,
      time: 0,
      tick: 0,
      phase: "build",              // build|battle|collect|win|defeat
      waveIndex: 0,
      totalWaves: (T.waves ? T.waves.length : 0),
      gold: num(get(econ, "startingGold", get(econ, "startGold", 0)), 0),
      baseHP: num(T.base && T.base.hp, 2000),
      baseMaxHP: num(T.base && T.base.hp, 2000),
      laneLength: LL,
      spawnPos: 0,                 // attackers spawn at pos 0
      basePos: LL,                 // base at far end
      structures: [],
      enemies: [],
      spawnQueue: [],
      spawnedCount: 0,
      killedCount: 0,
      leakedCount: 0,
      nextId: 1,
      collectedGold: 0,
      lastWaveCleared: -1,
      result: null
    };

    // deterministic auto build plan (optional)
    var plan = arr(T.buildPlan);
    for (var i = 0; i < plan.length; i++) placeStructure(plan[i]);

    return state;
  }

  // ================= build-phase actions =================
  function placeStructure(spec) {
    if (!spec) return false;
    var id = spec.structTypeId || spec.structureId || spec.id;
    var def = structureDef(id);
    if (!def) return false;
    var tier = num(spec.tier, 1);
    if (tier < 1) tier = 1; if (tier > 3) tier = 3;
    var cost = resolveCost(def, tier);
    var free = num(spec.free, 0) === 1;
    if (!free) {
      if (state.gold < cost) return false;
      state.gold -= cost;
    }
    var st = resolveEntityStats(def, tier);
    var s = {
      id: state.nextId++,
      typeId: id,
      tier: tier,
      pos: num(spec.pos, state.laneLength * 0.5),
      hp: st.hp, maxHp: st.hp,
      dps: st.dps,
      range: st.range,
      vision: st.vision,
      damageType: st.dmgType,
      armorClass: st.armorClass,
      canTargetAir: num(get(def, "canTargetAir",
        (def.CanTarget === "Both" || def.CanTarget === "Air") ? 1 : 0), 0) === 1,
      canTargetGround: num(get(def, "canTargetGround",
        (def.CanTarget === "Air") ? 0 : 1), 1) === 1,
      aoe: num(def.aoe, num(def.AOE, 0)),
      blocking: !!(get(def, "blocking", get(def, "blocksWalkers", false))),
      cooldown: 0,
      alive: true
    };
    state.structures.push(s);
    return true;
  }

  function findStruct(id) {
    for (var i = 0; i < state.structures.length; i++)
      if (state.structures[i].id === id) return i;
    return -1;
  }

  function upgradeStructure(id) {
    var i = findStruct(id);
    if (i < 0) return false;
    var s = state.structures[i];
    if (s.tier >= 3) return false;
    var def = structureDef(s.typeId);
    if (!def) return false;
    var nextTier = s.tier + 1;
    var delta = resolveCost(def, nextTier) - resolveCost(def, s.tier);
    if (delta < 0) delta = 0;
    if (state.gold < delta) return false;
    state.gold -= delta;
    var frac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
    s.tier = nextTier;
    var ns = resolveEntityStats(def, nextTier);
    s.maxHp = ns.hp;
    s.hp = ns.hp * frac;
    s.dps = ns.dps;
    s.range = ns.range;
    s.vision = ns.vision;
    return true;
  }

  function repairStructure(id) {
    var i = findStruct(id);
    if (i < 0) return false;
    var s = state.structures[i];
    if (s.hp >= s.maxHp) return false;
    var econ = T.economy || {};
    var rate = num(get(econ, "repairGoldPerHp", get(econ, "repairCostPerHp", 0.5)), 0.5);
    var missing = s.maxHp - s.hp;
    var cost = Math.ceil(missing * rate);
    if (state.gold < cost) {
      var afford = rate > 0 ? Math.floor(state.gold / rate) : 0;
      if (afford <= 0) return false;
      state.gold -= Math.ceil(afford * rate);
      s.hp = Math.min(s.maxHp, s.hp + afford);
      return true;
    }
    state.gold -= cost;
    s.hp = s.maxHp;
    return true;
  }

  function sellStructure(id) {
    var i = findStruct(id);
    if (i < 0) return false;
    var s = state.structures[i];
    var def = structureDef(s.typeId);
    var econ = T.economy || {};
    var refundFrac = num(get(econ, "sellRefund", get(econ, "sellRefundFrac", 0.5)), 0.5);
    var spent = def ? resolveCost(def, s.tier) : 0;
    state.gold += Math.floor(spent * refundFrac);
    state.structures.splice(i, 1);
    return true;
  }

  function applyInput(action) {
    if (!state) return false;
    if (!action || !action.type) return false;
    if (action.type === "ready") {
      if (state.phase === "build") { startBattle(); return true; }
      return false;
    }
    if (state.phase !== "build") return false;
    switch (action.type) {
      case "place": return placeStructure(action);
      case "upgrade": return upgradeStructure(action.entityId != null ? action.entityId : action.id);
      case "repair": return repairStructure(action.entityId != null ? action.entityId : action.id);
      case "sell": return sellStructure(action.entityId != null ? action.entityId : action.id);
    }
    return false;
  }

  // ================= battle setup =================
  function startBattle() {
    state.phase = "battle";
    state.time = 0;
    state.spawnedCount = 0;
    state.killedCount = 0;
    state.leakedCount = 0;
    state.enemies = [];
    state.spawnQueue = [];

    var waves = arr(T.waves);
    var w = waves[state.waveIndex];
    if (!w) return;
    var entries = arr(w.spawns);
    var q = state.spawnQueue;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var uid = e.unitId || e.id;
      if (!unitDef(uid)) continue;
      var count = num(e.count, 1);
      var interval = num(e.interval, 1);
      var startT = num(get(e, "startAt", get(e, "startTime", 0)), 0);
      var tier = num(e.tier, 1);
      if (tier < 1) tier = 1; if (tier > 3) tier = 3;
      for (var c = 0; c < count; c++) {
        q.push({ unitId: uid, tier: tier, spawnTime: startT + c * interval, ord: i * 10000 + c });
      }
    }
    q.sort(function (a, b) {
      if (a.spawnTime !== b.spawnTime) return a.spawnTime - b.spawnTime;
      if (a.unitId < b.unitId) return -1;
      if (a.unitId > b.unitId) return 1;
      return a.ord - b.ord;
    });
  }

  function spawnEnemy(q) {
    var def = unitDef(q.unitId);
    if (!def) return;
    var st = resolveEntityStats(def, q.tier);
    var e = {
      id: state.nextId++,
      typeId: q.unitId,
      tier: q.tier,
      pos: state.spawnPos,
      hp: st.hp, maxHp: st.hp,
      dps: st.dps,
      range: st.range,
      speed: st.speed,
      baseSpeed: st.speed,
      damageType: st.dmgType,
      armorClass: st.armorClass,
      domain: st.domain,
      flyer: (st.domain === "Flyer"),
      targets: def.Targets || def.targets || "Base",
      aoe: num(def.aoe, num(def.AOE, 0)),
      cost: resolveCost(def, q.tier),
      cooldown: 0,
      slowTimer: 0,
      slowFactor: 1,
      staggerTimer: 0,
      dotDps: 0,
      dotTimer: 0,
      alive: true
    };
    state.enemies.push(e);
    state.spawnedCount++;
  }

  function isFlyer(e) { return e.flyer; }

  // ================= status effect application =================
  function applyStatus(e, dmgType) {
    var d = damageTypeDef(dmgType);
    var status = d ? (d.status || d.effect) : null;
    // built-in fallbacks by type name
    if (dmgType === "Frost" && !isFlyer(e)) {
      e.slowFactor = d ? num(d.slowFactor, 0.5) : 0.5;
      e.slowTimer = d ? num(d.duration, 1.0) : 1.0;
    } else if (dmgType === "Concussion") {
      if (e.armorClass === "Machinery" || (d && d.staggerAll)) {
        e.staggerTimer = d ? num(d.duration, 0.5) : 0.5;
      }
    } else if (dmgType === "Fire" || dmgType === "Poison") {
      if (d && (d.dotDps || d.dot)) {
        e.dotDps = num(d.dotDps, num(d.dot, 0));
        e.dotTimer = num(d.duration, 2.0);
      }
    }
    if (status && typeof status === "object") {
      if (status.slow && !isFlyer(e)) {
        e.slowFactor = num(status.slow, 0.5);
        e.slowTimer = num(status.duration, 1.0);
      }
      if (status.stagger) e.staggerTimer = num(status.duration, 0.5);
      if (status.dot) { e.dotDps = num(status.dot, 0); e.dotTimer = num(status.duration, 2.0); }
    }
  }

  function damageEnemy(e, rawDps, dmgType, dt) {
    if (!e.alive) return;
    var mult = effMultiplier(dmgType, e.armorClass);
    e.hp -= rawDps * mult * dt;
    applyStatus(e, dmgType);
    if (e.hp <= 0) { e.hp = 0; e.alive = false; }
  }

  function damageStructure(s, rawDps, dmgType, dt) {
    if (!s || !s.alive) return;
    var mult = effMultiplier(dmgType, s.armorClass);
    s.hp -= rawDps * mult * dt;
    if (s.hp <= 0) { s.hp = 0; s.alive = false; }
  }

  // ================= targeting =================
  function blockingAhead(e) {
    var best = null, bestPos = Infinity;
    for (var i = 0; i < state.structures.length; i++) {
      var s = state.structures[i];
      if (!s.alive || !s.blocking) continue;
      if (s.pos >= e.pos - 1e-6 && s.pos < bestPos) { best = s; bestPos = s.pos; }
    }
    return best;
  }

  function structTarget(s) {
    var best = null, bd = Infinity;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.alive) continue;
      if (isFlyer(e) && !s.canTargetAir) continue;
      if (!isFlyer(e) && !s.canTargetGround) continue;
      var d = Math.abs(e.pos - s.pos);
      if (d <= s.range && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function nearestStructure(e) {
    var best = null, bd = Infinity;
    for (var i = 0; i < state.structures.length; i++) {
      var s = state.structures[i];
      if (!s.alive) continue;
      var d = Math.abs(s.pos - e.pos);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function moveEnemyToward(e, targetPos, dt) {
    var eff = e.speed * (e.slowTimer > 0 ? e.slowFactor : 1) * (e.staggerTimer > 0 ? 0 : 1);
    var dir = (targetPos > e.pos) ? 1 : -1;
    var step = eff * dt;
    var remaining = Math.abs(targetPos - e.pos);
    if (step >= remaining) e.pos = targetPos;
    else e.pos += dir * step;
  }

  // ================= step =================
  function step(dt) {
    dt = num(dt, 0);
    state.tick++;
    if (state.phase !== "battle") { return state; }
    state.time += dt;

    // spawns
    var q = state.spawnQueue;
    while (q.length > 0 && q[0].spawnTime <= state.time + 1e-9) {
      spawnEnemy(q.shift());
    }

    // structures fire
    var structs = state.structures;
    for (var i = 0; i < structs.length; i++) {
      var s = structs[i];
      if (!s.alive || s.hp <= 0) continue;
      var tgt = structTarget(s);
      if (!tgt) continue;
      if (s.aoe > 0) {
        for (var j = 0; j < state.enemies.length; j++) {
          var oe = state.enemies[j];
          if (!oe.alive) continue;
          if (isFlyer(oe) && !s.canTargetAir) continue;
          if (!isFlyer(oe) && !s.canTargetGround) continue;
          if (Math.abs(oe.pos - tgt.pos) <= s.aoe) damageEnemy(oe, s.dps, s.damageType, dt);
        }
      } else {
        damageEnemy(tgt, s.dps, s.damageType, dt);
      }
    }

    // enemies act
    var enemies = state.enemies;
    for (var k = 0; k < enemies.length; k++) {
      var e = enemies[k];
      if (!e.alive || e.hp <= 0) continue;

      // status timers
      if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer < 0) e.slowTimer = 0; }
      if (e.staggerTimer > 0) { e.staggerTimer -= dt; if (e.staggerTimer < 0) e.staggerTimer = 0; }
      if (e.dotTimer > 0) {
        e.hp -= e.dotDps * dt;
        e.dotTimer -= dt;
        if (e.dotTimer < 0) e.dotTimer = 0;
        if (e.hp <= 0) { e.hp = 0; e.alive = false; continue; }
      }

      // artillery: attack structures
      if (e.targets === "Structures") {
        var target = nearestStructure(e);
        if (target) {
          var d = Math.abs(target.pos - e.pos);
          if (d <= e.range) { damageStructure(target, e.dps, e.damageType, dt); continue; }
          moveEnemyToward(e, target.pos, dt);
          continue;
        }
      }

      // walkers blocked by wall/moat
      if (!isFlyer(e)) {
        var wall = blockingAhead(e);
        if (wall) {
          var wd = Math.abs(wall.pos - e.pos);
          if (wd <= e.range || wd < 1e-6) {
            damageStructure(wall, e.dps, e.damageType, dt);
            continue;
          } else if (wall.pos < state.basePos && wall.pos > e.pos) {
            moveEnemyToward(e, wall.pos, dt);
            continue;
          }
        }
      }

      // default: advance to base
      var distToBase = state.basePos - e.pos;
      if (distToBase <= e.range) {
        var bmult = effMultiplier(e.damageType, baseArmorClass());
        state.baseHP -= e.dps * bmult * dt;
        if (state.baseHP < 0) state.baseHP = 0;
      } else {
        moveEnemyToward(e, state.basePos, dt);
      }
    }

    // cleanup dead / leaked enemies & award bounty
    var econ = T.economy || {};
    var bountyFrac = num(get(econ, "bountyFrac", get(econ, "killGoldFrac", 0.5)), 0.5);
    var alive = [];
    for (var m = 0; m < enemies.length; m++) {
      var en = enemies[m];
      if (en.alive && en.hp > 0) {
        alive.push(en);
      } else if (!en.alive || en.hp <= 0) {
        state.killedCount++;
        state.gold += Math.floor(en.cost * bountyFrac);
      }
    }
    state.enemies = alive;

    // defeat check
    if (state.baseHP <= 0) {
      state.baseHP = 0;
      state.phase = "defeat";
      state.result = "lose";
      return state;
    }

    // wave cleared?
    var pending = state.spawnQueue.length + state.enemies.length;
    if (pending === 0 && state.spawnedCount > 0) {
      state.lastWaveCleared = state.waveIndex;
      // collect wave reward
      var w = arr(T.waves)[state.waveIndex];
      if (w) state.gold += num(w.reward, num(w.bonusGold, 0));
      state.waveIndex++;
      if (state.waveIndex >= state.totalWaves) {
        state.phase = "win";
        state.result = "win";
      } else {
        state.phase = "build";
      }
    }

    return state;
  }

  // ================= state accessor =================
  function getState() { return state; }

  // ================= hash =================
  function hash() {
    var h = fnvInit();
    var s = state;
    if (!s) return h >>> 0;
    h = fnvInt(h, s.seed | 0);
    h = fnvInt(h, s.tick | 0);
    h = fnvFloat(h, s.time);
    h = fnvStr(h, s.phase);
    h = fnvInt(h, s.waveIndex | 0);
    h = fnvFloat(h, s.gold);
    h = fnvFloat(h, s.baseHP);
    h = fnvInt(h, s.spawnedCount | 0);
    h = fnvInt(h, s.killedCount | 0);
    h = fnvInt(h, s.leakedCount | 0);
    h = fnvInt(h, s.nextId | 0);
    h = fnvInt(h, s.lastWaveCleared | 0);
    h = fnvStr(h, s.result == null ? "" : s.result);

    var i, o;
    // structures (order-stable: sorted by id)
    var structs = s.structures.slice().sort(function (a, b) { return a.id - b.id; });
    h = fnvInt(h, structs.length);
    for (i = 0; i < structs.length; i++) {
      o = structs[i];
      h = fnvInt(h, o.id);
      h = fnvStr(h, o.typeId);
      h = fnvInt(h, o.tier);
      h = fnvFloat(h, o.pos);
      h = fnvFloat(h, o.hp);
      h = fnvFloat(h, o.maxHp);
      h = fnvFloat(h, o.dps);
      h = fnvFloat(h, o.range);
      h = fnvInt(h, o.alive ? 1 : 0);
    }
    // enemies (sorted by id)
    var ens = s.enemies.slice().sort(function (a, b) { return a.id - b.id; });
    h = fnvInt(h, ens.length);
    for (i = 0; i < ens.length; i++) {
      o = ens[i];
      h = fnvInt(h, o.id);
      h = fnvStr(h, o.typeId);
      h = fnvInt(h, o.tier);
      h = fnvFloat(h, o.pos);
      h = fnvFloat(h, o.hp);
      h = fnvFloat(h, o.speed);
      h = fnvFloat(h, o.slowTimer);
      h = fnvFloat(h, o.staggerTimer);
      h = fnvFloat(h, o.dotTimer);
      h = fnvInt(h, o.alive ? 1 : 0);
    }
    // spawn queue
    h = fnvInt(h, s.spawnQueue.length);
    for (i = 0; i < s.spawnQueue.length; i++) {
      o = s.spawnQueue[i];
      h = fnvStr(h, o.unitId);
      h = fnvInt(h, o.tier);
      h = fnvFloat(h, o.spawnTime);
    }
    return h >>> 0;
  }

  return {
    init: init,
    step: step,
    state: getState,
    hash: hash,
    applyInput: applyInput
  };
})();
})();