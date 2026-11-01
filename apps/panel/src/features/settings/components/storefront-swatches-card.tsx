import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { ListFooter, RowCell } from "@/features/settings/components/storefront-rows"
import {
  STOREFRONT_LIMITS,
  colorSwatchesSchema,
  errorLine,
  isHexColor,
  useSaveStorefront,
} from "@/features/settings/storefront"
import { FULL_RESET } from "@/lib/forms"
import { STOREFRONT_THEME_COLOR } from "@/theme/storefront"

const S = "settings.storefront"
const C = `${S}.swatches`
const LIMITS = STOREFRONT_LIMITS
// A new row starts on the theme's near-black, so its picker and its code agree from the start
const START_COLOR = STOREFRONT_THEME_COLOR

const schema = z.object({ swatches: colorSwatchesSchema })
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  swatches: saved.color_swatches.map(({ label, hex }) => ({ label, hex })),
})

// The circle, the name and the remove button on one line, the colour under
// the name; side by side once the row is wide enough (inside an `@container`)
const ROW_GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 @md:grid-cols-[auto_minmax(0,1fr)_auto_auto]"

interface SwatchRowProps {
  index: number
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  onRemove: () => void
}

/** One colour: its circle as the storefront draws it, its name, its picker and code, and remove. */
function SwatchRow({ index, control, register, errors, onRemove }: SwatchRowProps) {
  const { t } = useTranslation()
  const number = index + 1
  const id = `storefront-swatch-${index}`
  const hex = useWatch({ control, name: `swatches.${index}.hex` })
  const valid = isHexColor(hex)
  // A half-typed code shows the picker on the start colour until it is whole
  const picked = valid ? hex : START_COLOR
  const labelError = errorLine(t, errors.swatches?.[index]?.label, LIMITS.swatchLabelLength)
  const hexError = errorLine(t, errors.swatches?.[index]?.hex)
  return (
    <li className="@container">
      <div className={ROW_GRID}>
        <span aria-hidden className="col-start-1 row-start-1 flex h-9 items-center">
          <span
            className="size-6 rounded-full border"
            style={valid ? { backgroundColor: hex } : undefined}
          />
        </span>
        <RowCell
          error={labelError}
          errorId={`${id}-label-error`}
          className="col-start-2 row-start-1"
        >
          <Input
            aria-label={t(`${C}.labelOf`, { number })}
            aria-invalid={Boolean(labelError)}
            aria-describedby={labelError ? `${id}-label-error` : undefined}
            placeholder={t(`${C}.labelPlaceholder`)}
            autoComplete="off"
            {...register(`swatches.${index}.label`)}
          />
        </RowCell>
        <RowCell
          error={hexError}
          errorId={`${id}-hex-error`}
          className="col-span-2 col-start-2 row-start-2 @md:col-span-1 @md:col-start-3 @md:row-start-1"
        >
          <Controller
            control={control}
            name={`swatches.${index}.hex`}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={t(`${C}.pickerOf`, { number })}
                  value={picked}
                  onChange={(event) => {
                    field.onChange(event.target.value)
                  }}
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <Input
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value.trim().toLowerCase())
                  }}
                  onBlur={field.onBlur}
                  aria-label={t(`${C}.hexOf`, { number })}
                  aria-invalid={Boolean(hexError)}
                  aria-describedby={hexError ? `${id}-hex-error` : undefined}
                  placeholder={t(`${C}.hexPlaceholder`)}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-28 font-mono"
                />
              </div>
            )}
          />
        </RowCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="col-start-3 row-start-1 text-destructive-text @md:col-start-4"
          aria-label={t(`${S}.remove`, { item: t(`${C}.item`, { number }) })}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

/**
 * The shop's colour names (F18 D5): a product option or a filter value that
 * reads as one of them, in any case, shows on the storefront as a coloured
 * circle. One dictionary for the whole shop; the list is saved whole.
 */
export function SwatchesCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const swatches = useFieldArray({ control: form.control, name: "swatches" })
  const submit = form.handleSubmit((next) => {
    save({ color_swatches: next.swatches }, (stored) => {
      form.reset(valuesOf(stored), FULL_RESET)
    })
  })
  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {swatches.fields.length > 0 ? (
        <div className="@container">
          {/* Two columns on a wide card, so a long list does not stretch its names */}
          <ol className="grid gap-3 @5xl:grid-cols-2 @5xl:gap-x-6">
            {swatches.fields.map((swatch, index) => (
              <SwatchRow
                key={swatch.id}
                index={index}
                control={form.control}
                register={form.register}
                errors={form.formState.errors}
                onRemove={() => {
                  swatches.remove(index)
                }}
              />
            ))}
          </ol>
        </div>
      ) : null}
      <ListFooter
        label={t(`${C}.add`)}
        hint={t(`${C}.hint`, { max: LIMITS.colorSwatches, length: LIMITS.swatchLabelLength })}
        full={swatches.fields.length >= LIMITS.colorSwatches}
        onAdd={() => {
          swatches.append({ label: "", hex: START_COLOR })
        }}
      />
    </CardForm>
  )
}
