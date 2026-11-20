# Tech Plan — The character system: generated layers, secret reach and rumours

**Repo copy is canonical:** `docs/tech-plan/Character-System.md`.
**Status:** v0.3, 2026-11-20. v0.2 approved by the owner (#350); v0.3 makes flaws a generated layer (§5a) and adds faction traits (§2a). Tickets:
MM-story_mwp5vobq_31, MM-story_mwpdkocr_3g.
**Builds on:** `Character-Secrets.md` (the nine secrets and the reveal rules, shipped in #348). This doc puts that work
back on a generated footing and adds secret reach and rumours.

> **owner** (2026-11-20): "When we started Bulwark we created the character and dialog system. Are we still following
> a system design approach?" … "There should be different types of secrets — known by 1 — known by close associates —
> known by opposing or allied faction member" … "Rumored .. but players who carefully track story can infer
> probability. Write the system."

## 0. Principle

**Every character fact is generated from a layer below it, or declared as an exception with a reason.** A fact that
is neither is a bug, and the consistency test (§9) fails on it. That is the GDD §10 test ("regenerable from the rules
without contradiction across all 81 characters") applied to the whole character model, not just the alignment matrix.

The layers, bottom up:

| # | Layer | Kind | Source |
|---|---|---|---|
| 1 | Alignment axes and matrix | **generated** from 11 rules | GDD §10 |
| 2 | Faction relations | **authored world input**, one reason per pair | `src/data/factionRelations.js` (exists) |
| 2a | Faction traits: known for, known to lack | **authored world input**, public | new (§2a) |
| 3 | Base relation, character → character | **generated** from 1 + 2 | new |
| 4 | Personality | **generated** from alignment; a declared alternate allowed | new rule over existing content |
| 5 | Drama threads (love, kin, hunts, …) | **declared exceptions** above 3 | GDD §12 + `threads.json` |
| 5a | Flaws (proud, greedy, rude, …) | **generated** from 1–5 on eight axes; declared overrides | new (§5a) |
| 6 | Secret reach and who knows | **generated** from 4 + 5; declared overrides | new |
| 7 | Rumours: what a knower says, true or not | **generated** from 1–6 | new |
| 8 | Magic side (Brain, Soul, Body) | **generated** from faction + conviction | `Magic-System.md` |

The missing `bulwark-dialog-system.md` (the original dialog design) is still not in the repo or on MetaMax. If it is
found it outranks this doc where they disagree, and this doc is revised to match.

## 1. Alignment (exists in the GDD, now in code)

GDD §10.1: two hidden axes.
- **Polarity:** Good {AG, PG, G, CG} · Neutral {N} · Evil {CE, E, PE, DE}.
- **Conviction:** T3 Zealots / Balance-Keepers {AG, PG, PE, DE} · T2 Committed {G, E} · T1 Chaotic {CG, CE} · T0 {N}.

GDD §10.2's eleven rules generate the symmetric 9×9 table (++ Allied · + Respect · 0 Neutral · − Distrust · −− Hostile).
New `src/data/alignment.js` implements the rules (not the table); its test regenerates the matrix and compares it cell
by cell with the GDD §10.3 table.

As numbers: ++ = +2, + = +1, 0 = 0, − = −1, −− = −2.

## 2. Faction relations (exists)

`FACTION_RELATIONS` stays the one authored world-level input: Allied · Friendly · Neutral · Wary · Hostile, rivals
Hostile, and every other pair with a one-line reason (the GDD §9 tropes). The doc does not derive it, because it is a
statement about the world, not about people. It can later be tied to the magic sides (§8).

As numbers: same faction +1 · allied +1 · friendly +1 · neutral 0 · wary −1 · hostile −1.

## 2a. Faction traits: what everyone knows (authored world input)

> **owner** (2026-11-20): "Each faction might also possess a set of common strengths as characteristics. Everyone
> knows Powder is resourceful and heavily armored, but lacking in science and strategic planning."

Each faction has a short public **reputation**: two strengths and two weaknesses that everyone in the universe
knows. Like faction relations (§2), it is authored, because it is a statement about the world. Everything below it
reads from it.

| Faction | Known for | Known to lack | Status |
|---|---|---|---|
| **Powder** | resourceful · heavily armoured | science · strategic planning | owner |
| Air | speed · daring aces | staying power (fragile) · patience | draft |
| High Tech | precision · shields | numbers (every unit is expensive) · adaptability | draft |
| Artillery | range · siege patience | speed · close defence | draft |
| Water | endurance in the cold · adaptability | unity (rival tribes) · reach away from water | draft |
| Arcane | discipline of faith · energy weapons | open minds (dogma) · hardiness | draft |
| Space | advanced science · long sight (orbital) | ground sense (detached) · speed of decision (bureaucracy) | draft |
| Dark | strength at night · endurance past death | trust (everyone distrusts them) · restraint | draft |
| Greenies | numbers (the swarm) · recovery | individual initiative (the hive) · strength alone | draft |

The drafts come from each faction's identity in Special-Abilities-Design and the GDD; the owner confirms or
rewrites them.

**What reads from the traits:**

1. **The Standings.** The faction detail shows "Known for" and "Known to lack" (public from the start).
2. **Characters, by default.** Every character is assumed to fit their faction's reputation. A character who goes
   **against type** declares it (`"againstType": "science"`, with a reason), and against-type facts are good secret
   material: the Powder officer who reads physics in secret is a `desire` or `share` secret waiting to be written.
   The gate requires at least one against-type character per faction, so no faction is only its stereotype.
3. **Flaws** (§5a.2). A weakness that is personal becomes the faction's cultural push on a flaw axis: Powder's lack
   of strategic planning pushes Mind −1 (short-sighted). A weakness that is not personal (science) pushes nothing.
   Against-type characters skip the push.
4. **Home magic** (Magic-System.md §4). The traits must agree with the faction's home magic: a faction known to lack
   science is never Brain-home. Powder is Soul-home: resourceful, armoured and stubborn in a stand.
5. **Combat data.** A strength that names a battle stat must show in the faction's units
   (`content/units/*.units.json`): "heavily armoured" means Powder's units rank in the top third of the nine
   factions on HP and armour; a weakness means the bottom third. Traits with no battle stat (science, strategy) are
   story only. A mismatch is listed by the gate; the fix is the trait's wording or a balance retune, and the owner
   chooses.
6. **Prejudice and rumours.** A prejudiced character (§5a.3) believes the weaknesses of the faction they look down on
   and says so: "Powder couldn't plan a picnic." Those lines come from the traits, so prejudice reads the same
   across the cast.

## 3. Base relation between two characters (generated)

```
base(A, B) = clamp(−2, +2, alignment(A.align, B.align) + faction(A.faction, B.faction))
```

| base | Reads as |
|---|---|
| +2 | close: would trust with a secret |
| +1 | respect |
| 0 | indifferent |
| −1 | distrust |
| −2 | hostile: would use a secret against them |

Examples:
- Seraphine (AG) and Aldric Vane (PG), both Powder: ++ +1 → **+2**.
- Rei (Air G) and Otto (Powder G): ++ and a hostile faction → **+1**. The public war is not the private respect.
- Hierophant Aurelia (AG) and Vaelith (PE), both Arcane: + +1 → **+2**, the GDD balance pact.

A character's `relations` bends toward whole factions (shipped in #348) stay as they are. They are declared
exceptions at layer 2 and already carry a `why`.

## 4. Personality (generated from alignment)

Each alignment has a **primary** personality and one **alternate**, both following from the two axes. A character
takes the primary unless they declare the alternate. Anything outside the pair must be declared with a `why` as an
exception, at most one per faction.

| Alignment | Axes | Primary | Alternate | Because |
|---|---|---|---|---|
| AG | Good, T3 | devoted | open-hearted | a zealot for the good; holds the line for others |
| PG | Good, T3 | devoted | wary | the order is everything; watches for what breaks it |
| G | Good, T2 | open-hearted | wary | committed but human; some have been burned |
| CG | Good, T1 | whimsical | open-hearted | loose, generous, quick to share |
| N | T0 | wary | whimsical | uncommitted: watches, trusts slowly, or drifts |
| CE | Evil, T1 | cruel | schemer | loose and hungry; takes what it wants |
| E | Evil, T2 | schemer | devoted | committed to a bad cause; plans, or serves |
| PE | Evil, T3 | schemer | cruel | the throne: controls through what it knows, or through fear |
| DE | Evil, T3 | cruel | schemer | the abyss: consumes, lies to feed |

The personality rules that already exist (whimsical tells magic early, and so on) stay as they are. **Proud is no
longer a personality** (owner 2026-11-20: "Pride is a flaw of its own so it feels less like an alignment
description"); its rules move to the proud extreme of the Self-regard flaw axis (§5a). Checked against the 81 characters as written today (#348 and
#349), 16 fell outside the v0.2 table, 3 of them Powder (Seraphine AG proud, Kord Stahl E proud, Graf PE cruel).
Under v0.3 every proud character takes their alignment's personality, and pride comes back as a generated flaw, and Graf (PE cruel) is now
inside the table, so the remaining exceptions are recounted by the gate (§9) and listed in the cast rework.

## 5. Drama threads (declared, above the matrix)

GDD §12: threads are **directed, asymmetric** relationships that sit above the symmetric layers. They move into one
file, `content/characters/threads.json`. The loves and hates now scattered through the secrets are moved there too,
so there is one place that answers "who is tied to whom".

```json
{ "from": "Captain Otto von Halbrecht", "to": "Rei \"Skylark\" Tanaka", "kind": "love", "tag": "DL", "public": false }
```

| Kind | Meaning | Puts the other in the circle? |
|---|---|---|
| `love` | loves (may be one-sided) | yes |
| `kin` | family (parent, sibling, house) | yes |
| `confidant` | trusted with secrets | yes |
| `comrade` | served together, owes their life | yes |
| `hunts` | revenge or pursuit | no: across the line, hostile |
| `rival` | personal rivalry | no: across the line |
| `uses` | buys from, funds, exploits | no: across the line |

**Rules:**
- A `love` secret names its thread's `to`. A `hate` secret names someone the character either hunts or has a rival
  thread with, or someone whose base relation is −2.
- **A love with base ≤ 0 must be a tagged thread.** That is the point of the tragedy: Otto ↔ Rei is +1 privately
  against a hostile war. A love that contradicts the matrix with no tag fails the test.
- The GDD §12 threads ([DL] [TA] [RE] [RV] [TW] [FL]) must all be present.

## 5a. Flaws (generated from layers 1–5)

> **owner** (2026-11-20): "Flaw might be another personality factor to determine. And should be derived from the rest
> of the characteristics. Lack of trusting, too trusting, proud, emotionally unstable, greedy, lustful, arrogant,
> closed minded, low IQ, lazy, self centered, narcissistic, over baring, rude, racist, mean spirited, endless list
> here."

A flaw is a weakness that cuts across alignment: a good character can be proud and an evil one cowardly. Flaws are
**generated**, like personality, from everything already known about the character. The list of flaw words is open
and can grow without limit, because **the rules attach to a small fixed set of flaw axes, not to each word.** A new
word costs one line of data and no new rules.

### 5a.1 The eight flaw axes

Each axis is a trait that is a flaw at either extreme. A character scores from −3 to +3 on every axis; near 0 is no
flaw.

| Axis | − extreme | + extreme |
|---|---|---|
| **Trust** | gullible: too trusting, naive, easily led | suspicious: distrustful, paranoid |
| **Self-regard** | self-doubting: insecure, servile | proud: vain, arrogant, conceited, grandiose |
| **Temper** | cold: aloof, callous, unfeeling | volatile: moody, emotionally unstable, hot-headed, wrathful |
| **Appetite** | joyless: prudish, puritan, grim | indulgent: greedy, lustful, gluttonous, decadent |
| **Mind** | flighty: short-sighted, scatterbrained, dim, slow-witted, credulous | rigid: stubborn, closed-minded, dogmatic, prejudiced, bigoted |
| **Drive** | idle: lazy, apathetic, indecisive | driven: obsessive, ruthless, consumed |
| **Regard for others** | self-effacing: doormat, people-pleaser | self-centred: rude, selfish, overbearing, mean-spirited, narcissistic |
| **Courage** | cowardly: timid, spineless | reckless: rash, foolhardy |

Every word in the owner's list has a home:

| Owner's word | Axis and extreme |
|---|---|
| lack of trusting / too trusting | Trust + / Trust − |
| proud, arrogant | Self-regard + |
| emotionally unstable | Temper + |
| greedy, lustful | Appetite + |
| closed minded | Mind + |
| racist | Mind +: **prejudiced against** a named faction (§5a.3) |
| low IQ | Mind −: dim, slow-witted |
| lazy | Drive − |
| self centered, narcissistic, overbearing, rude, mean spirited | Regard for others + |

### 5a.2 Where the scores come from

Each input pushes an axis by 1 (2 where marked). The sums are clamped to −3…+3.

| Input | Pushes |
|---|---|
| **Alignment polarity** | Evil: Regard +1, Appetite +1. Good and T3 (AG, PG): Appetite −1. |
| **Conviction** | T3: Mind +1, Self-regard +1. T1: Temper +1, Courage +1, Mind −1. N: Drive −1. |
| **Personality** | wary: Trust +1, Temper −1 · open-hearted: Trust −1, Regard −1 · whimsical: Mind −1, Drive −1, Self-regard −1 · devoted: Drive +1, Regard −1 · schemer: Trust +1, Regard +1, Temper −1 · cruel: Regard +1, Temper −1 |
| **Rank**, from the title (General, Chancellor, Field-Marshal, Chieftain: high; Sergeant, raider, crewman: low) | high: Self-regard +1, Regard +1 · low: Self-regard −1 |
| **Threads** (§5) | hunts someone: Drive +2, Temper +1 · is hunted: Trust +1 · loves two or more: Appetite +1 · loves without return: Self-regard −1 · `uses` someone: Appetite +1, Regard +1 · was used or betrayed: Trust +1 |
| **Faction** | home magic (Magic-System.md §4): Brain Mind +1 · Body Temper +1 · Soul Courage +1. Faction traits (§2a): a personal weakness is a cultural push (Powder, "lacking strategic planning": Mind −1); against-type characters skip it. |

**The flaw is the axis with the largest score, if it is at least 2.** A second flaw is added if another axis also
reaches 3. Ties go to the axis listed first. Most characters have one flaw; some have none.

### 5a.3 Which word: the severity ladder

Each extreme's ladder is its name followed by its words, mild to harsh. For Regard for others +: self-centred, rude,
selfish, overbearing, mean-spirited, narcissistic.

**Step on the ladder** = the score above 2 (0 or 1), plus 1 for N, plus 2 for Evil, plus 1 for T3, capped at the last
word. So the same axis reads as "proud" on a good captain and "grandiose" on an evil chancellor.

**Context words go first** when their condition holds:
- **overbearing:** Regard + and high rank.
- **lustful:** Appetite + and loves two or more.
- **prejudiced against <faction>:** Mind + and the character's faction is hostile to that faction. A prejudiced
  character's base relation to everyone in that faction drops by 1. The prejudice can be broken in play: rapport 60
  with a member of that faction removes it, which makes a story beat rather than a fixed trait.
- **wrathful:** Temper + and hunts someone.

**Worked examples** (Powder: Soul-home, and the strategic-planning push):
- **Otto** (G, open-hearted, Captain, loves Rei and is loved back): no axis reaches 2. **No flaw.** His tragedy is
  the war, not a weakness.
- **Seraphine** (AG, devoted, Field-Marshal): Self-regard 2. Step 0 + 1 (T3) = 1: **vain**.
- **Graf** (PE, cruel, Chancellor): Regard for others 3, with high rank: **overbearing**. Self-regard 2 is not
  enough for a second flaw.

### 5a.4 What a flaw does in play

The rules belong to the 16 extremes. Every word at an extreme plays the same way, and the word sets the voice.

| Extreme | In the secrets and rapport | In the prose (§7.4) |
|---|---|---|
| gullible | repeats an owner's lie as true; tells secrets one step early | none of its own |
| suspicious | close secrets become private; rapport gains −25% | a hedge |
| self-doubting | sorrow told first | a trailing "…or not." |
| proud | sorrow and love told last; their reach becomes private | a restart: "Everyone knows… I know." |
| cold | gifts give half rapport | clipped: drops the opening word |
| volatile | each kept or broken promise moves rapport ×1.5 | a flare: a short line in capitals |
| joyless | gifts of luxuries give no rapport | none of its own |
| indulgent | want told first; a rumoured want given early is worth double | none of its own |
| flighty | tells others' secrets without meaning to (their rumours skip shielding) | a lost thread: "Where was I." |
| rigid | holds to stage 1 of the magic story longer (Magic-System.md §6) | a flat repeat: "She did it. She did." |
| idle | offers fewer missions | a sigh: "Fine." |
| driven | tells their hate early when it is about the one they hunt | none of its own |
| self-effacing | shields others' secrets even across factions | an apology first |
| self-centred | tells others' secrets freely, their own last; broken promises cost ×2 | a jab before the name |
| cowardly | share and sorrow held behind the fear guard | hedges, whatever the personality |
| reckless | the first secret comes a step early | none of its own |

**Credibility:** a teller who is **gullible** or **flighty** gets passed lies and repeats them. Good characters still
never lie, but these two can be **wrong**: their credibility drops from 1.0 to 0.8. That gives careful players one
more thing to weigh: honest is not the same as right.

**Magic** (Magic-System.md §4): depth 3 is reached through proud (overreach), driven (consumed) or reckless (rash).
Indulgent users hoard one magic and never blend. Cowardly users stop short of depth 3.

### 5a.5 Declared flaws

A writer can declare a flaw in place of the generated one, with a reason (`"flaw": { "word": "lazy", "why": "…" }`),
at most two per faction. The gate lists every declared flaw beside the one the rules would have given, so the
writer can see what they are overriding.

## 6. Secret reach (new)

Every secret has a **reach**: who besides the character knows it, and so who else can tell the player.

| Reach | Known by | The player learns it |
|---|---|---|
| **private** | only the character | only from them, by rapport (today's rules, `secrets.js`) |
| **close** | their **circle**: everyone with a `love` / `kin` / `confidant` / `comrade` thread with them, plus same-faction characters with base +2 | from the character, or as a **rumour** from anyone in the circle |
| **across** | a member of **another faction**: anyone with a thread to them across the line (love, hunts, rival, uses) | from the character, or as a **rumour** from that outsider |

**Default reach by secret** (generated; a secret may override it with `reach` and a `why`):

| Secret | Default | Why |
|---|---|---|
| want | close | people see what you trade for |
| love | close | the people near you notice |
| hate | across | the one you hate knows it |
| share | close | it was shared with someone |
| sorrow | close | the circle was there |
| desire | private | |
| treasure | private | |
| magic | private | |
| sense | private | |

**Personality shifts the defaults by one step:**
- whimsical: private → close for magic and sense;
- open-hearted: private → close for desire;
- schemer: close → private for sorrow and love (flaws shift reach too, §5a.4).

**Generated check:** a close or across secret with nobody who knows it falls back to private, and the test lists it so
a writer can add a thread or accept the fallback.

## 7. Rumours (new): heard, not confirmed

A **rumour** is a secret told by someone other than its owner. It is shown in the Standings as rumoured until the
owner tells it in person.

### 7.1 When a knower tells

A knower K tells a rumour about owner O's secret when:
- the player's rapport with **K** has reached the step that secret holds in **O's** order;
- O has not already told it;
- K is not shielding O. A K who is `devoted` and in O's own faction keeps O's secrets until O's own guard would let
  the secret out.

**Channels:**
- **across:** the wave 3 cut-in. The secondary is chosen from O's across-knowers where one exists, so the map's
  outsider is the one who knows something.
- **close:** the map's main character, at the opening, when they have no untold secret of their own. They speak about
  someone in their circle instead ("Seraphine won't say it, but Otto loves an Air pilot").
- **close:** a greeting aboard the faction's capital ship.

### 7.2 What the knower says: true, twisted or false

Generated from who is telling and how they stand with the owner; no randomness.

| Teller | Version told |
|---|---|
| Good alignment (AG, PG, G, CG) | **always the truth** (the "good never lie" rule already in the content) |
| Neutral | the truth, or **the owner's own lie** repeated if the owner lied to them and the truth is not out |
| Evil, base with owner ≥ 0 | the truth, but only when it serves them, or the owner's lie |
| Evil, base with owner ≤ −1 | **twisted**: the secret's written `twist` (the enemy's version) |
| Evil and the secret's owner is the target of a `hunts` thread | **false**, if the secret has a `twist`; otherwise twisted |

A secret that can reach an evil hostile knower needs a `twist` written: one short line, what their enemy says about
it. The test lists the missing ones.

### 7.3 How careful players can infer the odds (owner: "infer probability")

**The game never shows a probability.** It shows every clue the truth is generated from, and the rules above never
break, so a player who tracks the story can work it out:

1. **Who said it.** The Standings show the teller and, once they have been met, their alignment. Good characters never
   lie; players can learn that rule from the story, so one honest source settles it.
2. **How the teller stands with the owner.** It is shown next to the rumour: "Rei · loves him", "Vex Marrow · hunts her".
   Enemies twist.
3. **Their record.** A teller caught out once carries "They lied before." (exists).
4. **Corroboration.** Two independent tellers (not in each other's circle) who say the same thing. The Standings group
   rumours that agree.
5. **Contradiction.** A rumour that conflicts with something the owner has confirmed is marked as contradicted.
6. **How they say it.** Hesitation in the line itself (§7.4): "Well, I, uh .. I heard she" reads differently from a
   flat statement. Nothing marks it; the prose carries it.

There is a hidden credibility in code, used by the tests and by the payoff, never shown:

| Factor | Value |
|---|---|
| Good teller | 1.0 |
| Neutral teller | 0.8 |
| Evil teller who is friendly to the owner | 0.6 |
| Evil teller who is hostile to the owner | 0.3 |
| Teller who lied before | × 0.5 |
| Several tellers | combined as 1 − ∏(1 − pᵢ) |

The test checks that this number follows only from the visible clues, so anything a player can infer is also what
the code believes.

### 7.4 How it is said: tells in the prose (owner: "delays, contradictions … '..' 'um' 'well,' 'I, uh ..'")

The hidden credibility also shapes the line. A rumour is written once, clean; the game adds **tells** when it is
spoken. Tells are the subtle clue: no icon, no colour, just how the character talks.

**How many tells.** Generated, no randomness:

| Input | Tells |
|---|---|
| Credibility ≥ 0.9 (a good teller, or several agreeing) | 0 |
| Credibility 0.5–0.9 | 1 |
| Credibility < 0.5 | 2 |
| The version told is a twist or a lie | +1 |
| The teller is `schemer` or `cruel` | the +1 for lying is dropped: **they lie smoothly** |
| The teller is `open-hearted` or `whimsical` | +1 filler always, even telling the truth: **it is how they talk** |
| Cap | 2 tells per line, so lines stay short |

So a tell means nothing until it is read against the speaker. A schemer's calm is no comfort; an open-hearted "um" is just
their voice; but a wary or devoted character who suddenly hedges is passing on something they don't trust. Players who
know the cast learn each one's normal voice, and the change from it is the clue. That is the inference.

**Which tells.** Personality picks the kind, so each voice stays itself:

| Personality | Tells it uses |
|---|---|
| open-hearted, whimsical | fillers: "um", "uh", "I, uh .." |
| wary | hedges: "Well,", "They say", "If it's true," |
| a flaw with its own tell (§5a.4) | the flaw's tell replaces the personality's |
| devoted | a pause: ".." before the name |
| schemer, cruel (lying, at credibility < 0.5) | a contradiction only: "At the docks. Or the yard. The docks." |

**The pause is timed.** ".." is a beat in the comm card's typing: the line holds about 400 ms there. Today
`typeText` in `src/comm/commCard.js` types at a steady rate; it gains a hold on "..". Under reduced motion the hold
is dropped and the dots stay.

**The owner's own lies** carry tells by the same rule when told in person. So Graf (PE, cruel) offers her amnesty
without a flicker, and a nervous liar gives themself away.

**Where tells appear.** Only on rumours and on lies told in person. Authored battle lines are never altered.

**Code.** `src/comm/tells.js` (new): `tellsFor(line, { credibility, version, personality, seed })` returns the spoken
line. The seed is owner + secret + teller, so the same rumour always reads the same. It is not in the sim tick, so
replays are unaffected.

### 7.5 The owner's reaction (it was told behind their back)

When the player has heard a rumour and the owner later tells it in person, the owner reacts by the secret's guard:

| Guard | Reaction | Rapport |
|---|---|---|
| shame | "Who told you?" | −5 with the owner; −5 with the teller, if same faction |
| fear | relief: "Then you know. Good." | +3 |
| control | the owner learns the player knows; their next told secret is their lie, if they have one | 0 |
| love | protective of the one they love | 0; −3 with the teller |
| none | none | 0 |

If the rumour was twisted or false, the owner's version replaces it. The Standings show "Vex's version was a lie", and
the teller gets the lied-before mark.

### 7.6 The payoff for inferring well (with the secret-missions follow-up)

- A **rumoured want** can be given early. A true rumour earns the gift bonus; a false one wastes the item.
- A **rumoured treasure or share** opens its mission from the rumour. A true rumour pays the reward; a twisted one
  sends the player somewhere wrong (an ambush wave or nothing).
- So inference has a price and a reward, and no menu ever says "73% likely".

### 7.7 Save data

`s.rumours[owner] = [{ key, teller, version: 'true' | 'twist' | 'lie' | 'false', at }]`, next to the existing
`s.secretsHeard`. It is pure data, and `secrets.js` gains `rumoursFor(…)`, `credibility(…)` and `noteRumour(…)`.

## 8. Magic side (hook only; the design is `Magic-System.md`)

The three magics (Brain, the electric field; Soul, the quantum field; Body, the organic field) are neutral; good and evil are how a
character uses them. Each `magic` and `sense` secret gains:

- `side`: one magic or one blend;
- `use`: good, neutral or evil, generated from the character's polarity (declared exceptions allowed);
- `depth`: 0–3, where 3 is extreme and must carry its cost;
- `stage`: which step of the discovery storyline the secret supports.

Rules and checks are in `Magic-System.md` §9; the player's own magic skills are its §7.

## 9. The consistency test (the gate)

`src/data/characterSystem.test.mjs`, part of the local suite. It replaces the per-file checks in
`characters.test.mjs` where they overlap.

1. The alignment matrix regenerated from the §10.2 rules equals the GDD §10.3 table.
2. Every personality is its alignment's primary or alternate, or a declared exception (≤ 1 per faction). Every
   flaw is the one §5a generates, or a declared override with a reason (≤ 2 per faction); its word is on its
   extreme's ladder; a prejudice names a faction its own faction is hostile to.
3. Every thread names real characters, and all GDD §12 threads are present.
4. Every love and hate secret agrees with a thread or the base relation. A love with base ≤ 0 is a tagged thread.
5. Every close or across secret has at least one knower through a real relationship (fallbacks listed).
6. Every secret an evil hostile knower can tell has a `twist`.
7. A good teller never yields a twisted or false rumour. Credibility follows only from the visible clues.
   Tells follow only from credibility, version and personality; a credibility-1.0 truth has none beyond the open-hearted/whimsical filler; a schemer's or
   cruel teller's lie adds none; no line gains more than 2 tells; authored battle lines are never changed.
8. Every homeworld map's secondary is an across-knower of a main-character secret where one exists.
9. Every faction has two strengths and two weaknesses (§2a) and at least one against-type character; its traits
   agree with its home magic; a strength or weakness that names a battle stat agrees with its units' data.

## 10. Data changes

| File | Change |
|---|---|
| `src/data/alignment.js` (new) | axes, the 11 rules, `alignmentRelation(a, b)` |
| `src/data/characterModel.js` (new) | `baseRelation`, `personalityFor`, `circleOf`, `reachOf`, `knowersOf` |
| `content/characters/threads.json` (new) | every drama thread |
| `src/data/factionTraits.js` (new) | each faction's known-for and known-to-lack, with the stat each names |
| `src/data/flaws.js` (new) | the eight axes, their ladders and context words, `flawsFor(character)` |
| `content/characters/<faction>.json` | secrets gain optional `reach` / `why` / `twist`; `love`/`hate` point at threads |
| `src/save/secrets.js` | rumours, credibility, owner reaction |
| `src/comm/mapCast.js` | rumour channels (opening, wave 3 cut-in) |
| `src/comm/tells.js` (new) | hesitation, hedges and contradictions added to spoken rumours and lies |
| `src/comm/commCard.js` | `typeText` holds on ".." (not under reduced motion) |
| `src/menu/standingsScreen.js` | rumoured secrets, tellers, corroboration, contradictions |

`voicepacks.json` stays the source of alignment, motivation and phrases. The `characters/*.json` files own the
battle lines and the fiction. Nothing is copied between them.

## 11. Order of work (each its own story)

1. **This doc**, reviewed by the owner.
2. **The model and the gate:** `alignment.js`, `characterModel.js`, `threads.json` built from today's 81 casts, and
   the consistency test reporting what fails.
3. **Rework the casts to pass the gate:** #349's 72 characters plus any Powder changes. Powder changes are listed for
   the owner, who approved that file. #349 is folded in here rather than merged as it stands.
4. **Rumours in play:** the channels, the Standings, the owner's reaction, tells in the prose, save data.
5. **Payoffs:** inside the secret-missions follow-up (MM-story_mwohmo7a_2z).
6. **Magic sides:** after the magic system design.

## Dependencies

| Relation | Document | Why |
|---|---|---|
| depends-on | docs/tech-plan/Character-Secrets.md | the nine secrets and reveal rules this extends |
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | rapport, standing and the alignment matrix |
| depends-on | docs/tech-plan/Dialog-Unification.md | one dialog path for every call |
