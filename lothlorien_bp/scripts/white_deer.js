// White deer guidance in the running game (Phase 12; rules in white_deer_rules.js). Offer Western Corn grain to a
// white deer while your Disharmony is 0: it finds the nearest hidden structure marker (a block in the buried part of
// each giant Mallorn trunk) in the loaded chunks and walks towards it, waiting for the player to keep up.
//
// The walking is done by script: entities have no "walk to X" call in the Script API, so every MOVE_TICKS the deer is
// teleported STEP blocks along a probed, obstacle-avoiding heading. While it guides, the entity sits in the component
// group `lothlorien:state_guiding` (flees only wolves and monsters, not the player).
import { BlockVolume, EquipmentSlot, GameMode, system, world } from "@minecraft/server";
import { disharmonyOf } from "./disharmony_game.js";
import { levelFor } from "./disharmony.js";
import { repeatedUse } from "./use_guard.js";
import {
  CORN_ID, DEER_ID, MARKER_ID, MOVE_TICKS, SEARCH_RADIUS, canBeGuided, horizontal, phase, pickStep, searchSpan, sliceOrigins,
  trackProgress,
} from "./white_deer_rules.js";

const sessions = new Map(); // deer id -> { playerId, target, bestDist, stuck, bias, born, phase }
const searching = new Set(); // deer ids with a marker search in progress

export const isGuiding = (deerId) => sessions.has(deerId);

const say = (player, text) => {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left
  }
};

// Nearest marker around `origin`, found column by column (one chunk-sized volume per job step) so no single tick pays
// for the whole search. Calls done({x, y, z}) or done(undefined).
function findMarker(dimension, origin, done) {
  system.runJob(
    (function* () {
      let best;
      const range = dimension.heightRange;
      const span = searchSpan(origin.y, range.min, range.max);
      for (const slice of sliceOrigins(origin.x, origin.z, SEARCH_RADIUS)) {
        if (best && slice.dist > best.dist) break; // nearest first: nothing farther can win
        try {
          const volume = new BlockVolume({ x: slice.x, y: span.from, z: slice.z }, { x: slice.x + 15, y: span.to, z: slice.z + 15 });
          const found = dimension.getBlocks(volume, { includeTypes: [MARKER_ID] }, true);
          for (const at of found.getBlockLocationIterator()) {
            const dist = horizontal(origin, { x: at.x + 0.5, z: at.z + 0.5 });
            if (!best || dist < best.dist) best = { x: at.x, y: at.y, z: at.z, dist };
          }
        } catch {
          // dimension or chunk went away mid-search
        }
        yield;
      }
      done(best);
    })()
  );
}

function consumeCorn(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  if (!slot?.hasItem() || slot.typeId !== CORN_ID) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

function offer(player, deer) {
  if (sessions.has(deer.id) || searching.has(deer.id)) return;
  if (!canBeGuided(levelFor(disharmonyOf(player).points))) {
    say(player, "§7The white deer shies from your restless spirit.");
    return;
  }
  searching.add(deer.id);
  const dimension = deer.dimension;
  findMarker(dimension, deer.location, (marker) => {
    searching.delete(deer.id);
    try {
      if (!deer.isValid || !player.isValid) return;
      if (!marker) {
        say(player, "§7The white deer eats, looks at you, and stays. It has nowhere to lead you.");
        return;
      }
      consumeCorn(player);
      sessions.set(deer.id, {
        playerId: player.id,
        target: { x: marker.x + 0.5, z: marker.z + 0.5 },
        bestDist: marker.dist,
        stuck: 0,
        bias: 1,
        born: system.currentTick,
        phase: "walk",
      });
      deer.triggerEvent("lothlorien:guide_start");
      say(player, "§fThe white deer lifts its head and turns. Follow it.");
    } catch {
      sessions.delete(deer.id);
    }
  });
}

// Standing height of a deer at column (x, z), reached from feet height y: the ground within reach below, two blocks
// of clearance above it, no liquid. undefined = cannot stand there. Passable plants (grass, ferns, flowers, leaf
// litter) do not stop the rays, so the deer walks through the forest floor.
function probe(dimension, x, z, y) {
  try {
    const hit = dimension.getBlockFromRay({ x, y: y + 1.3, z }, { x: 0, y: -1, z: 0 }, { maxDistance: 4, includeLiquidBlocks: true });
    if (!hit || hit.block.isLiquid) return undefined;
    const stand = hit.block.y + 1;
    if (stand - y > 1.01 || stand - y < -3) return undefined;
    const ceiling = dimension.getBlockFromRay({ x, y: stand + 0.05, z }, { x: 0, y: 1, z: 0 }, { maxDistance: 1.9 });
    return ceiling ? undefined : stand;
  } catch {
    return undefined; // unloaded chunk
  }
}

function end(deerId, deer, player, text) {
  sessions.delete(deerId);
  try {
    if (deer?.isValid && deer.getProperty("lothlorien:guiding")) deer.triggerEvent("lothlorien:guide_end");
  } catch {
    // deer unloaded
  }
  if (player && text) say(player, text);
}

function tickSessions() {
  for (const [deerId, s] of sessions) {
    const deer = world.getEntity(deerId);
    const player = world.getPlayers().find((p) => p.id === s.playerId);
    if (!deer?.isValid || !player?.isValid || deer.dimension.id !== player.dimension.id) {
      end(deerId, deer, player, undefined);
      continue;
    }
    if (!deer.getProperty("lothlorien:guiding")) {
      sessions.delete(deerId); // hurt (alarm clears the state) or otherwise reset by the entity
      continue;
    }
    const toTarget = horizontal(deer.location, s.target);
    const toPlayer = horizontal(deer.location, player.location);
    trackProgress(s, toTarget, s.phase === "walk", MOVE_TICKS);
    s.phase = phase({
      toTarget,
      toPlayer,
      stuck: s.stuck,
      age: system.currentTick - s.born,
      playerCalm: canBeGuided(levelFor(disharmonyOf(player).points)),
    });
    if (s.phase === "arrived") {
      end(deerId, deer, player, "§fThe white deer stops and looks ahead. A great tree stands near.");
    } else if (s.phase === "abort") {
      end(deerId, deer, player, "§7The white deer loses the way and lets you go.");
    } else if (s.phase === "wait") {
      try {
        deer.teleport(deer.location, { facingLocation: player.location });
      } catch {
        // deer unloaded
      }
    } else {
      const to = pickStep(deer.location, s.target, (x, z, y) => probe(deer.dimension, x, z, y), s.bias);
      if (to) {
        s.bias = to.turn || s.bias;
        try {
          deer.teleport({ x: to.x, y: to.y, z: to.z }, { facingLocation: { x: s.target.x, y: to.y + 1, z: s.target.z } });
        } catch {
          // deer unloaded
        }
      }
    }
  }
}

export function startWhiteDeer() {
  system.runInterval(tickSessions, MOVE_TICKS);
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, itemStack }) => {
    try {
      if (target.typeId !== DEER_ID || itemStack?.typeId !== CORN_ID) return;
      if (target.getProperty("lothlorien:coat") !== "white" || target.getComponent("minecraft:is_baby")) return;
      if (target.getProperty("lothlorien:alarmed") || repeatedUse(player, "white_deer")) return;
      offer(player, target);
    } catch {
      // entity gone
    }
  });
}
