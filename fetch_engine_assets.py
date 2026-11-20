"""Fetch and verify the pinned Pikafish WebAssembly engine and NNUE network."""
from __future__ import annotations

import hashlib
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENGINE_DIR = ROOT / "engine"
WASM_RELEASE = "https://github.com/brianhliou/pikafish-wasm/releases/download/v0.1.0"
ASSETS = {
    "pikafish.js": (f"{WASM_RELEASE}/pikafish.js", "17bc398028450c4c56df27812324cca8e5af9e2c86662f4a0d7f5b328270df3a"),
    "pikafish.wasm": (f"{WASM_RELEASE}/pikafish.wasm", "b437f89ca16a1ff9181878813d1991f60b22067dca6b3feb79a26033224a83b1"),
}
NETWORK_SHA256 = "7d13d73569a9b571ba0eb20cf1596247bc2a42738967e61afef6482b231e900e"
NETWORK_PACKAGE = (
    "https://github.com/official-pikafish/Pikafish/releases/download/"
    "Pikafish-2026-09-06/Pikafish.2026-09-06.7z"
)
NETWORK_PACKAGE_SHA256 = "41952bbfe2520faceb5902c69e6ab4845cc999841d2b49a95cc1be7867a25e5b"


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


def ensure_matching_network() -> None:
    target = ENGINE_DIR / "pikafish.nnue"
    if target.exists() and digest(target) == NETWORK_SHA256:
        print("pikafish.nnue: 与浏览器引擎版本匹配并通过 SHA-256 校验")
        return

    archive = ENGINE_DIR / "pikafish-2026-09-06.7z"
    download(archive.name, NETWORK_PACKAGE, NETWORK_PACKAGE_SHA256)
    print("从官方 Pikafish 2026-09-06 发行包提取匹配的 NNUE…")
    listing = subprocess.run(
        ["tar", "-tf", str(archive)], check=True, capture_output=True, text=True
    ).stdout.splitlines()
    members = [
        member for member in listing
        if Path(member.replace("\\", "/")).name.lower() == "pikafish.nnue"
        and ".." not in Path(member.replace("\\", "/")).parts
    ]
    if len(members) != 1:
        raise RuntimeError("官方发行包中未找到唯一的 pikafish.nnue")

    extracted = ENGINE_DIR / "network-extract"
    extracted.mkdir(exist_ok=True)
    try:
        subprocess.run(
            ["tar", "-xf", str(archive), "-C", str(extracted), members[0]],
            check=True,
            capture_output=True,
            text=True,
        )
        candidates = list(extracted.rglob("pikafish.nnue"))
        if len(candidates) != 1 or digest(candidates[0]) != NETWORK_SHA256:
            raise RuntimeError("提取的 NNUE 与浏览器引擎预期版本不匹配")
        candidates[0].replace(target)
        print("pikafish.nnue: 与浏览器引擎版本匹配并通过 SHA-256 校验")
    finally:
        for item in sorted(extracted.rglob("*"), reverse=True):
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                item.rmdir()
        extracted.rmdir()
        archive.unlink(missing_ok=True)


def ensure_assets() -> bool:
    ENGINE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        for name, (url, expected) in ASSETS.items():
            download(name, url, expected)
        ensure_matching_network()
    except Exception as error:
        print(f"Pikafish 引擎下载/校验失败：{error}", file=sys.stderr)
        print("应用仍可启动，但会退回内置的较弱 AI。", file=sys.stderr)
        return False
    return True


if __name__ == "__main__":
    raise SystemExit(0 if ensure_assets() else 1)
