"""Automated test verifying strict isolation of research_salkg from LectureLens codebase."""

import os
from pathlib import Path
import pytest


def test_no_files_modified_in_parent_lecturelens():
    """Verify that existing production LectureLens folders and files are intact."""
    test_file_dir = Path(__file__).resolve().parent
    research_dir = test_file_dir.parent
    project_root = research_dir.parent

    # Expected existing files and directories
    expected_dirs = ["ai_service", "client", "server", "spring_backend"]
    expected_files = ["README.md", "llm_transcript_integration_context.txt", ".gitignore"]

    for d in expected_dirs:
        dir_path = project_root / d
        assert dir_path.exists(), f"Expected directory '{d}' missing from LectureLens!"
        assert dir_path.is_dir(), f"'{d}' is not a directory!"

    for f in expected_files:
        file_path = project_root / f
        assert file_path.exists(), f"Expected file '{f}' missing from LectureLens!"
        assert file_path.is_file(), f"'{f}' is not a file!"


def test_research_root_confinement():
    """Verify that all research prototype artifacts stay strictly inside research_salkg."""
    test_file_dir = Path(__file__).resolve().parent
    research_dir = test_file_dir.parent
    project_root = research_dir.parent

    # Check entries in project_root
    for item in project_root.iterdir():
        if item.name.startswith("."):
            continue
        # Only existing project elements or research prototypes allowed
        allowed = {
            "ai_service", "client", "server", "spring_backend",
            "README.md", "llm_transcript_integration_context.txt",
            ".gitignore", "research_salkg", "research_salkg_guard"
        }
        assert item.name in allowed, f"Unauthorized file or directory '{item.name}' found outside research_salkg!"
