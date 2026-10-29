import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { bulkLabels } from "@/features/orders/api/shipping"
import { errorText } from "@/lib/errors"

/**
 * Opens parcels' labels as one PDF in a new tab, on the shop's label size
 * (Settings > Shipping), one label or many alike (F7.7). The tab opens at
 * the click, so the browser lets it, and is filled once the file arrives;
 * labels that could not be read are said in a toast.
 */
export function usePrintLabels() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const print = (fulfillmentIds: readonly string[]) => {
    const tab = window.open("", "_blank")
    setBusy(true)
    bulkLabels(fulfillmentIds)
      .then(({ url, missing }) => {
        if (tab) {
          tab.opener = null
          tab.location.href = url
        } else {
          window.location.assign(url)
        }
        // The tab keeps its own copy once loaded
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 60_000)
        if (missing > 0) {
          toast.warning(t("orders.bulkShip.labelsMissing", { count: missing }))
        }
      })
      .catch((failure: unknown) => {
        tab?.close()
        toast.error(errorText(t, failure))
      })
      .finally(() => {
        setBusy(false)
      })
  }
  return { print, busy }
}
