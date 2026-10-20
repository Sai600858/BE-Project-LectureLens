"""Master benchmark runner executing baselines, proposed method, and summary table generation."""

from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from salkg.cli import cmd_run_ablation, cmd_run_baselines, cmd_run_proposed
import argparse


def run_full_benchmark():
    print("==================================================")
    print("1. Running Baseline Alignments...")
    print("==================================================")
    args_base = argparse.Namespace(
        config="research_salkg/configs/default.yaml",
        manifest="research_salkg/experiments/manifests/dataset_manifest.json",
        output="research_salkg/results/raw",
        split="test",
    )
    cmd_run_baselines(args_base)

    print("\n==================================================")
    print("2. Running Proposed SALKG Method...")
    print("==================================================")
    args_prop = argparse.Namespace(
        config="research_salkg/configs/default.yaml",
        manifest="research_salkg/experiments/manifests/dataset_manifest.json",
        output="research_salkg/results/processed",
        split="test",
    )
    cmd_run_proposed(args_prop)

    print("\n==================================================")
    print("3. Running Ablation Studies...")
    print("==================================================")
    args_abl = argparse.Namespace(
        config="research_salkg/configs/experiment.yaml",
        split="test",
    )
    cmd_run_ablation(args_abl)

    print("\n==================================================")
    print("4. Aggregating Master Comparison Table...")
    print("==================================================")
    base_file = Path("research_salkg/results/raw/baselines_output.json")
    prop_file = Path("research_salkg/results/processed/proposed_results.json")

    with open(base_file, "r", encoding="utf-8") as f:
        baselines_data = json.load(f)

    with open(prop_file, "r", encoding="utf-8") as f:
        proposed_data = json.load(f)

    # Compute averages across test lectures
    temp_p, temp_r, temp_f1 = [], [], []
    sem_p, sem_r, sem_f1 = [], [], []
    comb_p, comb_r, comb_f1 = [], [], []
    for rec in baselines_data:
        temp_p.append(rec["temporal"]["precision"])
        temp_r.append(rec["temporal"]["recall"])
        temp_f1.append(rec["temporal"]["f1"])

        sem_p.append(rec["semantic"]["precision"])
        sem_r.append(rec["semantic"]["recall"])
        sem_f1.append(rec["semantic"]["f1"])

        comb_p.append(rec["combined"]["precision"])
        comb_r.append(rec["combined"]["recall"])
        comb_f1.append(rec["combined"]["f1"])

    prop_p, prop_r, prop_f1, prop_cov = [], [], [], []
    prop_sel_p, prop_forced_acc = [], []
    edge_p, edge_r, edge_f1 = [], [], []
    strict_edge_f1, relaxed_edge_f1 = [], []
    for rec in proposed_data.get("lectures", []):
        am = rec["alignment_metrics"]
        prop_p.append(am["precision"])
        prop_r.append(am["recall"])
        prop_f1.append(am["f1"])
        prop_cov.append(am["coverage"])
        prop_sel_p.append(am.get("selective_precision", am["precision"]))
        prop_forced_acc.append(am.get("forced_choice_accuracy", am["precision"]))

        gm = rec["graph_metrics"]
        edge_p.append(gm["edge_precision"])
        edge_r.append(gm["edge_recall"])
        edge_f1.append(gm["edge_f1"])
        strict_edge_f1.append(gm.get("strict_edge_f1", gm["edge_f1"]))
        relaxed_edge_f1.append(gm.get("relaxed_edge_f1", gm["edge_f1"]))

    avg = lambda lst: sum(lst) / len(lst) if lst else 0.0

    master_table = {
        "evaluation_split": "held_out_test",
        "methods": {
            "Baseline A (Temporal-Only)": {
                "precision": round(avg(temp_p), 4),
                "recall": round(avg(temp_r), 4),
                "f1": round(avg(temp_f1), 4),
                "coverage": 1.0,
            },
            "Baseline B (Semantic-Only TF-IDF)": {
                "precision": round(avg(sem_p), 4),
                "recall": round(avg(sem_r), 4),
                "f1": round(avg(sem_f1), 4),
                "coverage": 1.0,
            },
            "Baseline C (Independent Combined Weighted)": {
                "precision": round(avg(comb_p), 4),
                "recall": round(avg(comb_r), 4),
                "f1": round(avg(comb_f1), 4),
                "coverage": 1.0,
            },
            "Proposed SALKG (Full Pipeline)": {
                "precision": round(avg(prop_p), 4),
                "recall": round(avg(prop_r), 4),
                "f1": round(avg(prop_f1), 4),
                "selective_precision": round(avg(prop_sel_p), 4),
                "forced_choice_accuracy": round(avg(prop_forced_acc), 4),
                "coverage": round(avg(prop_cov), 4),
                "knowledge_graph_edge_f1": round(avg(edge_f1), 4),
                "strict_edge_f1": round(avg(strict_edge_f1), 4),
                "relaxed_edge_f1": round(avg(relaxed_edge_f1), 4),
            },
        },
        "subject_classification": proposed_data.get("subject_classification_metrics", {}),
    }

    table_path = Path("research_salkg/results/tables/master_benchmark_comparison.json")
    table_path.parent.mkdir(parents=True, exist_ok=True)
    with open(table_path, "w", encoding="utf-8") as f:
        json.dump(master_table, f, indent=2)

    print(f"Master benchmark table successfully generated at: {table_path}")
    print(json.dumps(master_table, indent=2))


if __name__ == "__main__":
    run_full_benchmark()
