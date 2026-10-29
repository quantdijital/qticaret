import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Choices } from "@/features/products/bulk/bulk-choices"
import type { FieldsProps } from "@/features/products/bulk/bulk-fields"

/**
 * The variants' unit cost at once (F11.4): one cost for every variant, a
 * percent up or down on the ones that have a cost, or none at all.
 */
export function BulkCostFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  return (
    <>
      <Choices
        label={t("products.bulk.cost.mode")}
        value={form.costMode}
        onChange={(costMode) => {
          onChange({ costMode })
        }}
        options={(["set", "percent", "clear"] as const).map((value) => ({
          value,
          label: t(`products.bulk.cost.modes.${value}`),
        }))}
      />
      {form.costMode === "percent" ? (
        <Choices
          label={t("products.bulk.direction")}
          value={form.direction}
          onChange={(direction) => {
            onChange({ direction })
          }}
          options={(["up", "down"] as const).map((value) => ({
            value,
            label: t(`products.bulk.price.directions.${value}`),
          }))}
        />
      ) : null}
      {form.costMode === "clear" ? (
        <p className="text-[13px] text-muted-foreground">{t("products.bulk.cost.clearHint")}</p>
      ) : (
        <Field
          label={t(
            form.costMode === "percent"
              ? "products.bulk.price.percent"
              : "products.bulk.cost.amount"
          )}
          htmlFor="bulk-value"
          hint={t(`products.bulk.cost.hints.${form.costMode}`)}
          error={error ? t(error) : undefined}
        >
          <Input
            id="bulk-value"
            inputMode="decimal"
            autoComplete="off"
            value={form.value}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              onChange({ value: event.target.value })
            }}
            className="sm:max-w-48"
          />
        </Field>
      )}
    </>
  )
}
