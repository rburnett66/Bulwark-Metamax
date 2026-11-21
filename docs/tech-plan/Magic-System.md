# Tech Plan — The magic system: three neutral magics, intent, cost and a slow discovery

**Repo copy is canonical:** `docs/tech-plan/Magic-System.md`.
**Status:** v0.3, 2026-11-20, agent-proposed for owner review. v0.2 added the MAGIC tree and skills (§7); v0.3
makes the three Brain, Soul and Body, with names derived from the fields, and magic as emotion (§1–§2). Ticket: MM-story_mwpdkocr_3g.
**Builds on:** `Character-System.md` (§8 reserves the hooks), `Character-Secrets.md` (the `magic` and `sense`
secrets).

> **owner** (2026-11-20): "I don't want to make it as simple as the force in Star Wars with a binary rule set. I want
> a three sided system fighting for balance. Quantum vs Structure vs Chaos." … "It would be fair to say that good
> magic and evil magic are the traditional vectors, but our line is more like the three magic provide a neutral system
> and there can also be evil and good applied to all three. The discovery of the three magics can also be strung out
> as a long storyline which might tease simplicity then reveal more depth. Extreme magic should have high cost or
> consequences. Balance will be a hidden truth. We do need name options for the three magics and their source -
> organic, electric, quantum .. seem like good themes"

## 0. The shape in one paragraph

There are **three magics**: **Brain** (the electric field), **Soul** (the quantum field) and **Body** (the organic
field), each drawn from its own source. Magic is also emotion: a group's shared will is Soul magic, the way the 300
held the pass. None of them is good or evil. **Intent** is a second,
separate axis: any magic can be used to heal or to harm, and the character's alignment decides which. Two magics
used together make a **blend**. Pushing one magic to the **extreme** costs the user and pulls the other two back
against them, because the three are one system that keeps itself in **balance**. Nobody says that last part out loud.
The player starts out believing the common story (good magic against dark magic) and finds the real shape one
secret at a time.

## 1. The three magics: Brain, Soul and Body

> **owner** (2026-11-20): "Magic in this universe can be an emotional power like group motivation. Think of the
> Spartans and the story of the 300 as a form of magic. Derive the names from the three fields: quantum, electric,
> and organic. Kind of like Brain, Soul, and Body. Brain - electric, soul - quantum, body - organic"

Each magic is a **field** that runs through everything, and each one shows in people as a **faculty**:

| Field | Faculty | Nature | What it does | Earlier working name |
|---|---|---|---|---|
| **Electric** | **Brain** | thought, nerves, memory, pattern, law | focuses, aims, remembers, binds by rule, reads and overwrites minds | Structure |
| **Quantum** | **Soul** | will, emotion, faith, fate | chooses between what might happen: courage, luck, hope, fear, the stand that should have failed | Quantum |
| **Organic** | **Body** | flesh, growth, decay | heals, grows, hardens, quickens, rots, mutates | Chaos |

**Magic is also emotion.** The Soul is the quantum field in people: what a person wills tilts what can happen.
When many people will the same thing, the tilt adds up. That is group motivation as magic. The 300 held the pass
because three hundred souls chose the same outcome, and the more hopeless the odds, the harder that choice pushes.
Fear is the same power used for evil: an army made to dread its general also fights past what it should.

This is the game's own shape. Bulwark is a few defenders holding a line against waves, so Soul magic is what the
player's side does at its best.

The existing Powder secrets already fit, and most of them are Soul:
- Seraphine's standard that never falls while she breathes, so troops near it stand firm: **Soul**, group motivation;
- Kord Stahl's men who fear him and fight on past death, for a minute: **Soul**, the evil use (fear);
- Bricks Malloy can't be hit while he's singing: **Soul**, morale;
- Otto's bullets that turn aside from anyone he swears to protect, once: **Soul**, an oath tilting chance;
- Aldric Vane's oath that neither side can break: **Soul**, a will that holds;
- Ines Roth's tally pencil that keeps counting while she sleeps: **Brain**, memory;
- Graf's signature that people believe, whatever she writes: **Brain**, minds bent;
- Grigor Vosk walking through fire unburned, and the heat behind the Iron Regent's mask: **Body**.

