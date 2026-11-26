import type { FieldError } from "react-hook-form"
import { Controller, useFieldArray, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { ADDON_CHARSETS, ADDON_LIMITS } from "@/features/products/api/addons"
import { ListFooter, RowActions, RowCell } from "@/features/settings/components/storefront-rows"
import { emptyChoice } from "./addon-values"
import type { AddonDraft } from "./addon-values"

const A = "products.addons"
const CHOICE_GRID = "grid grid-cols-[minmax(0,1fr)_10rem_auto] items-start gap-2"

/** A field's error key in words; undefined while it holds none. */
function useErrorText() {
  const { t } = useTranslation()
  return (error: Pick<FieldError, "message"> | undefined) =>
    error?.message ? t(error.message) : undefined
}

/** A typed text's price, length, characters and unit limit. */
export function TextRules() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { control, register, formState } = useFormContext<AddonDraft>()
  const { errors } = formState
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t(`${A}.price`)}
          htmlFor="addon-price"
          hint={t(`${A}.priceHint`)}
          error={errorText(errors.price)}
        >
          <NumberField
            decimals={2}
            min={0}
            max={ADDON_LIMITS.price}
            suffix="₺"
            id="addon-price"
            placeholder="0,00"
            aria-invalid={Boolean(errors.price)}
            {...register("price")}
          />
        </Field>
        <Field
          label={t(`${A}.maxLength`)}
          htmlFor="addon-max-length"
          hint={t(`${A}.maxLengthHint`, { max: ADDON_LIMITS.textMax })}
          error={errorText(errors.max_length)}
        >
          <NumberField
            min={1}
            max={ADDON_LIMITS.textMax}
            id="addon-max-length"
            aria-invalid={Boolean(errors.max_length)}
            {...register("max_length")}
          />
        </Field>
        <Field
          label={t(`${A}.maxQuantity`)}
          htmlFor="addon-max-quantity"
          hint={t(`${A}.maxQuantityHint`)}
          error={errorText(errors.max_quantity)}
        >
          <NumberField
            min={1}
            max={ADDON_LIMITS.quantityMax}
            id="addon-max-quantity"
            placeholder={t(`${A}.unlimited`)}
            aria-invalid={Boolean(errors.max_quantity)}
            {...register("max_quantity")}
          />
        </Field>
      </div>
      <Field label={t(`${A}.charset`)} hint={t(`${A}.charsetHint`)}>
        <Controller
          control={control}
          name="charset"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              value={field.value}
              aria-label={t(`${A}.charset`)}
              onValueChange={(next) => {
                if (next) {
                  field.onChange(next)
                }
              }}
              className="w-full"
            >
              {ADDON_CHARSETS.map((charset) => (
                <ToggleGroupItem key={charset} value={charset} className="flex-1">
                  {t(`${A}.charsets.${charset}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </Field>
    </>
  )
}

/** A choice add-on's options: two to ten, each with its own price; ids travel with the rows. */
export function ChoiceRows() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { control, register, formState } = useFormContext<AddonDraft>()
  const choices = useFieldArray({ control, name: "choices", keyName: "fieldKey" })
  const count = choices.fields.length
  const errors = formState.errors.choices
  // The list's own error (two to ten) sits beside the rows' errors
  const listError = errorText(
    (errors as { root?: FieldError } | undefined)?.root ??
      (errors?.message ? { message: errors.message } : undefined)
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t(`${A}.choices`)}</span>
      <div aria-hidden className={`${CHOICE_GRID} text-xs font-medium text-muted-foreground`}>
        <span>{t(`${A}.choiceLabel`)}</span>
        <span>{t(`${A}.choicePrice`)}</span>
        <span className="w-29" />
      </div>
      <ol className="flex flex-col gap-2">
        {choices.fields.map((choice, index) => {
          const number = index + 1
          const id = `addon-choice-${index}`
          const labelError = errorText(errors?.[index]?.label)
          const priceError = errorText(errors?.[index]?.price)
          return (
            <li key={choice.fieldKey} className={CHOICE_GRID}>
              <RowCell error={labelError} errorId={`${id}-label-error`}>
                <Input
                  placeholder={t("products.placeholders.addonChoice")}
                  aria-label={t(`${A}.choiceLabelOf`, { number })}
                  aria-invalid={Boolean(labelError)}
                  aria-describedby={labelError ? `${id}-label-error` : undefined}
                  maxLength={ADDON_LIMITS.label}
                  {...register(`choices.${index}.label`)}
                />
              </RowCell>
              <RowCell error={priceError} errorId={`${id}-price-error`}>
                <NumberField
                  decimals={2}
                  min={0}
                  max={ADDON_LIMITS.price}
                  suffix="₺"
                  placeholder="0,00"
                  aria-label={t(`${A}.choicePriceOf`, { number })}
                  aria-invalid={Boolean(priceError)}
                  aria-describedby={priceError ? `${id}-price-error` : undefined}
                  {...register(`choices.${index}.price`)}
                />
              </RowCell>
              <RowActions
                index={index}
                count={count}
                item={t(`${A}.choiceItem`, { number })}
                removable={count > ADDON_LIMITS.choicesMin}
                onMove={(to) => {
                  choices.move(index, to)
                }}
                onRemove={() => {
                  choices.remove(index)
                }}
              />
            </li>
          )
        })}
      </ol>
      {listError ? (
        <p role="alert" className="text-xs text-destructive-text">
          {listError}
        </p>
      ) : null}
      <ListFooter
        label={t(`${A}.addChoice`)}
        hint={t(`${A}.choicesHint`, {
          min: ADDON_LIMITS.choicesMin,
          max: ADDON_LIMITS.choicesMax,
        })}
        full={count >= ADDON_LIMITS.choicesMax}
        onAdd={() => {
          choices.append(emptyChoice())
        }}
      />
    </div>
  )
}
