import { useTranslation } from "react-i18next"
import {
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_COLUMNS_LIMITS,
  FOOTER_COLUMNS_SETTINGS,
} from "@qticaret/types"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { FooterColumnsSection, FooterRowsSection } from "@/features/storefront/api/layout"
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

const COLUMNS_ONLY = ["news_place", "brand_contact", "bottom_align", "wordmark"] as const

const isColumns = (
  section: FooterColumnsSection | FooterRowsSection
): section is FooterColumnsSection => section.variant === "brand_columns"

/**
 * How the brand columns footer is drawn, under "Stil": its ground and its
 * payment logos; the free rows footer's alike (adr/0070 §2, the same names).
 * The brand columns' alone: the newsletter's place, the brand's contact and
 * the bottom line.
 */
export function FooterStyleGroup<S extends FooterColumnsSection | FooterRowsSection>({
  section,
  reveal,
  onChange,
}: {
  section: S
  reveal: number | null
  onChange: (section: S, field?: string) => void
}) {
  const { t } = useTranslation()
  // The newsletter's place, the brand's contact and the bottom line: the brand columns' own
  const own = isColumns(section) ? section : null
  const set =
    Number(section.ground !== FOOTER_COLUMNS_DEFAULTS.ground) +
    Number(section.badge_style !== FOOTER_COLUMNS_DEFAULTS.badge_style) +
    COLUMNS_ONLY.filter((key) => own && own[key] !== FOOTER_COLUMNS_DEFAULTS[key]).length
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
        {own &&
          COLUMNS_ONLY.map((key) => (
            <StepChoice
              key={key}
              id={CARD_FIELD_IDS.footer(section.id, key)}
              label={t(`${F}.${key}.label`)}
              term={t(`${F}.${key}.term`)}
              {...(key === "brand_contact" || key === "wordmark"
                ? { hint: t(`${F}.${key}.hint`) }
                : {})}
              steps={FOOTER_COLUMNS_SETTINGS[key] as readonly string[]}
              value={own[key]}
              fallback={FOOTER_COLUMNS_DEFAULTS[key]}
              nameOf={(step) => t(`${F}.${key}.${step}`)}
              onChange={(value) => {
                onChange({ ...own, [key]: value })
              }}
            />
          ))}
      </div>
    </PanelGroup>
  )
}
