Original prompt: Publish the supplied VOLT-ROAST-source.zip at arisconstantinou.github.io/mafias and make a new Codex project called mafia for future improvements.

- Source ZIP SHA-256: `E9A7FBFDEAC8A4F4A82C7333E47DE8A15253C73E54C72F1014DE39D43A12572D`.
- Imported all 60 files into this dedicated project directory.
- Fixed the Python build script's Windows text encoding and set the project's fixed local port to 5174.
- Build output has identical HTML and asset data to the supplied file; only the order of embedded voice object keys differs. Voice ordering is now deterministic across rebuilds.
- The build is deterministic on Windows (`B62AD0FE102738BB94AE9ABAB98818969359EDBF340F8F68DCC976A342E4C4DE`). The supplied and rebuilt HTML/asset payloads are equivalent except for embedded voice key order.
- Regression checks passed in a disposable `.qa-run/` copy, including both controls, damage, pickups, win states, and desktop/mobile screenshots.
- Fixed test browser flags: Linux ANGLE GL flags caused a lost WebGL context and blank scene on Windows Chrome. Native Windows Chrome rendering shows the full city; rerun regression passed without JavaScript errors.
- Local performance sample on RTX 5080 Windows Chrome: 60 FPS at 1280x800 and 430x932, 124k-126k triangles and 64-70 draw calls. This is not a physical mobile measurement.
- GitHub Pages publication verified at `https://arisconstantinou.github.io/mafias/`; live index hash matched the local build, desktop and mobile browser interactions passed, and the service worker scope is `/mafias/`.
- Codex local project `mafia` is registered against this folder. The `mafias` GitHub repository is the remote for `main`.
- Optional next checks for future work: physical iPhone/Android performance and Safari audio/PWA behavior; native-speaker review of the Bangla lines.

2026-09-28 mobile visibility and driving pass:
- Protected baseline: `main` at `a771d4a`, clean before work. Changes developed on `fix/mobile-visibility-controls` in a separate worktree.
- Controlled 430x932 scene: two 196x111 px rider bubbles obscured the view; the same scene now uses one 339x36 px Greek subtitle above the road. Speech events are limited to one speaker every seven seconds; the subtitle can be hidden in Settings while voice remains independent.
- Fixed-step first-second control sample: cruise 45.3 to 57.6 km/h; diagonal steer and boost 45.3 to 83.2 km/h. Active left and right joystick labels now show the current action and light up together.
- Captures: `tests/mobile-before.png`, `tests/mobile-game.png`, `tests/mobile-landscape.png`, `tests/mobile-controls-active.png`, and `tests/desktop-action.png`.
- `tests/mobile_ux.py` checks the controlled scene, settings, three viewport layouts, acceleration, steering, braking, and dialogue timing. `tests/regression.py` checks actual two-finger input and the full race. Windows Chrome performance stayed at about 60 FPS on the RTX 5080 at 1280x800 and 430x932; these measurements do not establish physical phone performance.
- Version 1.0.1 bumps the hosted service-worker cache so the published game can refresh offline assets.

2026-09-28 pause Settings repair:
- The pause menu appeared after Settings in the document at the same stacking level, hiding the Settings panel after it opened. Settings now stacks above Pause and returns there when closed.
- Reproduced the failure on both local and published builds before editing. Verified open, close, and resume at 430x932, 360x780, and 1280x800 after editing; `tests/regression.py` now checks the full navigation flow.
- Version 1.0.2 refreshes the hosted offline cache. Captures: `tests/settings-pause-before.png` and `tests/settings-pause-after.png`.

2026-09-28 Brawl mode integration (current request):
- Original prompt: Add the supplied `VOLT-BRAWL-3D.html` as an extra mode alongside Scooter, wire it for mobile, use the same source/build workflow, and commit/push to `main`. Follow-up: show illustrated Scooter/Brawl options on the main menu and share one fighter selection across modes.
- Protected baseline: `main` at `f0b0910`, clean. Development is isolated in the existing worktree on `feat/brawl-mode`; the 5174 server remains attached to the prior main checkout until promotion.
- Original Brawl import is retained byte-for-byte in `imports/VOLT-BRAWL-3D.html` (SHA-256 `2A076A40125D28C8F0A155421360D14FCC40BF36494CF833B69955AF33408F93`). All 36 embedded files match existing `assets/` bytes, so the editable `src/brawl/` build reuses them without duplicating source media.
- `build.py` now produces both self-contained pages from the same `src/engine.js` WebGL renderer. The extracted Brawl engine differed from the Scooter engine only by surrounding blank lines; the first extracted Brawl rebuild matched the supplied HTML byte-for-byte before integration changes. Illustrated mode cards use crops from actual Scooter and Brawl gameplay, stored as compact `assets/mode-*.webp` and embedded in the menu build.
- One fighter choice is persisted with `volt-roast-player` and passed through relative `?fighter=` links in both directions. Brawl has return controls in its menu, pause and results. The service worker now caches and falls back to the correct game page.
- Local QA: four menu viewports, portrait/landscape gameplay, real two-touch movement plus Punch, all six Brawl actions, pause/settings, and all three result modes passed. The prior Scooter regression and mobile UX checks also passed. Both generated HTML files rebuild deterministically.
- Eight-second fixed-seed Brawl samples on Windows Chrome / RTX 5080: original and integrated builds each held about 60 FPS with 16.8 ms p95 frame intervals, 116 draw calls and 55,171 triangles at 1280x800 and 430x932. The Scooter build also stayed near 60 FPS at those viewports. Physical phone performance is not verified.
- Final: fast-forwarded to `main` as `5fe9fd3` and pushed. The fixed 5174 server and the public Pages site served both routes; the public `index.html`, `brawl.html` and `sw.js` bytes matched their Git blobs. The Pages deployment succeeded. A fresh mobile Chrome context loaded live Brawl gameplay and switched both ways offline using service-worker cache `volt-roast-v1.1.0`, preserving fighter selection, with no JavaScript errors.
- Remaining device check for later work: physical phone frame pacing, touch latency and Safari audio/PWA behavior. Desktop mobile viewport checks do not establish those results.

