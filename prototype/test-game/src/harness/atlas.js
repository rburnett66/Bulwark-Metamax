/**
 * prototype/test-game/src/harness/atlas.js  [state-harness sh-polish.sheets.t1]
 *
 * Load a sprite SHEET (the MetaMax / Pixi atlas format: a PNG + an atlas.json whose `frames` map each frame to
 * `{ frame: {x,y,w,h} }`) into per-frame PIXI textures — the sheet the harness assigns to the base/weapon/head
 * part-stack layers. Reuses the exact atlas.json the MetaMax sprite pipeline emits, so gallery sheets drop in.
 *
 * `parseAtlasFrames` is PURE (no PIXI, no DOM) so it can be unit-tested; `loadAtlasFromFiles` adds the PIXI
 * texture slicing (needs a global PIXI v7) and the file reads.
 */

/** Pure: atlas.json object -> { name: {x,y,w,h} }. Tolerant of a missing/!object `frames`. */
export function parseAtlasFrames(sheet) {
  const out = {};
  const frames = (sheet && sheet.frames) || {};
  for (const name of Object.keys(frames)) {
    const f = frames[name] && frames[name].frame;
    if (f && typeof f.x === 'number') {
      out[name] = { x: f.x | 0, y: f.y | 0, w: f.w | 0, h: f.h | 0 };
    }
  }
  return out;
}

/** Load a sheet from an { image PNG File } + { atlas.json File } → { textures, frameNames, meta, imageUrl }.
 *  Throws a clear Error on bad JSON / no frames / a PNG that won't decode. Needs a global PIXI (v7). */
export async function loadAtlasFromFiles(pngFile, jsonFile) {
  const [imageUrl, jsonText] = await Promise.all([_readDataURL(pngFile), jsonFile.text()]);
  let sheet;
  try { sheet = JSON.parse(jsonText); } catch (e) { throw new Error('atlas.json is not valid JSON'); }
  const rects = parseAtlasFrames(sheet);
  const frameNames = Object.keys(rects);
  if (!frameNames.length) throw new Error('atlas.json has no usable "frames"');
  const img = await _loadImage(imageUrl);
  const base = PIXI.BaseTexture.from(img);
  const textures = {};
  for (const name of frameNames) {
    const r = rects[name];
    textures[name] = new PIXI.Texture(base, new PIXI.Rectangle(r.x, r.y, r.w, r.h));
  }
  return { textures, frameNames, rects, meta: (sheet && sheet.meta) || {}, imageUrl };
}

function _readDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('could not read the sheet PNG'));
    r.readAsDataURL(file);
  });
}
function _loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('the sheet PNG failed to decode'));
    im.src = url;
  });
}
