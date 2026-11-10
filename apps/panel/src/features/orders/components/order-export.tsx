import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { useCan } from "@/features/auth/api/staff"
import { filterQuery } from "@/features/orders/api/orders"
import type { OrderFilters } from "@/features/orders/api/orders"
import { finishedJob } from "@/features/products/api/sheets"
import type { SheetJob } from "@/features/products/api/sheets"
import { jobResultUrl } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const E = "orders.export"

/**
 * The order list as it is filtered, as a file (the owner's alone: every
 * customer's name, address and phone is in it). A job makes it on the
 * server, a row per order line; the panel waits for it and downloads it,
 * and Settings > Jobs keeps it a week.
 */
export function OrderExportButton({ filters }: { filters: OrderFilters }) {
  const { t } = useTranslation()
  const allowed = useCan("orderExport")
  const [running, setRunning] = useState(false)
  if (!allowed) {
    return null
  }
  const start = async (format: "xlsx" | "csv") => {
    setRunning(true)
    try {
      const { async_job: started } = await sdk.client.fetch<{ async_job: SheetJob }>(
        "/admin/order-board/export",
        { method: "POST", body: { ...filterQuery(filters), format } }
      )
      const job = await finishedJob(started.id)
      if (job.status === "succeeded") {
        window.location.assign(new URL(await jobResultUrl(job.id), window.location.origin).href)
      } else if (job.status === "queued" || job.status === "running") {
        toast.info(t(`${E}.later`))
      } else {
        toast.error(job.error_message ?? t(`${E}.failed`))
      }
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setRunning(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Download />}
          {t(`${E}.button`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            void start("xlsx")
          }}
        >
          {t(`${E}.excel`)}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void start("csv")
          }}
        >
          {t(`${E}.csv`)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
