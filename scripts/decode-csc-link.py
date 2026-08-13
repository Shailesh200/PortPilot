#!/usr/bin/env python3
"""Decode GitHub secret CSC_LINK (base64 p12) to a file. Env: CSC_LINK_SECRET, P12_FILE."""
import base64
import os
import pathlib
import sys

raw = os.environ.get("CSC_LINK_SECRET", "")
dest = os.environ.get("P12_FILE", "")
if not raw or not dest:
    print("CSC_LINK_SECRET and P12_FILE are required", file=sys.stderr)
    sys.exit(1)

data = base64.b64decode("".join(raw.split()))
if not data:
    print("CSC_LINK decoded to empty bytes", file=sys.stderr)
    sys.exit(1)

path = pathlib.Path(dest)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_bytes(data)
print(f"Decoded Developer ID p12 ({len(data)} bytes)")
