import { SECTION_DEVICES } from "@qticaret/types"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import { isPageGroup } from "@/features/storefront/layout/sections"
import { isMain } from "@/features/storefront/layout/main-sections"
import type { RegistryField } from "./field-registry"

/**
 * The "Görünürlük" group's fields as the settings search knows them
 * (docs/tema/bilesen-standardi §1): whether the section shows, from when
 * until when, and on which screens (§2, denetim O1). The forms take their
 * elements' ids from `VISIBILITY_IDS`, so a search lands on the field it names.
 */

const P = "storefront.editor.panel"

/** The group's elements' ids (spread into `FIELD_IDS`). */
export const VISIBILITY_IDS = {
  visible: (sectionId: string) => `${sectionId}-schedule-visible`,
  starts: (sectionId: string) => `${sectionId}-schedule-starts`,
  ends: (sectionId: string) => `${sectionId}-schedule-ends`,
  device: (sectionId: string) => `${sectionId}-schedule-device`,
} as const

/**
 * Whether the section offers its screens: every page's body section, and
 * the header's scrolling strip (which had the setting first); not the
 * announcement bar, the footer's box or a main section (always shown).
 */
export const takesDevice = (section: AnySection, group: LayoutGroup): boolean =>
  !isMain(section) && (isPageGroup(group) || section.type === "marquee")

/** The group's fields as the section shows them; a main section has none (it always shows). */
export function visibilityFields(section: AnySection, group: LayoutGroup): RegistryField[] {
  if (isMain(section)) {
    return []
  }
  const id = section.id
  const plain = (key: string, label: string, target: string): RegistryField => ({
    key,
    group: "visibility",
    label,
    term: null,
    options: [],
    target,
  })
  return [
    plain("visible", `${P}.visible`, VISIBILITY_IDS.visible(id)),
    plain("starts_at", `${P}.startsAt`, VISIBILITY_IDS.starts(id)),
    plain("ends_at", `${P}.endsAt`, VISIBILITY_IDS.ends(id)),
    ...(takesDevice(section, group)
      ? [
          {
            key: "device",
            group: "visibility" as const,
            label: `${P}.device.label`,
            term: `${P}.device.term`,
            options: SECTION_DEVICES.map((step) => `${P}.device.${step}`),
            target: VISIBILITY_IDS.device(id),
          },
        ]
      : []),
  ]
}
