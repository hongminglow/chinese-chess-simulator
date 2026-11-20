"""Fetch and verify the pinned Pikafish WebAssembly engine and NNUE network."""
from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENGINE_DIR = ROOT / "engine"
WASM_RELEASE = "https://github.com/brianhliou/pikafish-wasm/releases/download/v0.1.0"
ASSETS = {
    "pikafish.js": (f"{WASM_RELEASE}/pikafish.js", "17bc398028450c4c56df27812324cca8e5af9e2c86662f4a0d7f5b328270df3a"),
    "pikafish.wasm": (f"{WASM_RELEASE}/pikafish.wasm", "b437f89ca16a1ff9181878813d1991f60b22067dca6b3feb79a26033224a83b1"),
    "pikafish.nnue": (
        "https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue",
        "071aefc0730e124876a97609a4a75624d62fa5d3155858c9646a1a8272e9e458",
    ),
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def download(name: str, url: str, expected: str) -> None:
    target = ENGINE_DIR / name
    if target.exists() and digest(target) == expected:
        print(f"{name}: 已缓存并通过 SHA-256 校验")
        return
    partial = target.with_suffix(target.suffix + ".part")
    print(f"下载 {name}…")
    try:
        with urllib.request.urlopen(url, timeout=60) as response, partial.open("wb") as output:
            total = int(response.headers.get("Content-Length", "0"))
            received = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                received += len(chunk)
                if total:
                    print(f"\r  {received / total:.0%}", end="", flush=True)
        if total:
            print()
        actual = digest(partial)
        if actual != expected:
            partial.unlink(missing_ok=True)
            raise RuntimeError(f"{name} 校验失败：期望 {expected}，实际 {actual}")
        partial.replace(target)
        print(f"{name}: SHA-256 校验通过")
    except Exception:
        partial.unlink(missing_ok=True)
        raise


def ensure_assets() -> bool:
    ENGINE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        for name, (url, expected) in ASSETS.items():
            download(name, url, expected)
    except Exception as error:
        print(f"Pikafish 引擎下载/校验失败：{error}", file=sys.stderr)
        print("应用仍可启动，但会退回内置的较弱 AI。", file=sys.stderr)
        return False
    return True


if __name__ == "__main__":
    raise SystemExit(0 if ensure_assets() else 1)
