"""Script to run ablation studies over SALKG components."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from salkg.cli import cmd_run_ablation

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run SALKG ablation study")
    parser.add_argument("--config", default="research_salkg/configs/experiment.yaml")
    args = parser.parse_args()
    sys.exit(cmd_run_ablation(args))
