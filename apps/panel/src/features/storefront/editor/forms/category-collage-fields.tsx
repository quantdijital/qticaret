import { useTranslation } from "react-i18next"
import {
  CATEGORY_CARD_LIMITS,
  CATEGORY_COLLAGE_DEFAULTS,
  CATEGORY_COLLAGE_SETTINGS,
} from "@qticaret/types"
import type { CategoriesCollageFields, CategoriesSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { CARD_FIELD_IDS } from "./card-field-ids"
import { CountField } from "./fields"
import { ColumnsDrawing as Columns, PhoneColumnsField } from "./phone-columns-field"
import { StepChoice } from "./step-choice"

const C = "storefront.editor.categoryCards"

type Collage = CategoriesSection & CategoriesCollageFields

/** The photo's height drawn in small: a block over a line, lower or taller. */
function Height({ step }: { step: CategoriesCollageFields["height"] }) {
  const block = { low: "h-1.5", medium: "h-2.5", high: "h-3.5" }[step]
  return (
    <span aria-hidden="true" className="flex h-5 w-8 flex-col justify-end gap-0.5">
      <span className={`w-full rounded-sm bg-current opacity-40 ${block}`} />
      <span className="h-1 w-2/3 rounded-sm bg-current opacity-60" />
    </span>
  )
}

/**
 * The collage's settings in the section's content (adr/0049 Ek
 * 2026-11-15), all open: the lead first (it shapes the rows), cards in a
 * row on a wide screen and on a phone, the photo's height and how many
 * subcategory links each card shows.
 */
export function CategoryCollageFields({
  section,
  onChange,
}: {
  section: Collage
  onChange: (section: CategoriesSection, field?: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div id={CARD_FIELD_IDS.card(section.id, "lead")}>
        <SwitchRow
          id={`${section.id}-cards-lead-switch`}
          label={t(`${C}.lead.label`)}
          term={t(`${C}.lead.term`)}
          hint={t(`${C}.lead.hint`)}
          checked={section.lead === "on"}
          onChange={(on) => {
            onChange({ ...section, lead: on ? "on" : "off" })
          }}
        />
      </div>
      <StepChoice
        id={CARD_FIELD_IDS.card(section.id, "columns")}
        label={t(`${C}.columns.label`)}
        term={t(`${C}.columns.term`)}
        hint={t(`${C}.columns.hintCollage`)}
        steps={CATEGORY_COLLAGE_SETTINGS.columns}
        value={section.columns}
        fallback={CATEGORY_COLLAGE_DEFAULTS.columns}
        nameOf={(step) => String(step)}
        drawOf={(step) => <Columns count={step} />}
        onChange={(columns) => {
          onChange({ ...section, columns })
        }}
      />
      <PhoneColumnsField
        id={CARD_FIELD_IDS.card(section.id, "columns_mobile")}
        value={section.columns_mobile ?? CATEGORY_COLLAGE_DEFAULTS.columns_mobile}
        fallback={CATEGORY_COLLAGE_DEFAULTS.columns_mobile}
        hint={t(`${C}.columns_mobile.hint`)}
        onChange={(columns_mobile) => {
          onChange({ ...section, columns_mobile })
        }}
      />
      <StepChoice
        id={CARD_FIELD_IDS.card(section.id, "height")}
        label={t(`${C}.height.label`)}
        term={t(`${C}.height.term`)}
        hint={t(`${C}.height.hint`)}
        steps={CATEGORY_COLLAGE_SETTINGS.height}
        value={section.height}
        fallback={CATEGORY_COLLAGE_DEFAULTS.height}
        nameOf={(step) => t(`${C}.height.${step}`)}
        drawOf={(step) => <Height step={step} />}
        onChange={(height) => {
          onChange({ ...section, height })
        }}
      />
      <CountField
        id={CARD_FIELD_IDS.card(section.id, "links")}
        label={`${t(`${C}.links.label`)} (${t(`${C}.links.term`)})`}
        hint={t(`${C}.links.hintCollage`)}
        min={CATEGORY_CARD_LIMITS.links.min}
        max={CATEGORY_CARD_LIMITS.links.max}
        value={section.links}
        onChange={(links) => {
          onChange({ ...section, links }, "links")
        }}
      />
    </>
  )
}
