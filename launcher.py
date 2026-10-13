import ctypes
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from ctypes import wintypes
from pathlib import Path

import uvicorn

FROZEN = getattr(sys, "frozen", False)
BASE = Path(sys.executable).parent if FROZEN else Path(__file__).resolve().parent
SERVER_DIR = BASE / "server"
SERVER_DIR.mkdir(exist_ok=True)
os.chdir(SERVER_DIR)  # stopgap: keeps relative paths in server code working
if not FROZEN:
    sys.path.insert(0, str(SERVER_DIR))

processes = {}          # name -> Popen
uvicorn_server = None
uvicorn_thread = None
job = None


# ---------- Windows Job Object: children die with the launcher ----------

def create_kill_on_close_job():
    k32 = ctypes.windll.kernel32
    k32.CreateJobObjectW.restype = wintypes.HANDLE
    k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]

    class BASIC(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64),
                    ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", wintypes.DWORD),
                    ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t),
                    ("ActiveProcessLimit", wintypes.DWORD),
                    ("Affinity", ctypes.c_size_t),
                    ("PriorityClass", wintypes.DWORD),
                    ("SchedulingClass", wintypes.DWORD)]

    class IO(ctypes.Structure):
        _fields_ = [(n, ctypes.c_uint64) for n in (
            "ReadOps", "WriteOps", "OtherOps",
            "ReadBytes", "WriteBytes", "OtherBytes")]

    class EXT(ctypes.Structure):
        _fields_ = [("Basic", BASIC), ("Io", IO),
                    ("ProcessMemoryLimit", ctypes.c_size_t),
                    ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t),
                    ("PeakJobMemoryUsed", ctypes.c_size_t)]

    handle = k32.CreateJobObjectW(None, None)
    info = EXT()
    info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    k32.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info))
    return handle


def add_to_job(proc):
    if job:
        ctypes.windll.kernel32.AssignProcessToJobObject(job, int(proc._handle))


# ---------- helpers ----------

def ensure_env():
    env_path = BASE / ".env"
    if env_path.exists():
        return
    env_path.write_text(
        f"LIVEKIT_API_KEY={secrets.token_hex(16)}\n"
        f"LIVEKIT_API_SECRET={secrets.token_hex(16)}\n"
        f"LIVEKIT_ROOM_NAME=classroom\n"
    )
    print("Created .env with generated credentials.")


def wait_for_port(host, port, timeout=30, interval=0.3):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(interval)
    return False


# ---------- services ----------

def run_generate_configs():
    print("Generating configs...")
    import generate_configs
    generate_configs.main()  # wrap its logic in main() if it runs at import time


def start_livekit():
    print("Starting LiveKit server...")
    proc = subprocess.Popen(
        [str(BASE / "livekit" / "livekit-server.exe"),
         "--config", str(BASE / "livekit" / "livekit.yaml")],
        cwd=BASE,
    )
    add_to_job(proc)
    processes["livekit"] = proc
    if not wait_for_port("127.0.0.1", 7880):
        raise RuntimeError("LiveKit server did not become ready on port 7880")
    print("LiveKit server ready.")


def start_fastapi():
    global uvicorn_server, uvicorn_thread
    print("Starting FastAPI...")
    from main import app  # direct import so PyInstaller detects it
    config = uvicorn.Config(app, host="127.0.0.1", port=5000, log_config=None)
    uvicorn_server = uvicorn.Server(config)
    uvicorn_thread = threading.Thread(target=uvicorn_server.run, daemon=True)
    uvicorn_thread.start()
    if not wait_for_port("127.0.0.1", 5000):
        raise RuntimeError("FastAPI did not become ready on port 5000")
    print("FastAPI ready.")


def start_nginx():
    print("Starting nginx...")
    nginx_path = BASE / "nginx"
    (nginx_path / "logs").mkdir(parents=True, exist_ok=True)
    (nginx_path / "temp").mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [str(nginx_path / "nginx.exe"), "-p", str(nginx_path), "-c", "conf/nginx.conf"],
        cwd=BASE,
    )
    add_to_job(proc)
    processes["nginx"] = proc
    if not wait_for_port("127.0.0.1", 8080):
        raise RuntimeError("nginx did not become ready on port 8080")
    print("nginx ready.")


def shutdown():
    print("\nShutting down...")

    if "nginx" in processes:
        try:
            subprocess.run(
                [str(BASE / "nginx" / "nginx.exe"), "-p", str(BASE / "nginx"), "-s", "stop"],
                cwd=BASE, timeout=10,
            )
            processes["nginx"].wait(timeout=10)
        except Exception as e:
            print(f"nginx stop failed: {e}")

    if uvicorn_server:
        uvicorn_server.should_exit = True
        uvicorn_thread.join(timeout=10)

    proc = processes.get("livekit")
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            print("livekit did not exit cleanly, killing.")
            proc.kill()

    print("Shutdown complete.")


def main():
    global job
    try:
        job = create_kill_on_close_job()
        ensure_env()
        run_generate_configs()
        start_livekit()
        start_fastapi()
        start_nginx()

        url = "http://localhost:8080/"
        print(f"Opening {url}")
        webbrowser.open(url)

        print("\nAll services running. Press Ctrl+C to stop.\n")
        while True:
            time.sleep(1)
            for name, proc in processes.items():
                if proc.poll() is not None:
                    print(f"WARNING: {name} exited unexpectedly (code {proc.returncode})")
            if not uvicorn_thread.is_alive():
                print("WARNING: fastapi thread exited unexpectedly")

    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Launch failed: {e}")
    finally:
        shutdown()


if __name__ == "__main__":
    main()