import sys
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
BASE = Path(sys.executable).parent if FROZEN else Path(__file__).resolve().parents[1]
SERVER_DIR = BASE / "server"