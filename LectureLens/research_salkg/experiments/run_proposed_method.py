"""Script to run proposed SALKG pipeline across benchmark lectures."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from salkg.cli import cmd_run_proposed

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run proposed SALKG pipeline")
    parser.add_argument("--config", default="research_salkg/configs/default.yaml")
    parser.add_argument("--manifest", default="research_salkg/experiments/manifests/dataset_manifest.json")
    parser.add_argument("--output", default="research_salkg/results/processed")
    args = parser.parse_args()
    sys.exit(cmd_run_proposed(args))