So Powder's home magic is **Soul** (§4), which also fits its public reputation: resourceful and armoured, but
lacking in science (Character-System §2a).

## 2. Names, derived from the three fields

The names come from the field words, so the three read as one family. Every option was checked against the
content and the GDD for clashes.

**People know the faculties; the few know the fields.** Soldiers and farmers say **brain-craft, soul-fire and
body-craft** (or just "wits", "heart" and "blood"). The field names are the deeper truth, learned late in the
discovery (§6), when the player finds that the faculties are fields that run through the whole world, not only
through people.

| Set | Brain (electric) | Soul (quantum) | Body (organic) | Reads as |
|---|---|---|---|---|
| **A (recommended)** | **Electrum** | **Quantum** | **Organum** | one Latin family; Electrum is also an old alloy, Organum an old word for a tool and an instrument |
| B | Electris | Quantis | Organis | invented, no clash anywhere, softer |
| C | the Electric | the Quantic | the Organic | plain, almost scientific; suits High Tech and Space speakers |
| (avoid) | Electra | Quanta | Organa | "Organa" is a Star Wars surname, the comparison the owner wants to avoid |

**Sources** (where each field comes from), kept from the earlier options and tied to the faculties:

| Field | Source | Why |
|---|---|---|
| Electrum | the **Storm-Lines**: lightning that runs the same paths across every world | the world's nerves |
| Quantum | the **Fold**: where the things that nearly happened are kept, and a will can reach in and choose | the world's soul |
| Organum | the **Mycel**: one fungal web under every world, alive and very slow | the world's body |

**Blends** (two faculties together):

| Blend | Fields | What it does |
|---|---|---|
| **Foresight** | Brain + Soul | sees what will happen and wills it |
| **Craft** | Brain + Body | the trained hand: grafts, living armour, bred beasts, a body taught past its limits |
| **Valor** (was Miracle) | Soul + Body | the will driving the body past death: the last stand, the impossible recovery |

