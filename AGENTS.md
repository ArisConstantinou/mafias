# Mafia project guidance

- Public URL: `https://arisconstantinou.github.io/mafias/`.
- This project's single fixed local port is `5174`: `http://127.0.0.1:5174/`. Check for an existing listener before starting the server. Never switch ports silently.
- `index.html` is generated from `src/`, `assets/`, and `build.py`. Run `python build.py` after source edits and verify the generated output.
- Preserve the supplied game's content, photographic assets, and Greek translations unless a task explicitly asks for a change.
- Run the relevant regression checks and verify desktop and mobile gameplay before publishing. Treat physical-device performance as unverified until tested on a device.
- Publish only verified changes to the `mafias` repository. Keep the original ZIP as the recoverable imported source.
