// Owner 2026-11-13 [MM-story_mwf9ecau_8]: "my PC chrome browser is warning of very high memory usage 1.8 gb". The battle
// HUD (battles and the outpost) put resize / orientationchange / visualViewport / fullscreenchange listeners on the window
// and document and never took them off, so every closed battle and outpost visit stayed in memory through them — its
// HUD, its session, its 3D renderer and scene (headless probe: 5 visits, 5 sessions still alive; with this fix, none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hud = readFileSync(new URL('./hud.js', import.meta.url), 'utf8');
const session = readFileSync(new URL('../battle/session.js', import.meta.url), 'utf8');

test('every window / document listener the HUD adds goes through listenGlobal, so hud.destroy takes it off', () => {
  const direct = hud.split('\n').filter((l) => /\b(view|doc|win|window|document)(\.visualViewport)?\.addEventListener\(/.test(l) && !/listenGlobal/.test(l)
    && !/const listenGlobal/.test(l) && !/target\.addEventListener/.test(l));
  assert.deepEqual(direct, [], 'a global listener added outside listenGlobal is never removed');
  assert.match(hud, /hud\.destroy = \(\) => \{/);
  assert.match(hud, /removeEventListener\(type, fn, opts\)/);
});

test('the battle session\'s destroy calls hud.destroy (battles and outpost visits alike)', () => {
  assert.match(session, /if \(hud && hud\.destroy\) \{ try \{ hud\.destroy\(\); \}/);
});
