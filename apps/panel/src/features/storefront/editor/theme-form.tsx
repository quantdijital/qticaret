import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useSaveSection } from "@/features/settings/api/sections"
import { isHexColor } from "@/features/settings/storefront"
import { THEME_SECTION } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import {
  CONTRAST_ERROR,
  isContrastRefusal,
  themeBodyOf,
  themeSchema,
  themeValuesOf,
} from "@/features/storefront/theme-settings"
import type { ThemeParsed, ThemeValues } from "@/features/storefront/theme-settings"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { STOREFRONT_THEME_COLOR, primaryReadable } from "@/theme/storefront"
import { FieldGroup } from "./forms/fields"
import { ThemeChoices } from "./theme-choices"
import { BackgroundField, ColorInput, ThemeSample } from "./theme-fields"

const C = "storefront.editor.theme"

interface ThemeFormProps {
  saved: ThemeSettings
  /** The storefront section's old main colour, shown until one is saved here. */
  legacyPrimary: string | null
  /** The first announcement line, for the sample. */
  announcement: string
  /** Saved: live on the storefront, so the preview reloads. */
  onSaved: () => void
}

/**
 * The theme's settings (adr/0053 §B): colours, faces, corners, the product
 * card and the header, from the server's fixed lists. One save puts them
 * live at once; they are the shop's settings, not part of the draft.
 */
export function ThemeForm({ saved, legacyPrimary, announcement, onSaved }: ThemeFormProps) {
  const { t } = useTranslation()
  const save = useSaveSection<ThemeSettings>(THEME_SECTION)
  const values = themeValuesOf(saved, legacyPrimary)
  const form = useForm<ThemeValues, unknown, ThemeParsed>({
    resolver: zodResolver(themeSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { control } = form
  const colors = useWatch({ control, name: "colors" })
  const buttons = useWatch({ control, name: "buttons" })
  const dirty = form.formState.isDirty
  const submit = form.handleSubmit((next) => {
    save.mutate(themeBodyOf(next), {
      onSuccess: (stored) => {
        form.reset(themeValuesOf(stored.values, legacyPrimary), FULL_RESET)
        toast.success(t(`${C}.saved`))
        onSaved()
      },
      onError: (failure) => {
        if (isContrastRefusal(failure)) {
          form.setError("colors.primary", { message: CONTRAST_ERROR }, { shouldFocus: true })
        } else {
          toast.error(errorText(t, failure))
        }
      },
    })
  })
  // Shown as it is typed and as the page colour changes, not only on save
  const primary = colors.primary
  const unreadable = isHexColor(primary) && !primaryReadable(primary, colors.background)
  const primaryError = form.formState.errors.colors?.primary?.message
  const primaryText = unreadable ? CONTRAST_ERROR : primaryError
  const accentText = form.formState.errors.colors?.accent?.message
  const usesLegacy = saved.colors.primary === null && legacyPrimary !== null
  return (
    <form noValidate className="flex flex-col" onSubmit={(event) => void submit(event)}>
      <div className="@container flex flex-col gap-6 p-4">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t(`${C}.live`)}
        </p>
        <FieldGroup title={t(`${C}.colors`)}>
          <Controller
            control={control}
            name="colors.primary"
            render={({ field }) => (
              <ColorInput
                id="theme-primary"
                label={t(`${C}.primary`)}
                hint={t(usesLegacy ? `${C}.primaryMoved` : `${C}.primaryHint`)}
                value={field.value}
                onChange={field.onChange}
                fallback={STOREFRONT_THEME_COLOR}
                error={primaryText ? t(primaryText) : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="colors.accent"
            render={({ field }) => (
              <ColorInput
                id="theme-accent"
                label={t(`${C}.accent`)}
                hint={t(`${C}.accentHint`)}
                value={field.value}
                onChange={field.onChange}
                fallback={STOREFRONT_THEME_COLOR}
                error={accentText ? t(accentText) : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="colors.background"
            render={({ field }) => (
              <BackgroundField
                value={field.value}
                onChange={(next) => {
                  field.onChange(next)
                  // The main colour is judged against the page: its refusal may no longer hold
                  if (form.getFieldState("colors.primary").error) {
                    void form.trigger("colors.primary")
                  }
                }}
              />
            )}
          />
          <ThemeSample
            primary={isHexColor(primary) ? primary : STOREFRONT_THEME_COLOR}
            accent={isHexColor(colors.accent) ? colors.accent : null}
            background={colors.background}
            buttons={buttons}
            announcement={announcement}
          />
        </FieldGroup>
        <ThemeChoices control={control} />
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-card px-4 py-3">
        <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${C}.save`)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            form.reset(values, FULL_RESET)
          }}
        >
          {t("common.reset")}
        </Button>
      </div>
    </form>
  )
}
