/**
 * src/outpost/draftLayout.js — a draft outpost map layout, in the Forge format the outpost maps use
 * (tech plan docs/tech-plan/Outpost.md §6.6) [MM-story_mw5oe696_j].
 *
 * A planet with no Forge outpost map (and the menu buttons' status lines) runs on this layout: a 40 × 24 open board
 * with the landing pad (`hub`), one deposit per ore tier (2 × 2 cells from x, y; the rare one far from the hub) and
 * the reference defense set. No build pads (One Battle UX S2c.2 [MM-story_mwc9pmbn_2i]): buildings stand where they
 * are placed (model.buildingRect). Cells are battle cells.
 */
export const DRAFT_LAYOUT = Object.freeze({
  id: 'draft-outpost',
  source: 'draft',
  width: 40,
  height: 24,
  hub: Object.freeze({ id: 'hub', x: 17, y: 10, w: 3, h: 3 }),
  deposits: [
    { tier: 'common', x: 15, y: 16 },
    { tier: 'uncommon', x: 25, y: 13 },
    { tier: 'rare', x: 1, y: 14 },
  ],
  // the reference defense set (design §2.3: a Cannon, a Machine Gun and a wall ring)
  kitDefenses: [
    { kind: 'cannon', cell: [13, 10] },
    { kind: 'mg', cell: [30, 17] },
    ...[[11, 8], [11, 9], [11, 10], [33, 9], [33, 10], [33, 11]].map((cell) => ({ kind: 'wall', cell })),
  ],
});
