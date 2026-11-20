# Pikafish engine notices

This app can download and run Pikafish WebAssembly v0.1.0 locally. The WASM build is based on Pikafish commit `6a59ee2f7b105bff64d9efc2692591107787e2b1` and was published by the `pikafish-wasm` project:

- Browser build: https://github.com/brianhliou/pikafish-wasm/releases/tag/v0.1.0
- Upstream engine source: https://github.com/official-pikafish/Pikafish/tree/6a59ee2f7b105bff64d9efc2692591107787e2b1
- Upstream engine license: GNU GPL v3. The app does not commit or redistribute the binary; `fetch_engine_assets.py` downloads the public release files directly and verifies the published SHA-256 values before use.
- NNUE weights license: https://github.com/brianhliou/pikafish-wasm/blob/v0.1.0/NNUE-License.md. It allows legal non-commercial use; commercial use requires permission. The app does not bundle the weights in its Git repository.
- The browser-build release does not contain its documented `pikafish.nnue` asset. The engine requires the exact matching network: SHA-256 `7d13d73569a9b571ba0eb20cf1596247bc2a42738967e61afef6482b231e900e`. The fetcher downloads the official Pikafish 2026-09-06 release archive, verifies its SHA-256, and extracts the matching network from that archive. Do not substitute the rolling `master-net` asset: it can change independently of this browser-engine build.

The fetched filenames, hashes, and release URLs are pinned in `fetch_engine_assets.py`. The user downloads them to the ignored `engine/` directory when starting the local server. If the upstream rolling network changes, checksum verification fails closed instead of silently running an unknown network.
