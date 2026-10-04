import { message } from "./messages.js";
// Disharmony in the running game: kills and deaths feed the rules in disharmony.js, state is kept
// per player in a dynamic property (survives relogging, independent between players).
import { world, system } from "@minecraft/server";
import { isFriend, killWeight, levelFor, newState, parse, recordDeath, recordKill, serialize, statusText, tick } from "./disharmony.js";

const PROPERTY = "lothlorien:disharmony";
const TICK_SECONDS = 1;
const PLAYER_ID = "minecraft:player";

const states = new Map();

// Current state of a player (loaded from the dynamic property on first use). Later phases read
// levelFor(...)/isFriend(...) of this to react to the player.
export function disharmonyOf(player) {
  let state = states.get(player.id);
  if (!state) {
    state = parse(player.getDynamicProperty(PROPERTY));
    states.set(player.id, state);
  }
  return state;
}

function save(player, state) {
  player.setDynamicProperty(PROPERTY, serialize(state));
}

// Runs `change` on the player's state; tells the player when the level or Friend status differs after.
function update(player, state, change) {
  const level = levelFor(state.points);
  const friend = isFriend(state);
  change();
  const nowLevel = levelFor(state.points);
  const nowFriend = isFriend(state);
  if (nowFriend !== friend) {
    player.sendMessage(message(nowFriend ? "friend.gained" : "friend.lost"));
  } else if (nowLevel !== level) {
    player.sendMessage(nowLevel ? message("disharmony.level", "I".repeat(nowLevel)) : message("disharmony.gone"));
  }
  save(player, state);
}

// `/scriptevent lothlorien:disharmony [points]` shows the state, or sets the points (for testing).
export function handleDisharmonyEvent(event, player) {
  if (event.id !== "lothlorien:disharmony") return false;
  const state = disharmonyOf(player);
  const points = Number.parseInt(event.message, 10);
  if (Number.isFinite(points) && points >= 0) update(player, state, () => { state.points = points; state.calm = 0; state.friend = 0; });
  player.sendMessage(
    message(isFriend(state) ? "disharmony.debug_friend" : "disharmony.debug", state.points, levelFor(state.points), Math.round(state.calm), Math.round(state.friend))
  );
  return true;
}

export function startDisharmony(isInside, debugTag) {
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      if (deadEntity.typeId === PLAYER_ID) {
        update(deadEntity, disharmonyOf(deadEntity), () => recordDeath(disharmonyOf(deadEntity)));
        return;
      }
      const killer = damageSource.damagingEntity;
      if (killer?.typeId !== PLAYER_ID || !isInside(deadEntity.dimension, deadEntity.location)) return;
      update(killer, disharmonyOf(killer), () => recordKill(disharmonyOf(killer), killWeight(deadEntity.typeId)));
    } catch {
      // entity already gone
    }
  });

  world.afterEvents.playerLeave.subscribe(({ playerId }) => states.delete(playerId));

  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const state = disharmonyOf(player);
      const inside = isInside(player.dimension, player.location);
      update(player, state, () => tick(state, inside, TICK_SECONDS));
      const text = statusText(state, inside);
      // the debug readout owns the actionbar of players who switched it on
      if (text && !player.hasTag(debugTag)) player.onScreenDisplay.setActionBar(text);
    }
  }, TICK_SECONDS * 20);
}
