import { useTranslation } from "react-i18next"
import { FOOTER_BAR_DEFAULTS, FOOTER_BAR_SETTINGS } from "@qticaret/types"
import type { FooterBarSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { CARD_FIELD_IDS } from "./card-field-ids"
import type { SectionFormProps } from "./form-props"
import { FooterColumnsContent } from "./footer-columns-fields"
import { PaymentBadgesField } from "./payment-badges-field"
import { StepChoice } from "./step-choice"

const F = "storefront.editor.footerBar"

/** A corner button drawn in small: a dot at the right or the left of a page's foot. */
const Corner = ({ side }: { side: "right" | "left" }) => (
  <span
    aria-hidden="true"
    className={`flex h-4 w-8 items-end rounded-sm border border-current p-0.5 opacity-60 ${side === "right" ? "justify-end" : "justify-start"}`}
  >
    <span className="size-1.5 rounded-full bg-current" />
  </span>
)

/**
 * The footer's own settings (adr/0049 Ek 2026-11-15): how the shop's
 * profiles show (their addresses are the store details' social accounts),
 * the ways to pay it names, and a "back to top" button; the button's
 * corner, face and phones show only while it is on; the brand columns
 * footer's strip and short line after them (its look under "Stil",
 * `FooterStyleGroup`). The menus, details
 * and marks are edited on their own screens.
 */
export function FooterBarForm({ section, problems, onChange }: SectionFormProps<FooterBarSection>) {
  const { t } = useTranslation()
  const id = (field: Parameters<typeof CARD_FIELD_IDS.footer>[1]) =>
    CARD_FIELD_IDS.footer(section.id, field)
  return (
    <div className="flex flex-col gap-5">
      <StepChoice
        id={id("social")}
        label={t(`${F}.social.label`)}
        term={t(`${F}.social.term`)}
        hint={t(`${F}.social.hint`)}
        steps={FOOTER_BAR_SETTINGS.social}
        value={section.social}
        fallback={FOOTER_BAR_DEFAULTS.social}
        nameOf={(step) => t(`${F}.social.${step}`)}
        onChange={(social) => {
          onChange({ ...section, social })
        }}
      />
      <PaymentBadgesField
        id={id("payment_badges")}
        value={section.payment_badges}
        onChange={(payment_badges) => {
          onChange({ ...section, payment_badges })
        }}
      />
      <SwitchRow
        id={id("back_to_top")}
        label={t(`${F}.back_to_top.label`)}
        hint={t(`${F}.back_to_top.hint`)}
        checked={section.back_to_top}
        onChange={(back_to_top) => {
          onChange({ ...section, back_to_top })
        }}
      />
      {section.back_to_top ? (
        <>
          <StepChoice
            id={id("back_to_top_side")}
            label={t(`${F}.back_to_top_side.label`)}
            term={t(`${F}.back_to_top_side.term`)}
            steps={FOOTER_BAR_SETTINGS.back_to_top_side}
            value={section.back_to_top_side}
            fallback={FOOTER_BAR_DEFAULTS.back_to_top_side}
            nameOf={(step) => t(`${F}.back_to_top_side.${step}`)}
            drawOf={(step) => <Corner side={step} />}
            onChange={(back_to_top_side) => {
              onChange({ ...section, back_to_top_side })
            }}
          />
          <StepChoice
            id={id("back_to_top_shape")}
            label={t(`${F}.back_to_top_shape.label`)}
            term={t(`${F}.back_to_top_shape.term`)}
            steps={FOOTER_BAR_SETTINGS.back_to_top_shape}
            value={section.back_to_top_shape}
            fallback={FOOTER_BAR_DEFAULTS.back_to_top_shape}
            nameOf={(step) => t(`${F}.back_to_top_shape.${step}`)}
            drawOf={(step) => (
              <span
                aria-hidden="true"
                className={`block size-4 border border-current opacity-60 ${step === "round" ? "rounded-full" : "rounded-sm"}`}
              />
            )}
            onChange={(back_to_top_shape) => {
              onChange({ ...section, back_to_top_shape })
            }}
          />
          <SwitchRow
            id={id("back_to_top_mobile")}
            label={t(`${F}.back_to_top_mobile.label`)}
            hint={t(`${F}.back_to_top_mobile.hint`)}
            checked={section.back_to_top_mobile}
            onChange={(back_to_top_mobile) => {
              onChange({ ...section, back_to_top_mobile })
            }}
          />
        </>
      ) : null}
      {section.variant === "brand_columns" ? (
        <FooterColumnsContent section={section} problems={problems} onChange={onChange} />
      ) : null}
    </div>
  )
}
