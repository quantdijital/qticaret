import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { DnsRecordState, SenderDns } from "@/features/settings/api/messaging"

const D = "settings.notifications.domain.dns"

const TONE: Record<DnsRecordState, StatusTone> = {
  found: "success",
  missing: "warning",
  unknown: "neutral",
}

const RECORDS = ["spf", "dkim", "dmarc"] as const

/**
 * The sender domain's SPF, DKIM and DMARC with the shop's own mail server
 * (adr/0036 Ek 2026-11-10): a warning only. Sending never waits on them;
 * a missing record only makes spam folders likelier.
 */
export function SenderDnsList({ dns }: { dns: SenderDns }) {
  const { t } = useTranslation()
  const missing = RECORDS.some((record) => dns[record] === "missing")
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-md border">
        {RECORDS.map((record) => (
          <li key={record} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <span className="w-16 text-sm font-medium">{t(`${D}.names.${record}`)}</span>
            <StatusBadge tone={TONE[dns[record]]}>{t(`${D}.states.${dns[record]}`)}</StatusBadge>
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">
              {record === "dkim" && dns.dkim_selector
                ? t(`${D}.selector`, { selector: dns.dkim_selector })
                : t(`${D}.hints.${record}`)}
            </span>
          </li>
        ))}
      </ul>
      {missing ? (
        <Alert>
          <AlertDescription>{t(`${D}.warning`, { domain: dns.domain })}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
