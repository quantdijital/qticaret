import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCan } from "@/features/auth/api/staff"
import {
  CONTACT_MESSAGES_KEY,
  deleteContactMessage,
  markContactMessage,
} from "@/features/customers/api/contact-messages"
import type { ContactMessage, ContactStatus } from "@/features/customers/api/contact-messages"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatPhone } from "@/lib/format"

const M = "customers.contactMessages"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** `mailto:` with the address kept whole and a subject the reply starts from. */
function mailtoOf(email: string, subject: string): string {
  const address = email.split("@").map(encodeURIComponent).join("@")
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`
}

/** Answered or back to waiting, and deleting for good; each only for a role the API allows. */
function Actions({ message, onDone }: { message: ContactMessage; onDone: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  // `POST /admin/contact-messages/:id` is open to operations as shipping is (adr/0047 §6)
  const canMark = useCan("orders")
  // `DELETE` is the owner's and admins', as the shop's settings are
  const canDelete = useCan("settings")
  const [confirming, setConfirming] = useState(false)
  const done = async (text: string) => {
    toast.success(text)
    onDone()
    await client.invalidateQueries({ queryKey: CONTACT_MESSAGES_KEY })
  }
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const mark = useMutation({
    mutationFn: (status: ContactStatus) => markContactMessage(message.id, status),
    onSuccess: (_, status) =>
      done(t(status === "handled" ? `${M}.markedHandled` : `${M}.markedNew`)),
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => deleteContactMessage(message.id),
    onSuccess: () => done(t(`${M}.deleted`)),
    onError: failed,
  })
  if (!canMark && !canDelete) {
    return null
  }
  const busy = mark.isPending || remove.isPending
  const next: ContactStatus = message.status === "new" ? "handled" : "new"
  return (
    <SheetFooter className="flex-row flex-wrap justify-end border-t">
      {canDelete ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {t(`${M}.delete`)}
        </Button>
      ) : null}
      {canMark ? (
        <Button
          variant={next === "handled" ? "default" : "outline"}
          disabled={busy}
          onClick={() => {
            mark.mutate(next)
          }}
        >
          {t(next === "handled" ? `${M}.markHandled` : `${M}.markNew`)}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${M}.deleteTitle`)}
        description={t(`${M}.deleteDescription`, { name: message.name })}
        confirmLabel={t(`${M}.deleteConfirm`)}
        destructive
        onConfirm={() => {
          remove.mutate()
        }}
      />
    </SheetFooter>
  )
}

/**
 * One contact message in full beside the list (adr/0047): who wrote, how
 * to reach them, the order they name and what they wrote, as plain text.
 * The reply goes from the shop's own mail program.
 */
export function ContactMessageSheet({
  message,
  onClose,
}: {
  message: ContactMessage | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const subject = message ? t(`${M}.subjects.${message.subject}`) : ""
  const reply = message?.order_number
    ? t(`${M}.replyOrder`, { subject, order: message.order_number })
    : t(`${M}.reply`, { subject })
  return (
    <Sheet
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{t(`${M}.detail.title`)}</SheetTitle>
          <SheetDescription>
            {message ? `${subject} · ${formatDateTime(message.created_at)}` : null}
          </SheetDescription>
        </SheetHeader>
        {message ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <dl className="divide-y">
                <Fact label={t(`${M}.detail.name`)}>{message.name}</Fact>
                <Fact label={t(`${M}.detail.email`)}>
                  <a
                    href={mailtoOf(message.email, reply)}
                    className="break-all text-primary-text hover:underline"
                  >
                    {message.email}
                  </a>
                </Fact>
                <Fact label={t(`${M}.detail.phone`)}>
                  {message.phone ? (
                    <a href={`tel:${message.phone}`} className="text-primary-text hover:underline">
                      {formatPhone(message.phone)}
                    </a>
                  ) : (
                    "—"
                  )}
                </Fact>
                <Fact label={t(`${M}.detail.order`)}>
                  {message.order_number ? (
                    <Link
                      to="/orders"
                      search={{ q: message.order_number }}
                      className="text-primary-text hover:underline"
                    >
                      #{message.order_number}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Fact>
                {message.customer_id ? (
                  <Fact label={t(`${M}.detail.customer`)}>
                    <Link
                      to="/customers/$id"
                      params={{ id: message.customer_id }}
                      className="text-primary-text hover:underline"
                    >
                      {t(`${M}.detail.openCustomer`)}
                    </Link>
                  </Fact>
                ) : null}
                <Fact label={t(`${M}.detail.status`)}>
                  <StatusBadge tone={message.status === "new" ? "warning" : "success"}>
                    {t(`${M}.status.${message.status}`)}
                  </StatusBadge>
                  {message.status === "handled" && message.handled_at ? (
                    <span className="ml-2 text-muted-foreground tabular-nums">
                      {formatDateTime(message.handled_at)}
                    </span>
                  ) : null}
                </Fact>
              </dl>
              <h3 className="mt-5 mb-2 text-sm font-medium">{t(`${M}.detail.message`)}</h3>
              <p className="rounded-md border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
                {message.body}
              </p>
            </div>
            <Actions message={message} onDone={onClose} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
