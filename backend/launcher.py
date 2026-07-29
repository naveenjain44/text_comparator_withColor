"""Standalone launcher for the packaged UAT Text Comparator binary.

Behaviour:
1. Serves the FastAPI backend + bundled React frontend on 127.0.0.1:8001.
2. Opens the default browser to http://127.0.0.1:8001 automatically.
3. Runs 100% offline — no external HTTP calls.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

# When bundled by PyInstaller, sys._MEIPASS points to the temp extract dir.
if getattr(sys, "frozen", False):
    BASE = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    os.chdir(BASE / "backend")
    sys.path.insert(0, str(BASE / "backend"))
else:
    BASE = Path(__file__).parent
    os.chdir(BASE)

HOST = os.environ.get("UAT_HOST", "127.0.0.1")
PORT = int(os.environ.get("UAT_PORT", "8001"))


def _open_browser():
    time.sleep(1.2)
    try:
        webbrowser.open(f"http://{HOST}:{PORT}")
    except Exception:
        pass


def main():
    threading.Thread(target=_open_browser, daemon=True).start()
    import uvicorn
    from server import app  # noqa: F401 — ensure init side effects run
    print(f"\n  UAT Text Comparator running at http://{HOST}:{PORT}\n  Press Ctrl+C to stop.\n")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
