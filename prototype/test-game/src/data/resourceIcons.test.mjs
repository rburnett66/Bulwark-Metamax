// [MM-story_mw18nusb_5] Every resource has its icon, under the id its name gives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resourceId, resourceIconUrl, resourceIconHtml } from './resourceIcons.js';
import { PLANETS } from './planets.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const DIR = new URL('../../content/icons/resources/', import.meta.url);

test('the id of every resource is its name in kebab case', () => {
  assert.equal(CATALOG.resources.length, 36);
  for (const r of CATALOG.resources) assert.equal(resourceId(r.name), r.id, r.name);
  for (const p of Object.values(PLANETS)) for (const r of Object.values(p.resources)) assert.ok(CATALOG.resources.some((x) => x.id === resourceId(r.name)), r.name);
});

test('every resource has a committed icon, and there are no strays', () => {
  for (const r of CATALOG.resources) assert.ok(existsSync(new URL(r.id + '.webp', DIR)), r.id + '.webp');
  const files = readdirSync(DIR).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();
  assert.deepEqual(files, CATALOG.resources.map((r) => r.id).sort());
});

test('the icon markup is a decorative image at the resolved URL', () => {
  assert.match(resourceIconUrl('helium-3'), /content\/icons\/resources\/helium-3\.webp$/);
  const h = resourceIconHtml('loam-grain', 'gem3 resi');
  assert.match(h, /^<img class="gem3 resi" src="[^"]+loam-grain\.webp" alt=""/);
});
