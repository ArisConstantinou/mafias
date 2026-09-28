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
