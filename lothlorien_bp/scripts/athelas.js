import { system, EquipmentSlot } from "@minecraft/server";

// Phase 8: Athelas salve and Miruvor. Food JSON gives the drinking (animation, duration, can always
// be drunk); these components add the effects. First balance is deliberately conservative: the salve
// is a modest heal-over-time (about 5 HP), Miruvor about 10 HP plus a short speed boost, and it costs
// a salve, both rare flowers and Mallorn nectar. Ticks: 20 per second.
// Miruvor is a skin, not a stack: 4 sips (durability), 30 s between sips (cooldown in the item JSON).
// It is not food, so the sip comes from onCompleteUse (use_modifiers duration) and the item survives.
const EFFECTS = {
  "lothlorien:salve": [["regeneration", 120, 1]],
  "lothlorien:miruvor": [
    ["instant_health", 1, 0],
    ["regeneration", 160, 1],
    ["speed", 600, 0],
  ],
};

function apply(source, effects) {
  for (const [effect, duration, amplifier] of effects) {
    source.addEffect(effect, duration, { amplifier, showParticles: true });
  }
  source.removeEffect("poison");
}

function sipFromSkin(player) {
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  const item = slot?.getItem();
  if (item?.typeId !== "lothlorien:miruvor") return;
  const durability = item.getComponent("minecraft:durability");
  if (!durability) return;
  if (durability.damage + 1 >= durability.maxDurability) {
    slot.setItem(undefined);
    player.playSound("random.break");
  } else {
    durability.damage += 1;
    slot.setItem(item);
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:salve", {
    onConsume({ source }) {
      try {
        apply(source, EFFECTS["lothlorien:salve"]);
      } catch {
        // entity gone mid-drink
      }
    },
  });
  itemComponentRegistry.registerCustomComponent("lothlorien:miruvor", {
    onCompleteUse({ source }) {
      try {
        apply(source, EFFECTS["lothlorien:miruvor"]);
        sipFromSkin(source);
      } catch {
        // player gone mid-drink
      }
    },
  });
});
