import type { StoreStatsSection, StoreStepsSection } from "@qticaret/types"
import { statsSettingsOf } from "@qticaret/types/section-stats"
import { stepNumber, stepsSettingsOf } from "@qticaret/types/section-steps"
import type { StatsSectionView, StepsSectionView, Translate } from "@qticaret/ui"
import { layoutLink } from "./layout"

/**
 * The figures strip as the theme draws it (adr/0077 §10): the shop's
 * figures as saved, its steps as the contract knows them (an unknown one,
 * from a newer backend, read as the default). No figure: no strip.
 */
export function statsView(section: StoreStatsSection, t: Translate): StatsSectionView | null {
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
        })),
        ...statsSettingsOf(section),
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
