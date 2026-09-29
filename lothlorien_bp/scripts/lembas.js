import { system } from "@minecraft/server";

// Phase 7: wrapped Lembas. The numbers (nutrition 8, supernatural saturation, 1.0 s to eat) are in
// items/lembas_wrapped.json; this component adds what a bigger golden carrot lacks: eating it lifts
// Hunger, so it is the food to carry on a long trek.
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:lembas", {
    onConsume({ source }) {
      try {
        source.removeEffect("minecraft:hunger");
      } catch {
        // effect not present or entity gone: nothing to lift
      }
    },
  });
});
