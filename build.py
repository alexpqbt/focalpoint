"""Build Focalpoint into dist/Focalpoint/.

Usage (from anywhere):
    python build.py                  # frontend + exe, console visible
    python build.py --windowed       # no console window
    python build.py --skip-frontend  # reuse the existing frontend/dist
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dist" / "Focalpoint"

HIDDEN_IMPORTS = [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]

REQUIRED = [
    ROOT / "launcher.py",
    ROOT / "livekit" / "livekit-server.exe",
    ROOT / "nginx" / "nginx.exe",
    ROOT / "nginx" / "conf" / "mime.types",
]


def tool(name):
    path = shutil.which(name)  # resolves pnpm.cmd on Windows
    if not path:
        sys.exit(f"ERROR: '{name}' was not found on PATH.")
    return path


def run(cmd, cwd=ROOT):
    print(f"\n> {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        sys.exit(f"ERROR: command failed with exit code {result.returncode}.")


def build_frontend():
    print("\n[1/3] Building frontend")
    run([tool("pnpm"), "build"], cwd=ROOT / "frontend")


def build_exe(windowed):
    print("\n[2/3] Building executable")
    cmd = [
        tool("uv"), "run", "--project", "server", "pyinstaller", "launcher.py",
        "--name", "Focalpoint",
        "--onedir",
        "--noconsole" if windowed else "--console",
        "--noconfirm",
        "--paths", "server",
        "--collect-all", "fpdf",
    ]
    for module in HIDDEN_IMPORTS:
        cmd += ["--hidden-import", module]
    run(cmd)


def copy_external_files():
    print("\n[3/3] Copying external files")
    (OUT / "livekit").mkdir(parents=True, exist_ok=True)
    (OUT / "nginx").mkdir(parents=True, exist_ok=True)
    (OUT / "frontend").mkdir(parents=True, exist_ok=True)

    shutil.copy2(ROOT / "livekit" / "livekit-server.exe", OUT / "livekit")
    shutil.copy2(ROOT / "nginx" / "nginx.exe", OUT / "nginx")
    shutil.copytree(ROOT / "nginx" / "conf", OUT / "nginx" / "conf", dirs_exist_ok=True)
    shutil.copytree(ROOT / "frontend" / "dist", OUT / "frontend" / "dist", dirs_exist_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Build Focalpoint.")
    parser.add_argument("--windowed", action="store_true",
                        help="build without a console window")
    parser.add_argument("--skip-frontend", action="store_true",
                        help="do not run pnpm build")
    args = parser.parse_args()

    missing = [p for p in REQUIRED if not p.exists()]
    if missing:
        sys.exit("ERROR: missing required files:\n" + "\n".join(f"  {p}" for p in missing))

    if not args.skip_frontend:
        build_frontend()
    if not (ROOT / "frontend" / "dist" / "index.html").exists():
        sys.exit("ERROR: frontend/dist/index.html not found. Run without --skip-frontend.")

    build_exe(args.windowed)
    copy_external_files()

    print(f"\nDone. Output: {OUT}")


if __name__ == "__main__":
    main()