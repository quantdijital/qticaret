import { zodResolver } from "@hookform/resolvers/zod"
import { THEME_DENSITIES, THEME_MODES, THEME_PRESETS, THEME_RADII } from "@qticaret/types"
import type { AppearanceSettings } from "@qticaret/types"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSaveAppearance } from "@/features/settings/api/appearance"
import { ThemePreview } from "@/features/settings/components/theme-preview"
import { errorText } from "@/lib/errors"
import {
  applyAppearance,
  appearanceSchema,
  rememberAppearance,
  resolveMode,
  resolveTheme,
} from "@/theme"
import type { AppearanceForm as FormValues } from "@/theme"

const HEX = /^#[0-9a-f]{6}$/

/**
 * The shop's five choices (docs/18 §5). Every change repaints this screen
 * at once; leaving without saving paints the stored values back.
 */
export function AppearanceForm({ saved }: { saved: AppearanceSettings }) {
  const { t } = useTranslation()
  const save = useSaveAppearance()
  const form = useForm<FormValues>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      brand_color: saved.brand_color,
      radius: saved.radius,
      density: saved.density,
      mode: saved.mode,
    },
  })
  // `useWatch`, not `form.watch()`: the React Compiler can follow it. It
  // types every field as possibly missing; the stored value stands in
  const watched = useWatch({ control: form.control })
  const values = useMemo<FormValues>(
    () => ({
      brand_color: watched.brand_color ?? saved.brand_color,
      radius: watched.radius ?? saved.radius,
      density: watched.density ?? saved.density,
      mode: watched.mode ?? saved.mode,
    }),
    [watched.brand_color, watched.radius, watched.density, watched.mode, saved]
  )
  const { isDirty } = form.formState
  const colorValid = HEX.test(values.brand_color)
  const brandAdjusted = useMemo(
    () => (colorValid ? resolveTheme({ ...saved, ...values }, "light").brandAdjusted : false),
    [colorValid, saved, values]
  )

  // Preview: the document follows the form; the stored look returns on unmount
  useEffect(() => {
    if (colorValid) {
      applyAppearance({ ...saved, ...values })
    }
  }, [colorValid, saved, values])
  useEffect(
    () => () => {
      applyAppearance(saved)
    },
    [saved]
  )

  const submit = form.handleSubmit((submitted) => {
    save.mutate(submitted, {
      onSuccess: (result) => {
        rememberAppearance(result.values)
        toast.success(t("settings.appearance.saved"))
      },
      onError: (failure) => {
        toast.error(errorText(t, failure))
      },
    })
  })

  return (
    <form
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <Label htmlFor="brand-color">{t("settings.appearance.brandColor")}</Label>
          <Controller
            control={form.control}
            name="brand_color"
            render={({ field, fieldState }) => (
              <>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={t("settings.appearance.brandColor")}
                    value={colorValid ? field.value : "#000000"}
                    onChange={(event) => {
                      field.onChange(event.target.value)
                    }}
                    className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5"
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
                <p className="text-xs text-muted-foreground">
                  {fieldState.error?.message
                    ? t(fieldState.error.message)
                    : t("settings.appearance.brandColorHint")}
                </p>
              </>
            )}
          />
          {brandAdjusted ? (
            <p className="text-xs text-warning-foreground/90 rounded-md bg-warning/15 px-3 py-2">
              {t("settings.appearance.adjusted")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              {t("settings.appearance.presets")}
            </span>
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  title={t(`settings.appearance.preset.${preset.key}`)}
                  aria-label={t(`settings.appearance.preset.${preset.key}`)}
                  aria-pressed={values.brand_color === preset.brand_color}
                  onClick={() => {
                    form.setValue("brand_color", preset.brand_color, { shouldDirty: true })
                  }}
                  className="size-8 rounded-full border-2 border-transparent aria-pressed:border-foreground"
                  style={{ backgroundColor: preset.brand_color }}
                />
              ))}
            </div>
          </div>
        </section>

        <Choice
          name="radius"
          label={t("settings.appearance.radius")}
          options={THEME_RADII}
          optionLabel={(option) => t(`settings.appearance.radiusOptions.${option}`)}
          form={form}
        />
        <Choice
          name="density"
          label={t("settings.appearance.density")}
          options={THEME_DENSITIES}
          optionLabel={(option) => t(`settings.appearance.densityOptions.${option}`)}
          form={form}
        />
        <Choice
          name="mode"
          label={t("settings.appearance.mode")}
          options={THEME_MODES}
          optionLabel={(option) => t(`settings.appearance.modeOptions.${option}`)}
          form={form}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={!isDirty || !colorValid || save.isPending}>
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || save.isPending}
            onClick={() => {
              form.reset()
            }}
          >
            {t("common.reset")}
          </Button>
        </div>
      </div>

      <ThemePreview mode={resolveMode(values.mode)} />
    </form>
  )
}

interface ChoiceProps<K extends "radius" | "density" | "mode"> {
  name: K
  label: string
  options: readonly FormValues[K][]
  optionLabel: (option: FormValues[K]) => string
  form: ReturnType<typeof useForm<FormValues>>
}

function Choice<K extends "radius" | "density" | "mode">({
  name,
  label,
  options,
  optionLabel,
  form,
}: ChoiceProps<K>) {
  return (
    <section className="flex flex-col gap-3">
      <Label id={`${name}-label`}>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <RadioGroup
            aria-labelledby={`${name}-label`}
            value={field.value}
            onValueChange={field.onChange}
            className="flex flex-wrap gap-2"
          >
            {options.map((option) => (
              <Label
                key={option}
                htmlFor={`${name}-${option}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
              >
                <RadioGroupItem id={`${name}-${option}`} value={option} />
                {optionLabel(option)}
              </Label>
            ))}
          </RadioGroup>
        )}
      />
    </section>
  )
}
