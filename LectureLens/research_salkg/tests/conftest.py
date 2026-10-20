"""Pytest configuration to ensure salkg package is always on sys.path."""

import sys
from pathlib import Path

# Add research_salkg/src to sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))
