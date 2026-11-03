import { FlaskConical, Info, Loader2, Play } from "lucide-react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import type { MigrationMode } from "@/features/settings/api/migration"
import { PARCEL_FIELDS } from "@/features/settings/components/migration/parcel"
import type { ParcelField } from "@/features/settings/components/migration/parcel"

const R = "settings.migration.run"

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

interface RunButtonsProps {
  disabled: boolean
  /** A run that is only ever applied (a WordPress description refresh): no dry run. */
  checkDisabled?: boolean
  /** The mode a start under way was asked in: its button turns. */
  pending: MigrationMode | null
  onCheck: () => void
  onApply: () => void
}

/** A dry run first, then applying (confirmed, and proved again), side by side. */
export function RunButtons({
  disabled,
  checkDisabled = false,
  pending,
  onCheck,
  onApply,
}: RunButtonsProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="outline" disabled={disabled || checkDisabled} onClick={onCheck}>
        {pending === "check" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        {t(`${R}.check`)}
      </Button>
      <Button disabled={disabled} onClick={onApply}>
        {pending === "apply" ? <Loader2 className="animate-spin" /> : <Play />}
        {t(`${R}.apply`)}
      </Button>
    </div>
  )
}
