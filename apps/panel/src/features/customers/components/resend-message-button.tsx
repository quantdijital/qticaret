import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, RotateCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import { resendOrderMessage } from "@/features/customers/api/messages"
import type { MessageRow } from "@/features/customers/api/messages"
import { errorText } from "@/lib/errors"

const M = "customers.messages"

/**
 * "Mesajı yeniden gönder" on one of the order's messages (2026-11-06): its
 * template again, to the order's current address on its channel, after a
 * confirmation. What it came to is a toast and a new line in the history.
 */
export function ResendMessageButton({ orderId, row }: { orderId: string; row: MessageRow }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [asking, setAsking] = useState(false)
  const name = t(`settings.notifications.templates.names.${row.template}`, {
    defaultValue: row.template,
  })
  const resend = useMutation({
    mutationFn: () => resendOrderMessage(orderId, row.id),
    onSuccess: ({ outcome }) => {
      if (outcome === "sent") {
        toast.success(t(`${M}.resent`))
      } else {
        toast.warning(t(`${M}.reason.${outcome}`, { defaultValue: t(`${M}.resendNotSent`) }))
      }
    },
    onError: (failure) => toast.error(errorText(t, failure)),
    onSettled: () => client.invalidateQueries({ queryKey: ["messages", { orderId }] }),
  })
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={resend.isPending}
        onClick={() => {
          setAsking(true)
        }}
      >
        {resend.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
        {t(`${M}.resend`)}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${M}.resendTitle`)}
        description={t(`${M}.resendText`, {
          name,
          channel: t(`${M}.channel.${row.channel}`),
        })}
        confirmLabel={t(`${M}.resend`)}
        onConfirm={() => {
          resend.mutate()
        }}
      />
    </>
  )
}
