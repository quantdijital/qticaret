import { BANNER_SETTINGS, BANNER_SETTING_NAMES, BANNER_SPLIT_EDGES } from "@qticaret/types"
import type { BannerSetting, BannerVariant } from "@qticaret/types"
import type { BannerSection } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "./field-registry"

/**
 * Where the band's settings sit (docs/tema/bilesen-denetimi 1.4): its
 * height, the words' place and the veil, the basics, open in "Diziliş"
 * under its pictures; its width and the buttons' style in "Görünüm"
 * (Stil) with the page's look.
 */
export const BANNER_GROUPS: Readonly<Record<BannerSetting, FieldGroupName>> = {
  width: "frame",
  height: "layout",
  text_position: "layout",
  overlay: "layout",
  button_style: "frame",
}

const bannerIn = (group: FieldGroupName): readonly BannerSetting[] =>
  (Object.keys(BANNER_SETTINGS) as BannerSetting[]).filter(
    (setting) => BANNER_GROUPS[setting] === group
  )

/** The band's basics: the open "Diziliş" group. */
export const BANNER_LAYOUT_SETTINGS = bannerIn("layout")

/** The band's width and buttons, with the look in "Görünüm" (Stil). */
export const BANNER_FRAME_SETTINGS = bannerIn("frame")

/** What the split band (adr/0077 Ek) has no use for: its words stand beside the picture, unveiled. */
const SPLIT_UNUSED: ReadonlySet<BannerSetting> = new Set(["text_position", "overlay"])

/** The settings the band's variant shows (§0 ilke 3, "geniş düşün, az göster"). */
export const bannerSettingsFor = (
  variant: BannerVariant,
  settings: readonly BannerSetting[]
): readonly BannerSetting[] =>
  variant === "split" ? settings.filter((setting) => !SPLIT_UNUSED.has(setting)) : settings

/** A band setting's element (`FIELD_IDS.banner`). */
export const bannerSettingId = (sectionId: string, setting: BannerSetting) =>
  `${sectionId}-banner-${setting}`

/** The split's edge ("Geçiş"), in "Diziliş" beside the height. */
export const bannerEdgeId = (sectionId: string) => `${sectionId}-banner-edge`

const B = "storefront.editor.banner"

/**
 * The band's settings for the settings search: its basics open in
 * "Diziliş", its width and buttons closed in "Diğer ayarlar"; the ones its
 * variant shows, and the split's edge (adr/0077 Ek) beside its height.
 */
export function bannerFields(section: BannerSection): RegistryField[] {
  const shown = bannerSettingsFor(section.variant, BANNER_SETTING_NAMES)
  const fields: RegistryField[] = shown.map((setting) => ({
    key: `banner.${setting}`,
    group: BANNER_GROUPS[setting],
    label: `${B}.${setting}.label`,
    term: `${B}.${setting}.term`,
    options: BANNER_SETTINGS[setting].map((step) => `${B}.${setting}.${step}`),
    target: bannerSettingId(section.id, setting),
  }))
  if (section.variant === "split") {
    fields.push({
      key: "banner.edge",
      group: "layout",
      label: `${B}.edge.label`,
      term: `${B}.edge.term`,
      options: BANNER_SPLIT_EDGES.map((edge) => `${B}.edge.${edge}`),
      target: bannerEdgeId(section.id),
    })
  }
  return fields
}