**The hidden whole** (never said until late): **the Bulwark** (recommended; the three hold each other up, and the
game's own name turns out to be the truth), the Brace, or the Weft.

## 3. Intent: good, neutral and evil on all three

Intent is not a fourth magic and not a property of the magic. It comes from the user.

| Magic | Good use | Neutral use | Evil use |
|---|---|---|---|
| Brain (Electrum) | clear sight, shield, keep a memory safe | calculation, records, aim | deceive, coerce, overwrite a mind |
| Soul (Quantum) | rally, courage, give hope and luck away | gamble, guess, chance | fear, despair, steal someone's luck |
| Body (Organum) | heal, grow, strengthen | harvest, breeding, endurance | blight, plague, feed on others to grow |

**Generated:** a character's `use` comes from their alignment's polarity: Good → good, N → neutral, Evil → evil.
A character may declare a different use with a reason; for example, a good healer who once blighted a field.

This is how the common story gets it wrong. People see Seraphine's standard and Kord Stahl's fear, the same Soul
magic used two ways, and take them for two different magics.

## 4. Where characters stand: home side, depth, conviction

- **Home side by faction** (revised for Brain, Soul and Body):
  - **Brain (Electrum):** High Tech, Artillery, Space;
  - **Soul (Quantum):** Powder, Arcane, Air;
  - **Body (Organum):** Greenies, Water, Dark.
  - A character's magic secret takes the home side unless declared otherwise; at least one character per faction
    uses another side, so no faction is a monoculture.
  - A faction's public traits (Character-System §2a) must agree with its home side; for example a faction known for
    lacking science is never Brain-home.
- **Depth** 0–3: 0 touched, 1 practised, 2 adept, 3 **extreme**. Most characters are 0–1.
- **Conviction** (GDD §10.1) places them in the triangle:
  - **T3 Balance-Keepers** (AG, PG, PE, DE) sit near the centre. They know, or half-know, the hidden balance; that
    is why the GDD has zealots of both poles respect each other.
  - **T2** sit at their faction's side.
  - **T1** lean toward Body (appetite, change).
  - **N** drift with their faction.
- A **flaw** (Character-System.md §5a) is what pushes a character to depth 3: proud overreaches, driven is consumed,
  reckless rushes in. Indulgent users hoard one magic; cowardly users stop short. Depth is declared, not generated,
  and the gate checks that every depth-3 character has one of the three flaws that lead there.

## 5. Extremes: high cost and consequences

Depth 3 always costs something, in three ways.

**1. The user pays.** Each magic takes its own price:

| Magic | The cost of the extreme |
|---|---|
| Brain | **rigidity**: thought hardens into pattern; memory overwrites self; they repeat |
| Soul | **burning out**: the will pours into the cause until nothing of the person is left; martyrdom, or a fervour that cannot stop |
| Body | **becoming**: the body changes toward what it grows or rots; it stops being only them |

Some existing names could already be such extremes, for the owner to confirm: **the Signal** (Brain), **the Unmade
Choir** and **the Hollow Prophet** (Soul), **the Root-Mind** (Brain and Body, a Craft extreme).

**2. The other two magics push back.** This is the hidden balance at work. Pushing one magic hard makes the other two
surge around the user: an extreme Brain user's body sickens and their luck turns; an extreme Soul user's mind
scatters and their body fails; an extreme Body user loses their wits and their will. Nobody in the world calls it
"balance"; they call it a curse, bad weather or the price.

**3. People react.** An extreme user loses rapport with anyone who has seen the cost: −2 base relation with
characters of their own side who are not extreme.

**In battle and in the story,** magic is the player's own skills (§7), and backlash is how the cost of the
extreme is felt there (§7.3).

## 6. The discovery storyline: simple first, then deeper

Five stages, strung across the campaigns. Each stage is carried by `magic` and `sense` secrets tagged with that
stage, plus rumours, so the player assembles it rather than being told.

| Stage | What the player believes | How they learn it | Where |
|---|---|---|---|
| **1. Two kinds** (the tease) | magic is good or dark: saints' grace and devil's luck | "blessing" and "curse" only; good characters' magic secrets are called blessings, evil ones curses | early Powder maps; most first secrets |
| **2. Three sources** | there are three, Brain, Soul and Body, and none is good or evil | a neutral or Balance-Keeper character's secret says so outright; it contradicts stage 1, and the player has to weigh who to believe (rumour credibility, Character-System.md §7.3) | first homeworld outside Powder |
| **3. Intent** | the same magic heals or harms; it depends on the user | meeting a good and an evil user of the same magic, ideally in a drama thread (Coral and Kael, Water) | mid-campaign |
| **4. Blends, extremes and fields** | magics combine; pushing one too far costs; the faculties are fields that run through the whole world (Electrum, Quantum, Organum) | blend secrets; meeting an extreme and seeing the cost; High Tech and Space characters name the fields | later homeworlds |
| **5. Balance** (the hidden truth) | the three are one system that keeps itself even | never stated by one character. Pieces sit in the T3 Balance-Keepers' secrets across factions; the player who has heard enough of them can put it together. One late map confirms it with the hidden whole's name. | spread across factions, confirmed at the end |

Rules that keep the tease honest:
- **No secret before stage k states stage k's truth.** Earlier characters can be wrong. They tell stage 1 as fact,
  and that is in character, not a lie.
- Stage 1 believers who are evil and hostile tell stage 2 talk as a twist ("a heretic's tale").
- Stage 5 pieces exist only in T3 characters' secrets, at least one in each of 5 factions, so no single faction
  gives it away.

## 7. Magic in play: the MAGIC tree and three skills

> **owner** (2026-11-20): "Magic should be part of the very high level unit itemization. Magic could impact story and
> mission distribution with coercion, manipulation, mind reading, or in combat it might implement as a skill that
> gives an army a short term heal, DPS boost, range boost or speed boost. We may need another skill tree for Magic
> where we limits players to focus on developing 3 specific skills."

### 7.1 Where magic sits in the item hierarchy

Today the top of the player's item hierarchy is two trees (`src/data/techtree.js` `TREES`): **BATTLE** (Units, Bases,
Map, Ships) and **OUTPOST & FARM**. Magic becomes a **third top-level tree, MAGIC**, beside them on the same
switch buttons, with the same screen and the same save shape. It is not a division inside BATTLE, because it reaches
past battle into story and missions (§7.4).

