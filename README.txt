VOLT / ROAST — SCOOTER INSULT BATTLE
Playable build 1.0.2 · 28 September 2026

START HERE
Open index.html in a full desktop browser. Everything needed for gameplay is
embedded inside that HTML: the renderer, city, character cutouts, item images,
and all 24 synthetic Bangla voice clips. No engine download, account, API key,
build command, or Internet connection is required for that standalone file.
On Windows, START-WINDOWS.bat opens the same file in your default browser.

This is one local human player against three computer-controlled rivals.
It does NOT include online multiplayer, real-time voice chat, or cloned voices.
The cutout heads come from the four central people in the supplied photograph;
VOLT, SPARK, FUSE and SURGE are fictional game nicknames, not identifications.
The heads are transparent 2D photographic cutouts attached to modeled 3D riders,
with a colored round halo. They are not reconstructed 3D face scans.

MOBILE / HOSTING
The layout supports portrait and landscape touch controls. For a browser link,
host this folder as a static website. index.html alone runs the game; sw.js,
manifest.webmanifest and the app icons add hosted offline-shell support.
Public site: https://arisconstantinou.github.io/mafias/
GitHub Pages serves the `mafias` repository from the root of `main`. netlify.toml remains an
optional alternative static-host configuration.
Hosting the game publicly also publishes the four photo-head assets.
An iPhone attachment preview is not the intended game runtime. Physical iPhone
performance and installation have not been tested in this build.

Optional local server: run `python serve.py` and open the address it prints.
The server binds only to this computer (127.0.0.1), not the local network.
This Codex project's fixed local address is http://127.0.0.1:5174/.

HOW TO PLAY
Choose one of the four riders, then choose a mode and press LET IT RIP.
The scooter accelerates automatically. Both hands remain on its handlebars.

Left joystick: left/right to steer, up to boost, down to brake.
               Push diagonally up to boost and steer together.
Right joystick: point and hold to fire fictional electric bolts.
                Up shoots ahead; down shoots behind; sideways shoots sideways.
Circular item images: tap once to throw the pictured hazard BEHIND your scooter.
On phones, a small Greek subtitle appears at the top instead of large speech
bubbles. SETTINGS > Dialogue text hides it without changing the voice setting.

Desktop controls:
A / D           Steer left / right.
W or Shift      Boost while energy remains.
S               Brake.
Arrow keys      Aim and fire the electric blaster.
Space           Fire; defaults forward unless an aiming direction is held.
1 / 2 / 3 / 4   Throw banana / pins / oil / toolbox behind.
Escape          Pause / resume.

ITEMS AND SCOOTER DAMAGE
Every scooter starts with 100 health. Hits damage scooters, with non-graphic
arcade knockback and sparks rather than realistic bodily injuries.

Banana:   8 health damage; 1.5-second skid. Starts with 3, maximum stock 5.
Pins:    16 health damage; 3.2-second punctured-tyre slowdown. Starts with 2,
         maximum stock 4.
Oil:      5 health damage; 2.2-second slide. Starts with 2, maximum stock 4.
Toolbox: 23 health damage; heavy slowdown and a small bounce. Starts with 1,
         maximum stock 3.

A throw has a 1.1-second shared cooldown. The object travels in a visible arc,
can strike a trailing scooter in flight, then lands and becomes a road hazard. Hazards expire after 18–24
seconds. Oil can affect different riders, but each oil slick only damages a
particular rider once. Other hazards are consumed on a successful impact.
Opponents use the same inventories, item damages and effects as the player.

Green pickups repair 22 health (capped at 100).
Blue pickups restore 45 boost energy (capped at 100).
Purple supply boxes restore one item in each of two low-stock inventory slots.

Scooter-to-scooter contacts damage both riders, separate the scooters, trigger
an automatic retaliatory bolt from each surviving rider, and start a spoken
exchange. A 1.3-second pair cooldown stops sustained overlap from generating
a new full collision hit every simulation frame. Manually aimed bolts also
cause damage. Static cones, crates, barriers, potholes, barrels and parked vans
are physical road hazards; ramps let riders jump over some low hazards.

MORE HITS, HEAVIER INSULTS
24 authored Bangla lines, with conversational Greek translations and embedded
synthetic speech, are split across four levels:
  Hit events 1–2: teasing.
  Hit events 3–4: annoyed.
  Hit events 5–6: furious.
  Hit events 7+: strong, uncensored profanity.
Successful contacts, item hits and aimed bolt hits raise the participants'
heat. Misses do not. At most two speech clouds are visible at once, prioritizing
nearby riders, so the subtitles do not bury the entire play area.
Turn Strong insults off in Settings to cap dialogue at level 3.
The voices are synthetic game speech, NOT the real voices of the people shown.
Native-speaker wording review is advisable before a polished public release.

WIN CONDITIONS
STREET CLASH: complete two laps of the approximately 900-metre city circuit
first, OR be the last scooter still running.
LAST SCOOTER: no lap finish; outlast everyone else. After two minutes, battery
failure drains the remaining scooters' health to resolve a prolonged match.
If your scooter is wrecked early, the camera follows a surviving racer until
the match ends. Restart or change rider from the pause / results screens.

SETTINGS AND PRIVACY
Sound effects, Bangla voice playback, strong language, rendering resolution
and a live performance counter are adjustable. Best finish time and settings
use local browser storage when available. Failure to access storage does not
prevent gameplay. There are no analytics, account systems or external APIs.
Graphics Auto can lower render pixel density if the measured frame rate drops.
No physical-device frame-rate guarantee is made. See TEST-REPORT.txt.

EDITING / CODEX HANDOFF
src/engine.js      Dependency-free WebGL renderer, mesh builder and math.
src/world.js       Closed city circuit, architecture, scooters, bodies and props.
src/game.js        Physics, AI, items, damage, dialogue, audio, controls and HUD.
src/template.html HTML/CSS interface and insertion points for bundled scripts.
assets/           Four transparent heads, four item illustrations, dialogue,
                  and the 24 embedded synthetic-speech source files.
build.py          Rebuilds index.html using Python's standard library only.

After editing source or assets, run `python build.py`. Do not edit only the
bundled HTML if you intend to keep the source project in sync. Original photo
processing / speech-generation tools are not needed to rebuild this project.
No font files are bundled.

The gameplay tests use Playwright and Chromium and are optional development
tools, not game dependencies. CHROMIUM_EXECUTABLE may specify a browser binary.
For local development on Windows: create a virtual environment, install
`requirements-dev.txt`, then run `python tests/regression.py`. The test scripts
find an installed Chrome or Edge browser; CHROMIUM_EXECUTABLE can override it.
The regression script
writes screenshots and JSON reports under `tests/`; use a disposable copy if
you want to preserve the supplied baseline captures.
On a headless Linux host, an X display / Xvfb may be needed for the chosen Mesa
software renderer. The recorded regression and performance JSON files document
the checks run for this delivery.
