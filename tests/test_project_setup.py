import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_python_version():
    assert sys.version_info[:2] == (3, 11)


def test_required_project_files_exist():
    required_files = [
        "pyproject.toml",
        "requirements.txt",
        "README.md",
        ".gitignore",
        "src/periorder/__init__.py",
    ]

    for filename in required_files:
        assert (ROOT / filename).is_file(), f"Missing file: {filename}"


def test_required_directories_exist():
    required_directories = [
        "data/raw",
        "data/interim",
        "data/processed",
        "models",
        "results",
        "src/periorder",
        "api",
        "dashboard",
        "scripts",
        "tests",
    ]

    for directory in required_directories:
        assert (ROOT / directory).is_dir(), (
            f"Missing directory: {directory}"
        )


def test_periorder_package_imports():
    import periorder

    assert periorder is not None
