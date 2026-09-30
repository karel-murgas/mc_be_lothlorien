// DEV ONLY, not part of the pack. Phase 1 spike helpers removed from lothlorien_bp/scripts/main.js
// (recover: git show dc1182e:lothlorien_bp/scripts/main.js). They need biomeAt/BIOME_ID from main.js:
// `/scriptevent lothlorien:survey` (biome share and centre within 160 blocks) and the world-load
// "biome REGISTERED/MISSING" chat line (call reportBiomeRegistration() from the worldLoad handler;
// also import BiomeTypes from "@minecraft/server").

// `/scriptevent lothlorien:survey` samples the surface of the loaded area on a grid and
// reports how much of it is Lothlórien, how much of that is water, and where its centre
// lies -- enough to judge region size and to walk from a /locate hit into the biome.
const SURVEY_RADIUS = 160;
const SURVEY_STEP = 8;
const COMPASS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];

function survey(player) {
  const dimension = player.dimension;
  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  let sampled = 0, lorien = 0, water = 0, sumX = 0, sumZ = 0;
  for (let dx = -SURVEY_RADIUS; dx <= SURVEY_RADIUS; dx += SURVEY_STEP) {
    for (let dz = -SURVEY_RADIUS; dz <= SURVEY_RADIUS; dz += SURVEY_STEP) {
      const x = px + dx, z = pz + dz;
      let top;
      try {
        top = dimension.getTopmostBlock({ x, z });
      } catch {
        continue; // unloaded
      }
      if (!top) continue;
      sampled++;
      if (biomeAt(dimension, top.location) !== BIOME_ID) continue;
      lorien++;
      sumX += dx;
      sumZ += dz;
      if (top.typeId === "minecraft:water") water++;
    }
  }
  if (lorien === 0) {
    player.sendMessage(`[lothlorien] survey r${SURVEY_RADIUS}: 0/${sampled} surface samples are Lothlórien`);
    return;
  }
  const cx = sumX / lorien, cz = sumZ / lorien;
  // Minecraft yaw convention: 0 = south (+z), 90 = west (-x).
  const yaw = (Math.atan2(-cx, cz) * 180) / Math.PI;
  const dir = COMPASS[Math.round(((yaw + 360) % 360) / 45) % 8];
  const pct = (n, d) => Math.round((100 * n) / d);
  player.sendMessage(
    `[lothlorien] survey r${SURVEY_RADIUS}: ${pct(lorien, sampled)}% of ${sampled} samples are Lothlórien ` +
      `(${pct(water, lorien)}% of it water); centre ~${Math.round(Math.hypot(cx, cz))} blocks ${dir} ` +
      `at ${px + Math.round(cx)} ${pz + Math.round(cz)}`
  );
}


// Spike check: did the engine accept the biome JSON? A rejected definition is silent
// apart from the Content Log, so say it in chat.
function reportBiomeRegistration() {
  const custom = BiomeTypes.getAll()
    .map((b) => b.id)
    .filter((id) => !id.startsWith("minecraft:"));
  const ok = BiomeTypes.get(BIOME_ID) !== undefined;
  const msg = `[lothlorien] biome ${BIOME_ID} ${ok ? "REGISTERED" : "MISSING"}; non-vanilla biomes: ${custom.join(", ") || "none"}`;
  console.warn(msg);
  system.runTimeout(() => world.sendMessage(msg), 100);
}

