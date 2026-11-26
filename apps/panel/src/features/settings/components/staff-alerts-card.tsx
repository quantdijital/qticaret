import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { NotificationSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const A = "settings.notifications.alerts"
const ALERTS = [
  "alert_new_order",
  "alert_bank_transfer",
  "alert_low_stock",
  "alert_seo_digest",
  "alert_contact_message",
] as const
type Alert = (typeof ALERTS)[number]

/** The addresses as typed: one per comma or line, blanks dropped. */
const emailsOf = (text: string): string[] =>
  text
    .split(/[\s,;]+/)
    .map((each) => each.trim())
    .filter(Boolean)

/**
 * Settings > Notifications: which of the shop's alerts its staff get by
 * e-mail, and at which addresses (F9.7). The panel's bell shows them all
 * anyway; an e-mail reaches someone away from it.
 */
export function StaffAlertsCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<NotificationSettings>("notifications"))
  const save = useSaveSection<NotificationSettings>("notifications")
  const stored = section.data?.values
  const [emails, setEmails] = useState<string | null>(null)
  const [switches, setSwitches] = useState<Partial<Record<Alert, boolean>>>({})
  const text = emails ?? stored?.staff_emails.join("\n") ?? ""
  const dirty = emails !== null || Object.keys(switches).length > 0
  return (
    <SectionCard title={t(`${A}.title`)} description={t(`${A}.description`)}>
      {!stored ? (
        <Skeleton className="h-32" />
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { staff_emails: emailsOf(text), ...switches },
              {
                onSuccess: () => {
                  setEmails(null)
                  setSwitches({})
                  toast.success(t(`${A}.saved`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="staff-emails" className="text-sm font-medium">
              {t(`${A}.emails`)}
            </label>
            <Textarea
              placeholder={t("settings.placeholders.staffEmails")}
              id="staff-emails"
              rows={3}
              aria-describedby="staff-emails-hint"
              value={text}
              onChange={(event) => {
                setEmails(event.target.value)
              }}
            />
            <span id="staff-emails-hint" className="text-[13px] text-muted-foreground">
              {t(`${A}.emailsHint`)}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {ALERTS.map((alert) => (
              <li key={alert} className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <label htmlFor={`staff-${alert}`} className="text-sm font-medium">
                    {t(`${A}.items.${alert}.title`)}
                  </label>
                  <span id={`staff-${alert}-hint`} className="text-[13px] text-muted-foreground">
                    {t(`${A}.items.${alert}.hint`)}
                  </span>
                </div>
                <Switch
                  id={`staff-${alert}`}
                  aria-describedby={`staff-${alert}-hint`}
                  checked={switches[alert] ?? stored[alert]}
                  onCheckedChange={(checked) => {
                    setSwitches((current) => ({ ...current, [alert]: checked }))
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}
