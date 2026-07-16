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
import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

html = sys.argv[1] if len(sys.argv) > 1 else "Bass-tastic-prototype.html"
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

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler = functools.partial(_NoCacheHandler, directory=directory)

# Find a free port starting at 9000.
port = 9000
while port < 9050:
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)
        break
    except OSError:
        port += 1
else:
    sys.exit("No free port in 9000-9049.")

url = f"http://127.0.0.1:{port}/{fname}"
print(f"Serving {fname}\n  {url}\n(Ctrl+C to stop)")
threading.Timer(0.6, lambda: webbrowser.open(url)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nstopped.")
finally:
    httpd.server_close()
