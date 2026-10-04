# Brawl crew — editable character sources

## Delivered assets

- `crew-tactical.blend`: realistic adult proportions, authored clothing, boots,
  gloves, the deform armature, weights, textures and 20 in-place actions.
- `crew-stylized.blend`: broader silhouette and shorter legs, with a separately
  fitted armature and the same action set.
- `../assets/crew-tactical.glb.gz` and `crew-stylized.glb.gz`: losslessly gzipped,
  standard glTF 2.0 exports, loaded by the Brawl game and model viewer.
- `crew-*-manifest.json`: topology, clip durations, archive provenance and sizes.
- `../tools/build_crew_assets.py`: reproducible authoring/export script.

These are the authored game character bodies.
The original photographic portraits remain 2D by the user's chosen direction.
Anatomical bodies and equipment can be inspected separately from that head treatment.

## Source and licence

The anatomical topology derives from **Blender Studio Human Base Meshes 1.4.1**,
object `GEO-body_male_realistic`, released under **CC0**. Clothing, boots,
accessories, skeleton fitting and action poses were authored for this game.

- Official listing: https://www.blender.org/download/demo-files/#assets
- Official archive: https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- Archive SHA-256: `811F43ACCBB31A88266D932F8F5563B2D13586FCA0BA2693AAD1F5FE582B3515`

The original authoring checkout retains the downloaded archive. Rebuilding
from the script requires extracting it at the configured source path; this
integration does not duplicate the library. No library scripts are executed.
The delivered blends contain the editable derived geometry, so editing them
does not require loading the external library.
The user's photographs and supplied Crimson ZIP were not replaced.

## Rig and game integration

Blender **5.1.2** was used for authoring and export. Source: metres, Z up,
character forward -Y. Export: glTF Y up, forward +Z. The game actor uses a
uniform 1.6 scale. Both variants have 52 joints, including three joints per
finger. Body deformation uses up to four normalized weights per vertex.
Boot soles follow the foot; the upper shaft blends into the shin.

The `palmL` / `palmR` metadata names designate the **closed grip centre**, not
the surface of an open palm. Gun sockets are aligned to the actual curled
finger volume. The baked two-arm IK pose positions both grips; the game fixes
the carbine to the right grip and drives its beam from the muzzle. Fingers
are oriented around the grip axis, not vertically below the handle.

All actions are in place. Gameplay owns movement, collisions, throws and
elimination. The renderer blends transitions and applies sole contact
correction for standing/moving poses. This is not a general-purpose humanoid
retargeter or a replacement physics engine.

## Rebuild and inspect

Preserve the extracted source library at the path configured in the script.
Run Blender with `--background --factory-startup --disable-autoexec --python
tools/build_crew_assets.py`, then the same command with `-- --stylized`.
Run `python build.py` after runtime/asset changes.

The game and viewer use the project's fixed **5174** server:
`http://127.0.0.1:5174/brawl.html` and `brawl-viewer.html`.
The realistic body is the default; the stylized option is available in Brawl
settings and persists locally. The selected body is shared with the viewer.
The same bodies appear in normal Brawl and the boss phase, with guns added
for the boss encounter. The viewer retains its orbit camera and timeline.

Validation: `tests/boss_crew_health_browser.cjs`, `tests/boss_health_groups.test.js`,
existing boss v401, viewer, keypad and Node combat regressions. Screenshots
and performance reports are in `.qa-run/boss-crew-health/`. Browser mobile
viewports run on a desktop host; physical iPhone/Safari performance is unverified.
