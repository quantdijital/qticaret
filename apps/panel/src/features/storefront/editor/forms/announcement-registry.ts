import {
  ANNOUNCEMENT_SETTINGS,
  ANNOUNCEMENT_SETTING_NAMES,
  announcementSettingsOf,
} from "@qticaret/types"
import type { AnnouncementSetting } from "@qticaret/types"
import type { AnySection, AnnouncementBar } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "./field-registry"

/**
 * The announcement bar's settings as the settings search knows them
 * (docs/tema/bilesen-denetimi (b) 6): how it shows several lines under its
 * lines in "İçerik", how they take turns in the open "Hareket" group, where
 * its lines sit and its size in the open "Stil" group (adr/0049 Ek
 * 2026-11-15). The
 * form takes its elements' ids from `ANNOUNCEMENT_IDS`.
 */

const A = "storefront.editor.announcement"

/** The bar's elements' ids (spread into `FIELD_IDS`). */
export const ANNOUNCEMENT_IDS = {
  announcement: (sectionId: string, setting: AnnouncementSetting) =>
    `${sectionId}-announcement-${setting}`,
} as const

const GROUPS: Readonly<Record<AnnouncementSetting, FieldGroupName>> = {
  mode: "content",
  interval: "motion",
  pause_button: "motion",
  hover_pause: "motion",
  align: "appearance",
  size: "appearance",
  tone: "appearance",
}

/**
 * Which settings the panel shows as the bar stands (bilesen-standardi §0.3):
 * where its lines sit and its size always, how it shows several lines only
 * once it has more than one, the turning's settings only while they take turns.
 */
export function announcementOffers(section: AnnouncementBar, setting: AnnouncementSetting) {
  if (setting === "align" || setting === "size" || setting === "tone") {
    return true
  }
  if (section.lines.length < 2) {
    return false
  }
  return setting === "mode" || announcementSettingsOf(section).mode === "rotate"
}

/** The bar's settings the panel shows, as the search finds them. */
export function announcementFields(section: AnySection): RegistryField[] {
  // The light strip shows its first line as a note: none of the dark bar's settings (owner 2026-11-27)
  if (section.type !== "announcement_bar" || section.variant === "light") {
    return []
  }
  return ANNOUNCEMENT_SETTING_NAMES.filter((setting) => announcementOffers(section, setting)).map(
    (setting) => {
      const steps: readonly string[] = ANNOUNCEMENT_SETTINGS[setting]
      return {
        key: `announcement.${setting}`,
        group: GROUPS[setting],
        label: `${A}.${setting}.label`,
        term: `${A}.${setting}.term`,
        options: steps.map((step) => `${A}.${setting}.${step}`),
        target: ANNOUNCEMENT_IDS.announcement(section.id, setting),
      }
    }
  )
}
