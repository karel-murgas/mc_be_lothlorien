// Ground squirrel errands in the running game (Phase 15; rules in squirrel_rules.js). A Friend of Lothlorien offers a
// Mallorn acorn: the squirrel takes it, runs off to a spot 10-14 blocks away, digs a moment, comes back and drops a small
// gift (loot_tables/gifts/squirrel.json) at the player's feet. Not a Friend: it sniffs the acorn and keeps it.
//
// Like the white deer (white_deer.js) the squirrel is never moved by script. During the errand it sits in the component
// group `lothlorien:state_guiding` (entities/squirrel.json), whose follow goal makes the engine's navigator walk it to the
// nearest guide beacon; this script moves the beacon: to the away point, to the squirrel's feet while it digs, then onto
// the player. The beacon is the white deer's invisible helper entity, so white_deer.js's stray sweep is told about ours.
import { system, world } from "@minecraft/server";
import { disharmonyOf } from "./disharmony_game.js";
import { isFriend, levelFor } from "./disharmony.js";
import { repeatedUse } from "./use_guard.js";
import { addBeaconSource, consumeAcorn, stand } from "./white_deer.js";
import { ACORN_ID, BEACON_ID } from "./white_deer_rules.js";
import {
  GIFT_TABLE, SQUIRREL_ID, SQUIRREL_TICKS, cooldownLeft, digTicks, horizontal, nextPhase, offerRefusal, pickAway, COOLDOWN_TICKS,
} from "./squirrel_rules.js";

const READY_AT = "lothlorien:gift_ready_at"; // dynamic property on the squirrel: world time (ticks) of its next errand
const sessions = new Map(); // squirrel id -> { playerId, beaconId, away, born, phase, phaseStart, digFor }

export const isErrand = (squirrelId) => sessions.has(squirrelId);

const say = (player, text) => {
  try {
    player.sendMessage(text); // chat: the action bar belongs to the Disharmony / Friend status (disharmony_game.js)
  } catch {
    // player left
  }
};

function removeBeacon(beaconId) {
  try {
    const beacon = beaconId && world.getEntity(beaconId);
    if (beacon?.isValid) beacon.remove();
  } catch {
    // already gone
  }
}

const moveBeacon = (beacon, to) => beacon.teleport({ x: to.x, y: to.y, z: to.z });

function offer(player, squirrel) {
  if (sessions.has(squirrel.id)) return;
  const state = disharmonyOf(player);
  const left = cooldownLeft(world.getAbsoluteTime(), squirrel.getDynamicProperty(READY_AT));
  const refusal = offerRefusal({ level: levelFor(state.points), friend: isFriend(state), cooldownLeft: left });
  if (refusal === "restless") return say(player, "§7The squirrel shies from your restless spirit.");
  if (refusal === "untrusted") return say(player, "§7The squirrel sniffs the acorn and watches you, but does not trust you yet.");
  if (refusal === "full") return say(player, "§7The squirrel sniffs the acorn, but it is busy with its stash. Try again later.");
  const dimension = squirrel.dimension;
  const away = pickAway(squirrel.location, (x, z, y) => stand(dimension, x, z, y), Math.random() * 2 * Math.PI);
  if (!away) return say(player, "§7The squirrel sniffs the acorn, looks around, and stays. It has nowhere to run from here.");
  let beaconId;
  try {
    beaconId = dimension.spawnEntity(BEACON_ID, { x: away.x, y: away.y, z: away.z }).id;
    squirrel.triggerEvent("lothlorien:guide_start");
    consumeAcorn(player); // only now: the errand really starts
    sessions.set(squirrel.id, { playerId: player.id, beaconId, away, born: system.currentTick, phase: "away", phaseStart: system.currentTick, digFor: 0 });
    say(player, "§fThe squirrel snatches the acorn and bolts into the undergrowth.");
  } catch {
    sessions.delete(squirrel.id);
    removeBeacon(beaconId);
  }
}

// Ends the errand: beacon removed, the squirrel back to its wariness state (or, if it was hurt meanwhile, left alarmed).
function end(squirrelId, squirrel, player, text) {
  const s = sessions.get(squirrelId);
  sessions.delete(squirrelId);
  removeBeacon(s?.beaconId);
  try {
    if (squirrel?.isValid && squirrel.getProperty("lothlorien:guiding")) {
      squirrel.triggerEvent(squirrel.getProperty("lothlorien:alarmed") ? "lothlorien:guide_abort" : "lothlorien:guide_end");
    }
  } catch {
    // squirrel unloaded
  }
  if (player && text) say(player, text);
}

function giveGift(squirrelId, squirrel, player) {
  const { x, y, z } = squirrel.location;
  squirrel.setDynamicProperty(READY_AT, world.getAbsoluteTime() + COOLDOWN_TICKS);
  try {
    squirrel.dimension.runCommand(`loot spawn ${x.toFixed(2)} ${(y + 0.3).toFixed(2)} ${z.toFixed(2)} loot "${GIFT_TABLE}"`);
    squirrel.dimension.spawnParticle("minecraft:heart_particle", { x, y: y + 0.6, z });
  } catch {
    // chunk unloaded after all: the gift is lost, the acorn was eaten
  }
  end(squirrelId, squirrel, player, "§fThe squirrel scampers back and drops something at your feet.");
}

function tickSession(squirrelId, s) {
  const squirrel = world.getEntity(squirrelId);
  const player = world.getPlayers().find((p) => p.id === s.playerId);
  if (!squirrel?.isValid || !player?.isValid || squirrel.dimension.id !== player.dimension.id) return end(squirrelId, squirrel, undefined, undefined);
  if (squirrel.getProperty("lothlorien:alarmed")) return end(squirrelId, squirrel, player, "§7The squirrel is frightened and drops the errand.");
  const now = system.currentTick;
  let beacon = world.getEntity(s.beaconId);
  if (!beacon?.isValid) {
    beacon = squirrel.dimension.spawnEntity(BEACON_ID, { x: s.away.x, y: s.away.y, z: s.away.z }); // lost (chunk unloaded, /kill)
    s.beaconId = beacon.id;
  }
  const next = nextPhase({
    phase: s.phase,
    age: now - s.born,
    phaseAge: now - s.phaseStart,
    toBeacon: horizontal(squirrel.location, s.away),
    toPlayer: horizontal(squirrel.location, player.location),
    digFor: s.digFor,
  });
  if (next === "abort") return end(squirrelId, squirrel, player, "§7The squirrel loses its way and gives up. The acorn is gone.");
  if (next === "gift") return giveGift(squirrelId, squirrel, player);
  if (next !== s.phase) {
    s.phase = next;
    s.phaseStart = now;
    if (next === "dig") {
      s.digFor = digTicks(Math.random());
      moveBeacon(beacon, squirrel.location); // stand still and dig
    }
  }
  if (s.phase === "return") moveBeacon(beacon, player.location);
}

function tickSessions() {
  for (const [squirrelId, s] of sessions) {
    try {
      tickSession(squirrelId, s);
    } catch {
      end(squirrelId, undefined, undefined, undefined); // squirrel or beacon unloaded mid-tick
    }
  }
}

export function startSquirrels() {
  addBeaconSource(() => [...sessions.values()].map((s) => s.beaconId));
  system.runInterval(tickSessions, SQUIRREL_TICKS);
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== SQUIRREL_ID || (beforeItemStack ?? itemStack)?.typeId !== ACORN_ID) return;
      if (target.getProperty("lothlorien:alarmed") || repeatedUse(player, "squirrel")) return;
      offer(player, target);
    } catch {
      // squirrel or player gone
    }
  });
}
