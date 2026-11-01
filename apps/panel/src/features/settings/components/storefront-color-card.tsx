import { zodResolver } from "@hookform/resolvers/zod"
import { RotateCcw } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import {
  colorSchema,
  errorLine,
  isHexColor,
  useSaveStorefront,
} from "@/features/settings/storefront"
import { FULL_RESET } from "@/lib/forms"
import { STOREFRONT_THEME_COLOR, storefrontTextOn } from "@/theme/storefront"

const S = "settings.storefront"
const C = `${S}.color`

const schema = z.object({ color: colorSchema })
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({ color: saved.primary_color ?? "" })

/** The announcement bar and a primary button as the storefront paints them in `color`. */
function ColorPreview({ color, announcement }: { color: string; announcement: string }) {
  const { t } = useTranslation()
  const paint = { backgroundColor: color, color: storefrontTextOn(color) }
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{t(`${C}.preview`)}</figcaption>
      <div className="flex flex-col overflow-hidden rounded-md border">
        <p style={paint} className="truncate px-4 py-2 text-center text-xs">
          {announcement}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
          <span
            style={paint}
            className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            {t(`${C}.button`)}
          </span>
          <span className="text-xs text-muted-foreground">{t(`${C}.previewHint`)}</span>
        </div>
      </div>
    </figure>
  )
}

/**
 * The storefront's main colour: its primary buttons and the announcement
 * bar, each with white or near-black text, whichever reads better. Empty:
 * the theme's own (near-black).
 */
export function ColorCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const typed = useWatch({ control: form.control, name: "color" }).trim().toLowerCase()
  // A half-typed code keeps the saved colour on show until it is whole
  const shown = isHexColor(typed)
    ? typed
    : typed === ""
      ? STOREFRONT_THEME_COLOR
      : (saved.primary_color ?? STOREFRONT_THEME_COLOR)
  const saveColor = (color: string | null) => {
    save({ primary_color: color }, (stored) => {
      form.reset(valuesOf(stored), FULL_RESET)
    })
  }
  const submit = form.handleSubmit((next) => {
    saveColor(next.color === "" ? null : next.color)
  })
  const error = errorLine(t, form.formState.errors.color)
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
      <div className="@container">
        <div className="grid gap-5 @2xl:grid-cols-2">
          <Field
            label={t(`${C}.label`)}
            htmlFor="storefront-color"
            hint={t(`${C}.hint`)}
            error={error}
          >
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    aria-label={t(`${C}.picker`)}
                    value={shown}
                    onChange={(event) => {
                      field.onChange(event.target.value)
                    }}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                  <Input
                    id="storefront-color"
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={(event) => {
                      field.onChange(event.target.value.trim().toLowerCase())
                    }}
                    onBlur={field.onBlur}
                    placeholder={t(`${C}.placeholder`)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    className="w-36 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saved.primary_color === null || saving}
                    onClick={() => {
                      saveColor(null)
                    }}
                  >
                    <RotateCcw />
                    {t(`${C}.reset`)}
                  </Button>
                </div>
              )}
            />
          </Field>
          <ColorPreview
            color={shown}
            announcement={saved.announcements[0] ?? t(`${S}.announcements.placeholder`)}
          />
        </div>
      </div>
    </CardForm>
  )
}
