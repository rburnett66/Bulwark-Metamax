# Tech Plan — The magic system: three neutral magics, intent, cost and a slow discovery

**Repo copy is canonical:** `docs/tech-plan/Magic-System.md`.
**Status:** v0.1, 2026-11-20, agent-proposed for owner review. Ticket: MM-story_mwpdkocr_3g.
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

There are **three magics**, each drawn from its own source. None of them is good or evil. **Intent** is a second,
separate axis: any magic can be used to heal or to harm, and the character's alignment decides which. Two magics
used together make a **blend**. Pushing one magic to the **extreme** costs the user and pulls the other two back
against them, because the three are one system that keeps itself in **balance**. Nobody says that last part out loud.
The player starts out believing the common story (good magic against dark magic) and finds the real shape one
secret at a time.

## 1. The three magics

The owner's two framings line up: Structure is the electric theme, Chaos the organic, Quantum the quantum.

| Theme | Nature | What it does | Feels like |
|---|---|---|---|
| **Electric** (Structure) | pattern, law, memory | holds things in shape: shields, binds, stores, repeats | a current that runs fixed paths |
| **Organic** (Chaos) | change, growth, decay | makes things become something else: heals, grows, rots, mutates | sap, spores, a tide |
| **Quantum** | possibility, chance | chooses between what might happen: luck, foresight, erasure | a shimmer at the edge of sight |

The existing Powder secrets already fit:
- Ines Roth's tally pencil, which keeps counting while she sleeps, is electric (memory, repetition);
- Aldric Vane's oath that neither side can break is electric (law);
- Otto's "bullets turn aside from anyone he swears to protect, once" is quantum (one chance chosen);
- Grigor Vosk walking through fire unburned is organic (the body changed).

Nothing written so far has to change to fit the three.

## 2. Name options (owner to choose)

Each magic gets a **folk name** (what soldiers and farmers call it, used early) and a **true name** with its
**source** (what the few who understand it call it, used once the player learns there are three). The two layers are
part of the discovery (§6): the player first hears only folk names. Every option was checked against the content and
the GDD for clashes.

### Electric

| True name | Source (where it comes from) | Folk name |
|---|---|---|
| **Current** | the **Storm-Lines**: lightning that runs the same paths across every world, older than the worlds | "the hum" |
| **Lattice** | the **Lode**: a crystal core inside each world that holds memory as charge | "iron luck" |
| **Lodecraft** | the **Lodestone** under each homeworld; it remembers every shape it has held | "the old law" |

### Organic

| True name | Source | Folk name |
|---|---|---|
| **Quick** (as in "the quick and the dead") | the **Mycel**: one fungal web under every world, alive and very slow | "green luck" |
| **Wildsap** | the **Seedfall**: spores that fell from between the stars and took root everywhere | "the rot" (evil users) / "the bloom" (good) |
| **Thrive** | the **Undergrowth**: the living layer every world grows from and rots back into | "root-sense" |

### Quantum

| True name | Source | Folk name |
|---|---|---|
| **The Fold** | the **Fold**: the place where the things that nearly happened are kept | "maybe" |
| **Shimmer** | the **Rift**: a tear the light bends around, seen only from the corner of the eye | "devil's luck" |
| **Drift** | the **Unwritten**: everything that has not been decided yet | "the coin" |

### The blends (working names, kept from the first proposal)

| Blend | Magics | What it does |
|---|---|---|
| **Foresight** | electric + quantum | sees the pattern of what will happen |
| **Craft** | electric + organic | gives living things a lasting shape: grafts, living armour, bred beasts |
| **Miracle** | quantum + organic | the impossible recovery, the life that should not be |

### The hidden whole (the name of the balance, never said until late)

| Option | Why |
|---|---|
| **The Bulwark** | the three hold each other up like a wall; the game's own name turns out to mean the truth |
| **The Brace** | three beams leaning on each other; remove one and the others fall |
| **The Weft** | three threads woven into one cloth |

