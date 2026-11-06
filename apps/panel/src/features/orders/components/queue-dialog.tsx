import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * A queue row opened (returns, invoices, chargebacks, held orders): one
 * standard dialog with the item's details and its own actions, and the way
 * to its order (docs/06: a row click opens one standard window).
 */
export function QueueDialog({
  open,
  onClose,
  title,
  description,
  orderId,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  /** The order the item belongs to; null when it has none. */
  orderId: string | null
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          {orderId ? (
            <Button asChild>
              <Link to="/orders/$id" params={{ id: orderId }}>
                {t("orders.queueDialog.openOrder")}
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A label and its value in a queue dialog's list of facts. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}
