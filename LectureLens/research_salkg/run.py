#!/usr/bin/env python3
"""Convenient zero-configuration runner for SALKG CLI commands."""

import sys
from pathlib import Path

# Automatically inject research_salkg/src into sys.path
src_dir = Path(__file__).resolve().parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from salkg.cli import main

if __name__ == "__main__":
    main()