2026-09-28 desktop camera and keyboard pass:
- Original prompt: "on desktop scooter games shakes constantly, also you can wire the desktop controls to keyboard, same for brawl keybindings".
- Protected baseline: `main` at `5b468ff`, clean, served by the existing 5174 Python process. Development in the managed `desktop-controls` worktree; the original ZIP remains untouched.
- Reproduced scooter camera judder with no hits or camera shake: at simulated 144 Hz, fixed-step rider position stayed unchanged in 84 of the first 143 rendered frames. Camera velocity step jitter was 0.937 before and 0.038 after render interpolation in the same controlled scenario.
- Scooter keeps WASD/Shift driving, arrows aiming, Space firing, 1–4 items and Esc pause; IJKL now also aims so both hands can stay on the letter keys. The key guide is visible in the desktop menu and HUD. Brawl already had WASD/arrows, J/U/K/L, E, Space and Esc; the full map is now visible in its desktop menu and the HUD hint is readable.
- `tests/desktop_controls.py` exercises the camera and every desktop action in both modes. Scooter regression, Brawl integration, mobile UX, and matched Windows Chrome performance checks passed. `.qa-run/desktop-controls/` holds before/after captures and camera traces. Physical-device performance remains unverified.

2026-09-28 Brawl pressure, ground grab and move showcase:
- Request: automatic push after sustained close hits from one opponent; knockdown when defender HP is more than double attacker HP; grab a grounded rival; simplify Brawl touch controls; show each move live against a partner. User confirmed the repeated-hit trigger.
- Protected baseline: clean `main` at `eb56dd6` served on fixed port 5174. Work was isolated in the existing managed worktree on `codex/brawl-pressure-showcase`; no second server or port was started. `.qa-run/brawl-pressure/` contains before/after captures and frame data.
- Implemented three close melee hits from the same aggressor within 4.5 seconds, with a 7-second cooldown. Normal push creates separation and short protection; when current defender HP exceeds twice attacker HP, the attacker falls for a 1.65-second ground-grab window. Grounded targets take priority for grab; grab/slam uses the existing damage path.
- Touch Brawl shows four larger actions: tap Punch, hold Punch for Heavy, Kick, Dodge, and a context button that labels and depicts Grab, Ground Grab, Slam, Escape, Counter, Pick Up, or Throw. Desktop keyboard and its six action buttons stay available. The help entry opens 11 live, replayable 3D demonstrations using the combat simulation.
- Verified with `tests/brawl_pressure.test.js`, `tests/brawl_pressure_showcase.py`, Brawl integration, desktop controls, Scooter regression, and Scooter mobile UX. Captures cover 430x932, 360x780, 844x390, and 1280x800. A 5-second paired Chrome/RTX 5080 Brawl frame sample found 4.3 ms p95 in both builds at desktop and mobile viewport, no frames above 33 ms, and similar GC-collected JS heap. These desktop-hosted viewports do not establish physical-phone performance.
- Pending at this checkpoint: remove only generated test outputs, commit the focused candidate, promote and verify the fixed 5174 route, push, and verify Pages deployment. Original ZIP and photographic assets remain untouched.
- The first candidate was published as `e54ecd1`; the fixed 5174 route, Pages file hashes, new service-worker cache, live mobile showcase and offline round-trip passed. A final readability pass raised the new compact labels to at least 12 px, made the Heavy hold hint fit in 64–76 px touch targets, and checked the 360x780 pause menu plus 844x390 landscape. Focused behavior tests and paired frame pacing passed again before the follow-up release.

2026-09-28 Brawl menu background transition:
- Request: selecting Brawl on the shared mode menu should smoothly change the background from the Scooter street to the Brawl yard.
- Protected baseline: clean `main` at `262b608`, served by the existing 5174 Python process. Candidate is in the managed `brawl-menu-background` worktree on `codex/brawl-menu-background`; no second server or port was started.
- Captured desktop and portrait backgrounds from the actual Brawl 3D menu on the baseline at 1600x900 and 430x932. They are stored in `assets/menu-brawl-yard*.jpg` and embedded into the generated standalone `index.html`. No supplied photo or original ZIP was modified.
- The Brawl card starts a 0.95-second circular reveal with a slight camera-style zoom and glow; Scooter reverses it. The route badge follows the selection. Reduced-motion preference uses an immediate switch. The portrait crop keeps the yard recognizable behind the mobile menu.
- Before/transition/after captures are in `.qa-run/mode-transition/`. Full-page Chrome screenshots verified desktop, 430x932 portrait and 844x390 landscape; both mode routes and reverse selection worked without page errors. `tests/brawl_integration.py` and `tests/regression.py` passed. Paired Windows Chrome samples during selection: 1600x900 p95 4.3 ms before/after, 430x932 p95 4.3/4.4 ms, zero frames above 33 ms. Physical phone performance remains unverified.
- `sw.js` cache was bumped to `volt-roast-v1.1.3` for the new self-contained menu. Pending: focused commit, promotion to the fixed 5174 checkout, then public deployment verification if approved by the task's publication instructions.
