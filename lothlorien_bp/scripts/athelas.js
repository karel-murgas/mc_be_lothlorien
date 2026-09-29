import { system } from "@minecraft/server";

// Phase 8: Athelas salve and Miruvor. Food JSON gives the drinking (animation, duration, can always
// be drunk); these components add the effects. First balance is deliberately conservative: the salve
// is a modest heal-over-time (about 5 HP), Miruvor about 10 HP plus a short speed boost, and it costs
// a salve, both rare flowers and honey. Ticks: 20 per second.
const EFFECTS = {
  "lothlorien:salve": [["regeneration", 120, 1]],
  "lothlorien:miruvor": [
    ["instant_health", 1, 0],
    ["regeneration", 160, 1],
    ["speed", 600, 0],
  ],
};

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  for (const [id, effects] of Object.entries(EFFECTS)) {
    itemComponentRegistry.registerCustomComponent(id, {
      onConsume({ source }) {
        try {
          for (const [effect, duration, amplifier] of effects) {
            source.addEffect(effect, duration, { amplifier, showParticles: true });
          }
          source.removeEffect("poison");
        } catch {
          // entity gone mid-drink
        }
      },
    });
  }
});
