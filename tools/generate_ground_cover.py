"""Lothlorien entrypoint for the shared cover generator, with production support.

Accepts the shared gen_ground_cover.py arguments unchanged. Use this entrypoint
instead of invoking that shared generator directly for Lothlorien.
"""
import runpy
from pathlib import Path
from configure_support import main as configure_production_support

if __name__ == "__main__":
    workspace = Path(__file__).resolve().parents[3]
    runpy.run_path(str(workspace / ".claude/skills/bedrock-block-families/scripts/gen_ground_cover.py"), run_name="__main__")
    configure_production_support()
