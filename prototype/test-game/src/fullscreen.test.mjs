// [MM-story_mvfxazk4_1t] mobile full screen: which route each device takes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fullscreenRoute } from './fullscreen.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const base = { search: '', webdriver: false, standalone: false, coarse: false, canFullscreen: true, isFullscreen: false, maxTouchPoints: 0 };

test('iPhone and iPad Safari take the swipe-up trick', () => {
  assert.equal(fullscreenRoute({ ...base, ua: IPHONE, coarse: true, canFullscreen: false, maxTouchPoints: 5 }).route, 'swipe');
  // iPadOS reports itself as a Mac — touch points give it away
  assert.equal(fullscreenRoute({ ...base, ua: MAC, platform: 'MacIntel', maxTouchPoints: 5, coarse: true }).route, 'swipe');
});

test('the Home Screen app, automation and ?fs=off show nothing', () => {
  assert.equal(fullscreenRoute({ ...base, ua: IPHONE, standalone: true }).route, 'none');
  assert.equal(fullscreenRoute({ ...base, ua: IPHONE, webdriver: true }).route, 'none');
  assert.equal(fullscreenRoute({ ...base, ua: ANDROID, coarse: true, search: '?fs=off' }).route, 'none');
  assert.equal(fullscreenRoute({ ...base, ua: IPHONE, search: '?map=2&fs=off' }).why, 'fs=off');
});

test('Android touch browsers get the full-screen card; desktop keeps its ⛶ button', () => {
  assert.equal(fullscreenRoute({ ...base, ua: ANDROID, coarse: true, maxTouchPoints: 5 }).route, 'card');
  assert.equal(fullscreenRoute({ ...base, ua: ANDROID, coarse: true, isFullscreen: true }).route, 'none', 'already full screen');
  assert.equal(fullscreenRoute({ ...base, ua: ANDROID, coarse: true, canFullscreen: false }).route, 'none', 'no API');
  assert.equal(fullscreenRoute({ ...base, ua: MAC, platform: 'MacIntel' }).route, 'none', 'a real Mac is a desktop');
});
