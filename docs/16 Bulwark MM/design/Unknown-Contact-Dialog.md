# Unknown Contact — dialog

**Version:** 1.0 · [MM-story_mvajkyq5_z] · epic *Orbital arrival and contact* [MM-epic_mvajkra0_x]

Source of truth for the Unknown Contact's lines. `tools/extract_contact.py` turns this file into
`content/dialog/contact.json` (the file the game reads). Edit here, re-run the tool, never hand-edit the JSON.
`src/comm/contact.test.mjs` fails if the two drift.

## Who

A voice on an encrypted channel that reaches the harvester the moment it settles into survey orbit, as a
last-minute attempt to get a favour done. No faction, no face, no name. It wants the planet's **rare** and
**epic** resources (see `src/data/planets.js`), carried off the manifest. What it is, and whose side it is on,
is not revealed here.

**Speaker:** Unknown Contact
**Sub:** UNREGISTERED · ENCRYPTED
**Gender:** neutral

**Voice profile:** Close-miked and dry, as if it is in the cockpit with you: low, unhurried, a little amused.
A scrambler warbles under every syllable, so the voice never quite resolves into a person. It never raises
itself, and it always sounds like it already knows what you will say.

## Favour lines

One per homeworld, keyed by faction key. Each line names that world's rare and epic resource.

- *ground:* "Harvester. Don't close the channel. Your charter wants grain and amber from Verdance. Dull, but honest. Bring me Rootsong Seeds. And if you find Elder Bloom, bring that too. Off the manifest. I pay better than your charter ever will."
- *air:* "Harvester. Don't close the channel. Petals and honey, is it? Your buyers have no imagination. Bring me Dawnpollen. And if you find Choir Lily, bring that too. Off the manifest. I pay better than your charter ever will."
- *hightech:* "Harvester. Don't close the channel. The corp will weigh every grain of sunsalt you lift off Ochre. They can't weigh what they never see. Bring me Mirage Oil. And if you find Solar Pearl, bring that too. Off the manifest. I pay better than your charter ever will."
- *artillery:* "Harvester. Don't close the channel. Nobody misses scrap on Kessra. But something under that dust is still warm. Bring me Ghost Brass. And if you find Dreadnought Core, bring that too. Off the manifest. I pay better than your charter ever will."
- *water:* "Harvester. Don't close the channel. Cold work on Rime. Let me make it worth the frostbite. Bring me Glacier Breath. And if you find Leviathan Scale, bring that too. Off the manifest. I pay better than your charter ever will."
- *arcane:* "Harvester. Don't close the channel. The priests of Cinder would call this theft. I call it a rescue. Bring me Phoenix Glass. And if you find Heartflame, bring that too. Off the manifest. I pay better than your charter ever will."
- *space:* "Harvester. Don't close the channel. Federation sensors see everything on Lumen. Almost everything. Bring me Starfall Iron. And if you find Void Lens, bring that too. Off the manifest. I pay better than your charter ever will."
- *dark:* "Harvester. Don't close the channel. Keep your filters sealed down there, and listen to me before you breathe. Bring me Dreamspore. And if you find Mycelial Heart, bring that too. Off the manifest. I pay better than your charter ever will."
- *greenies:* "Harvester. Don't close the channel. The hive will notice. That's why I'm asking you, and not someone sensible. Bring me Hive Jelly. And if you find Broodqueen Egg, bring that too. Off the manifest. I pay better than your charter ever will."

## Replies

Spoken after the player answers the favour (used by the favour contract, [MM-story_mvajl0pm_11]).

- *accept:* "Good. Nobody needs to know but us. I'll be listening…"
- *decline:* "Your loss, harvester. The offer won't come twice."