Everything the player owns in MAGIC folds into the existing **loadout** at `createSim` (Tech-Tree-Design §2), so
battles stay deterministic and a replay carries its magic.

The enemy already uses magic without naming it. All nine faction special abilities (Special-Abilities-Design) fall on
a magic (§4):

| Magic | Enemy abilities that are already this magic |
|---|---|
| Brain | Shield Drone (High Tech), Mine Layer (Artillery), Stealth (Space: hidden from minds and sensors), Stun Drones (Greenies: nerves) |
| Soul | Shield Tank (Powder: the guard that holds), Mirror Units (Arcane: faith made visible), Freeze Missile (Air: a moment held) |
| Body | Water Blobs (Water), Resurrected (Dark) |

Eight of the nine are their faction's home magic; Greenies' Stun Drones are Brain, which is the Greenies' one
off-side character in the enemy's ranks.

So nothing changes in the sim for them; they gain a side tag, and in the story the player learns that the enemy's
"tricks" were magic all along (stage 2).

### 7.2 The tree, and the limit of three

The MAGIC tree has three divisions, one per magic, with the blends on the borders between them and the hidden whole
at the centre.

| Division | Battle skills | Story skills |
|---|---|---|
| **Brain** (Electrum) | **Overcharge**: DPS boost (focus fire) · **Reach**: range boost (aim) · Foresee: see the next wave's makeup | **Read** (mind reading) |
| **Soul** (Quantum) | **Rally**: group motivation, the 300: the army holds (takes less damage, does not break) · **Last Stand**: DPS that grows the more the army is outnumbered · Luck: critical hits | **Sway** (manipulation of feeling) |
| **Body** (Organum) | **Regrowth**: heal · **Quicken**: speed boost · Graft: harvesters carry more | **Coerce** (fear and pain) |
| Blends (two magics) | Foresight, Craft, Valor: one cast does two effects at a higher cost | — |
| Centre | **Balance** (hidden; §7.5) | — |

The owner's four battle effects are there: heal (Body), DPS (Brain, and Soul's Last Stand), range (Brain) and speed
(Body). Group motivation is Soul's own: Rally and Last Stand.

**The limit:** a player may **develop three skills**, no more.
- Learning a skill is cheap; **developing** it (levels 1–5) is where the gold and story progress go.
- Story skills count against the same three. A player who takes Read gives up a battle skill. That is the trade:
  combat power against story power.
- The three developed skills are the player's **magic slots**: the three casts they bring into battle and the
  powers they can use in dialog.
- **Respec** is allowed at a real cost (gold, and a level lost on the skill dropped), so the choice is a commitment,
  not a menu toggle.

**The build is the player's position in the triangle.** Three skills from one magic is the **extreme** build: the
strongest numbers and the worst backlash (§7.3). One from each magic is the **balanced** build: weaker each, and no
backlash, and a hidden reward the player can discover (§7.5). The hidden truth of the story is also the best
long-term build, and nothing tells the player so.

### 7.3 Battle skills

- A cast is a player command, `{ type: 'castMagic', skillId }`, logged in the replay like the wave-bonus pick
  (`src/sim/bonuses.js`). Effects count ticks; no clock, no `Math.random`.
- **Short term:** each cast lasts a few seconds and recharges per wave. Placeholder numbers, all data in
  `tables.js`, tuned by `balanceSim.js`:

