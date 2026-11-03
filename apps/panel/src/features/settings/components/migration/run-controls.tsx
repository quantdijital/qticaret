import { CircleAlert, FlaskConical, Loader2, Play } from "lucide-react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MigrationMode } from "@/features/settings/api/migration"
import { PARCEL_FIELDS } from "@/features/settings/components/migration/parcel"
import type { ParcelField } from "@/features/settings/components/migration/parcel"

const R = "settings.migration.run"

interface ParcelFieldsProps {
  /** Each input's value and change, or a form's registration of it. */
  inputProps: (field: ParcelField) => ComponentProps<typeof Input>
  /** In place of the hint: why this source's products are likely to need it. */
  warning?: string | undefined
  /** An i18n'd sentence: the four values do not make a parcel. */
  error?: string | undefined
}

/** The owner's parcel for products without measurements: grams and cm, all four or none. */
export function ParcelFields({ inputProps, warning, error }: ParcelFieldsProps) {
  const { t } = useTranslation()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t(`${R}.parcel.title`)}</legend>
      {warning ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t(`${R}.parcel.hint`)}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {PARCEL_FIELDS.map((field) => (
          <Field key={field} label={t(`${R}.parcel.${field}`)} htmlFor={`parcel-${field}`}>
            <Input id={`parcel-${field}`} inputMode="decimal" {...inputProps(field)} />
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
  /** The mode a start under way was asked in: its button turns. */
  pending: MigrationMode | null
  onCheck: () => void
  onApply: () => void
}

/** A dry run first, then applying (confirmed, and proved again), side by side. */
export function RunButtons({ disabled, pending, onCheck, onApply }: RunButtonsProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="outline" disabled={disabled} onClick={onCheck}>
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
