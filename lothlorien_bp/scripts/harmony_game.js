import { message } from "./messages.js";
// Harmony in the running game: deeds and deaths feed the rules in harmony.js, state is kept per player in a dynamic
// property (survives relogging, independent between players) and written only when harmony changes.
import { world, system } from "@minecraft/server";
import { MAX_HARMONY, MIN_HARMONY, bandOf, changeMessages, deedKindOf, hintDue, isHated, parse, recordDeath, recordDeed, serialize, statusText, tick } from "./harmony.js";

const PROPERTY = "lothlorien:harmony";
export const HATED_TAG = "lothlorien_hated"; // read by entities/elven_warden.json (wardens attack tagged players on sight)
const TICK_SECONDS = 1;
const PLAYER_ID = "minecraft:player";

const states = new Map();
const lastHint = new Map(); // player id -> Date.now() of the last deed hint
let isInside = () => false;

// Current state of a player (loaded from the dynamic property on first use). Consumers read bandOf(state.harmony).
export function harmonyOf(player) {
  let state = states.get(player.id);
  if (!state) {
    state = parse(player.getDynamicProperty(PROPERTY));
    states.set(player.id, state);
  }
  return state;
}

// The tag follows the Hated band; checked after every change and every second (covers join and reload).
function syncHatedTag(player, state) {
  const hated = isHated(state);
  if (hated !== player.hasTag(HATED_TAG)) {
    if (hated) player.addTag(HATED_TAG);
    else player.removeTag(HATED_TAG);
  }
}

// Runs `change` on the player's state; chat lines for band changes; saves only when harmony differs after.
// Returns true when a chat line was sent.
function update(player, state, change) {
  const before = state.harmony;
  change();
  syncHatedTag(player, state);
  if (state.harmony === before) return false;
  const keys = changeMessages(before, state.harmony);
  for (const key of keys) player.sendMessage(message(key));
  player.setDynamicProperty(PROPERTY, serialize(state));
  return keys.length > 0;
}

// A deed that is not a band change gets a short hint, at most once per HINT_GAP_MS.
function hint(player) {
  const now = Date.now();
  if (!hintDue(lastHint.get(player.id), now)) return;
  lastHint.set(player.id, now);
  player.sendMessage(message("harmony.hint"));
}

// A deed of `player` against `victim` (an entity): counts when either stands inside the forest.
function deed(player, victim, kind) {
  if (!kind || !(isInside(player.dimension, player.location) || isInside(victim.dimension, victim.location))) return;
  const state = harmonyOf(player);
  const before = state.harmony;
  const said = update(player, state, () => recordDeed(state, kind));
  if (!said && state.harmony < before) hint(player);
}

// A new fight with a warden (elven_warden.js decides what a fight is): a small cost.
export function recordWardenFight(player, warden) {
  try {
    deed(player, warden, "warden_fight");
  } catch {
    // entity gone
  }
}

function familiesOf(entity) {
  try {
    return entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
  } catch {
    return [];
  }
}

// `/scriptevent lothlorien:harmony [value]` shows harmony, or sets it (for testing).
export function handleHarmonyEvent(event, player) {
  if (event.id !== "lothlorien:harmony") return false;
  const state = harmonyOf(player);
  const value = Number.parseInt(event.message, 10);
  if (Number.isFinite(value)) {
    update(player, state, () => {
      state.harmony = Math.max(MIN_HARMONY, Math.min(MAX_HARMONY, value));
      state.timer = 0;
    });
  }
  player.sendMessage(message("harmony.debug", state.harmony, message(`status.${bandOf(state.harmony)}`), Math.round(state.timer)));
  return true;
}

export function startHarmony(inside, debugTag) {
  isInside = inside;
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      if (deadEntity.typeId === PLAYER_ID) {
        const state = harmonyOf(deadEntity);
        update(deadEntity, state, () => recordDeath(state, inside(deadEntity.dimension, deadEntity.location)));
      }
      const killer = damageSource.damagingEntity;
      if (killer?.typeId !== PLAYER_ID || killer.id === deadEntity.id) return;
      deed(killer, deadEntity, deedKindOf(deadEntity.typeId, familiesOf(deadEntity)));
    } catch {
      // entity already gone
    }
  });

  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    states.delete(playerId);
    lastHint.delete(playerId);
  });

  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const state = harmonyOf(player);
      const here = inside(player.dimension, player.location);
      update(player, state, () => tick(state, here, TICK_SECONDS));
      const text = statusText(state, here);
      // the debug readout owns the actionbar of players who switched it on
      if (text && !player.hasTag(debugTag)) player.onScreenDisplay.setActionBar(text);
    }
  }, TICK_SECONDS * 20);
}
