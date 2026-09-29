# Crimson Boss source

Source supplied by the user as `CRIMSON-BOSS-RIGGED-PACK.zip`, SHA-256 `3DC097E1AF29A5FAF757DFEB90ABABCFA3B2B2CF72FC77D29D56215D79A73B17`. The original ZIP is preserved outside this repository.

`assets/Crimson_Boss_EDITABLE.glb` is the supplied editable asset, unchanged (SHA-256 `A7F09A661742AE2E4F3AC2EA960B700384579B0FDF823B0ED434CA30455A9B24`). It contains separate armor parts, the 90-joint rigid skin, embedded textures and 17 clips. `assets/boss-manifest.json` records joints, sockets and event markers.

The game uses the supplied MOBILE GLB compressed losslessly to `../../assets/boss-crimson.glb.gz` (MOBILE GLB SHA-256 `b0891c0f08be08817d1ff149981def0924045a14e0a4b069e5e7de910d04e42b`). The runtime gzip is 1,892,810 bytes. The Brawl-only loader and GPU skinning path are in `src/brawl/crimson-core.js` and `src/brawl/crimson-adapter.js`; build output embeds the gzip for offline play.

The source pack describes this as a simplified reconstruction of the concept reference. Browser checks verify playback and integration; physical iPhone/Safari performance and native Blender authoring remain unverified.
