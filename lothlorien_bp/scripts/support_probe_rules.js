// Pure validation for the temporary engine experiment; no guessed piston directions.
export function calibratedFacing(samples) {
  const mapping = {};
  const states = new Set();
  const faces = new Set(["up", "down", "north", "south", "east", "west"]);
  for (const sample of samples) {
    if (!Number.isInteger(sample.state) || sample.state < 0 || sample.state > 5 || states.has(sample.state)) {
      throw new Error("Calibration must contain each facing_direction value exactly once");
    }
    if (sample.heads.length !== 1 || !faces.has(sample.heads[0]) || mapping[sample.heads[0]] !== undefined) {
      throw new Error("Calibration requires exactly one unique head direction per piston rotation");
    }
    states.add(sample.state);
    mapping[sample.heads[0]] = sample.state;
  }
  if (states.size !== 6) throw new Error("Piston calibration is incomplete");
  return mapping;
}
export function caseStatus(result) {
  return result.status ?? (result.pass ? "pass" : "fail");
}
export function summarizeCases(results) {
  const counts = { passed: 0, failed: 0, inconclusive: 0 };
  for (const result of results) {
    const status = caseStatus(result);
    if (status === "pass") counts.passed++;
    else if (status === "inconclusive") counts.inconclusive++;
    else counts.failed++;
  }
  return { total: results.length, ...counts };
}
export function reportGroups(results) {
  const groups = new Map();
  for (const result of results) {
    // Combine the six-face/four-cause matrix, but keep each direct movement
    // verdict visible. This also works with saved revision-1/2 reports.
    const parts = result.label.split("/");
    const label = parts.length === 3 ? `${parts[0]}/support-loss`
      : parts[1]?.startsWith("eligibility-") ? `${parts[0]}/support-eligibility`
      : parts[1]?.startsWith("control-") ? `${parts[0]}/controls` : result.label;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(result);
  }
  return [...groups].map(([label, cases]) => ({ label, results: cases, ...summarizeCases(cases) }));
}
