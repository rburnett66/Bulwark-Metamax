#!/usr/bin/env python3
"""
verify_art_mirror.py — GUARD for the MetaMax local asset mirror (docs/art/).

The failure it catches: the MetaMax bridge write fails (413 over the ~2 MiB cap, connection abort,
auth blackout) but the manifest still lists the asset — the local mirror silently drifts from the
cloud, and every later launch spams 404s for files that never landed.

  python tools/verify_art_mirror.py           # report drift; exit 1 if the mirror is incomplete
  python tools/verify_art_mirror.py --quiet   # one-line summary only (for loops/hooks)

Writes docs/art/missing-local.txt (the exact heal list) whenever files are missing; removes it
when the mirror is clean. Exit codes: 0 = clean, 1 = missing files, 2 = no manifest.

The REAL fix belongs in MetaMax itself (make manifest-update transactional with the file write,
verify after write, surface 413s as "asset too large"); this guard is the local tripwire until
that lands.
"""
import argparse
import json
import sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()

    art = Path(__file__).resolve().parents[1] / 'docs' / 'art'
    manifest = art / 'manifest.json'
    if not manifest.is_file():
        print(f'no manifest at {manifest}')
        return 2

    entries = json.loads(manifest.read_text(encoding='utf-8'))
    want = {e['file'] for e in entries if isinstance(e, dict) and e.get('file')}
    have = {p.name for p in art.glob('*.png')}
    missing = sorted(want - have)
    unmanifested = sorted(have - want)

    listing = art / 'missing-local.txt'
    if missing:
        listing.write_text('\n'.join(missing), encoding='utf-8')
    elif listing.exists():
        listing.unlink()

    print(f'art mirror: {len(want)} in manifest | {len(have)} on disk | '
          f'MISSING {len(missing)} | unmanifested {len(unmanifested)}')
    if missing and not args.quiet:
        for f in missing[:10]:
            print('  missing:', f)
        if len(missing) > 10:
            print(f'  ... and {len(missing) - 10} more (full list: docs/art/missing-local.txt)')
    return 1 if missing else 0

if __name__ == '__main__':
    sys.exit(main())
