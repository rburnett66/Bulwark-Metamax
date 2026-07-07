const SimCore = (() => {

  function createWorld(config, seed) {
    const World = config.data.World;
    return World.create(config, seed);
  }

  function step(world, dt, commands) {
    const Step = world.config.data.Step;
    return Step.tick(world, dt, commands);
  }

  // Run a full battle headlessly (same code path as balance sim §17).
  // Optionally auto-plays a script of commands keyed by frame.
  function runBattle(config, seed, opts) {
    opts = opts || {};
    const maxFrames = opts.maxFrames || 60 * 60 * 20; // 20 min cap @60hz
    const dt = opts.dt || (1 / 60);
    const script = opts.script || {}; // { frameIndex: [commands...] }
    const onFrame = opts.onFrame || null;
    const log = opts.log || null;

    const world = createWorld(config, seed);

    if (log) {
      log.begin(seed, world);
    }

    // auto start first wave if requested
    if (opts.autoStart) {
      const cmd = { type: 'startWave' };
      applyAndLog(world, dt, [cmd], log);
    }

    let frame = 0;
    while (frame < maxFrames) {
      const cmds = script[frame] ? script[frame].slice() : [];

      // Auto-driver for balance/headless play: keep waves flowing.
      if (opts.autoWaves && world.wave && world.wave.betweenWaves &&
          !world.gameOver) {
        cmds.push({ type: 'startWave' });
      }

      applyAndLog(world, dt, cmds, log);

      if (onFrame) onFrame(world, frame);

      frame++;

      if (world.gameOver) break;
    }

    const result = {
      seed,
      frames: frame,
      outcome: world.gameOver ? world.outcome : 'timeout',
      baseHp: world.base ? world.base.hp : 0,
      wavesCleared: world.wave ? world.wave.cleared : 0,
      gold: world.economy ? world.economy.gold : 0,
      world
    };

    if (log) {
      log.end(result);
    }

    return result;
  }

  function applyAndLog(world, dt, cmds, log) {
    if (log && cmds && cmds.length) {
      for (const c of cmds) log.recordCommand(world.frame, c);
    }
    const events = step(world, dt, cmds);
    if (log && events && events.length) {
      for (const e of events) log.recordEvent(world.frame, e);
    }
    return events;
  }

  // Re-drive from a battle log and return final state for determinism check.
  function replayFromLog(config, logData, opts) {
    opts = opts || {};
    const dt = opts.dt || (1 / 60);
    const seed = logData.seed;
    const world = createWorld(config, seed);

    // Index commands by frame
    const byFrame = {};
    for (const rec of logData.commands) {
      (byFrame[rec.frame] = byFrame[rec.frame] || []).push(rec.command);
    }

    const maxFrame = logData.endFrame != null
      ? logData.endFrame
      : (logData.commands.length
          ? logData.commands[logData.commands.length - 1].frame
          : 0);

    let frame = 0;
    while (frame <= maxFrame && !world.gameOver) {
      const cmds = byFrame[frame] ? byFrame[frame].slice() : [];
      step(world, dt, cmds);
      frame++;
    }

    return {
      seed,
      frames: frame,
      outcome: world.gameOver ? world.outcome : 'timeout',
      baseHp: world.base ? world.base.hp : 0,
      wavesCleared: world.wave ? world.wave.cleared : 0,
      world
    };
  }

  return {
    createWorld,
    step,
    runBattle,
    replayFromLog
  };
})();

export default SimCore;
export const createWorld = SimCore.createWorld;
export const step = SimCore.step;
export const runBattle = SimCore.runBattle;
export const replayFromLog = SimCore.replayFromLog;