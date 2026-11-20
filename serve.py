"""Start the local Xiangqi app with the isolation headers Pikafish WASM needs."""
from __future__ import annotations

import http.server
import webbrowser
from pathlib import Path

from fetch_engine_assets import ensure_assets

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000


class IsolatedHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()


if __name__ == "__main__":
    ensure_assets()
    server = http.server.ThreadingHTTPServer((HOST, PORT), IsolatedHandler)
    url = f"http://{HOST}:{PORT}/"
    print(f"楚河象棋已在 {url} 启动；保持此窗口开启以使用 Pikafish。")
    print("首次下载的引擎网络约 51 MB；本地文件会通过 SHA-256 校验。")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止。")
    finally:
        server.server_close()
