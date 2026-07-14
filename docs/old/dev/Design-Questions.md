# Design Questions (auto-review)

- **[high/model]** The acceptance item requires 'All 3 towers' that place, FIRE, repair, upgrade, and sell — but the model defines only two firing towers (anti-ground, anti-air) plus a wall/moat that is a non-firing terrain piece. What is the third tower, and does the wall/moat count as a tower despite not firing?  
  _Acceptance criterion has no clean supporting rule set: either a third firing tower is missing from entities, or the wall/moat must satisfy 'fire' requirements it cannot meet._
- **[high/model]** Are repairs free or paid? V§5 says 'repairs are free but consume troops', while the economy rule and the acceptance checklist both say 'spend → build/repair/upgrade'.  
  _Direct conflict between two behavioral rules and the acceptance criteria; the economy implementation and bankruptcy behavior depend on which is true._
- **[high/model]** If structures snap only to fixed base hard-point slots that scale with base level (V§8), how can walls/moats be placed in the lanes to reroute walker paths? Are walls/moats exempt from slot snapping, or are slots distributed along the lanes?  
  _The slot-placement rule appears to contradict the core reroute mechanic ('wall/moat placement recomputes walker paths'), which is its own acceptance item._
- **[medium/shared]** Structures 'can be upgraded one tier' and acceptance says 'upgrade once', but the structure render states include 'Upgrading 1-2-3'. Is there one upgrade or three tiers?  
  _View states imply a 3-tier progression that the model rule forbids; affects data tables, pricing, and UI._
- **[high/model]** What are 'troops' exactly — a purchasable/limited resource with their own entity (position, hp, speed)? They are required for repairs and deployment marching, but no troop entity, cost, or capacity rule is defined.  
  _Two mechanics (repair-via-troop-travel, deploy-and-march) depend on troops, yet troops have no entity definition, making repair timing and deployment unbuildable as specified._
- **[medium/model]** How many waves (N) constitute a win, and what defines wave composition/timing? Is this in the data tables?  
  _'Survive N waves = win' is an acceptance item, but N and wave content are unspecified and not explicitly routed to the config/data tables._
- **[medium/scope]** Is vision implemented or stubbed for this slice ('minimal, or explicitly stubbed'), and if stubbed, does fog of war still render in the visual layer stack?  
  _Open decision left in the model; the view layer includes fog of war rendering, which conflicts with a fully stubbed vision system._
- **[medium/model]** Can the anti-air tower also target ground/water domains, or is it air-only? The rule says 'can target air' without stating its full domain list.  
  _Weapon domain targeting is data-driven per weapon; the anti-air tower's ground/water capability is left ambiguous and changes balance-sim pricing._
- **[medium/model]** Does the real-time economy and troop travel run on a fixed simulation timestep so the seed + input log fully determines outcomes across machines?  
  _Determinism and replay-from-log are acceptance items, but no tick-rate/fixed-timestep rule is stated for the 'real-time' accrual and movement systems._