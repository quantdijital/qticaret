import { ChevronRight, Eye, Info, Loader2, Play } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { MigrationMode } from "@/features/settings/api/migration"
import { PARCEL_FIELDS } from "@/features/settings/components/migration/parcel"
import type { ParcelField } from "@/features/settings/components/migration/parcel"

const R = "settings.migration.run"
// A parcel a shop might send: a knife's box, in grams and cm
const EXAMPLE: Readonly<Record<ParcelField, string>> = {
  weight: "1000",
  length: "30",
  width: "20",
  height: "10",
}

interface ParcelFieldsProps {
  /** Each input's value and change, or a form's registration of it. */
  inputProps: (field: ParcelField) => ComponentProps<typeof NumberField>
  /** In place of the hint: what this source's products are likely to lack, and what happens then. */
  note?: string | undefined
  /** An i18n'd sentence: the four values do not make a parcel. */
  error?: string | undefined
}

/**
 * The owner's optional parcel for products without measurements, written
 * into their own fields: grams and cm, all four or none. Without it they
 * come as the source has them and ship as the shop's default parcel (adr/0054).
 */
export function ParcelFields({ inputProps, note, error }: ParcelFieldsProps) {
  const { t } = useTranslation()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t(`${R}.parcel.title`)}</legend>
      {note ? (
        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {note}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t(`${R}.parcel.hint`)}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {PARCEL_FIELDS.map((field) => (
          <Field key={field} label={t(`${R}.parcel.${field}`)} htmlFor={`parcel-${field}`}>
            <NumberField
              decimals={field === "weight" ? 0 : 1}
              min={0}
              id={`parcel-${field}`}
              placeholder={EXAMPLE[field]}
              {...inputProps(field)}
            />
          </Field>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

interface AdvancedOptionsProps {
  /** Something in it to see to (a field the run refused): it opens. */
  attention?: boolean
  children: ReactNode
}

/**
 * The options most shops leave empty (the old category address base, the
 * parcel), folded under "Gelişmiş" so the run's own fields come first.
 * Closed, they stay mounted: what was typed survives.
 */
export function AdvancedOptions({ attention = false, children }: AdvancedOptionsProps) {
  const { t } = useTranslation()
  return (
    <details className="group/advanced rounded-md border px-3 py-2.5" open={attention || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/advanced:rotate-90"
        />
        <span className="font-medium">{t(`${R}.advanced`)}</span>
        <span className="ml-auto text-right text-[13px] text-muted-foreground">
          {t(`${R}.advancedHint`)}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  )
}

interface RunButtonsProps {
  disabled: boolean
  /** The mode a start under way was asked in: its button turns. */
  pending: MigrationMode | null
  onCheck: () => void
  onApply: () => void
}

/** A preview first (nothing saved), then the run itself (confirmed, and proved again), side by side. */
export function RunButtons({ disabled, pending, onCheck, onApply }: RunButtonsProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="outline" disabled={disabled} onClick={onCheck}>
        {pending === "check" ? <Loader2 className="animate-spin" /> : <Eye />}
        {t(`${R}.check`)}
      </Button>
      <Button disabled={disabled} onClick={onApply}>
        {pending === "apply" ? <Loader2 className="animate-spin" /> : <Play />}
        {t(`${R}.apply`)}
      </Button>
    </div>
  )
}
