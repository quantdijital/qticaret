/** A settings page's `?part=` (its open tab, `SettingsTabs`): kept when it is text, left out otherwise. */
export const settingsTabSearch = (search: Record<string, unknown>): { part?: string } =>
  typeof search["part"] === "string" ? { part: search["part"] } : {}
