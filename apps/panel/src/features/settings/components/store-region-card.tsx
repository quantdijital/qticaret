import { Clock, Ruler } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { useSaveSection } from "@/features/settings/api/sections"
import type { StoreSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { cn } from "@qticaret/admin-ui/lib/utils"

// The zones a Turkish shop meets first; the browser knows the rest
const PREFERRED_ZONES = [
  "Europe/Istanbul",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Baku",
  "Europe/Nicosia",
]

function zones(): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  return [...PREFERRED_ZONES, ...all.filter((zone) => !PREFERRED_ZONES.includes(zone))]
}

type UnitValues = Pick<StoreSettings, "timezone" | "weight_unit" | "dimension_unit">

const unitsOf = (saved: StoreSettings): UnitValues => ({
  timezone: saved.timezone,
  weight_unit: saved.weight_unit,
  dimension_unit: saved.dimension_unit,
})

function UnitChoice<K extends "weight_unit" | "dimension_unit">({
  name,
  options,
  control,
}: {
  name: K
  options: readonly UnitValues[K][]
  control: ReturnType<typeof useForm<UnitValues>>["control"]
}) {
  const { t } = useTranslation()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <RadioGroup
          value={field.value}
          onValueChange={field.onChange}
          // The two choices one width and one height, side by side once the card has room for both
          className="grid gap-2 @[22rem]:grid-cols-2"
        >
          {options.map((option) => (
            <label
              key={option}
              className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={option} />
              {t(`settings.store.units.${option}`)}
            </label>
          ))}
        </RadioGroup>
      )}
    />
  )
}

// The clock moves on while the page is open; a minute is all it shows
const CLOCK_TICK_MS = 30_000

/** The time now in a zone, as the shop reads it; nothing for a zone the browser does not know. */
function clockIn(zone: string, locale: string, now: Date): string | null {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: zone,
    }).format(now)
  } catch {
    return null
  }
}

/**
 * The card's foot: the shop's clock in the zone chosen (before it is
 * saved, so a choice shows what it means) and what the units change. The
 * units are only the product forms' (`useStoreUnits`); the section stores
 * the choice and no saved value is converted.
 */
function RegionFacts({ zone }: { zone: string }) {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, CLOCK_TICK_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [])
  const time = clockIn(zone, i18n.language, now)
  return (
    <div className="mt-auto flex flex-col gap-2 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
      {time ? (
        <p className="flex items-start gap-2">
          <Clock className="h-lh w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("settings.store.clock", { time })}</span>
        </p>
      ) : null}
      <p className="flex items-start gap-2">
        <Ruler className="h-lh w-3.5 shrink-0" aria-hidden="true" />
        <span>{t("settings.store.unitsHint")}</span>
      </p>
    </div>
  )
}

/**
 * The shop's time zone and the units its product forms open in: short
 * facts, in the store profile's right column beside the brand and as tall
 * as it. Its fields on top; its facts at its foot, so the card is filled
 * at any height the row gives it (a save bar on either card included).
 */
export function RegionCard({ saved, className }: { saved: StoreSettings; className?: string }) {
  const { t } = useTranslation()
  const save = useSaveSection<StoreSettings>("store")
  const zoneList = useMemo(() => zones(), [])
  const values = unitsOf(saved)
  const form = useForm<UnitValues>({ values, resetOptions: { keepDirtyValues: true } })
  const zone = useWatch({ control: form.control, name: "timezone" })

  const submit = form.handleSubmit((next) => {
    save.mutate(next, {
      onSuccess: (result) => {
        form.reset(unitsOf(result.values), FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <CardForm
      title={t("settings.store.region")}
      description={t("settings.store.regionHint")}
      className={cn("@container", className)}
      fill
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <Field label={t("settings.store.timezone")} htmlFor="store-timezone">
        <Controller
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="store-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {zoneList.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label={t("settings.store.weightUnit")}>
        <UnitChoice name="weight_unit" options={["g", "kg"] as const} control={form.control} />
      </Field>
      <Field label={t("settings.store.dimensionUnit")}>
        <UnitChoice name="dimension_unit" options={["cm", "mm"] as const} control={form.control} />
      </Field>
      <RegionFacts zone={zone} />
    </CardForm>
  )
}
