#!/usr/bin/env python3
"""Pull the built prototype off the hosted MetaMax server onto THIS machine (a durable copy).

The hosted server writes prototypes to its EPHEMERAL disk; if the repo publish is skipped (no PAT),
the files exist only there and are wiped on the next restart. This grabs them via the token-free
`/prototype/export` endpoint and writes them next to this script — then `git add`/`commit` to make
them durable in the repo.

Usage:
    python pull_prototype.py [project_id] [dest_folder]
    # defaults: project_id=16 (Bulwark), dest_folder=.  (this folder)

Auth: set env MM_EMAIL + MM_PASSWORD to skip the prompts.
"""
import os
import sys
import json
import base64
import getpass
import urllib.request

API = os.environ.get("MM_API", "https://api.metamaxdev.ai").rstrip("/")
PROJECT = int(sys.argv[1]) if len(sys.argv) > 1 else 16
DEST = sys.argv[2] if len(sys.argv) > 2 else "."


def _req(path, token=None, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(API + path, data=data,
                               method="POST" if payload is not None else "GET")
    if payload is not None:
        r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.load(resp)


def main():
    email = os.environ.get("MM_EMAIL") or input("MetaMax email: ").strip()
    password = os.environ.get("MM_PASSWORD") or getpass.getpass("Password: ")

    print("Logging in…")
    tok = (_req("/api/auth/login", payload={"email": email, "password": password}) or {}).get("access_token")
    if not tok:
        print("✗ Login failed — no access token returned."); sys.exit(1)

    print(f"Pulling prototype for project {PROJECT} from {API} …")
    exp = _req(f"/api/projects/{PROJECT}/prototype/export", token=tok)
    files = exp.get("files", [])
    if not files:
        print("✗ No prototype files on the server (already wiped, or none built)."); sys.exit(2)

    n = 0
    for f in files:
        rel = str(f["path"]).replace("\\", "/").lstrip("/")
        if ".." in rel.split("/"):
            continue
        dest = os.path.join(DEST, *rel.split("/"))
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        if "text" in f:
            with open(dest, "w", encoding="utf-8") as out:
                out.write(f["text"])
        else:
            with open(dest, "wb") as out:
                out.write(base64.b64decode(f["b64"]))
        n += 1

    print(f"✓ Wrote {n} file(s) under {os.path.abspath(DEST)}")
    print(f"  Entry dir: {exp.get('dir')}")
    print(f"  Run:  python serve_prototype.py \"{exp.get('dir')}/index.html\"")
    print("  Then:  git add -A && git commit -m \"rescue prototype from ephemeral disk\"   # make it durable")


if __name__ == "__main__":
    main()
