/**
 * The announcement bar's settings (`announcement_bar`, docs/tema/bilesen-
 * denetimi (b) 6, O14): how it shows more than one line, and, when the
 * lines take turns, how long each stays and how the turning stops. Every
 * setting is a closed list of named steps the theme maps onto its own
 * scale. The contract's list: a new step goes here first, then into the
 * backend's mirror (`lib/storefront/sections/announcement-bar.ts`, a test
 * keeps them equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.announcement.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-announcement` subpath).
 */
export const ANNOUNCEMENT_SETTINGS = {
  /**
   * More than one line: only the first (as before), the lines taking turns
   * in one place, or side by side on a wide screen (a phone shows the first).
   */
  mode: ["first", "rotate", "inline"],
  /** How long a line stays while they take turns (the dictionary's `interval`). */
  interval: ["slow", "medium", "fast"],
  /**
   * When the pause button shows while the lines take turns: always, or only
   * under the pointer or with focus in the bar (always on a touch screen).
   * It never goes (WCAG 2.2.2).
   */
  pause_button: ["always", "hover"],
  /** Whether the turning stops under the pointer; it always stops while focus is in the bar. */
  hover_pause: ["on", "off"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type AnnouncementSetting = keyof typeof ANNOUNCEMENT_SETTINGS
export type AnnouncementStep<S extends AnnouncementSetting> =
  (typeof ANNOUNCEMENT_SETTINGS)[S][number]

/** A new bar's settings, and what a bar saved before them reads as: the first line alone, as before. */
export const ANNOUNCEMENT_DEFAULTS: { readonly [S in AnnouncementSetting]: AnnouncementStep<S> } = {
  mode: "first",
  interval: "medium",
  pause_button: "always",
  hover_pause: "on",
}

/** The settings in the order the panel offers them. */
export const ANNOUNCEMENT_SETTING_NAMES = Object.keys(
  ANNOUNCEMENT_SETTINGS
) as AnnouncementSetting[]

/** The bar's settings as the design keeps them. */
export type AnnouncementSettings = { [S in AnnouncementSetting]: AnnouncementStep<S> }

/** Every setting as a reader takes it: one missing or not on this build's list reads as its default. */
export function announcementSettingsOf(
  section: Partial<Record<AnnouncementSetting, unknown>>
): AnnouncementSettings {
  const settings: Partial<Record<AnnouncementSetting, string>> = {}
  for (const name of ANNOUNCEMENT_SETTING_NAMES) {
    const steps: readonly unknown[] = ANNOUNCEMENT_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : ANNOUNCEMENT_DEFAULTS[name]
  }
  return settings as AnnouncementSettings
}
