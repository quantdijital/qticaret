import type {
  StorePhotoCollageSection,
  StoreStatsSection,
  StoreStepsSection,
} from "@qticaret/types"
import { photoCollageSettingsOf } from "@qticaret/types/section-collage"
import { sectionIconOf } from "@qticaret/types/section-icons"
import { statsSettingsOf } from "@qticaret/types/section-stats"
import { stepNumber, stepsSettingsOf } from "@qticaret/types/section-steps"
import type {
  PhotoCollageSectionView,
  StatsSectionView,
  StepsSectionView,
  Translate,
} from "@qticaret/ui"
import { layoutImage, layoutLink } from "./layout"

/**
 * The figures strip as the theme draws it (adr/0077 §10): the shop's
 * figures as saved, its steps as the contract knows them (an unknown one,
 * from a newer backend, read as the default). No figure: no strip.
 */
export function statsView(section: StoreStatsSection, t: Translate): StatsSectionView | null {
  const settings = statsSettingsOf(section)
  return section.items.length > 0
    ? {
        id: section.id,
        type: "stats",
        title: section.title,
        label: t("home.stats_label"),
        items: section.items.map((item) => ({
          value: item.value,
          label: item.label,
          text: item.text,
          // Its icon only while the strip shows icons (adr/0077 §10 Ek)
          ...(settings.icons === "on" ? { icon: sectionIconOf(item.icon) } : {}),
        })),
        ...settings,
      }
    : null
}

/**
 * The numbered steps as the theme draws them (adr/0077 §10): the shop's
 * heading, else the storefront's words; each step's number printed as the
 * shop chose; the link as a path (a broken one none). No step: no section.
 */
export function stepsView(section: StoreStepsSection, t: Translate): StepsSectionView | null {
  const settings = stepsSettingsOf(section)
  return section.items.length > 0
    ? {
        id: section.id,
        type: "steps",
        title: section.title ?? t("home.steps"),
        intro: section.intro,
        items: section.items.map((item, index) => ({
          number: stepNumber(index, settings.numbers),
          title: item.title,
          text: item.text,
        })),
        link: layoutLink(section.link, t),
        ...settings,
      }
    : null
}

/**
 * The photo collage as the theme draws it (adr/0077 §10): each photograph
 * with its own words (the caption when they are missing, from an older
 * draft), its caption, its link as a path (a broken one none); its steps as
 * the contract knows them. No photograph: no section.
 */
export function collageView(
  section: StorePhotoCollageSection,
  t: Translate
): PhotoCollageSectionView | null {
  const more = layoutLink(section.more ?? null, t)
  return section.items.length > 0
    ? {
        id: section.id,
        type: "photo_collage",
        title: section.title,
        label: t("home.collage_label"),
        intro: section.intro,
        items: section.items.map((item) => ({
          image: layoutImage(item.image, item.caption ?? ""),
          caption: item.caption,
          href: layoutLink(item.link, t)?.path ?? null,
          ...(item.subtitle ? { subtitle: item.subtitle } : {}),
        })),
        ...photoCollageSettingsOf(section),
        ...(section.eyebrow ? { eyebrow: section.eyebrow } : {}),
        ...(more ? { more } : {}),
      }
    : null
}
