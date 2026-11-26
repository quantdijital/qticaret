import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { Loader2, Send, StickyNote, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AsyncBody } from "@/components/patterns/async-body"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useCan } from "@/features/auth/api/staff"
import {
  ORDER_NOTE_MAX,
  orderNotesQuery,
  useAddOrderNote,
  useRemoveOrderNote,
} from "@/features/orders/api/notes"
import type { NoteSendOutcome, OrderNote } from "@/features/orders/api/notes"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const N = "orders.notes"

function Composer({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const add = useAddOrderNote(orderId)
  const [body, setBody] = useState("")
  const [notify, setNotify] = useState(false)
  const ready = body.trim() !== "" && !add.isPending
  return (
    <form
      className="mt-auto flex flex-col gap-2 border-t px-5 pt-4 pb-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready) {
          return
        }
        add.mutate(
          { body: body.trim(), notifyCustomer: notify },
          {
            onSuccess: (answer) => {
              setBody("")
              setNotify(false)
              if (notify) {
                announceSend(t, answer.sent ?? null)
              }
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <Textarea
        aria-label={t(`${N}.new`)}
        placeholder={t(`${N}.placeholder`)}
        maxLength={ORDER_NOTE_MAX}
        rows={3}
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
        }}
      />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={notify}
          onCheckedChange={(on) => {
            setNotify(on === true)
          }}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{t(`${N}.notify`)}</span>
          <span className="text-xs text-muted-foreground">{t(`${N}.notifyHint`)}</span>
        </span>
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(`${N}.length`, { count: body.length, max: ORDER_NOTE_MAX })}
        </span>
        <Button type="submit" size="sm" disabled={!ready}>
          {add.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(notify ? `${N}.addAndSend` : `${N}.add`)}
        </Button>
      </div>
    </form>
  )
}

/** The note is saved; how its e-mail went, in words: sent, or why it did not go. */
function announceSend(t: TFunction, sent: NoteSendOutcome) {
  if (sent === "sent" || sent === "duplicate") {
    toast.success(t(`${N}.sent`))
    return
  }
  const reason =
    sent === "template_off"
      ? "templateOff"
      : sent === "failed"
        ? "failed"
        : sent === "not_sent"
          ? "noAddress"
          : "other"
  toast.warning(t(`${N}.notSent.${reason}`))
}

/** Whether the note went to the customer, beside its author and time. */
function SendBadge({ state }: { state: OrderNote["sent_to_customer"] }) {
  const { t } = useTranslation()
  if (!state) {
    return null
  }
  const went = state === "sent" || state === "pending"
  return (
    <Badge variant={went ? "secondary" : "outline"} className="gap-1">
      <Send aria-hidden="true" />
      {t(went ? `${N}.badgeSent` : `${N}.badgeNotSent`)}
    </Badge>
  )
}

function Note({ note, onRemove }: { note: OrderNote; onRemove: () => void }) {
  const { t } = useTranslation()
  const author = note.author ? note.author.name || t(`${N}.unnamed`) : t(`${N}.formerMember`)
  return (
    <li className="flex items-start gap-3 border-t px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{author}</span> ·{" "}
            {formatDateTime(note.created_at)}
          </span>
          <SendBadge state={note.sent_to_customer ?? null} />
        </span>
        <p className="text-sm break-words whitespace-pre-wrap">{note.body}</p>
      </div>
      {note.deletable ? (
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-2 size-8 shrink-0 text-muted-foreground"
          aria-label={t(`${N}.remove`)}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      ) : null}
    </li>
  )
}

/**
 * The team's notes on the order (F12.8), oldest first, with who wrote them
 * and when; the shopper never sees them. Staff who act on orders add one;
 * its author or the owner removes it.
 */
export function NotesCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const query = useQuery(orderNotesQuery(orderId))
  const mayWrite = useCan("orders")
  const remove = useRemoveOrderNote(orderId)
  const [removing, setRemoving] = useState<string | null>(null)
  return (
    <SectionCard title={t(`${N}.title`)} description={t(`${N}.text`)} flush>
      <AsyncBody query={query} skeleton={<Skeleton className="mx-5 mb-5 h-20" />}>
        {(data) =>
          data.notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 pt-2 pb-6 text-center">
              <StickyNote className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t(`${N}.empty`)}</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {data.notes.map((note) => (
                <Note
                  key={note.id}
                  note={note}
                  onRemove={() => {
                    setRemoving(note.id)
                  }}
                />
              ))}
            </ul>
          )
        }
      </AsyncBody>
      {mayWrite ? <Composer orderId={orderId} /> : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${N}.removeTitle`)}
        description={t(`${N}.removeText`)}
        confirmLabel={t(`${N}.remove`)}
        destructive
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing, {
              onSuccess: () => toast.success(t(`${N}.removed`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setRemoving(null)
        }}
      />
    </SectionCard>
  )
}
