"""Build a static Vercel output with verified Pikafish browser assets."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from fetch_engine_assets import ENGINE_DIR, ensure_assets

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist"
APP_FILES = ("index.html", "style.css", "app.js")
ENGINE_FILES = (
    "worker.js",
    "pikafish.js",
    "pikafish.wasm",
    "pikafish.nnue",
)


def main() -> None:
    # Vercel's Linux builder uses UTF-8; set it locally too for reliable checks.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if not ensure_assets():
        raise SystemExit("Pikafish 资源下载或 SHA-256 校验失败，取消部署构建。")

    missing = [name for name in ENGINE_FILES if not (ENGINE_DIR / name).is_file()]
    if missing:
        raise SystemExit(f"缺少 Pikafish 部署资源：{', '.join(missing)}")

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    (OUTPUT / "engine").mkdir(parents=True)

    for name in APP_FILES:
        shutil.copy2(ROOT / name, OUTPUT / name)
    for name in ENGINE_FILES:
        shutil.copy2(ENGINE_DIR / name, OUTPUT / "engine" / name)

    print(f"Vercel 静态产物已生成：{OUTPUT}")
    print("Pikafish JS、WASM、NNUE 与 Worker 均已包含并通过资源校验。")


if __name__ == "__main__":
    main()
