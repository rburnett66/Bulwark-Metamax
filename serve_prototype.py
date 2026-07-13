#!/usr/bin/env python3
"""
serve_prototype.py — run a MetaMax UX prototype as a simple local app.

Double-clicking an exported prototype uses file://, which Chrome locks down (data:
images get blocked, opaque-origin errors). This serves it over http://localhost and
opens your browser, so it just works.

    python serve_prototype.py                       # serves Bass-tastic-prototype.html
    python serve_prototype.py path/to/prototype.html

Ctrl+C to stop.
"""
import datetime
import functools
import http.server
import json
import os
import socket
import socketserver
import subprocess
import sys
import threading
import webbrowser

# --lan: also serve on the local network so a PHONE on the same Wi-Fi can play —
#   python serve_prototype.py "prototype/test-game/index.html" --lan
# then open the printed http://<pc-ip>:<port>/... URL on the phone. (Windows may ask to
# allow python through the firewall the first time — allow on Private networks.)
args = [a for a in sys.argv[1:] if a != "--lan"]
LAN = "--lan" in sys.argv[1:]

html = args[0] if args else "Bass-tastic-prototype.html"
html = os.path.abspath(html)
if not os.path.exists(html):
    sys.exit(f"Not found: {html}")

directory = os.path.dirname(html)
fname = os.path.basename(html)


class _NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Never serve a stale cached file. Different prototypes get served on reused ports (9000-9049),
    and the default handler returns 304 Not Modified off the browser's cache — so a tab that earlier
    loaded a DIFFERENT prototype on this port would replay that one's index.html (and 404 on its
    sub-files). Strip conditional-request headers (force a fresh 200) and tell the browser not to cache."""

    def send_head(self):
        for h in ("If-Modified-Since", "If-None-Match"):
            if h in self.headers:
                del self.headers[h]
        return super().send_head()

    def do_GET(self):
        # /__version — which git commit the served tree is at, so the game HUD can show a build stamp
        # ("is this tab actually running the new code?"). Dirty = uncommitted changes under the SERVED
        # directory only (the repo's docs churn constantly; that isn't this prototype's dirtiness).
        if self.path.split("?")[0] == "/__version":
            try:
                def git(*args):
                    r = subprocess.run(["git", "-C", directory] + list(args),
                                       capture_output=True, text=True, timeout=5)
                    return r.stdout.strip() if r.returncode == 0 else ""
                commit = git("rev-parse", "--short", "HEAD") or "unknown"
                branch = git("rev-parse", "--abbrev-ref", "HEAD")
                dirty = bool(git("status", "--porcelain", "--", "."))
            except Exception:
                commit, branch, dirty = "unknown", "", False
            body = json.dumps({
                "commit": commit, "branch": branch, "dirty": dirty,
                "time": datetime.datetime.now().isoformat(timespec="seconds"),
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler = functools.partial(_NoCacheHandler, directory=directory)

# Find a free port starting at 9000.
bind = "0.0.0.0" if LAN else "127.0.0.1"
port = 9000
while port < 9050:
    try:
        httpd = socketserver.TCPServer((bind, port), Handler)
        break
    except OSError:
        port += 1
else:
    sys.exit("No free port in 9000-9049.")

url = f"http://127.0.0.1:{port}/{fname}"
print(f"Serving {fname}\n  {url}")
if LAN:
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))          # no traffic sent — just resolves the outbound iface IP
        lan_ip = probe.getsockname()[0]
        probe.close()
        print(f"  phone (same Wi-Fi): http://{lan_ip}:{port}/{fname}")
    except OSError:
        print("  (could not detect the LAN IP — run `ipconfig` and use the IPv4 address)")
print("(Ctrl+C to stop)")
threading.Timer(0.6, lambda: webbrowser.open(url)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nstopped.")
finally:
    httpd.server_close()
