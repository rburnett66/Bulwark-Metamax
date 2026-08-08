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
import base64
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

    def _reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _loopback_only(self, endpoint):
        """LOOPBACK ONLY. With --lan the bind is 0.0.0.0, which made /__ship writable by anything on the
        Wi-Fi. The path whitelist prevents escaping content/**, not overwriting what is inside it — so a
        phone on the same network could replace any unit manifest or sprite. Authoring is local-only.
        Shared by every mutating endpoint so the two can never drift apart — /__unship DELETES content,
        so it needs this rail at least as much as the write path does."""
        peer = (self.client_address[0] if self.client_address else "")
        if peer in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            return True
        self._reply(403, {"ok": False, "error": f"{endpoint} is loopback-only (peer {peer})"})
        return False

    # The image formats /__ship will write, each with the magic bytes a payload MUST start with. This is
    # the check that makes the extension a claim the server verifies rather than one it takes on trust:
    # without it `path` decides the name on disk and `b64` decides the contents, independently, and a
    # loopback POST could put arbitrary bytes under a .png name. JPEG earns the same rigour as PNG did --
    # SOI marker, then the JFIF/Exif/raw APPn byte, which is every JPEG a canvas will produce.
    #   PNG   89 50 4E 47 0D 0A 1A 0A   the 8-byte signature
    #   JPEG  FF D8 FF                  SOI + the first marker's FF
    _IMAGE_MAGIC = {
        ".png": bytes.fromhex("89504e470d0a1a0a"),
        ".jpg": bytes.fromhex("ffd8ff"),
    }

    @staticmethod
    def _content_path(req):
        """The ONE path whitelist, shared by write and delete: a relative path under content/, no escape,
        .json or an allowed image extension only, never code.
        Returns (rel, abs_dest, magic) -- magic is None for .json, else the required leading bytes."""
        rel = str(req.get("path", "")).replace("\\", "/").lstrip("/")
        norm = os.path.normpath(rel).replace("\\", "/")
        # .json carries `data` (an object); an image carries `b64` (a bare-or-data-URL base64 image).
        # PNGs are allowed so sprite atlases can live on disk instead of being inlined as base64 in
        # the units manifest -- three units of inline atlases reached 4.2 MB, past the localStorage
        # ceiling. JPEG joined them for the unit CARDS (BBB-1): a measured 256x256 card is 13.9 KB as
        # PNG and 5.2 KB as JPEG q0.9, and a 90-unit catalog is one such file per unit.
        # Still whitelisted to content/**, still no path escape, still never code.
        # EXACTLY these spellings, case included. Lower-casing before the lookup would widen the
        # whitelist the PNG check never widened: it would accept `card/X.JPG`, write it under that name,
        # and the resolver -- which asks for `<id>.jpg` -- would never find it again on any filesystem
        # that tells the two apart. One spelling per format, and `.jpeg` is not one of them.
        ext = os.path.splitext(rel)[1]
        magic = _NoCacheHandler._IMAGE_MAGIC.get(ext)
        allowed = sorted(_NoCacheHandler._IMAGE_MAGIC) + [".json"]
        if norm != rel or not rel.startswith("content/") or ".." in rel or ext not in allowed:
            raise ValueError(f"path not allowed: {rel!r} "
                             f"(must be content/** with one of {', '.join(allowed)})")
        return rel, os.path.join(directory, *rel.split("/")), magic

    # Files that carry EVERY unit / every prop. Removing one unit means rewriting these with its entry
    # gone (that goes through /__ship, which is atomic and keeps a .bak); DELETING one would take the
    # whole roster with it. A delete endpoint that can do that is one typo away from wiping the content
    # set, so it simply cannot address them.
    _UNDELETABLE = ("content/units/voxel-units.json", "content/decor/voxel-decor.json")

    def do_POST(self):
        # /__ship — the tools' one-click "Ship to repo": writes authored content (Terrain Forge maps,
        # Stack Forge units manifest) into the SERVED tree's content/ folder so the dev-hot-loop
        # localStorage state and the committed ship files can't silently diverge (owner 2026-07-16:
        # the deployed game fell back to the generator map because no export was ever committed).
        # /__unship — the same door, opening the other way: REMOVE one authored file (Stack Forge's
        # "remove unit"). Same loopback rail, same path whitelist, and it never unlinks — see below.
        # Local dev only — the deployed static site has no POST, so the tools degrade gracefully.
        route = self.path.split("?")[0]
        if route == "/__unship":
            self.do_UNSHIP()
            return
        if route != "/__ship":
            self.send_error(404)
            return
        if not self._loopback_only("/__ship"):
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n))
            rel, dest, magic = self._content_path(req)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            # ATOMIC. Writing in place truncates the destination if anything fails mid-write — and one of
            # these destinations, content/units/voxel-units.json, carries EVERY unit. Write a temp file
            # beside it and os.replace() (atomic on NTFS), keeping the previous version as .bak. Given how
            # many ways content has been lost, the .bak is the cheapest recoverability available.
            tmp = dest + ".tmp"
            if magic:
                ext = os.path.splitext(rel)[1]
                raw = str(req.get("b64", ""))
                if not raw:
                    raise ValueError(f"{ext} request has no b64 payload")
                if raw.startswith("data:"):
                    raw = raw.split(",", 1)[-1]
                blob = base64.b64decode(raw + "=" * (-len(raw) % 4))
                # THE EXTENSION IS CHECKED AGAINST THE BYTES, per format. A canvas that cannot encode the
                # requested mime type quietly hands back a PNG data URL, so this is not a theoretical
                # mismatch -- it is the exact way a .jpg on disk would end up holding PNG bytes.
                if blob[:len(magic)] != magic:
                    raise ValueError(f"payload is not a {ext} image "
                                     f"(starts {blob[:4].hex() or '<empty>'})")
                with open(tmp, "wb") as f:
                    f.write(blob)
            else:
                # A missing `data` used to write literal null AND return ok:true — a malformed request
                # blanked the manifest and told the tool it had worked.
                if "data" not in req or req.get("data") is None:
                    raise ValueError("json request has no data payload — refusing to blank the file")
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(req.get("data"), f, indent=None, separators=(",", ":"))
            if os.path.exists(dest):
                try:
                    os.replace(dest, dest + ".bak")
                except OSError:
                    pass                                            # a missing .bak must never block the write
            os.replace(tmp, dest)
            self._reply(200, {"ok": True, "path": rel, "bytes": os.path.getsize(dest)})
        except Exception as e:  # noqa: BLE001 — report the reason to the tool UI
            self._reply(400, {"ok": False, "error": str(e)})

    def do_UNSHIP(self):
        """Remove ONE authored file from content/**. Strictly more dangerous than a write, so it carries
        every rail the write path has and two more of its own:

          * loopback only, and the SAME path whitelist (content/**, .json or .png, no traversal) — both
            shared with /__ship as single functions, so a fix to one can never miss the other.
          * it REFUSES the shared manifests (_UNDELETABLE): one unit is removed by rewriting those files
            without its entry, never by deleting them.
          * it NEVER unlinks. The file is moved to <path>.bak — the same recovery the atomic write path
            already leaves behind — so a mistaken removal of the owner's authored art is `mv` away from
            being undone. Directories are never touched.

        A file that is already gone is ok:true / existed:false, not an error: removal is made of several
        deletes and has to be safely repeatable after a partial failure."""
        if not self._loopback_only("/__unship"):
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n))
            rel, dest, _ = self._content_path(req)
            if rel in self._UNDELETABLE:
                raise ValueError(f"{rel} carries the WHOLE set — remove one entry by shipping the file "
                                 f"without it, not by deleting the file")
            if os.path.isdir(dest):
                raise ValueError(f"{rel} is a directory")
            if not os.path.exists(dest):
                self._reply(200, {"ok": True, "path": rel, "existed": False, "trash": None})
                return
            trash = dest + ".bak"
            os.replace(dest, trash)                     # MOVED, never unlinked — recoverable on disk
            self._reply(200, {"ok": True, "path": rel, "existed": True, "trash": rel + ".bak"})
        except Exception as e:  # noqa: BLE001 — report the reason to the tool UI
            self._reply(400, {"ok": False, "error": str(e)})

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
