import { Download, Loader2 } from "lucide-react"
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
import { finishedJob } from "@/features/products/api/sheets"
import type { SheetJob } from "@/features/products/api/sheets"
import { jobResultUrl } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { useJobsMessage } from "@/features/settings/use-jobs-message"

const A = "settings.accounting.package"
// The months offered: this one and the twelve before it
const MONTHS = 13

/** `YYYY-MM` and its name ("Ekim 2026"), newest first, as Turkey counts months. */
function recentMonths(now: Date = new Date()) {
  const turkey = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const name = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
  return Array.from({ length: MONTHS }, (_, back) => {
    const first = new Date(Date.UTC(turkey.getUTCFullYear(), turkey.getUTCMonth() - back, 1))
    return { value: first.toISOString().slice(0, 7), label: name.format(first) }
  })
}

/**
 * The month's package for the accountant (F11.5, adr/0039 §5): sales by
 * VAT rate, refunds, collections, the VAT summary and gift cards sold and
 * spent (adr/0025 Ek 2026-11-03), as one zip (an Excel file and the same
 * tables as CSV), made on the server.
 */
export function AccountingPackageCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const months = recentMonths()
  const [month, setMonth] = useState(months[1]?.value ?? months[0]?.value ?? "")
  const [running, setRunning] = useState(false)
  const start = async () => {
    setRunning(true)
    try {
      const { async_job: started } = await sdk.client.fetch<{ async_job: SheetJob }>(
        "/admin/async-jobs",
        { method: "POST", body: { type: "accounting.package", input: { month } } }
      )
      const job = await finishedJob(started.id)
      if (job.status === "succeeded") {
        window.location.assign(new URL(await jobResultUrl(job.id), window.location.origin).href)
      } else if (job.status === "queued" || job.status === "running") {
        toast.info(t(jobs(`${A}.later`)))
      } else {
        toast.error(job.error_message ?? t(`${A}.failed`))
      }
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setRunning(false)
    }
  }
  return (
    <SectionCard
      title={t(`${A}.title`)}
      description={t(`${A}.hint`)}
      {...(className ? { className } : {})}
    >
      <div className="flex h-full flex-col gap-3">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
          {(["sales", "returns", "collections", "vat", "giftCards"] as const).map((key) => (
            <li key={key}>{t(`${A}.contents.${key}`)}</li>
          ))}
        </ul>
        <p className="text-[13px] text-muted-foreground">{t(`${A}.privacy`)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48" aria-label={t(`${A}.month`)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={running || !month}
            onClick={() => {
              void start()
            }}
          >
            {running ? <Loader2 className="animate-spin" /> : <Download />}
            {t(`${A}.download`)}
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}
