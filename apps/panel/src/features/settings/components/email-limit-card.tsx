import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { NotificationSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const L = "settings.notifications.emailLimit"

const isLimit = (text: string) =>
  /^\d{1,6}$/.test(text) && Number(text) >= 100 && Number(text) <= 200_000

/**
 * Settings > Notifications: the most e-mails the shop sends a day (F10
 * M9). A guard on the sending reputation: orders with made-up addresses
 * bounce, and enough bounces stop a sender. Staff hear in the bell at
 * 80%; past it no e-mail goes until the next day.
 */
export function EmailLimitCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<NotificationSettings>("notifications"))
  const save = useSaveSection<NotificationSettings>("notifications")
  const stored = section.data?.values.email_daily_limit
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? (stored === undefined ? "" : String(stored))
  const valid = isLimit(text)
  return (
    <SectionCard title={t(`${L}.title`)} description={t(`${L}.description`)}>
      {section.data ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { email_daily_limit: Number(text) },
              {
                onSuccess: () => {
                  setDraft(null)
                  toast.success(t(`${L}.saved`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="email-daily-limit" className="text-sm font-medium">
              {t(`${L}.label`)}
            </label>
            <NumberField
              min={100}
              max={200_000}
              step={100}
              id="email-daily-limit"
              className="w-40"
              value={text}
              aria-invalid={!valid || undefined}
              onChange={(event) => {
                setDraft(event.target.value.trim())
              }}
            />
          </div>
          <Button type="submit" disabled={!valid || draft === null || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </form>
      ) : (
        <Skeleton className="h-16" />
      )}
    </SectionCard>
  )
}
