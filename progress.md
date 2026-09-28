Original prompt: Publish the supplied VOLT-ROAST-source.zip at arisconstantinou.github.io/mafias and make a new Codex project called mafia for future improvements.

- Source ZIP SHA-256: `E9A7FBFDEAC8A4F4A82C7333E47DE8A15253C73E54C72F1014DE39D43A12572D`.
- Imported all 60 files into this dedicated project directory.
- Fixed the Python build script's Windows text encoding and set the project's fixed local port to 5174.
- Build output has identical HTML and asset data to the supplied file; only the order of embedded voice object keys differs. Voice ordering is now deterministic across rebuilds.
- The build is deterministic on Windows (`B62AD0FE102738BB94AE9ABAB98818969359EDBF340F8F68DCC976A342E4C4DE`). The supplied and rebuilt HTML/asset payloads are equivalent except for embedded voice key order.
- Regression checks passed in a disposable `.qa-run/` copy, including both controls, damage, pickups, win states, and desktop/mobile screenshots.
- Fixed test browser flags: Linux ANGLE GL flags caused a lost WebGL context and blank scene on Windows Chrome. Native Windows Chrome rendering shows the full city; rerun regression passed without JavaScript errors.
- Local performance sample on RTX 5080 Windows Chrome: 60 FPS at 1280x800 and 430x932, 124k-126k triangles and 64-70 draw calls. This is not a physical mobile measurement.
- Pending: GitHub Pages publication, live URL verification, and Codex project registration.
