# Pikafish engine notices

This app can download and run Pikafish WebAssembly v0.1.0 locally. The WASM build is based on Pikafish commit `6a59ee2f7b105bff64d9efc2692591107787e2b1` and was published by the `pikafish-wasm` project:

- Browser build: https://github.com/brianhliou/pikafish-wasm/releases/tag/v0.1.0
- Upstream engine source: https://github.com/official-pikafish/Pikafish/tree/6a59ee2f7b105bff64d9efc2692591107787e2b1
- Upstream engine license: GNU GPL v3. The app does not commit or redistribute the binary; `fetch_engine_assets.py` downloads the public release files directly and verifies the published SHA-256 values before use.
- NNUE weights license: https://github.com/brianhliou/pikafish-wasm/blob/v0.1.0/NNUE-License.md. It allows legal non-commercial use; commercial use requires permission. The app does not bundle the weights in its Git repository.
- The browser-build release does not contain its documented `pikafish.nnue` asset. The fetcher therefore gets the matching-format official network from https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue and pins SHA-256 `071aefc0730e124876a97609a4a75624d62fa5d3155858c9646a1a8272e9e458` (asset snapshot published 2026-11-14).

The fetched filenames, hashes, and release URLs are pinned in `fetch_engine_assets.py`. The user downloads them to the ignored `engine/` directory when starting the local server. If the upstream rolling network changes, checksum verification fails closed instead of silently running an unknown network.
