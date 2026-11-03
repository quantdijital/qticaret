import { PackageSearch, X } from "lucide-react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SearchPicker } from "@/components/patterns/search-picker"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import { searchVariants } from "@/features/orders/api/edit"
import { MAX_LINES, MAX_QUANTITY } from "@/features/payment-links/form"
import type { LinkFormValues } from "@/features/payment-links/form"
import { useFieldError } from "./use-field-error"

const L = "paymentLinks.form.lines"

/**
 * What the customer buys (adr/0051 §2): variants found by name or code and
 * how many; the price is the catalog's, worked out by the backend. A
 * variant picked again adds to its row. Lines short on stock are marked
 * from the summary; the link is still made.
 */
export function LinesCard({ short }: { short: ReadonlySet<string> }) {
  const { t } = useTranslation()
  const fieldError = useFieldError()
  const { control, register, formState, getValues, setValue } = useFormContext<LinkFormValues>()
  const lines = useFieldArray({ control, name: "lines", keyName: "key" })
  const full = lines.fields.length >= MAX_LINES
  return (
    <SectionCard title={t(`${L}.title`)} description={t(`${L}.description`)}>
      <div className="flex flex-col gap-4">
        <Field
          label={t(`${L}.add`)}
          htmlFor="link-variant"
          hint={full ? t(`${L}.full`, { count: MAX_LINES }) : undefined}
          error={fieldError(formState.errors.lines?.root ?? formState.errors.lines)}
        >
          <SearchPicker
            id="link-variant"
            value={null}
            disabled={full}
            onChange={(option) => {
              if (!option) {
                return
              }
              const index = getValues("lines").findIndex((each) => each.variant_id === option.id)
              if (index >= 0) {
                const quantity = getValues(`lines.${index}.quantity`)
                setValue(`lines.${index}.quantity`, Math.min(MAX_QUANTITY, quantity + 1), {
                  shouldDirty: true,
                })
              } else {
                lines.append({ variant_id: option.id, label: option.label, quantity: 1 })
              }
            }}
            search={searchVariants}
            queryKey={["payment-links", "variants"]}
            placeholder={t(`${L}.searchPlaceholder`)}
            empty={t(`${L}.searchEmpty`)}
          />
        </Field>
        {lines.fields.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <PackageSearch className="size-5 shrink-0" aria-hidden="true" />
            {t(`${L}.empty`)}
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {lines.fields.map((line, index) => {
              const error = fieldError(formState.errors.lines?.[index]?.quantity)
              return (
                <li key={line.key} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                      <span className="truncate font-medium">{line.label}</span>
                      {short.has(line.variant_id) ? (
                        <StatusBadge tone="warning">{t("paymentLinks.lines.short")}</StatusBadge>
                      ) : null}
                    </span>
                    <NumberField
                      plain
                      min={1}
                      max={MAX_QUANTITY}
                      aria-label={t(`${L}.quantityOf`, { name: line.label })}
                      aria-invalid={error ? true : undefined}
                      className="w-28 shrink-0"
                      {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t(`${L}.remove`, { name: line.label })}
                      onClick={() => {
                        lines.remove(index)
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                  {error ? (
                    <p role="alert" className="text-xs text-destructive-text">
                      {error}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  )
}
