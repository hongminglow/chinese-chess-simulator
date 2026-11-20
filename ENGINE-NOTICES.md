# Pikafish engine notices

This app can download and run Pikafish WebAssembly v0.1.0 locally. The WASM build is based on Pikafish commit `6a59ee2f7b105bff64d9efc2692591107787e2b1` and was published by the `pikafish-wasm` project:

- Browser build: https://github.com/brianhliou/pikafish-wasm/releases/tag/v0.1.0
- Upstream engine source: https://github.com/official-pikafish/Pikafish/tree/6a59ee2f7b105bff64d9efc2692591107787e2b1
- Upstream engine license: GNU GPL v3. The app does not commit or redistribute the binary; `fetch_engine_assets.py` downloads the public release files directly and verifies the published SHA-256 values before use.
- NNUE weights license: https://github.com/brianhliou/pikafish-wasm/blob/v0.1.0/NNUE-License.md. It allows legal non-commercial use; commercial use requires permission. The app does not bundle the weights in its Git repository.

The fetched filenames, hashes, and release URLs are pinned in `fetch_engine_assets.py`. The user downloads them to the ignored `engine/` directory when starting the local server.
