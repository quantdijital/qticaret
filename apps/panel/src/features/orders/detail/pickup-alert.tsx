import { Download, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useLabelLink } from "@/features/orders/api/shipping"
import { errorText } from "@/lib/errors"

const P = "orders.detail.pickup"

/**
 * Parcels packed with a carrier's label (F7, adr/0031): the label to print
 * and stick on, and the order moving to shipped by itself once the carrier
 * picks the parcel up.
 */
export function PickupAlert({ orderId, parcels }: { orderId: string; parcels: string[] }) {
  const { t } = useTranslation()
  const label = useLabelLink(orderId)
  const open = (fulfillmentId: string) => {
    // Opened before the request so the browser does not take it for a pop-up
    const tab = window.open("", "_blank")
    label.mutate(fulfillmentId, {
      onSuccess: (url) => {
        if (tab) {
          tab.opener = null
          tab.location.href = url
        } else {
          window.location.assign(url)
        }
      },
      onError: (failure) => {
        tab?.close()
        toast.error(errorText(t, failure))
      },
    })
  }
  return (
    <Alert>
      <Truck aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{t(`${P}.waiting`, { count: parcels.length })}</span>
        <span className="flex flex-wrap gap-2">
          {parcels.map((id, index) => (
            <Button
              key={id}
              size="sm"
              variant="outline"
              disabled={label.isPending}
              onClick={() => {
                open(id)
              }}
            >
              <Download aria-hidden="true" />
              {parcels.length > 1 ? t(`${P}.labelOf`, { number: index + 1 }) : t(`${P}.label`)}
            </Button>
          ))}
        </span>
      </AlertDescription>
    </Alert>
  )
}
