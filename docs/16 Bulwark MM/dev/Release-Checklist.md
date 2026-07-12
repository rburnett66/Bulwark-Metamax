# Release-Checklist.md

# BULWARK — Release Checklist

*Companion to Architecture.md, Technical-Plan.md, and Implementation-Notes.md. An ordered, role-owned checklist for shipping the vertical slice (GDD §19).*

**Release target — Vertical slice:** one walker, one floater, one flyer, three towers, the deploy loop, the three-part shot, structure FX, camera rotation, and the **battle log + replay determinism check** (Visuals §10).

**Deployment model:** BULWARK ships as a **client + headless sim binary** built from a committed lockfile (Implementation-Notes §1.1). A release is a **versioned tagged build promoted staging → production** using a **blue-green** discipline: the previously tagged build remains the live channel until the new tag passes acceptance and is promoted. There is no long-running server — "production" is the published, deployable build artifact plus its generated balance data.

**The one release-blocking gate:** replay of a seeded headless battle log must reproduce **bit-identically (zero drift)**. Everything else is quality; this is correctness. If it fails, the release does not ship.

---

## 1. Pre-Release (T-7 days)

- [ ] **[PM]** Feature freeze confirmed — only bug fixes and determinism/balance corrections permitted afterward.
- [ ] **[QA]** All P0/P1 bugs resolved or explicitly risk-accepted, with PM sign-off recorded in the QA Report.
- [ ] **[DevOps]** Release branch cut from `main` at the frozen commit; tag reserved.
- [ ] **[Engineer]** Version bumped and changelog updated — **must include the balance-data hash and the 9×9 matrix version** so a shipped build is traceable to exact data.
- [ ] **[DevOps]** All environment variables documented and verified in staging: `BULWARK_BALANCE_XLSX_PATH`, `BULWARK_DATA_OUT_DIR`, `BULWARK_SIM_SEED`, `BULWARK_REPLAY_LOG_DIR`, `BULWARK_HEADLESS`, `BULWARK_ASSET_ATLAS_DIR`, `BULWARK_LOG_LEVEL` (Implementation-Notes §1.3).
- [ ] **[Engineer]** Committed lockfile verified — **no floated math/runtime dependency versions**. Any float leakage breaks bit-reproducibility and is treated as a P0 (Implementation-Notes §1.1).
- [ ] **[Engineer]** Git LFS sprite atlases (four-layer unit stacks, structure-state atlases) pulled and integrity-checked against expected hashes (Visuals §2, §5).

---

## 2. Staging Verification (T-3 days)

- [ ] **[QA]** Full regression pass on staging: deploy loop, three-part shot, all four structure FX (construction dust, gold pie-sweep, damage smoke, destruction debris), and camera rotation (Visuals §10).
- [ ] **[Engineer]** Camera-rotation re-sort + shadow re-projection produce **zero sim state change** — presentation reads the sim, never writes, and camera rotation never enters the battle log (Implementation-Notes §2.1, §4). Verify by rotating during a recorded run and confirming the replay hash is unchanged.
- [ ] **[Engineer]** Performance targets met (Technical-Plan): frame budget holds during camera rotation with the full layer stack; headless sim sustains target tick rate.
- [ ] **[Engineer]** Diagnostic log stream (`BULWARK_LOG_LEVEL`) confirmed **fully isolated** from the battle-log stream — no timestamp or ordering leakage into replay data (Implementation-Notes §2.4).
- [ ] **[QA]** Analytics and error tracking verified functional and confirmed **not** feeding the sim.
- [ ] **[Engineer]** Balance regeneration tested end-to-end: `bulwark-balance.xlsx` → runtime tables (`Assumptions`, `Archetypes`, `Faction_Mods`, `DamageTypes`, `Effectiveness`, `Units`, `Structures`, `Vertical_Slice`). Build must **fail loud** on any derived-column mismatch (Implementation-Notes §1.2, §3).
- [ ] **[Engineer]** 9×9 alignment matrix regenerated from §10.2 rules and asserted **byte-for-byte equal** to the §10.3 table.
- [ ] **[QA]** Migration-equivalent check: regenerated tables validated against prior release tables; regeneration confirmed reproducible and reversible (roll back to the previous `BULWARK_DATA_OUT_DIR` snapshot and re-verify equality).

