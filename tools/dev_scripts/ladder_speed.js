// DEV ONLY, not part of the pack. `/scriptevent lothlorien:ladder_speed` toggles an actionbar
// readout of the real vertical speed (blocks/s, mean of the last 40 ticks) while the player climbs a vanilla ladder
// (isClimbing) or stands in an Elven rope, split by what the player holds: jump, forward, sneak or nothing.
// Wire up: copy into lothlorien_bp/scripts/ and add `import "./ladder_speed.js";` to main.js (it subscribes itself).
import { system, world } from "@minecraft/server";
import { inRope } from "./elven_rope.js";

const TAG = "lothlorien_ladder_speed";
const WINDOW = 40;
const samples = new Map(); // "player|source|input" -> last speeds
const last = new Map(); // player id -> { y, active }

function input(player) {
  const info = player.inputInfo;
  const jump = info.getButtonState("Jump") === "Pressed";
  const forward = info.getMovementVector().y > 0.3;
  if (player.isSneaking) return "sneak";
  if (jump && forward) return "jump+fwd";
  return jump ? "jump" : forward ? "forward" : "idle";
}

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id !== "lothlorien:ladder_speed" || !sourceEntity) return;
  if (sourceEntity.hasTag(TAG)) sourceEntity.removeTag(TAG);
  else sourceEntity.addTag(TAG);
});

system.runInterval(() => {
  for (const player of world.getPlayers({ tags: [TAG] })) {
    try {
      const y = player.location.y;
      const prev = last.get(player.id);
      const source = player.isClimbing ? "ladder" : inRope(player) ? "rope" : undefined;
      last.set(player.id, { y, active: !!source });
      if (!source || !prev?.active) continue;
      const key = `${player.id}|${source}|${input(player)}`;
      const list = samples.get(key) ?? [];
      list.push((y - prev.y) * 20);
      if (list.length > WINDOW) list.shift();
      samples.set(key, list);
      if (system.currentTick % 10 !== 0) continue;
      // compact, one line per source: "ladder J3.20 F3.18 I-2.95 S0.00" (J jump, F forward, B both, I nothing, S sneak)
      const short = { jump: "J", forward: "F", "jump+fwd": "B", idle: "I", sneak: "S" };
      const lines = [];
      for (const src of ["ladder", "rope"]) {
        const parts = [];
        for (const inp of Object.keys(short)) {
          const v = samples.get(`${player.id}|${src}|${inp}`);
          if (v) parts.push(`${short[inp]}${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}`);
        }
        if (parts.length) lines.push(`${src} ${parts.join(" ")}`);
      }
      player.onScreenDisplay.setActionBar(lines.join("\n"));
    } catch {
      // player gone
    }
  }
}, 1);
