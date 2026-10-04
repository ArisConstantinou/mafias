# Crimson v401 game model

The existing final boss now uses the exact delivered v401 runtime GLB (accepted v382 appearance plus human Run). `Crimson_Boss_v401.blend` is the complete editable source; the original user file and prior sources remain preserved. SHA-256 hashes and export metadata are in `provenance.json`.

Runtime: `assets/boss-crimson.glb.gz`, embedded unchanged by `python build.py` in Brawl and its viewer. 75 bones, 23 clips, 857,322 boss triangles. The current crew, HUD, simulation and Scooter remain intact. Equipment follows the authored hierarchy; the obsolete shield and wrist overrides have been removed. Grasp and release use the authored hand socket and preserve the existing combat timings.

Regression: Node boss, combo/context and pressure suites; Chrome desktop, portrait and landscape boss mapping/controls, grasp contact/throw continuity and shield defence; four-view Spin/prop/laser-range regression; desktop/mobile viewer clips and orbit/zoom. A forced rigid-draw fallback renders all 857,322 triangles with finite palettes and no GL errors.

Performance on this RTX 5080 Windows/Chrome host: matched scene 104 to 116 draws, 157,749 to 919,175 triangles. Direct typed GPU-buffer construction avoids the intermediate JavaScript arrays: the initial 1.25 GB heap measurement falls to about 153-163 MB. Candidate local loads took about 1.7-2.0 seconds; baseline samples about 0.6-1.3 seconds. The 120-frame samples retained approximately 4.3 ms p95 RAF spacing with no gaps over 33 ms. These short PC samples do not establish physical-phone FPS or GPU/VRAM use; iPhone/Safari remains unverified.

Detailed screenshots and reports: `.qa-run/boss-v401/`. The installed web-game client was run; its WebGL toDataURL captured a discarded buffer. A task-local copy adds only a synchronous redraw before capture, producing a visibly verified gameplay capture. Installed skill files are unchanged.

Recovery: prior default runtime and generated pages are retained by commit `a804e6b`. Other visual-study worktrees were not merged into this release. No image generation, paid asset service, installation, external credits or agents were used. Attributable Codex weekly usage and credits are unavailable.
