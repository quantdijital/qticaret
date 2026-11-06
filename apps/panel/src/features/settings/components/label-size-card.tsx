import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { NumberField } from "@/components/patterns/number-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LABEL_FORMATS, useSaveSection } from "@/features/settings/api/sections"
import type { LabelFormat, ShippingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const L = "settings.shipping.labels"

const millimetres = (min: number, max: number) =>
  z.string().refine((text) => {
    const value = Number(text.trim())
    return /^\d{2,3}$/.test(text.trim()) && value >= min && value <= max
  }, `${L}.sizeInvalid`)

const schema = z.object({
  format: z.enum(LABEL_FORMATS),
  width: millimetres(70, 210),
  height: millimetres(70, 297),
  prices: z.boolean(),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: ShippingSettings): Values => ({
  format: saved.label_format,
  width: String(saved.label_custom.width_mm),
  height: String(saved.label_custom.height_mm),
  prices: saved.packing_slip_prices,
})

/** The page's size in mm and how many labels go on it, for the preview. */
function pageOf(format: LabelFormat, width: string, height: string) {
  switch (format) {
    case "a4":
      return { width: 210, height: 297, labels: 4 }
    case "custom":
      return { width: Number(width) || 100, height: Number(height) || 150, labels: 1 }
    case "100x150":
    case "100x100":
    case "80x80": {
      const [w, h] = format.split("x").map(Number)
      return { width: w ?? 100, height: h ?? 150, labels: 1 }
    }
  }
}

/**
 * Settings > Shipping: the page parcels' labels print on (F7.7). Yurtiçi's
 * label is drawn at this size; a carrier's own label is fitted to it. A4
 * takes four to a sheet, for an office printer.
 */
export function LabelSizeCard({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ShippingSettings>("shipping")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const [format, width, height] = useWatch({
    control: form.control,
    name: ["format", "width", "height"],
  })
  const { errors } = form.formState
  const page = pageOf(format, width, height)
  // The preview's longer side is 112 px, the label's shape kept
  const scale = 112 / Math.max(page.width, page.height)
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        label_format: next.format,
        label_custom: { width_mm: Number(next.width), height_mm: Number(next.height) },
        packing_slip_prices: next.prices,
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${L}.title`)}
      description={t(`${L}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex flex-col gap-5">
          <Field label={t(`${L}.format`)} htmlFor="label-format" hint={t(`${L}.formatHint`)}>
            <Controller
              control={form.control}
              name="format"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="label-format" className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_FORMATS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`${L}.formats.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {format === "custom" ? (
            <Field
              label={t(`${L}.custom`)}
              htmlFor="label-width"
              hint={t(`${L}.customHint`)}
              error={
                (errors.width?.message ?? errors.height?.message)
                  ? t(errors.width?.message ?? errors.height?.message ?? "")
                  : undefined
              }
            >
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <NumberField
                  min={70}
                  max={210}
                  id="label-width"
                  aria-label={t(`${L}.width`)}
                  className="w-36"
                  {...form.register("width")}
                />
                ×
                <NumberField
                  min={70}
                  max={297}
                  aria-label={t(`${L}.height`)}
                  className="w-36"
                  {...form.register("height")}
                />
                mm
              </span>
            </Field>
          ) : null}
          <p className="text-[13px] text-muted-foreground">{t(`${L}.printerHint`)}</p>
          {/* Packing slips print on A4 from the order list and the order page */}
          <div className="flex items-start justify-between gap-4 border-t pt-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor="packing-slip-prices" className="text-sm font-medium">
                {t(`${L}.slipPrices`)}
              </label>
              <span id="packing-slip-prices-hint" className="text-[13px] text-muted-foreground">
                {t(`${L}.slipPricesHint`)}
              </span>
            </div>
            <Controller
              control={form.control}
              name="prices"
              render={({ field }) => (
                <Switch
                  id="packing-slip-prices"
                  aria-describedby="packing-slip-prices-hint"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
        <figure className="flex flex-col items-center gap-2 rounded-md bg-muted/50 px-6 py-4">
          <div className="flex size-28 items-center justify-center" aria-hidden="true">
            <div
              className="grid gap-px border border-foreground/40 bg-background p-0.5"
              style={{
                width: `${String(page.width * scale)}px`,
                height: `${String(page.height * scale)}px`,
                gridTemplateColumns: page.labels === 4 ? "1fr 1fr" : "1fr",
              }}
            >
              {Array.from({ length: page.labels }, (_, index) => (
                <span key={index} className="rounded-sm bg-muted" />
              ))}
            </div>
          </div>
          <figcaption className="text-center text-xs text-muted-foreground">
            {t(`${L}.preview`, {
              width: page.width,
              height: page.height,
              count: page.labels,
            })}
          </figcaption>
        </figure>
      </div>
    </CardForm>
  )
}
