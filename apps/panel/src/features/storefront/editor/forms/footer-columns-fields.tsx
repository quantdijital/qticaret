import { useTranslation } from "react-i18next"
import {
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_COLUMNS_LIMITS,
  FOOTER_COLUMNS_SETTINGS,
} from "@qticaret/types"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { FooterColumnsSection } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { PANEL_GROUPS } from "../panel-groups"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { CARD_FIELD_IDS } from "./card-field-ids"
import { useProblemText } from "./problem-text"
import { StepChoice } from "./step-choice"

const F = "storefront.editor.footerBar"

type Change = (section: FooterColumnsSection, field?: string) => void

/**
 * The brand columns footer's words (adr/0049 Ek 2026-11-17), under
 * "İçerik" after the footer's own: the strip above the columns, and a
 * short line about the shop under its name.
 */
export function FooterColumnsContent({
  section,
  problems,
  onChange,
}: {
  section: FooterColumnsSection
  problems: SectionProblems
  onChange: Change
}) {
  const { t } = useTranslation()
  const problemText = useProblemText()
  const about = CARD_FIELD_IDS.footer(section.id, "about")
  const error = problemText(problems["about"], FOOTER_COLUMNS_LIMITS.about)
  return (
    <>
      <SwitchRow
        id={CARD_FIELD_IDS.footer(section.id, "top_strip")}
        label={t(`${F}.top_strip.label`)}
        term={t(`${F}.top_strip.term`)}
        hint={t(`${F}.top_strip.hint`)}
        checked={section.top_strip}
        onChange={(top_strip) => {
          onChange({ ...section, top_strip })
        }}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={about} className="text-sm font-medium">
          {t(`${F}.about.label`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${F}.about.term`)}
          </small>
        </label>
        <Input
          id={about}
          value={section.about ?? ""}
          maxLength={FOOTER_COLUMNS_LIMITS.about}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${about}-error` : `${about}-hint`}
          onChange={(event) => {
            const words = event.target.value.replace(/\s*[\r\n\t]+\s*/g, " ")
            onChange({ ...section, about: words.trim() === "" ? null : words }, about)
          }}
        />
        {error ? (
          <p id={`${about}-error`} role="alert" className="text-xs text-destructive-text">
            {error}
          </p>
        ) : (
          <p id={`${about}-hint`} className="text-xs text-muted-foreground">
            {t(`${F}.about.hint`)}
          </p>
        )}
      </div>
    </>
  )
}

/** How the brand columns footer is drawn, under "Stil": its ground and its payment logos. */
export function FooterStyleGroup({
  section,
  reveal,
  onChange,
}: {
  section: FooterColumnsSection
  reveal: number | null
  onChange: Change
}) {
  const { t } = useTranslation()
  const set =
    Number(section.ground !== FOOTER_COLUMNS_DEFAULTS.ground) +
    Number(section.badge_style !== FOOTER_COLUMNS_DEFAULTS.badge_style)
  return (
    <PanelGroup
      name="appearance"
      title={t(PANEL_GROUPS.appearance.title)}
      marked={set}
      reveal={reveal}
    >
      <div className="flex flex-col gap-5">
        <StepChoice
          id={CARD_FIELD_IDS.footer(section.id, "ground")}
          label={t(`${F}.ground.label`)}
          term={t(`${F}.ground.term`)}
          steps={FOOTER_COLUMNS_SETTINGS.ground}
          value={section.ground}
          fallback={FOOTER_COLUMNS_DEFAULTS.ground}
          nameOf={(step) => t(`${F}.ground.${step}`)}
          onChange={(ground) => {
            onChange({ ...section, ground })
          }}
        />
        <StepChoice
          id={CARD_FIELD_IDS.footer(section.id, "badge_style")}
          label={t(`${F}.badge_style.label`)}
          term={t(`${F}.badge_style.term`)}
          hint={t(`${F}.badge_style.hint`)}
          steps={FOOTER_COLUMNS_SETTINGS.badge_style}
          value={section.badge_style}
          fallback={FOOTER_COLUMNS_DEFAULTS.badge_style}
          nameOf={(step) => t(`${F}.badge_style.${step}`)}
          onChange={(badge_style) => {
            onChange({ ...section, badge_style })
          }}
        />
      </div>
    </PanelGroup>
  )
}
