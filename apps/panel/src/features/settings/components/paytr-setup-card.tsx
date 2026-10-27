import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { isPublicOrigin, paytrNotificationUrl } from "@/features/settings/payments"

/**
 * What the shop does in PayTR's own panel (dev.paytr.com, 2026-10-27):
 * where the details are, the notification address to paste, going live.
 * The address is copied, not typed: a typo would lose every payment result.
 */
export function PaytrSetupCard() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = paytrNotificationUrl(window.location.origin)
  const p = "settings.payments.setup"
  return (
    <SectionCard title={t(`${p}.title`)} description={t(`${p}.description`)}>
      <ol className="grid gap-6 text-sm lg:grid-cols-3">
        <li className="flex flex-col gap-1">
          <span className="font-medium">{t(`${p}.findTitle`)}</span>
          <span className="text-muted-foreground">{t(`${p}.find`)}</span>
        </li>
        <li className="flex flex-col gap-2">
          <span className="font-medium">{t(`${p}.notifyTitle`)}</span>
          <span className="text-muted-foreground">{t(`${p}.notify`)}</span>
          {/* Shown whole, not cut: the shop checks what it pastes into PayTR */}
          <div className="flex items-start gap-2">
            <code
              id="paytr-notification-url"
              className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-[13px] break-all"
            >
              {url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t(`${p}.copy`)}
              aria-describedby="paytr-notification-url"
              onClick={() => {
                // Refused without the page's clipboard permission: the address stays selectable
                navigator.clipboard.writeText(url).then(
                  () => {
                    setCopied(true)
                    toast.success(t(`${p}.copied`))
                  },
                  () => toast.error(t(`${p}.copyFailed`))
                )
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          {isPublicOrigin(window.location.origin) ? null : (
            <span className="text-[13px] text-warning-text">{t(`${p}.notPublic`)}</span>
          )}
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-medium">{t(`${p}.liveTitle`)}</span>
          <span className="text-muted-foreground">{t(`${p}.live`)}</span>
        </li>
      </ol>
    </SectionCard>
  )
}
