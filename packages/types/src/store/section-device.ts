/**
 * Which screens show a section (docs/tema/bilesen-standardi §2, denetim
 * O1): everywhere, only on phones (the theme's narrow frame) or only on
 * wide screens. One setting every body section and the header's scrolling
 * strip share, in the panel's "Görünürlük" group; the strip had it alone
 * before and its saved `device` reads as it is (the same key, no
 * migration). The contract's list: a new step goes here first, then into
 * the backend's mirror (`lib/storefront/layout-fields.ts`, a test keeps
 * them equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.panel.device.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-device` subpath).
 */
export const SECTION_DEVICES = ["all", "mobile", "desktop"] as const

export type SectionDevice = (typeof SECTION_DEVICES)[number]

/** A new section's, and what a section saved before the setting reads as: shown everywhere. */
export const SECTION_DEVICE_DEFAULT: SectionDevice = "all"

/** A section's screens as a reader takes them: a step this build does not know reads as everywhere. */
export function deviceOf(device: unknown): SectionDevice {
  const steps: readonly unknown[] = SECTION_DEVICES
  return steps.includes(device) ? (device as SectionDevice) : SECTION_DEVICE_DEFAULT
}
