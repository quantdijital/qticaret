import { zodResolver } from "@hookform/resolvers/zod"
import {
  SIDEBAR_MODES,
  THEME_DENSITIES,
  THEME_MODES,
  THEME_RADII,
  THEME_SIDEBARS,
} from "@qticaret/types"
import type { AppearanceSettings } from "@qticaret/types"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { spanOf } from "@/components/patterns/page-spans"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { useSaveAppearance } from "@/features/settings/api/appearance"
import { BrandColorField, ChoiceField } from "@/features/settings/components/appearance-fields"
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
 * The shop's choices (docs/18 §5): colours (brand, mode, the menu's ground)
 * and layout (how the menu behaves, corners, density) side by side, the
 * panel in miniature under them. Every change repaints this screen at
 * once; leaving without saving paints the stored values back.
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
      sidebar: saved.sidebar,
      sidebar_mode: saved.sidebar_mode,
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
      sidebar: watched.sidebar ?? saved.sidebar,
      sidebar_mode: watched.sidebar_mode ?? saved.sidebar_mode,
    }),
    [
      watched.brand_color,
      watched.radius,
      watched.density,
      watched.mode,
      watched.sidebar,
      watched.sidebar_mode,
      saved,
    ]
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
      className="flex flex-col gap-[var(--grid-gap)]"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <PageHeader
        title={t("settings.appearance.title")}
        description={t("settings.appearance.subtitle")}
        action={
          <>
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
            <Button type="submit" disabled={!isDirty || !colorValid || save.isPending}>
              {t("common.save")}
            </Button>
          </>
        }
      />
      <PageGrid>
        <SectionCard
          title={t("settings.appearance.colors")}
          description={t("settings.appearance.colorsHint")}
          className={spanOf(6)}
        >
          <div className="flex flex-col gap-6">
            <BrandColorField
              control={form.control}
              setValue={form.setValue}
              color={values.brand_color}
              colorValid={colorValid}
              adjusted={brandAdjusted}
            />
            <ChoiceField
              name="mode"
              control={form.control}
              options={THEME_MODES}
              optionLabel={(option) => t(`settings.appearance.modeOptions.${option}`)}
            />
            <ChoiceField
              name="sidebar"
              control={form.control}
              options={THEME_SIDEBARS}
              optionLabel={(option) => t(`settings.appearance.sidebarOptions.${option}`)}
            />
          </div>
        </SectionCard>
        <SectionCard
          title={t("settings.appearance.layout")}
          description={t("settings.appearance.layoutHint")}
          className={spanOf(6)}
        >
          <div className="flex flex-col gap-6">
            <ChoiceField
              name="sidebar_mode"
              control={form.control}
              options={SIDEBAR_MODES}
              optionLabel={(option) => t(`settings.appearance.sidebar_modeOptions.${option}`)}
            />
            <ChoiceField
              name="radius"
              control={form.control}
              options={THEME_RADII}
              optionLabel={(option) => t(`settings.appearance.radiusOptions.${option}`)}
            />
            <ChoiceField
              name="density"
              control={form.control}
              options={THEME_DENSITIES}
              optionLabel={(option) => t(`settings.appearance.densityOptions.${option}`)}
            />
          </div>
        </SectionCard>
        <SectionCard
          title={t("settings.appearance.preview")}
          description={t("settings.appearance.previewHint")}
          className={spanOf(12)}
        >
          <ThemePreview mode={resolveMode(values.mode)} />
        </SectionCard>
      </PageGrid>
    </form>
  )
}
