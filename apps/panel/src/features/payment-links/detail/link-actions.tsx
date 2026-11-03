import { Link } from "@tanstack/react-router"
import { Ban, Clock, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useCancelPaymentLink } from "@/features/payment-links/api/payment-links"
import type { PaymentLink } from "@/features/payment-links/api/types"
import { shownStatus } from "@/features/payment-links/components/link-state"
import { errorText } from "@/lib/errors"
import { ExtendDialog } from "./extend-dialog"

const A = "paymentLinks.actions"

/**
 * What a link allows where it stands (adr/0051 §8, §12): an open one is
 * extended (owner and admin), an open or repriced one cancelled (owner and
 * admin, asked once more), and one that no longer opens is made again at
 * today's prices. One past its end counts as expired (`shownStatus`).
 */
export function LinkActions({ link, canManage }: { link: PaymentLink; canManage: boolean }) {
  const { t } = useTranslation()
  const cancel = useCancelPaymentLink(link.id)
  const [extending, setExtending] = useState(false)
  const [asking, setAsking] = useState(false)
  const status = shownStatus(link)
  const again = status === "draft" || status === "expired" || status === "canceled"
  return (
    <>
      {again ? (
        <Button asChild variant={status === "draft" ? "default" : "outline"}>
          <Link to="/payment-links/new" search={{ from: link.id }}>
            <RefreshCw />
            {t(`${A}.again`)}
          </Link>
        </Button>
      ) : null}
      {canManage && status === "open" ? (
        <Button
          variant="outline"
          onClick={() => {
            setExtending(true)
          }}
        >
          <Clock />
          {t(`${A}.extend`)}
        </Button>
      ) : null}
      {canManage && (status === "open" || status === "draft") ? (
        <Button
          variant="outline"
          disabled={cancel.isPending}
          onClick={() => {
            setAsking(true)
          }}
        >
          <Ban />
          {t(`${A}.cancel`)}
        </Button>
      ) : null}
      {extending ? (
        <ExtendDialog
          link={link}
          onClose={() => {
            setExtending(false)
          }}
        />
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${A}.confirmCancel.title`, { number: link.number })}
        description={t(`${A}.confirmCancel.description`)}
        confirmLabel={t(`${A}.cancel`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          cancel.mutate(undefined, {
            onSuccess: () => toast.success(t(`${A}.canceled`, { number: link.number })),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}
