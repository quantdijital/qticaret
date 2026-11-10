import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useConfirmBankTransfer } from "@/features/orders/api/payments"
import type { BankTransferState } from "@/features/orders/api/payments"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const B = "orders.detail.bankTransfer"

/**
 * A bank transfer order awaiting the money (F6 W2, adr/0029): until when,
 * and the shop's confirmation once the transfer shows in its bank. Unpaid
 * by the deadline, the order is cancelled on its own.
 */
export function BankTransferAlert({
  orderId,
  displayId,
  state,
}: {
  orderId: string
  displayId: number
  state: BankTransferState
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const confirm = useConfirmBankTransfer(orderId)
  return (
    <Alert>
      <AlertDescription>
        {state.deadline
          ? t(`${B}.awaitingUntil`, { number: displayId, date: formatDateTime(state.deadline) })
          : t(`${B}.awaiting`, { number: displayId })}
      </AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          disabled={confirm.isPending}
          onClick={() => {
            setAsking(true)
          }}
        >
          {t(`${B}.confirm`)}
        </Button>
      </AlertAction>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${B}.confirmTitle`, { number: displayId })}
        description={t(`${B}.confirmDescription`)}
        confirmLabel={t(`${B}.confirm`)}
        onConfirm={() => {
          confirm.mutate(undefined, {
            onSuccess: () => toast.success(t(`${B}.confirmed`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </Alert>
  )
}