My recommendation: **Current (Storm-Lines), Quick (the Mycel), the Fold**, with **the Bulwark** as the hidden whole.
They are short, each sounds like its theme, and the folk names ("the hum", "green luck", "maybe") are easy to say in
a one-line comm call.

## 3. Intent: good, neutral and evil on all three

Intent is not a fourth magic and not a property of the magic. It comes from the user.

| Magic | Good use | Neutral use | Evil use |
|---|---|---|---|
| Electric | shield, bind a wound shut, keep a memory safe | power, industry, records | shackle, burn, overwrite a mind |
| Organic | heal, grow, feed | harvest, weather, breeding | blight, plague, feed on others to grow |
| Quantum | foresee for others, give luck away | gamble, guess, scout | unmake, steal someone's luck, erase |

**Generated:** a character's `use` comes from their alignment's polarity: Good → good, N → neutral, Evil → evil.
A character may declare a different use with a reason; for example, a good healer who once blighted a field.

This is how the common story gets it wrong. People see good and evil uses of the same magic and take them for two
different magics.

## 4. Where characters stand: home side, depth, conviction

- **Home side by faction** (revised for the themes; it was Structure, Quantum and Chaos by faction):
  - **Electric:** High Tech, Artillery, Powder;
  - **Organic:** Greenies, Water, Dark;
  - **Quantum:** Space, Arcane, Air.
  - A character's magic secret takes the home side unless declared otherwise; at least one character per faction
    uses another side, so no faction is a monoculture.
- **Depth** 0–3: 0 touched, 1 practised, 2 adept, 3 **extreme**. Most characters are 0–1.
- **Conviction** (GDD §10.1) places them in the triangle:
  - **T3 Balance-Keepers** (AG, PG, PE, DE) sit near the centre. They know, or half-know, the hidden balance; that
    is why the GDD has zealots of both poles respect each other.
  - **T2** sit at their faction's side.
  - **T1** lean toward organic (looseness, change).
  - **N** drift with their faction.
- A **flaw** (Character-System.md §5a) is what pushes a character to depth 3: proud overreaches, driven is consumed,
  reckless rushes in. Indulgent users hoard one magic; cowardly users stop short. Depth is declared, not generated,
  and the gate checks that every depth-3 character has one of the three flaws that lead there.

## 5. Extremes: high cost and consequences

Depth 3 always costs something, in three ways.

**1. The user pays.** Each magic takes its own price:

| Magic | The cost of the extreme |
|---|---|
| Electric | **rigidity**: the user stops being able to change; memory overwrites self; they repeat |
| Organic | **becoming**: the body changes toward what it grows or rots; it stops being only them |
| Quantum | **unmooring**: they forget which version of events is real, then start to fade from it |

Some existing names could already be such extremes, for the owner to confirm: the **Root-Mind** (organic), the
**Unmade Choir** (quantum), **Signal** (electric), the **Hollow Prophet** (quantum or a blend).

**2. The other two magics push back.** This is the hidden balance at work. Pushing one magic hard makes the other two
surge around the user: an extreme electric user's ground sprouts and rots, and chance turns against them; an extreme
organic user draws storms and bad luck; an extreme quantum user finds things locking rigid and growing wild. Nobody
in the world calls it "balance"; they call it a curse, bad weather or the price.

**3. People react.** An extreme user loses rapport with anyone who has seen the cost: −2 base relation with
characters of their own side who are not extreme.

**In battle** (proposal, still for the owner to decide; see §9): a map tracks a hidden balance between the three
magics. Each faction's special ability leans on its home side. Heavy one-sided use tips it, and past a threshold the
other two push back with a **backlash** event: a short surge that helps neither side cleanly. It would run on the
seeded RNG (`src/sim/rng.js`) so replays stay exact.

## 6. The discovery storyline: simple first, then deeper

Five stages, strung across the campaigns. Each stage is carried by `magic` and `sense` secrets tagged with that
stage, plus rumours, so the player assembles it rather than being told.

