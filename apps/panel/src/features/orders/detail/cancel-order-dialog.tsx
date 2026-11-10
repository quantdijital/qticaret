import { useQueryClient } from "@tanstack/react-query"
import { Gift } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { cancelFailureText } from "@/features/orders/api/cancel"
import { useCancelOrder } from "@/features/orders/api/orders"
import type { OrderDetail } from "@/features/orders/api/orders"
import { orderGiftCards } from "@/features/orders/gift-lines"

const C = "orders.cancel"

/**
 * Asks before canceling the order. With gift card lines it says what
 * becomes of the cards (adr/0025 Ek 2026-11-03): untouched ones are voided
 * and their money refunded; once one was spent (or closed by staff) the
 * server refuses the cancel, said in words.
 */
export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Pick<OrderDetail, "id" | "display_id" | "items">
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const cancel = useCancelOrder(order.id)
  const client = useQueryClient()
  const gift = orderGiftCards(order.items)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${C}.title`, { number: order.display_id })}
      description={t(`${C}.description`)}
      confirmLabel={t("orders.actions.cancel")}
      destructive
      onConfirm={() => {
        cancel.mutate(undefined, {
          onSuccess: () => {
            // A cancel voids the order's untouched gift cards
            if (gift === "issued") {
              void client.invalidateQueries({ queryKey: ["gift-cards"] })
            }
            onOpenChange(false)
            toast.success(t(`${C}.done`))
          },
          onError: (failure) => {
            toast.error(cancelFailureText(t, failure))
          },
        })
      }}
    >
      {gift ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          <Gift className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${C}.gift.${gift}`)}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
