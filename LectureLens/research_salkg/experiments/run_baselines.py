"""Script to run and evaluate baseline alignment models."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

# Ensure src is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from salkg.cli import cmd_run_baselines

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run baseline models on benchmark lectures")
    parser.add_argument("--config", default="research_salkg/configs/default.yaml")
    parser.add_argument("--manifest", default="research_salkg/experiments/manifests/dataset_manifest.json")
    parser.add_argument("--output", default="research_salkg/results/raw")
    args = parser.parse_args()
    sys.exit(cmd_run_baselines(args))