| Stage | What the player believes | How they learn it | Where |
|---|---|---|---|
| **1. Two kinds** (the tease) | magic is good or dark: saints' grace and devil's luck | folk names only; good characters' magic secrets are called blessings, evil ones curses | early Powder maps; most first secrets |
| **2. Three sources** | there are three, and none is good or evil | a neutral or Balance-Keeper character's secret says so outright; it contradicts stage 1, and the player has to weigh who to believe (rumour credibility, Character-System.md §7.3) | first homeworld outside Powder |
| **3. Intent** | the same magic heals or harms; it depends on the user | meeting a good and an evil user of the same magic, ideally in a drama thread (Coral and Kael, Water) | mid-campaign |
| **4. Blends and extremes** | magics combine, and pushing one too far costs | blend secrets; meeting an extreme and seeing the cost | later homeworlds |
| **5. Balance** (the hidden truth) | the three are one system that keeps itself even | never stated by one character. Pieces sit in the T3 Balance-Keepers' secrets across factions; the player who has heard enough of them can put it together. One late map confirms it with the hidden whole's name. | spread across factions, confirmed at the end |

Rules that keep the tease honest:
- **No secret before stage k states stage k's truth.** Earlier characters can be wrong. They tell stage 1 as fact,
  and that is in character, not a lie.
- Stage 1 believers who are evil and hostile tell stage 2 talk as a twist ("a heretic's tale").
- Stage 5 pieces exist only in T3 characters' secrets, at least one in each of 5 factions, so no single faction
  gives it away.

## 7. Where it shows today, and later

- **Now (content only):** the folk names and true names in secrets and lines; the stage rules; costs told in
  sorrow and magic secrets.
- **The Standings:** once a character's magic secret is revealed, it reads with its folk name or, after stage 2, its
  true name. No triangle diagram until the player reaches stage 2. A blank triangle that fills in as they learn could
  be the player's map of what they know.
- **Battle:** only if the owner chooses it (§9).

## 8. Data and the consistency checks

In each `magic` and `sense` secret (Character-System.md §8):

```json
{ "key": "magic", "side": "quantum", "use": "good", "depth": 1, "stage": 1, "text": "…", "line": "…" }
```

New `src/data/magic.js`: the three magics, the blends, folk and true names, home sides, `useFor(align)`. Checks added
to `characterSystem.test.mjs`:

1. Every `magic` and `sense` secret has a `side`, `depth` and `stage`.
2. `use` matches the character's polarity, or is declared with a reason.
3. Depth 3 only on declared extremes, and each one has a cost in a sorrow or magic secret.
4. Every faction has at least one character off its home side.
5. No secret at stage k is revealed by a map earlier than stage k's first map.
6. Stage 5 pieces only in T3 characters, at least one in each of 5 factions.
7. Folk names only before stage 2 in lines; true names only from stage 2.

## 9. Open for the owner

1. **Names:** choose one per magic, plus the hidden whole. My recommendation is in §2.
2. **Home sides:** I revised them for the themes (High Tech is now electric, Arcane quantum). Keep or move?
3. **Battle:** should magic touch battle (the hidden balance and backlash events, §5), or stay story only for now?
4. **Extremes:** confirm which existing characters are extremes (Root-Mind, Unmade Choir, Signal, Hollow Prophet).

## 10. Order of work

1. This doc and the Character-System v0.3 flaw layer, owner review.
2. `magic.js` and the checks, inside the model-and-gate story (MM-story_mwp61a5f_32).
3. Tag every magic and sense secret during the cast rework (MM-story_mwohmp8n_30).
4. Battle balance and backlash, only if chosen: its own story under the combat agent.

## Dependencies

| Relation | Document | Why |
|---|---|---|
| depends-on | docs/tech-plan/Character-System.md | the generated character model and the §8 hooks this fills |
| depends-on | docs/tech-plan/Character-Secrets.md | the `magic` and `sense` secrets that carry the system |
