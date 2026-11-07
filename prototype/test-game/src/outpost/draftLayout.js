/**
 * src/outpost/draftLayout.js — a draft outpost map layout, in the Forge format the outpost maps will use
 * (tech plan docs/tech-plan/Outpost.md §6.6) [MM-story_mw5oe696_j].
 *
 * Until story O4 authors the Verdance outpost map in the Terrain Forge, the model's tests and the review page run on
 * this layout. It follows the design's rules (Outpost-Design §4.5, §9): a 40 × 24 map; a central mesa whose pads all
 * sit within reach of the first Power Station; the rare deposit remote, outside that reach, with its own power pad;
 * defense cells on a ring. Cells are battle cells; a pad's centre is (x + w/2, y + h/2).
 */
export const DRAFT_LAYOUT = Object.freeze({
  id: 'draft-outpost',
  width: 40,
  height: 24,
  pads: [
    { id: 'hub', x: 16, y: 9, w: 6, h: 6, role: 'hub' },
    { id: 'p1', x: 22, y: 9, w: 4, h: 4, role: 'power' },
    { id: 'r1', x: 15, y: 16, w: 4, h: 4, role: 'rig' },
    { id: 's1', x: 22, y: 15, w: 4, h: 4, role: 'storage' },
    { id: 'r2', x: 27, y: 4, w: 4, h: 4, role: 'rig' },
    { id: 'b1', x: 17, y: 3, w: 4, h: 4, role: 'bay' },
    { id: 'b2', x: 22, y: 3, w: 4, h: 4, role: 'bay' },
    { id: 'x1', x: 28, y: 12, w: 4, h: 4, role: 'spare' },
    { id: 'r3', x: 1, y: 14, w: 4, h: 4, role: 'rig', remote: true },
    { id: 'p2', x: 4, y: 18, w: 4, h: 4, role: 'power', remote: true },
  ],
  deposits: [
    { tier: 'common', x: 16, y: 17, pad: 'r1' },
    { tier: 'uncommon', x: 28, y: 5, pad: 'r2' },
    { tier: 'rare', x: 2, y: 15, pad: 'r3' },
  ],
  conduits: [['p1', 'hub'], ['p1', 'r1'], ['p1', 's1'], ['p1', 'r2'], ['p1', 'b1'], ['p1', 'b2'], ['p1', 'x1'], ['p2', 'r3']],
  // where the contract kit's defenses start (design §2.3: a Cannon, a Machine Gun and a wall ring)
  kitDefenses: [
    { kind: 'cannon', cell: [14, 10] },
    { kind: 'mg', cell: [30, 17] },
    ...[[12, 8], [12, 9], [12, 10], [33, 9], [33, 10], [33, 11]].map((cell) => ({ kind: 'wall', cell })),
  ],
});
