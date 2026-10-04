import { message } from "./messages.js";
// Unicorns in the running game (Phase 15; rules in unicorn_rules.js). Their wariness follows the nearest player's Disharmony
// in deer.js (they are in WARY_TYPES): strangers and restless players are fled from, a Friend of Lothlorien may come close
// and lure one with Elanor. This file is the taming: three offers of Elanor from a Friend bond the unicorn to that player
// (the `lothlorien:bonded` group in entities/unicorn.json makes it rideable without a saddle), and only the owner may ride it.
import { EquipmentSlot, GameMode, system, world } from "@minecraft/server";
import { disharmonyOf } from "./disharmony_game.js";
import { isFriend, levelFor } from "./disharmony.js";
import { repeatedUse } from "./use_guard.js";
import { setEventFor } from "./deer_rules.js";
import { ELANOR_ID, UNICORN_ID, mayRide, nextTrust, offerRefusal, ticksSince } from "./unicorn_rules.js";

const OWNER = "lothlorien:owner"; // dynamic property on the unicorn: id of the player it is bonded to
const LAST_OFFER = "lothlorien:last_offer"; // dynamic property: world time (ticks) of the last accepted offer

const say = (player, text) => {
  try {
    player.sendMessage(text); // chat: the action bar belongs to the Disharmony / Friend status (disharmony_game.js)
  } catch {
    // player left
  }
};

function consumeElanor(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  if (!slot?.hasItem() || slot.typeId !== ELANOR_ID) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

const REFUSALS = {
  restless: message("unicorn.restless"),
  untrusted: message("unicorn.untrusted"),
  alarmed: message("unicorn.alarmed"),
  wait: message("unicorn.wait"),
};

const MESSAGES = [
  message("unicorn.trust1"),
  message("unicorn.trust2"),
  message("unicorn.trust3"),
];

// Fed = bonded. Re-applying the current state event one tick after the event swaps state_calm/state_friend for state_tame
// (a property change is not visible to event filters before the next tick).
function bond(unicorn, player) {
  unicorn.setDynamicProperty(OWNER, player.id);
  unicorn.triggerEvent("lothlorien:become_tame");
  system.runTimeout(() => {
    try {
      if (!unicorn.getProperty("lothlorien:alarmed")) unicorn.triggerEvent(setEventFor(unicorn.getProperty("lothlorien:wariness")));
    } catch {
      // unicorn unloaded meanwhile
    }
  }, 1);
  try {
    unicorn.dimension.spawnParticle("minecraft:totem_particle", { x: unicorn.location.x, y: unicorn.location.y + 1.2, z: unicorn.location.z });
  } catch {
    // chunk unloaded
  }
}

function offer(player, unicorn) {
  const state = disharmonyOf(player);
  const now = world.getAbsoluteTime();
  const refusal = offerRefusal({
    level: levelFor(state.points),
    friend: isFriend(state),
    tame: !!unicorn.getProperty("lothlorien:tame"),
    alarmed: !!unicorn.getProperty("lothlorien:alarmed"),
    sinceLast: ticksSince(now, unicorn.getDynamicProperty(LAST_OFFER)),
  });
  if (refusal === "tame") return;
  if (refusal) return say(player, REFUSALS[refusal]);
  const { trust, bonded } = nextTrust(unicorn.getProperty("lothlorien:trust"));
  consumeElanor(player);
  unicorn.setProperty("lothlorien:trust", trust);
  unicorn.setDynamicProperty(LAST_OFFER, now);
  say(player, MESSAGES[trust - 1]);
  if (bonded) bond(unicorn, player);
  else {
    try {
      unicorn.dimension.spawnParticle("minecraft:heart_particle", { x: unicorn.location.x, y: unicorn.location.y + 1.8, z: unicorn.location.z });
    } catch {
      // chunk unloaded
    }
  }
}

export function startUnicorns() {
  // Only the owner mounts a bonded unicorn: the interaction is cancelled for everyone else (before the engine mounts).
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    if (target.typeId !== UNICORN_ID || !target.getProperty("lothlorien:tame")) return;
    if (mayRide(target.getDynamicProperty(OWNER), player.id)) return;
    event.cancel = true;
    system.run(() => say(player, message("unicorn.other_owner")));
  });
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== UNICORN_ID || (beforeItemStack ?? itemStack)?.typeId !== ELANOR_ID) return;
      if (repeatedUse(player, "unicorn")) return;
      offer(player, target);
    } catch {
      // entity gone
    }
  });
}
