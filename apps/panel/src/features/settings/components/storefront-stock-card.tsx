import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { NumberField } from "@/components/patterns/number-field"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { useSaveStorefront } from "@/features/settings/storefront"

const L = "settings.storefront.lowStock"
// The server's limit (backend platform-settings/sections/storefront.ts)
const MAX = 1000

const isThreshold = (text: string): boolean => /^\d{1,4}$/.test(text) && Number(text) <= MAX

/**
 * The storefront's "Az kaldı" line: a product card says it at or under this
 * many in stock, never the number itself; 0 never says it. Apart from the
 * staff's own low-stock alert (Settings > Shipping > Locations).
 */
export function LowStockBadgeCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const stored = String(saved.low_stock_threshold)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? stored
  const valid = isThreshold(text)
  return (
    <CardForm
      title={t(`${L}.title`)}
      description={t(`${L}.description`)}
      dirty={text !== stored}
      saving={saving}
      onSubmit={() => {
        if (valid) {
          save({ low_stock_threshold: Number(text) }, () => {
            setDraft(null)
          })
        }
      }}
      onReset={() => {
        setDraft(null)
      }}
    >
      <Field
        label={t(`${L}.label`)}
        htmlFor="storefront-low-stock"
        hint={t(`${L}.hint`)}
        error={valid ? undefined : t(`${L}.invalid`, { max: MAX })}
      >
        <NumberField
          id="storefront-low-stock"
          min={0}
          max={MAX}
          suffix={t(`${L}.unit`)}
          className="w-44"
          value={text}
          aria-invalid={!valid || undefined}
          onChange={(event) => {
            setDraft(event.target.value.trim())
          }}
        />
      </Field>
    </CardForm>
  )
}
