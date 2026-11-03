import type { Open } from "@/features/orders/components/return-actions"
import { ApproveExchangeDialog } from "@/features/orders/detail/exchange-dialog"
import { ApproveGiftReturnDialog } from "@/features/orders/detail/gift-return-dialog"
import { RejectReturnDialog } from "@/features/orders/detail/reject-return-dialog"
import { ReceiveReturnDialog } from "@/features/orders/detail/return-dialogs"

/** The dialog a request's action opened, in the queue and on the order alike. */
export function ReturnDialogHost({ open, onClose }: { open: Open; onClose: () => void }) {
  if (!open) {
    return null
  }
  switch (open.kind) {
    case "reject":
      return <RejectReturnDialog request={open.request} onClose={onClose} />
    case "exchange":
      return <ApproveExchangeDialog request={open.request} onClose={onClose} />
    case "receive":
      return <ReceiveReturnDialog request={open.request} onClose={onClose} />
    case "gift":
      return <ApproveGiftReturnDialog request={open.request} onClose={onClose} />
  }
}
