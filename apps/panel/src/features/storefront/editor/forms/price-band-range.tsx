import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import type { PriceBand } from "@/features/storefront/api/layout"
import { PRICE_BANDS_LIMITS as B } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { RecordField } from "./record-fields"

const P = "storefront.editor.priceBands"

/** Whether the band is a price band: no category of its own. */
export const isPriced = (band: PriceBand) => !band.category_id

/** A price band's bounds (the price bands', others left out): what the next price band rises past. */
export function nextBound(bands: readonly PriceBand[]): number {
  const bounds = bands.flatMap((band) => (isPriced(band) && band.max !== null ? [band.max] : []))
  const top = bounds.length > 0 ? Math.max(...bounds) : 0
  return Math.min(B.max, top > 0 ? top * 2 : 500)
}

/**
 * A band's category and range (adr/0049, 2026-11-15): its category,
 * optional; without one, its upper bound (the last price band may have
 * none: "and up"); with one, a price limit of its own, off for the whole
 * category.
 */
export function PriceBandRange({
  id,
  band,
  bands,
  index,
  onChange,
}: {
  id: string
  band: PriceBand
  bands: readonly PriceBand[]
  index: number
  onChange: (next: Partial<PriceBand>, field?: string) => void
}) {
  const { t } = useTranslation()
  const lastPriced = bands.findLastIndex(isPriced)
  const category = band.category_id ?? ""
  const bound = (hint: string) =>
    band.max === null ? null : (
      <Field label={t(`${P}.max`)} htmlFor={`${id}-max`} hint={hint}>
        <NumberField
          plain
          id={`${id}-max`}
          min={1}
          max={B.max}
          step={1}
          value={band.max}
          className="w-40"
          onChange={(event) => {
            const next = Math.trunc(Number(event.target.value))
            if (Number.isFinite(next) && event.target.value !== "") {
              onChange({ max: Math.max(1, Math.min(B.max, next)) }, "max")
            }
          }}
        />
      </Field>
    )
  return (
    <>
      <RecordField
        kind="category"
        label={t(`${P}.category`)}
        hint={t(`${P}.categoryHint`)}
        id={category}
        onChange={(category_id) => {
          // A category chosen shows the whole category; a price limit is the shop's to turn on
          onChange(category ? { category_id } : { category_id, max: null }, "category_id")
        }}
        onClear={() => {
          // A price band again: open only when no price band comes after it
          const later = bands.slice(index + 1).some(isPriced)
          const max = band.max ?? (later ? nextBound(bands.slice(0, index)) : null)
          onChange({ category_id: null, max }, "category_id")
        }}
      />
      {category ? (
        <>
          <SwitchRow
            id={`${id}-priced`}
            label={t(`${P}.priced`)}
            hint={t(`${P}.pricedHint`)}
            checked={band.max !== null}
            onChange={(on) => {
              onChange({ max: on ? nextBound([]) : null })
            }}
          />
          {bound(t(`${P}.categoryMaxHint`))}
        </>
      ) : (
        <>
          {bound(t(`${P}.maxHint`))}
          {index === lastPriced ? (
            <SwitchRow
              id={`${id}-open`}
              label={t(`${P}.open`)}
              hint={t(`${P}.openHint`)}
              checked={band.max === null}
              onChange={(open) => {
                onChange({ max: open ? null : nextBound(bands.slice(0, index)) })
              }}
            />
          ) : null}
        </>
      )}
    </>
  )
}
