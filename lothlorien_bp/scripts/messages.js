// Client-side translation: each player uses their selected game language.
// Object arguments remain RawMessages, allowing nested translated labels.
export function message(key, ...values) {
  if (values.length === 0) return { translate: "lothlorien.message." + key };
  const args = values.map(value => typeof value === "object" && value !== null ? value : { text: String(value) });
  return { translate: "lothlorien.message." + key, with: { rawtext: args } };
}
