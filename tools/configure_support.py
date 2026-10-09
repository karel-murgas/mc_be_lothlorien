"""Apply production support metadata after regenerating blocks; no art changes.

Run python -B tools/configure_support.py after any block generator.
The native placement filters remain authoritative for eligibility.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"
MOUNTED = {"deer_antler", "elven_lantern", "elven_lantern_heartwood", "firefly_jar", "elven_chandelier",
           "mallorn_button", "mallorn_heartwood_button"}
EXTRA = {"mallorn_door", "mallorn_heartwood_door", "elven_rope", "elven_rope_hanging"}
COVERS = {"mallorn_leaf_carpet", "mallorn_blossom"}


def configure(block):
    b = block["minecraft:block"]
    name = b["description"]["identifier"].split(":")[1]
    c = b["components"]
    placement = c.get("minecraft:placement_filter")
    if not (placement or name in MOUNTED or name in EXTRA):
        return None
    c["minecraft:movable"] = {"movement_type": "popped"}
    c["lothlorien:motion_support"] = {}
    c.setdefault("minecraft:tick", {"interval_range": [2, 2], "looping": True})
    if name in COVERS:
        c["minecraft:loot"] = f"loot_tables/blocks/{name}.json"
        permutations = b.setdefault("permutations", [])
        permutations[:] = [p for p in permutations if not p.get("components", {}).get("minecraft:loot", "").startswith(f"loot_tables/blocks/{name}_")]
        for count in range(2, 5):
            permutations.append({"condition": f"q.block_state('lothlorien:amount') == {count}",
                "components": {"minecraft:loot": f"loot_tables/blocks/{name}_{count}.json"}})
    elif name.startswith("elven_rope"):
        c["minecraft:loot"] = "loot_tables/blocks/elven_rope.json"
    condition = placement["conditions"][0] if placement else {}
    return {"mount": "face" if name in MOUNTED else "rope" if name.startswith("elven_rope") else
            "door" if name.endswith("_door") else "ceiling" if condition.get("allowed_faces") == ["down"] else "floor",
            "allowed": condition.get("block_filter")}


def main():
    policies = {}
    for path in sorted((BP / "blocks").glob("*.json")):
        block = json.loads(path.read_text(encoding="utf8"))
        policy = configure(block)
        if policy is None:
            continue
        policies[block["minecraft:block"]["description"]["identifier"]] = policy
        # Preserve the repository's newline convention on Windows.
        baseline = subprocess.run(["git", "show", "HEAD:" + path.relative_to(ROOT).as_posix()],
                                  cwd=ROOT, capture_output=True).stdout
        newline = "\r\n" if b"\r\n" in baseline else "\n"
        with path.open("w", encoding="utf8", newline="") as stream:
            stream.write((json.dumps(block, indent=2) + "\n").replace("\n", newline))
    (BP / "scripts/support_policies.js").write_text(
        "// Generated from the native block placement filters by tools/configure_support.py.\n"
        "export const SUPPORT_POLICIES = " + json.dumps(policies, indent=2) + ";\n", encoding="utf8")
    for name in COVERS:
        for count in range(1, 5):
            loot = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"lothlorien:{name}",
                "functions": [{"function": "set_count", "count": count}]}]}]}
            suffix = "" if count == 1 else f"_{count}"
            (BP / f"loot_tables/blocks/{name}{suffix}.json").write_text(json.dumps(loot, indent=2) + "\n", encoding="utf8")
    (BP / "loot_tables/blocks/elven_rope.json").write_text(json.dumps({"pools": [{"rolls": 1,
        "entries": [{"type": "item", "name": "lothlorien:elven_rope"}]}]}, indent=2) + "\n", encoding="utf8")
    print(f"Configured piston support for {len(policies)} block definitions.")


if __name__ == "__main__":
    main()