| Skill | Effect at level 1 → 5 | Lasts | Charges |
|---|---|---|---|
| Regrowth | heals 15% → 35% of max HP, troops and structures in a radius, over 4 s | 4 s | 1 per wave |
| Overcharge | towers' DPS +15% → +40% | 8 s | 1 per wave |
| Reach | towers' range +10% → +25% | 10 s | 1 per wave |
| Quicken | troops' and harvesters' speed +20% → +45% | 8 s | 1 per wave |
| Rally | troops and structures take 15% → 35% less damage, and troops do not retreat | 8 s | 1 per wave |
| Last Stand | DPS +10% → +30%, doubled while the enemy on the field outnumbers the player's units three to one | 8 s | 1 per wave |
| Luck | 10% → 25% chance of a double-damage shot | 8 s | 1 per wave |

- **Backlash** (the cost of the extreme, §5): every cast adds to its magic's weight in a hidden per-battle balance.
  When one magic's weight passes twice the lowest of the other two, the next cast of it triggers a backlash from the
  other two: a short surge that helps neither side cleanly (for example, after heavy Brain: a Body surge heals the enemy wave
  too, or a Soul misfire that shakes the player's troops). The surge is drawn from the seeded `state.rng`.
- **The enemy's casts count too.** A wave full of Body abilities tips the same balance, so a player's Brain cast can
  be the one that sets the balance back.

### 7.4 Story skills: coercion, manipulation, mind reading

They act in dialog and on which missions the player is offered. Each is an **intent** choice: using it pulls the
player's own alignment (the existing `alignment` reward kind), so the player's use of magic is good, neutral or evil
exactly as a character's is (§3).

| Skill | Magic | What it does | The price |
|---|---|---|---|
| **Read** (mind reading) | Brain | reveals the next locked secret of a character now, without the rapport. Or on a rumour: shows whether the teller believes it, but not whether it is true. | the character senses it: −3 rapport; reading a good character pulls alignment −1 |
| **Coerce** (coercion) | Body: fear and pain | forces a mission from a character below the rapport it needs, or makes them keep a promise | −10 rapport, and the character carries "They forced me."; alignment −2; a coerced mission pays 75% |
| **Sway** (manipulation) | Soul: changing the feeling | shifts one character's stance toward another faction for one map, which changes who appears at the wave 3 cut-in and what missions open | if found out later (a rumour about it), −15 rapport with them; alignment −1 |

**Mission distribution:** Coerce opens missions early; Sway redirects which faction's character brings the next
secondary and its missions; Read finds secret missions (MM-story_mwohmo7a_2z) before their secret is told.

Read is held back on purpose: it tells the player whether the teller believes the rumour, not whether it is true, so
it adds a clue to the inference (Character-System §7.3) without replacing it.

Flaws matter here too (Character-System §5a): suspicious characters notice a Read; gullible ones never notice a Sway;
proud ones cannot be Coerced without a broken relation.

### 7.5 The discovery storyline drives the tree

The tree itself teases simplicity, then reveals depth (§6):

| Stage | What the MAGIC tree looks like |
|---|---|
| 1. Two kinds | Two branches, **Blessings** and **Curses**. One skill can be developed. |
| 2. Three sources | The tree redraws as a triangle, Brain, Soul and Body; the player's skill is shown on its real side. Three slots. |
| 3. Intent | Story skills appear, with their alignment pull visible. |
| 4. Blends, extremes and fields | Blends open on the borders; the field names appear under the faculties; the first backlash in battle is the player's lesson. |
| 5. Balance | **Balance**, the centre node, appears only for a player who has developed one skill on each side. It is never listed beforehand. While equipped, every cast also helps the other two sides a little, and backlash never triggers. |

## 8. Where it shows

- **Content:** blessing and curse, then Brain, Soul and Body, then the field names, in secrets and lines; the stage rules; costs told in sorrow and magic
  secrets.
- **The Standings:** a revealed magic secret reads as a blessing or curse, then by its faculty after stage 2, and by
  its field after stage 4.
- **The MAGIC tree screen:** the third tree beside BATTLE and OUTPOST & FARM.
- **Battle:** the three cast buttons in the HUD, the backlash event, and the enemy abilities tagged with their side.
- **Dialog:** Read, Coerce and Sway as choices on a character call, when developed.

## 9. Data and the consistency checks

In each `magic` and `sense` secret (Character-System.md §8):

```json
{ "key": "magic", "side": "soul", "use": "good", "depth": 1, "stage": 1, "text": "…", "line": "…" }
```

New `src/data/magic.js`: the three magics, the blends, faculty and field names, home sides, `useFor(align)`, and the
MAGIC tree's skills. New `src/sim/magic.js`: casts, effects and the hidden balance with backlash. `techtree.js`
gains the `magic` tree; the save gains `save.magic = { learned: [], developed: { [skillId]: level } }`. Checks added
to `characterSystem.test.mjs`:

1. Every `magic` and `sense` secret has a `side`, `depth` and `stage`.
2. `use` matches the character's polarity, or is declared with a reason.
3. Depth 3 only on declared extremes, and each one has a cost in a sorrow or magic secret.
4. Every faction has at least one character off its home side.
5. No secret at stage k is revealed by a map earlier than stage k's first map.
6. Stage 5 pieces only in T3 characters, at least one in each of 5 factions.
7. Before stage 2, lines say only "blessing" and "curse"; Brain, Soul and Body from stage 2; field names
   (Electrum, Quantum, Organum) only from stage 4.
8. MAGIC tree: every skill names its magic; a player's developed skills are never more than three; Balance
   is never shown to a save without one developed skill on each side.
9. Sim: every cast is a replay-logged command; a replay with casts and a backlash reproduces its final hash;
   the starter loadout with no magic still wins Maps 1–3 (`balanceSim.js`); the extreme, balanced and mixed
   three-skill builds stay within ±10% of each other over a mixed map set.

## 10. Open for the owner

1. **Names:** choose a set (§2). I recommend A: Electrum, Quantum, Organum; Valor for Soul + Body; the Bulwark as
   the hidden whole.
2. **Home sides:** Brain: High Tech, Artillery, Space · Soul: Powder, Arcane, Air · Body: Greenies, Water, Dark.
   Powder moved to Soul because its secrets are mostly group motivation and it lacks science. Keep or move?
3. **The limit of three:** do story skills (Read, Coerce, Sway) count against the same three as battle skills?
   I recommend yes, so story power costs combat power.
4. **Extremes:** confirm which existing characters are extremes (the Signal, the Unmade Choir, the Hollow Prophet,
   the Root-Mind).
5. **Item hierarchy:** I read "very high level unit itemization" as MAGIC being a third top-level tree beside
   BATTLE and OUTPOST & FARM. If you meant magic as an item that units carry, §7.1 changes.

## 11. Order of work

1. This doc and the Character-System v0.3 flaw layer, owner review.
2. `magic.js` and the checks, inside the model-and-gate story (MM-story_mwp61a5f_32).
3. Tag every magic and sense secret during the cast rework (MM-story_mwohmp8n_30).
4. The MAGIC tree screen and save (menu), on the Tech Tree's code path.
5. Battle skills and backlash (`src/sim/magic.js`, HUD cast buttons), under the combat agent, with `balanceSim`.
6. Story skills in dialog and mission distribution, with the rumours and secret-missions stories.

## Dependencies

| Relation | Document | Why |
|---|---|---|
| depends-on | docs/tech-plan/Character-System.md | the generated character model and the §8 hooks this fills |
| depends-on | docs/tech-plan/Character-Secrets.md | the `magic` and `sense` secrets that carry the system |
| depends-on | docs/16 Bulwark MM/design/Tech-Tree-Design.md | the trees, the loadout at createSim, the screen |
| depends-on | docs/16 Bulwark MM/design/Special-Abilities-Design.md | the enemy abilities that are already magic |
