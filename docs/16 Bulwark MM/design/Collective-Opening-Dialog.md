# Collective Opening — the bar conversation

**Version:** 0.1 · [MM-story_mw548j4g_v] · epic *The Collective trade faction* [MM-epic_mvo5po8u_4]

Source of truth for what Factor Mira Valcourt says at the bar in the Collective opening (design:
`Collective-Opening-Design.md` §6.4). `prototype/test-game/tools/extract_opening.py` turns this file into
`content/dialog/opening.json` (the file the game reads). Edit here, re-run the tool, never hand-edit the JSON.
`src/comm/opening.test.mjs` fails if the two drift.

The lines play through the game's comm card, one transmission per line, held and centred like every other held
dialog: tap to close moves to the next line. A line tagged with a slide id cues that holo-slide beside the card.

**PLACEHOLDER** lines, in the owner's order: welcome, who the Collective are, the frontier, the offer, the terms, the
handshake. The owner's transcript replaces them; keep the slide ids.

## Who

**Speaker:** Factor Mira Valcourt
**Sub:** CONTRACT OFFICER · THE COLLECTIVE
**Gender:** female

**Voice profile:** The `collective` contact in `src/comm/voice.js`: warm, clear and unhurried, a voice used to
closing deals. A quiet room behind her, not a radio.

## Slides

- *ledger:* The Long Ledger — Capital ship of the Collective · above Vesper
- *seal:* The Collective — Traders, not soldiers
- *frontier:* The frontier — Nine homeworlds · nine factions · one market
- *verdance:* Verdance — Ground · Powder homeworld
- *transport:* Your transport — Collective hauler · fitted for harvest
- *terms:* The terms — We buy to the quota · the surplus is yours

## Lines

- *ledger:* "Welcome aboard the Long Ledger, Commander. Mind the stools — they bolt them down after the last convoy."
- "I'm Mira Valcourt. I write the contracts on this ship, which makes me the most interesting person in the bar."
- *seal:* "You'll hear a lot of things about the Collective out there. Most of them are true, and none of them are about guns."
- "We're traders. We don't take worlds. We buy what comes out of them."
- *frontier:* "Nine homeworlds on this arm, nine factions, and every one of them sitting on resources they can't move without us."
- "They'll fight each other over it. We'd rather they fought efficiently."
- *verdance:* "Which brings me to you. Verdance — green, loud, and rich in powder ore."
- "The Ground faction holds it. Their harvest lines need a commander who can keep them standing."
- *transport:* "So here's the offer: a transport, fitted and fuelled, waiting in the Loading Bay."
- "It's yours for as long as you keep a contract with us. Fair?"
- *terms:* "The terms are simple. Whatever you harvest, we buy — up to the quota."
- "Common ore and the uncommon finds. Anything past the quota, and anything rare, you keep."
- "Fill enough contracts and the Collective remembers your name. That's worth more than the gold."
- "Then we have a deal. Welcome to the Collective, Commander."