---

## 3. Release Day (T-0)

### Engineering
- [ ] **[DevOps]** Promote the verified tagged build to production (blue-green: previous tag stays live until promotion completes).
- [ ] **[Engineer]** Smoke-test critical paths post-promotion: launch client, load `Vertical_Slice`, deploy walker + floater + flyer, place the three slice towers, fire the three-part shot, rotate camera once.
- [ ] **[Engineer]** **[RELEASE-BLOCKING]** Run the headless seeded sim and replay its battle log — confirm bit-identical reproduction (zero drift). This is the determinism acceptance test (Implementation-Notes §4; Visuals §9).
- [ ] **[DevOps]** Confirm the balance data shipped with the build matches the staging-validated tables via hash comparison (the "migration ran successfully" equivalent).
- [ ] **[Engineer]** Monitor diagnostic error rates for 30 minutes post-promotion.

### QA
- [ ] **[QA]** Sign off on production smoke test (deploy loop + three-part shot + structure FX + camera rotation all functional).
- [ ] **[QA]** Verify the coin animation + sound fires on unit kill and that kill bounty updates live unit-list pricing (Visuals §10).
- [ ] **[QA]** Verify replay is launchable from Main Menu and reproduces the recorded battle exactly (Visuals §9).

### PM / Stakeholders
- [ ] **[PM]** Release notes published — include vertical-slice scope and the determinism-check result.
- [ ] **[PM]** Support/benchmark-evaluation team briefed on delivered features and risk-accepted known issues.

---

## 4. Post-Release (T+24h)

- [ ] **[Engineer]** Diagnostic error rates returned to baseline.
- [ ] **[PM]** Key metrics trending as expected (slice loads, replays launched, no reported determinism drift).
- [ ] **[QA]** No P0 incidents in first 24 hours. **P0 = sim desync / replay drift, balance-data hash mismatch, or slice fails to load.**
- [ ] **[DevOps]** Hotfix process briefed and on standby; previous tagged build retained for immediate rollback.

---

## 5. Rollback Plan

**Trigger — any one of:**
- (a) Replay of a recorded battle log **drifts** from the original (determinism broken; Implementation-Notes §4).
- (b) Shipped **balance-data hash mismatches** the staging-validated tables, or the 9×9 matrix fails its byte-for-byte assertion.
- (c) `Vertical_Slice` fails to load, or a core interaction (deploy loop, three-part shot) is non-functional.

**Procedure:**
1. **[DevOps]** Re-point the production distribution channel to the previous tagged build (instant blue-green swap — no rebuild required).
2. **[DevOps]** Restore the prior `BULWARK_DATA_OUT_DIR` balance snapshot and re-verify its hash.
3. **[QA]** Re-run the determinism acceptance test on the restored build to confirm the known-good state.
4. **[PM]** Notify stakeholders and log the failure class (a/b/c) with the offending commit and data hash.

**Recovery time objective:** channel swap ≤ 5 minutes (no rebuild); full re-verification ≤ 30 minutes.

---

## Key Takeaways

- **Determinism is the release gate.** A bit-identical seeded-replay reproduction is the single non-negotiable acceptance test; treat any drift, float leakage, or diagnostic-into-sim bleed as P0.
- **Balance data is a shipped artifact.** Version it, hash it in the changelog, regenerate it "fail-loud," and verify the shipped hash matches staging.
- **Blue-green enables instant rollback.** Because the previous tag stays live and no server rebuild exists, recovery is a channel re-point plus a data-snapshot restore — measured in minutes.
- **Every item has a named owner.** Ambiguous ownership is the most common cause of a missed gate; the role prefix is load-bearing, not decorative.

---

*Generated by MetaMax Research Brain (LangGraph)*