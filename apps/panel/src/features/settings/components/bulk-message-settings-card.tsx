import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { MarketingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const C = "settings.marketing.bulk"

type BulkSettings = Pick<
  MarketingSettings,
  "campaign_frequency_cap" | "campaign_sms_start_hour" | "campaign_sms_end_hour"
>

const STARTS = Array.from({ length: 24 }, (_, hour) => hour)
const ENDS = Array.from({ length: 24 }, (_, hour) => hour + 1)
const hourText = (hour: number) => `${String(hour).padStart(2, "0")}:00`

/** A text window the backend takes: it ends after it starts (`platform_settings.hours_invalid`). */
const hoursValid = (start: number, end: number): boolean => end > start

/**
 * Settings > Marketing > Toplu ileti (adr/0050 §3, §6): one bulk message a
 * person in 24 hours at most, and the hours bulk texts go in, Türkiye
 * time; a text campaign outside them waits and goes on by itself.
 */
export function BulkMessageSettingsCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<MarketingSettings>("marketing"))
  const save = useSaveSection<MarketingSettings>("marketing")
  const [draft, setDraft] = useState<Partial<BulkSettings>>({})
  const stored = section.data?.values
  const values = stored ? { ...stored, ...draft } : null
  const valid = values
    ? hoursValid(values.campaign_sms_start_hour, values.campaign_sms_end_hour)
    : true
  const set = (change: Partial<BulkSettings>) => {
    setDraft((current) => ({ ...current, ...change }))
  }
  const hourSelect = (
    key: "campaign_sms_start_hour" | "campaign_sms_end_hour",
    hours: number[],
    value: number
  ) => (
    <div className="flex flex-col gap-2">
      <span id={`bulk-${key}`} className="text-sm font-medium">
        {t(`${C}.${key === "campaign_sms_start_hour" ? "start" : "end"}`)}
      </span>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          const hour = Number(next)
          set(
            key === "campaign_sms_start_hour"
              ? { campaign_sms_start_hour: hour }
              : { campaign_sms_end_hour: hour }
          )
        }}
      >
        <SelectTrigger
          className="w-full"
          aria-labelledby={`bulk-${key}`}
          aria-invalid={!valid || undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map((hour) => (
            <SelectItem key={hour} value={String(hour)}>
              {hourText(hour)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {!values ? (
        <Skeleton className="h-40" />
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(draft, {
              onSuccess: () => {
                setDraft({})
                toast.success(t(`${C}.saved`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor="bulk-frequency-cap" className="text-sm font-medium">
                {t(`${C}.cap`)}
              </label>
              <span id="bulk-frequency-cap-hint" className="text-[13px] text-muted-foreground">
                {t(`${C}.capHint`)}
              </span>
            </div>
            <Switch
              id="bulk-frequency-cap"
              aria-describedby="bulk-frequency-cap-hint"
              checked={values.campaign_frequency_cap}
              onCheckedChange={(checked) => {
                set({ campaign_frequency_cap: checked })
              }}
            />
          </div>
          <fieldset className="flex flex-col gap-2 border-t pt-4">
            <legend className="sr-only">{t(`${C}.hours`)}</legend>
            <span className="text-sm font-medium">{t(`${C}.hours`)}</span>
            <span className="text-[13px] text-muted-foreground">{t(`${C}.hoursHint`)}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {hourSelect("campaign_sms_start_hour", STARTS, values.campaign_sms_start_hour)}
              {hourSelect("campaign_sms_end_hour", ENDS, values.campaign_sms_end_hour)}
            </div>
            {valid ? null : (
              <p role="alert" className="text-xs text-destructive-text">
                {t(`${C}.hoursInvalid`)}
              </p>
            )}
          </fieldset>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={Object.keys(draft).length === 0 || !valid || save.isPending}
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}
