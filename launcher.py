import subprocess
import socket
import sys
import time
import webbrowser
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "server"))
from networking import get_local_ip  # noqa: E402

processes = {}  # name -> Popen


def wait_for_port(host, port, timeout=30, interval=0.3):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(interval)
    return False


def run_generate_configs():
    print("Generating configs...")
    result = subprocess.run(
        ["uv", "run", "python", "generate_configs.py"],
        cwd=BASE / "server",
    )
    if result.returncode != 0:
        raise RuntimeError("generate_configs.py failed")


def start_livekit():
    print("Starting LiveKit server...")
    proc = subprocess.Popen(
        [str(BASE / "livekit" / "livekit-server.exe"),
         "--config", str(BASE / "livekit" / "livekit.yaml")],
        cwd=BASE,
    )
    processes["livekit"] = proc
    if not wait_for_port("127.0.0.1", 7880):
        raise RuntimeError("LiveKit server did not become ready on port 7880")
    print("LiveKit server ready.")


def start_fastapi():
    print("Starting FastAPI...")
    proc = subprocess.Popen(
        ["uv", "run", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "5000"],
        cwd=BASE / "server",
    )
    processes["fastapi"] = proc
    if not wait_for_port("127.0.0.1", 5000):
        raise RuntimeError("FastAPI did not become ready on port 5000")
    print("FastAPI ready.")


def start_nginx():
    print("Starting nginx...")
    proc = subprocess.Popen(
        [str(BASE / "nginx" / "nginx.exe"),
         "-p", str(BASE / "nginx"),
         "-c", "conf/nginx.conf"],
        cwd=BASE,
    )
    processes["nginx"] = proc
    if not wait_for_port("127.0.0.1", 8080):
        raise RuntimeError("nginx did not become ready on port 8080")
    print("nginx ready.")


def shutdown():
    print("\nShutting down...")

    if "nginx" in processes:
        subprocess.run([str(BASE / "nginx" / "nginx.exe"), "-s", "stop"], cwd=BASE)
        processes["nginx"].wait(timeout=10)

    for name in ("fastapi", "livekit"):
        proc = processes.get(name)
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                print(f"{name} did not exit cleanly, killing.")
                proc.kill()

    print("Shutdown complete.")


def main():
    try:
        run_generate_configs()
        start_livekit()
        start_fastapi()
        start_nginx()

        url = f"http://localhost:8080/"
        print(f"Opening {url}")
        webbrowser.open(url)

        print("\nAll services running. Press Ctrl+C to stop.\n")
        while True:
            time.sleep(1)
            for name, proc in processes.items():
                if proc.poll() is not None:
                    print(f"WARNING: {name} exited unexpectedly (code {proc.returncode})")

    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Launch failed: {e}")
    finally:
        shutdown()


if __name__ == "__main__":
    main()