import { useTranslation } from "react-i18next"
import {
  CATEGORY_CARD_DEFAULTS,
  CATEGORY_CARD_LIMITS,
  CATEGORY_CARD_SETTINGS,
} from "@qticaret/types"
import type { CategoriesLinkedFields, CategoriesSection } from "@/features/storefront/api/layout"
import { CARD_FIELD_IDS } from "./card-field-ids"
import { CountField } from "./fields"
import { StepChoice } from "./step-choice"

const C = "storefront.editor.categoryCards"

type Linked = CategoriesSection & CategoriesLinkedFields

/** A column count drawn in small: that many cards in a row. */
const Columns = ({ count }: { count: number }) => (
  <span aria-hidden="true" className="flex w-full max-w-12 gap-0.5">
    {Array.from({ length: count }, (_, index) => (
      <span key={index} className="h-3 flex-1 rounded-sm bg-current opacity-40" />
    ))}
  </span>
)

/** The picture's place drawn in small: a square beside two lines, a block above them, or lines alone. */
function Place({ step }: { step: CategoriesLinkedFields["image_position"] }) {
  const lines = (
    <span className="flex flex-1 flex-col gap-0.5">
      <span className="h-1 w-full rounded-sm bg-current opacity-60" />
      <span className="h-1 w-2/3 rounded-sm bg-current opacity-35" />
    </span>
  )
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-10 gap-1 ${step === "top" ? "flex-col" : "items-center"}`}
    >
      {step === "side" && <span className="size-4 shrink-0 rounded-sm bg-current opacity-40" />}
      {step === "top" && <span className="h-2 w-full rounded-sm bg-current opacity-40" />}
      {lines}
    </span>
  )
}

/**
 * The linked cards' basics in the section's content (adr/0049 Ek
 * 2026-11-15): cards in a row on a wide screen, where the picture stands
 * and how many subcategory links each card shows. The frame is with the
 * look, closed (`CategoryCardsOther`).
 */
export function CategoryCardsFields({
  section,
  onChange,
}: {
  section: Linked
  onChange: (section: CategoriesSection, field?: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <StepChoice
        id={CARD_FIELD_IDS.card(section.id, "columns")}
        label={t(`${C}.columns.label`)}
        term={t(`${C}.columns.term`)}
        hint={t(`${C}.columns.hint`)}
        steps={CATEGORY_CARD_SETTINGS.columns}
        value={section.columns}
        fallback={CATEGORY_CARD_DEFAULTS.columns}
        nameOf={(step) => String(step)}
        drawOf={(step) => <Columns count={step} />}
        onChange={(columns) => {
          onChange({ ...section, columns })
        }}
      />
      <StepChoice
        id={CARD_FIELD_IDS.card(section.id, "image_position")}
        label={t(`${C}.image_position.label`)}
        term={t(`${C}.image_position.term`)}
        hint={t(`${C}.image_position.hint`)}
        steps={CATEGORY_CARD_SETTINGS.image_position}
        value={section.image_position}
        fallback={CATEGORY_CARD_DEFAULTS.image_position}
        nameOf={(step) => t(`${C}.image_position.${step}`)}
        drawOf={(step) => <Place step={step} />}
        onChange={(image_position) => {
          onChange({ ...section, image_position })
        }}
      />
      <CountField
        id={CARD_FIELD_IDS.card(section.id, "links")}
        label={`${t(`${C}.links.label`)} (${t(`${C}.links.term`)})`}
        hint={t(`${C}.links.hint`)}
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

/** The cards' frame, a rarer choice, with the section's look in "Diğer ayarlar". */
export function CategoryCardsOther({
  section,
  onChange,
}: {
  section: Linked
  onChange: (section: CategoriesSection) => void
}) {
  const { t } = useTranslation()
  return (
    <StepChoice
      id={CARD_FIELD_IDS.card(section.id, "frame")}
      label={t(`${C}.frame.label`)}
      term={t(`${C}.frame.term`)}
      steps={CATEGORY_CARD_SETTINGS.frame}
      value={section.frame}
      fallback={CATEGORY_CARD_DEFAULTS.frame}
      nameOf={(step) => t(`${C}.frame.${step}`)}
      drawOf={(step) => (
        <span
          aria-hidden="true"
          className={`block h-4 w-8 rounded-sm ${step === "lined" ? "border border-current opacity-60" : "bg-current opacity-15"}`}
        />
      )}
      onChange={(frame) => {
        onChange({ ...section, frame })
      }}
    />
  )
}
