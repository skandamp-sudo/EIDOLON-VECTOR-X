"""POSIX loopback development supervisor. The control socket belongs to this checkout."""
import fcntl
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / ".runtime"
CONTROL = RUN / "dev.sock"
FRONT = ROOT / "frontend"
BACK = [str(ROOT / ".venv/bin/python"), "-m", "uvicorn", "backend.api:app",
        "--host", "127.0.0.1", "--port", "8000", "--reload", "--reload-dir", "backend",
        "--no-access-log", "--log-level", "info"]
WEB = ["node", str(FRONT / "node_modules/vite/bin/vite.js")]


def relay(pipe, name):
    handler = RotatingFileHandler(RUN / f"{name}.log", maxBytes=1_000_000, backupCount=2)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    with pipe:
        for line in iter(lambda: pipe.readline(8192), b""):
            logger.info("%s", line.decode(errors="replace").rstrip())
    logger.removeHandler(handler)
    handler.close()


def control(command):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(12)
        client.connect(str(CONTROL))
        client.sendall(command.encode())
        return client.recv(128).decode()


def supervise():
    os.chdir(ROOT)
    os.umask(0o077)
    RUN.mkdir(mode=0o700, exist_ok=True)
    guard = (RUN / "dev.lock").open("a")
    try:
        fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit("A supervisor already owns this workspace.")
    CONTROL.unlink(missing_ok=True)
    children = []
    readers = []
    stopping = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    with tempfile.TemporaryDirectory(prefix="vector-x-vite-") as cache, socket.socket(socket.AF_UNIX) as listener:
        listener.bind(str(CONTROL))
        listener.listen(4)
        listener.settimeout(.25)
        pending = None
        try:
            # Refuse occupied ports before launching either service.
            for port in (5173, 8000):
                with socket.socket() as probe:
                    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    probe.bind(("127.0.0.1", port))
            for name, args, cwd in [("backend", BACK, ROOT), ("frontend", WEB, FRONT)]:
                child = subprocess.Popen(args, cwd=cwd, stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True,
                    env={**os.environ, "VECTOR_X_VITE_CACHE": cache,
                         "VECLIB_MAXIMUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"})
                children.append(child)
                thread = threading.Thread(target=relay, args=(child.stdout, name), daemon=True)
                thread.start()
                readers.append(thread)
            print("Starting Vector-X at http://localhost:5173 (API :8000)", flush=True)
            while not stopping.is_set():
                if any(child.poll() is not None for child in children):
                    raise SystemExit("A service exited. Inspect .runtime/backend.log and frontend.log.")
                try:
                    conn, _ = listener.accept()
                except TimeoutError:
                    continue
                conn.settimeout(1)
                try:
                    command = conn.recv(32)
                    if command == b"ping":
                        conn.sendall(b"vector-x")
                    elif command == b"stop":
                        pending = conn
                        break
                except OSError:
                    pass
                conn.close()
        finally:
            for child in children:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            for child in children:
                try:
                    child.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
            for thread in readers:
                thread.join(timeout=1)
            CONTROL.unlink(missing_ok=True)
            if pending is not None:
                with pending:
                    pending.sendall(b"stopped")


def ready():
    for port in (8000, 5173):
        with urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=2) as res:
            health = json.load(res)
            if health != {"service":"eidolon-vector-x","status":"ready","version":"0.1.0"}:
                return False
    with urlopen("http://127.0.0.1:5173", timeout=2) as res:
        return b"Vector-X" in res.read(8192)


def start():
    RUN.mkdir(mode=0o700, exist_ok=True)
    with (RUN / "start.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if CONTROL.exists():
            try:
                if control("ping") == "vector-x" and ready():
                    print("Available at http://localhost:5173")
                    return
            except (OSError, URLError, ValueError):
                pass
        # The long-running processes have separate rotating logs.
        with (RUN / "startup.log").open("w") as log:
            proc = subprocess.Popen([sys.executable, __file__, "serve"], cwd=ROOT, stdin=subprocess.DEVNULL,
                stdout=log, stderr=log, start_new_session=True)
        deadline = time.monotonic() + 90
        try:
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    raise SystemExit((RUN / "startup.log").read_text()[-2000:])
                try:
                    if CONTROL.exists() and ready():
                        print("Available at http://localhost:5173  ·  API http://localhost:8000/api/v1/health")
                        return
                except (OSError, URLError, ValueError):
                    pass
                time.sleep(.35)
            raise SystemExit("Startup timed out. Inspect .runtime logs.")
        except BaseException:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=12)
            raise


if __name__ == "__main__":
    action = sys.argv[1:]
    if action == ["serve"]:
        supervise()
    elif action == ["start"]:
        start()
    elif action == ["stop"]:
        try:
            if control("stop") != "stopped":
                raise SystemExit("Unexpected supervisor response")
            print("Stopped both development services.")
        except (ConnectionRefusedError, FileNotFoundError):
            print("No active workspace supervisor.")
    else:
        raise SystemExit("Use scripts/start or scripts/stop")
