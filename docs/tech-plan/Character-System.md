# Tech Plan — The character system: generated layers, secret reach and rumours

**Repo copy is canonical:** `docs/tech-plan/Character-System.md`.
**Status:** v0.1, 2026-11-20, agent-proposed for owner review. Ticket: MM-story_mwp5vobq_31.
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
| 3 | Base relation, character → character | **generated** from 1 + 2 | new |
| 4 | Personality | **generated** from alignment; a declared alternate allowed | new rule over existing content |
| 5 | Drama threads (love, kin, hunts, …) | **declared exceptions** above 3 | GDD §12 + `threads.json` |
| 6 | Secret reach and who knows | **generated** from 4 + 5; declared overrides | new |
| 7 | Rumours: what a knower says, true or not | **generated** from 1–6 | new |
| 8 | Magic side | **generated** from faction + conviction (draft) | new; waits on the magic design |

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
| PG | Good, T3 | devoted | proud | the order is everything; pride in keeping it |
| G | Good, T2 | open-hearted | wary | committed but human; some have been burned |
| CG | Good, T1 | whimsical | open-hearted | loose, generous, quick to share |
| N | T0 | wary | proud | uncommitted: watches, trusts slowly |
| CE | Evil, T1 | cruel | schemer | loose and hungry; takes what it wants |
| E | Evil, T2 | schemer | devoted | committed to a bad cause; plans, or serves |
| PE | Evil, T3 | schemer | proud | the throne: controls through what it knows |
| DE | Evil, T3 | cruel | schemer | the abyss: consumes, lies to feed |

The personality rules that already exist (whimsical tells magic early, proud tells sorrow last, and so on) stay as
they are. Checked against the 81 characters as written today (#348 and #349), **16 fall outside this table**, 3 of
them Powder (Seraphine AG proud, Kord Stahl E proud, Graf PE cruel). Each one either moves to their primary or
alternate, or is declared as an exception. One open question: three AG characters (Seraphine, Aurelia, Elias) are
proud, so AG may want proud as its alternate instead of open-hearted.

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
- proud, schemer: close → private for sorrow and love.

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

### 7.4 The owner's reaction (it was told behind their back)

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

### 7.5 The payoff for inferring well (with the secret-missions follow-up)

- A **rumoured want** can be given early. A true rumour earns the gift bonus; a false one wastes the item.
- A **rumoured treasure or share** opens its mission from the rumour. A true rumour pays the reward; a twisted one
  sends the player somewhere wrong (an ambush wave or nothing).
- So inference has a price and a reward, and no menu ever says "73% likely".

### 7.6 Save data

`s.rumours[owner] = [{ key, teller, version: 'true' | 'twist' | 'lie' | 'false', at }]`, next to the existing
`s.secretsHeard`. It is pure data, and `secrets.js` gains `rumoursFor(…)`, `credibility(…)` and `noteRumour(…)`.

## 8. Magic side (hook only; waits on the owner's decisions)

Working names: **Structure · Quantum · Chaos**, and the pair blends **Foresight** (Structure+Quantum), **Craft**
(Structure+Chaos) and **Miracle** (Quantum+Chaos). The magic system design is its own doc. This model only reserves:

- `side` on each `magic` and `sense` secret: one side or one blend.
- A character's place in the triangle, generated:
  - the faction's **home side** (draft: Structure for Powder, Artillery and Arcane; Quantum for Space, High Tech and
    Air; Chaos for Greenies, Water and Dark);
  - pulled by **conviction**: the T3 Balance-Keepers sit near the centre and hold the tension (GDD §10.1, "both poles
    to stay balanced"); T2 sit at their faction's side; T1 lean toward Chaos (looseness); N drift with their faction.

Open for the owner: in-world names; whether balance is the hidden truth; how much the sides touch battle.

## 9. The consistency test (the gate)

`src/data/characterSystem.test.mjs`, part of the local suite. It replaces the per-file checks in
`characters.test.mjs` where they overlap.

1. The alignment matrix regenerated from the §10.2 rules equals the GDD §10.3 table.
2. Every personality is its alignment's primary or alternate, or a declared exception (≤ 1 per faction).
3. Every thread names real characters, and all GDD §12 threads are present.
4. Every love and hate secret agrees with a thread or the base relation. A love with base ≤ 0 is a tagged thread.
5. Every close or across secret has at least one knower through a real relationship (fallbacks listed).
6. Every secret an evil hostile knower can tell has a `twist`.
7. A good teller never yields a twisted or false rumour. Credibility follows only from the visible clues.
8. Every homeworld map's secondary is an across-knower of a main-character secret where one exists.

## 10. Data changes

| File | Change |
|---|---|
| `src/data/alignment.js` (new) | axes, the 11 rules, `alignmentRelation(a, b)` |
| `src/data/characterModel.js` (new) | `baseRelation`, `personalityFor`, `circleOf`, `reachOf`, `knowersOf` |
| `content/characters/threads.json` (new) | every drama thread |
| `content/characters/<faction>.json` | secrets gain optional `reach` / `why` / `twist`; `love`/`hate` point at threads |
| `src/save/secrets.js` | rumours, credibility, owner reaction |
| `src/comm/mapCast.js` | rumour channels (opening, wave 3 cut-in) |
| `src/menu/standingsScreen.js` | rumoured secrets, tellers, corroboration, contradictions |

`voicepacks.json` stays the source of alignment, motivation and phrases. The `characters/*.json` files own the
battle lines and the fiction. Nothing is copied between them.

## 11. Order of work (each its own story)

1. **This doc**, reviewed by the owner.
2. **The model and the gate:** `alignment.js`, `characterModel.js`, `threads.json` built from today's 81 casts, and
   the consistency test reporting what fails.
3. **Rework the casts to pass the gate:** #349's 72 characters plus any Powder changes. Powder changes are listed for
   the owner, who approved that file. #349 is folded in here rather than merged as it stands.
4. **Rumours in play:** the channels, the Standings, the owner's reaction, save data.
5. **Payoffs:** inside the secret-missions follow-up (MM-story_mwohmo7a_2z).
6. **Magic sides:** after the magic system design.

## Dependencies

| Relation | Document | Why |
|---|---|---|
| depends-on | docs/tech-plan/Character-Secrets.md | the nine secrets and reveal rules this extends |
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | rapport, standing and the alignment matrix |
| depends-on | docs/tech-plan/Dialog-Unification.md | one dialog path for every call |
