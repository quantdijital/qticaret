import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  featuredProductSettingsOf,
} from "@qticaret/types"
import type { FeaturedProductSettings } from "@qticaret/types"
import type { FeaturedProductSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { GallerySketch, LayoutSketch, LineSketch, SlantSketch } from "./featured-sketches"
import { StepChoice } from "./step-choice"

const P = "storefront.editor.featured"

type StepSetting = "strips_layout" | "strips_slant" | "strips_line"

/** The strips' steps by setting: its label key's stem and its small drawing (`featured-sketches.tsx`). */
const STEPS = [
  ["strips_layout", "stripsLayout", (step) => <LayoutSketch step={step as "side"} />],
  ["strips_slant", "stripsSlant", (step) => <SlantSketch step={step as "soft"} />],
  ["strips_line", "stripsLine", (step) => <LineSketch step={step as "none"} />],
] as const satisfies readonly (readonly [StepSetting, string, (step: string) => ReactNode])[]

/** The strips' two switches, by setting and label key's stem. */
const SWITCHES = [
  ["strips_overlap", "stripsOverlap"],
  ["strips_dim", "stripsDim"],
] as const

/**
 * The featured product's open "Diziliş" group (docs/tema/bilesen-standardi
 * §1): how its photographs stand, a basic the shop changes in its first
 * minutes, so open under the content. "Kolaj", the drawing from before the
 * setting, is the default (adr/0049 Ek 2026-11-15). With the strips chosen
 * their own look follows in the same group (Ek 2026-11-16): where they
 * stand, the seams' slant and line as steps, the overlap and the darkening
 * as switches; hidden with the collage, which they do not touch.
 */
export function FeaturedGroups({
  section,
  reveal,
  onChange,
}: {
  section: FeaturedProductSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: FeaturedProductSection) => void
}) {
  const { t } = useTranslation()
  const settings = featuredProductSettingsOf(section)
  const set = (next: Partial<FeaturedProductSettings>) => {
    onChange({ ...section, ...next })
  }
  return (
    <PanelGroup title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <StepChoice
        id={FIELD_IDS.content(section.id, "gallery")}
        label={t(`${P}.gallery`)}
        term={t(`${P}.galleryTerm`)}
        hint={t(`${P}.galleryHint.${settings.gallery}`)}
        steps={FEATURED_PRODUCT_SETTINGS.gallery}
        value={settings.gallery}
        fallback={FEATURED_PRODUCT_DEFAULTS.gallery}
        nameOf={(step) => t(`${P}.galleries.${step}`)}
        drawOf={(step) => <GallerySketch step={step} />}
        onChange={(gallery) => {
          set({ gallery })
        }}
      />
      {settings.gallery === "strips" ? (
        <div className="flex flex-col gap-4 border-t pt-4">
          {STEPS.map(([name, key, draw]) => (
            <StepChoice<string>
              key={name}
              id={FIELD_IDS.content(section.id, name)}
              label={t(`${P}.${key}`)}
              term={t(`${P}.${key}Term`)}
              hint={
                name === "strips_layout"
                  ? t(`${P}.${key}Hint.${settings[name]}`)
                  : t(`${P}.${key}Hint`)
              }
              steps={FEATURED_PRODUCT_SETTINGS[name]}
              value={settings[name]}
              fallback={FEATURED_PRODUCT_DEFAULTS[name]}
              nameOf={(step) => t(`${P}.${key}s.${step}`)}
              drawOf={draw}
              onChange={(step) => {
                set({ [name]: step })
              }}
            />
          ))}
          {SWITCHES.map(([name, key]) => (
            <SwitchRow
              key={name}
              id={FIELD_IDS.content(section.id, name)}
              label={t(`${P}.${key}`)}
              term={t(`${P}.${key}Term`)}
              hint={t(`${P}.${key}Hint`)}
              checked={settings[name] === "on"}
              onChange={(on) => {
                set({ [name]: on ? "on" : "off" })
              }}
            />
          ))}
        </div>
      ) : null}
    </PanelGroup>
  )
}
