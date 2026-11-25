import { HERO_FULL_SETTINGS, heroFullSettingsOf } from "@qticaret/types"
import type { HeroFullSetting } from "@qticaret/types"
import type { AnySection } from "@/features/storefront/api/layout"
import type { ContentField } from "./content-registry"
import type { FieldGroupName, RegistryField } from "./field-registry"

/** A field's element id (`CONTENT_IDS.content`), passed in so the two registries need not import each other. */
type Target = (sectionId: string, field: ContentField) => string

const H = "storefront.editor.heroFull"

/**
 * The full image opening's steps (adr/0077 §9) by the group their fields
 * stand in: what stands under the heading with the opening's content, how
 * the opening stands in "Diziliş". Each a setting's name and its field's.
 */
export const HERO_FULL_CONTENT = [
  ["action", "action"],
  ["search_position", "search_position"],
  ["button_tone", "button_tone"],
  ["button_icon", "button_icon"],
] as const satisfies readonly (readonly [HeroFullSetting, ContentField])[]

export const HERO_FULL_LAYOUT = [
  ["height", "height"],
  ["align", "align"],
  ["image_side", "image_side"],
  ["scrim", "scrim"],
  ["edge", "edge"],
  ["accent_mark", "accent_mark"],
  ["ornament", "ornament"],
] as const satisfies readonly (readonly [HeroFullSetting, ContentField])[]

type FullSection = Extract<AnySection, { type: "hero"; variant: "full_image" }>

/**
 * Whether a step's field is shown as the opening stands: the search box's
 * place only while the opening asks for a search, the veil only while the
 * photograph is behind the words, the button's colour and arrow only while
 * the opening has its buttons.
 */
export function heroFullShows(section: FullSection, name: HeroFullSetting): boolean {
  const settings = heroFullSettingsOf(section)
  if (name === "search_position") {
    return settings.action !== "button"
  }
  if (name === "button_tone" || name === "button_icon") {
    return settings.action !== "search"
  }
  return name !== "scrim" || settings.image_side === "full"
}

/** The full image opening's fields as the settings search finds them, as its form shows them. */
export function heroFullFields(section: AnySection, target: Target): RegistryField[] {
  if (section.type !== "hero" || section.variant !== "full_image") {
    return []
  }
  const step = (
    name: HeroFullSetting,
    field: ContentField,
    group: FieldGroupName
  ): RegistryField => ({
    key: field,
    group,
    label: `${H}.${name}.label`,
    term: `${H}.${name}.term`,
    options: HERO_FULL_SETTINGS[name].map((each) => `${H}.${name}.${each}`),
    target: target(section.id, field),
  })
  return [
    ...HERO_FULL_CONTENT.filter(([name]) => heroFullShows(section, name)).map(([name, field]) =>
      step(name, field, "content")
    ),
    {
      key: "show_trust",
      group: "content",
      label: `${H}.show_trust.label`,
      term: `${H}.show_trust.term`,
      options: [],
      target: target(section.id, "show_trust"),
    },
    // The video button's link, in its own group ("Video")
    {
      key: "video_url",
      group: "video",
      label: `${H}.video.url.label`,
      term: `${H}.video.url.term`,
      options: [],
      target: target(section.id, "video_url"),
    },
    ...HERO_FULL_LAYOUT.filter(([name]) => heroFullShows(section, name)).map(([name, field]) =>
      step(name, field, "layout")
    ),
  ]
}
