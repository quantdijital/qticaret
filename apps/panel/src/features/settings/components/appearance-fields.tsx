import { THEME_PRESETS } from "@qticaret/types"
import { Controller } from "react-hook-form"
import type { Control, UseFormSetValue } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AppearanceForm as FormValues } from "@/theme"

type ChoiceName = "radius" | "density" | "mode" | "sidebar"

/**
 * One of the look's choices: its name and what it changes, then the options
 * side by side as one segmented control (every option one height).
 */
export function ChoiceField<K extends ChoiceName>({
  name,
  control,
  options,
  optionLabel,
}: {
  name: K
  control: Control<FormValues>
  options: readonly FormValues[K][]
  optionLabel: (option: FormValues[K]) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span id={`${name}-label`} className="text-sm font-medium">
          {t(`settings.appearance.${name}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t(`settings.appearance.${name}Hint`)}
        </span>
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={`${name}-label`}
            value={field.value}
            onValueChange={(next) => {
              if (next) {
                field.onChange(next)
              }
            }}
            className="w-full"
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="flex-1 px-3 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
              >
                {optionLabel(option)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      />
    </div>
  )
}

/** The brand colour: a picker, its hex value, and the ready-made colours. */
export function BrandColorField({
  control,
  setValue,
  color,
  colorValid,
  adjusted,
}: {
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  color: string
  colorValid: boolean
  adjusted: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={control}
        name="brand_color"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-color">{t("settings.appearance.brandColor")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t("settings.appearance.brandColor")}
                value={colorValid ? field.value : "#000000"}
                onChange={(event) => {
                  field.onChange(event.target.value)
                }}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <Input
                id="brand-color"
                value={field.value}
                onChange={(event) => {
                  field.onChange(event.target.value.trim().toLowerCase())
                }}
                onBlur={field.onBlur}
                spellCheck={false}
                className="w-32 font-mono"
                aria-invalid={fieldState.error ? true : undefined}
              />
            </div>
            {fieldState.error?.message ? (
              <p className="text-xs text-destructive">{t(fieldState.error.message)}</p>
            ) : null}
          </div>
        )}
      />
      {adjusted ? (
        <p className="rounded-md bg-warning/15 px-3 py-2 text-xs text-warning-foreground/90">
          {t("settings.appearance.adjusted")}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">{t("settings.appearance.presets")}</span>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={t(`settings.appearance.preset.${preset.key}`)}
              aria-label={t(`settings.appearance.preset.${preset.key}`)}
              aria-pressed={color === preset.brand_color}
              onClick={() => {
                setValue("brand_color", preset.brand_color, { shouldDirty: true })
              }}
              className="size-8 rounded-full border-2 border-transparent ring-offset-2 ring-offset-card aria-pressed:border-foreground"
              style={{ backgroundColor: preset.brand_color }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
