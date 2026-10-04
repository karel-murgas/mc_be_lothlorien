"""Keep asset generators from overwriting contextual translations."""
import sys
from pathlib import Path

MOD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MOD.parents[1] / 'tools'))
from localization import register_generated_entries


def merge_localized_names(entries):
    return register_generated_entries(MOD, 'lothlorien_rp', entries)
