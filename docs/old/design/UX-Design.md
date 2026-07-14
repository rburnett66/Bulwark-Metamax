# Interaction Flows

## Screens

### MENU <!--id:scr_ab5f1vj-->

### CHOOSE LOCATION <!--id:scr_u4678ee-->
Purpose: Select the continent/biome to deploy into; fog of war means the chosen faction and terrain are scouted, not free (GDD §5).

### PLAY <!--id:scr_zc7dhlv-->
Purpose: The core Day Battle / Day Build loop — scout, fortify, defend, collect (GDD §3).

### SETTINGS <!--id:scr_er2mf9n-->
Purpose: Volume Control

### STORE <!--id:scr_rskt6dn-->

### INVENTORY <!--id:scr_ae09vxa-->

### CHARACTER <!--id:scr_m8rpgxd-->
Purpose: Review the faction's 9 heroes across the alignment spectrum (GDD §10–§11).

### CHOOSE GEAR <!--id:scr_gc083l1-->
Purpose: Select units and structures to deploy before/between waves.

### RESULTS <!--id:scr_29xml07-->
Purpose: Post-battle summary — bounties, captures, and story unlocks earned by clearing the wave (GDD §3).

### LOADING SCREEN <!--id:scr_xn5t664-->

### HELP <!--id:scr_bky3bf6-->

### LEADERBOARD <!--id:scr_wp1ium2-->
Purpose: Present the list of top players scores

## Transitions

- MENU → CHOOSE LOCATION  <!--id:trn_73qqsfm from:scr_ab5f1vj to:scr_u4678ee-->
- MENU → STORE  <!--id:trn_p1wd9as from:scr_ab5f1vj to:scr_rskt6dn-->
- STORE → MENU  <!--id:trn_cs3vv9v from:scr_rskt6dn to:scr_ab5f1vj-->
- MENU → SETTINGS  <!--id:trn_mfaifnh from:scr_ab5f1vj to:scr_er2mf9n-->
- SETTINGS → MENU  <!--id:trn_7dv8fso from:scr_er2mf9n to:scr_ab5f1vj-->
- MENU → CHARACTER  <!--id:trn_e8c4jcs from:scr_ab5f1vj to:scr_m8rpgxd-->
- CHARACTER → MENU  <!--id:trn_a7p86hy from:scr_m8rpgxd to:scr_ab5f1vj-->
- MENU → INVENTORY  <!--id:trn_20wpm1t from:scr_ab5f1vj to:scr_ae09vxa-->
- INVENTORY → MENU  <!--id:trn_hayg91i from:scr_ae09vxa to:scr_ab5f1vj-->
- CHOOSE LOCATION → CHOOSE GEAR  <!--id:trn_rplnnnc from:scr_u4678ee to:scr_gc083l1-->
- CHOOSE GEAR → PLAY  <!--id:trn_k0iefok from:scr_gc083l1 to:scr_zc7dhlv-->
- PLAY → PLAY : CHOOSE GEAR  <!--id:trn_ctl_ctl_qs423mb from:scr_zc7dhlv to:scr_zc7dhlv-->
- PLAY → RESULTS  <!--id:trn_7jvu4cl from:scr_zc7dhlv to:scr_29xml07-->
- RESULTS → MENU  <!--id:trn_0zfd7u2 from:scr_29xml07 to:scr_ab5f1vj-->
- LOADING SCREEN → MENU  <!--id:trn_6rjedme from:scr_xn5t664 to:scr_ab5f1vj-->
- MENU → HELP  <!--id:trn_8lomqaf from:scr_ab5f1vj to:scr_bky3bf6-->
- HELP → MENU  <!--id:trn_dp3d29d from:scr_bky3bf6 to:scr_ab5f1vj-->
- MENU → LEADERBOARD  <!--id:trn_39pazvf from:scr_ab5f1vj to:scr_wp1ium2-->
- LEADERBOARD → MENU  <!--id:trn_uxu7naj from:scr_wp1ium2 to:scr_ab5f1vj-->
