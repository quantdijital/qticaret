import { useTranslation } from "react-i18next"
import {
  HERO_FULL_DEFAULTS,
  HERO_FULL_LIMITS,
  HERO_FULL_SETTINGS,
  heroFullSettingsOf,
} from "@qticaret/types"
import type { HeroFullSetting } from "@qticaret/types"
import type { HeroSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { TextField } from "./fields"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { HERO_FULL_CONTENT, HERO_FULL_LAYOUT, heroFullShows } from "./hero-full-registry"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"
import { StepChoice } from "./step-choice"

const H = "storefront.editor.heroFull"

/** The opening drawn as the full image (adr/0077 §9). */
export type HeroFull = Extract<HeroSection, { variant: "full_image" }>

type Steps = readonly (readonly [HeroFullSetting, Parameters<typeof FIELD_IDS.content>[1]])[]

/** Each step of a list as a choice, only those the opening shows as it stands. */
function StepFields({
  section,
  steps,
  onChange,
}: {
  section: HeroFull
  steps: Steps
  onChange: (section: HeroFull) => void
}) {
  const { t } = useTranslation()
  const settings = heroFullSettingsOf(section)
  return steps
    .filter(([name]) => heroFullShows(section, name))
    .map(([name, field]) => (
      <StepChoice<string>
        key={name}
        id={FIELD_IDS.content(section.id, field)}
        label={t(`${H}.${name}.label`)}
        term={t(`${H}.${name}.term`)}
        hint={t(`${H}.${name}.hint`)}
        steps={HERO_FULL_SETTINGS[name]}
        value={settings[name]}
        fallback={HERO_FULL_DEFAULTS[name]}
        nameOf={(step) => t(`${H}.${name}.${step}`)}
        onChange={(step) => {
          onChange({ ...section, [name]: step })
        }}
      />
    ))
}

/** The heading's second line, in the shop's colour; empty: no line. */
export function HeroAccentField({ section, problems, onChange }: SectionFormProps<HeroFull>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <TextField
      id={PREVIEW_IDS.text(section.id, "title_accent")}
      label={t(`${H}.accent.label`)}
      term={t(`${H}.accent.term`)}
      value={section.title_accent ?? null}
      max={HERO_FULL_LIMITS.title_accent}
      tokens
      placeholder={t(`${H}.accent.placeholder`)}
      hint={t(`${H}.accent.hint`)}
      error={problem(problems["title_accent"], HERO_FULL_LIMITS.title_accent)}
      onChange={(title_accent) => {
        onChange({ ...section, title_accent }, "title_accent")
      }}
    />
  )
}

/**
 * What stands under the opening's words, with its content: the buttons or
 * the shop's one search box (its fields the theme's, so a note says where
 * they are chosen), the box's place while it is shown, and the shop's
 * trust badges as a switch.
 */
export function HeroFullAction({
  section,
  onChange,
}: {
  section: HeroFull
  onChange: (section: HeroFull) => void
}) {
  const { t } = useTranslation()
  const searching = heroFullSettingsOf(section).action === "search"
  return (
    <>
      <StepFields section={section} steps={HERO_FULL_CONTENT} onChange={onChange} />
      {searching ? <p className="text-xs text-muted-foreground">{t(`${H}.searchNote`)}</p> : null}
      <SwitchRow
        id={FIELD_IDS.content(section.id, "show_trust")}
        label={t(`${H}.show_trust.label`)}
        term={t(`${H}.show_trust.term`)}
        hint={t(`${H}.show_trust.hint`)}
        checked={section.show_trust === true}
        onChange={(show_trust) => {
          onChange({ ...section, show_trust })
        }}
      />
    </>
  )
}

/** The open "Diziliş" group: the opening's height, its words' side, the photograph's place, veil and edge. */
export function HeroFullGroups({
  section,
  reveal,
  onChange,
}: {
  section: HeroFull
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: HeroFull) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name="layout" title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      <div className="flex flex-col gap-5">
        <StepFields section={section} steps={HERO_FULL_LAYOUT} onChange={onChange} />
      </div>
    </PanelGroup>
  )
}
