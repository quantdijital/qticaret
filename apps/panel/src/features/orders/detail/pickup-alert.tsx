import { Download, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { usePrintLabels } from "@/features/orders/components/print-labels"

const P = "orders.detail.pickup"

/**
 * Parcels packed with a carrier's label (F7, adr/0031): the label to print
 * (on the shop's label size) and stick on, and the order moving to shipped
 * by itself once the carrier picks the parcel up.
 */
export function PickupAlert({ parcels }: { parcels: string[] }) {
  const { t } = useTranslation()
  const labels = usePrintLabels()
  return (
    <Alert>
      <Truck aria-hidden="true" />
      <AlertDescription>{t(`${P}.waiting`, { count: parcels.length })}</AlertDescription>
      <AlertAction>
        {parcels.map((id, index) => (
          <Button
            key={id}
            size="sm"
            variant="outline"
            disabled={labels.busy}
            onClick={() => {
              labels.print([id])
            }}
          >
            <Download aria-hidden="true" />
            {parcels.length > 1 ? t(`${P}.labelOf`, { number: index + 1 }) : t(`${P}.label`)}
          </Button>
        ))}
      </AlertAction>
    </Alert>
  )
}
