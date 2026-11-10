import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import {
  MAX_REPLY_BYTES,
  replyBytes,
  useGoogleReviewReply,
} from "@/features/reviews/api/google-reviews"
import type { GoogleReviewRow, HideReason } from "@/features/reviews/api/google-reviews"
import { HiddenLine, ReplyBadge, Stars } from "@/features/reviews/components/google-review-item"
import { HideReviewDialog } from "@/features/reviews/components/hide-review-dialog"
import { errorText } from "@/lib/errors"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"

const G = "reviews.google"

/** Google's moderation of the reply in a line, when it is not simply shown. */
function ReplyStateNote({ review }: { review: GoogleReviewRow }) {
  const { t } = useTranslation()
  if (!review.replied || (review.reply_state !== "pending" && review.reply_state !== "rejected")) {
    return null
  }
  return (
    <p
      className={
        review.reply_state === "pending"
          ? "text-[13px] text-info-text"
          : "text-[13px] text-destructive-text"
      }
    >
      {t(review.reply_state === "pending" ? `${G}.replyPendingNote` : `${G}.replyRejectedNote`)}
    </p>
  )
}

/**
 * One Google review in the standard dialog (adr/0058 Ek 2026-11-06): the
 * review whole, the shop's reply (plain text, 4096 bytes as Google counts
 * them) sent with "Yanıtla" or "Yanıtı güncelle", removed with "Yanıtı
 * sil" after asking; under it whether the review shows on the storefront,
 * taken off for one of the three reasons or put back.
 */
export function GoogleReviewDialog({
  review,
  busy,
  onClose,
  onHide,
  onRestore,
}: {
  review: GoogleReviewRow
  busy: boolean
  onClose: () => void
  onHide: (reason: HideReason) => void
  onRestore: () => void
}) {
  const { t } = useTranslation()
  const reply = useGoogleReviewReply()
  const [text, setText] = useState(review.reply ?? "")
  const [asking, setAsking] = useState<"hide" | "delete" | null>(null)
  const author = review.author ?? t(`${G}.anonymous`)
  const trimmed = text.trim()
  const used = replyBytes(trimmed)
  const tooLong = used > MAX_REPLY_BYTES
  const had = review.reply !== null
  const send = (comment: string | null, done: string) => {
    reply.mutate(
      { id: review.id, comment },
      {
        onSuccess: () => {
          toast.success(t(done))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const fieldId = `google-reply-${review.id}`
  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        title={t(`${G}.dialogTitle`, { author })}
        description={formatDate(review.created_at)}
        dirty={trimmed !== (review.reply ?? "").trim()}
        canSubmit={trimmed !== "" && !tooLong}
        saving={reply.isPending}
        submitLabel={t(had ? `${G}.replyUpdate` : `${G}.replySend`)}
        initialFocus={fieldId}
        footerStart={
          had ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive-text"
              disabled={reply.isPending}
              onClick={() => {
                setAsking("delete")
              }}
            >
              {t(`${G}.replyDelete`)}
            </Button>
          ) : null
        }
        onSubmit={() => {
          send(trimmed, had ? `${G}.replyUpdated` : `${G}.replySent`)
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <ReplyBadge review={review} />
          </div>
          {review.comment ? (
            <p className="text-sm whitespace-pre-wrap">{review.comment}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t(`${G}.noText`)}</p>
          )}
        </div>
        <Field
          label={t(`${G}.reply`)}
          htmlFor={fieldId}
          hint={t(`${G}.replyHint`)}
          error={tooLong ? t(`${G}.replyTooLong`, { max: MAX_REPLY_BYTES }) : undefined}
        >
          <Textarea
            id={fieldId}
            rows={5}
            value={text}
            placeholder={t(`${G}.replyPlaceholder`)}
            aria-invalid={tooLong}
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {review.replied_at
                ? t(`${G}.repliedAt`, { when: formatDateTime(review.replied_at) })
                : ""}
            </span>
            <span className={tooLong ? "text-destructive-text" : undefined}>
              {t(`${G}.replyBytes`, { used, max: MAX_REPLY_BYTES })}
            </span>
          </p>
          <ReplyStateNote review={review} />
        </Field>
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">{t(`${G}.visibility`)}</h3>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {review.hidden ? (
              <HiddenLine review={review} />
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(`${G}.shownLine`)}</p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={review.hidden ? undefined : t(`${G}.hideFor`, { author })}
              onClick={() => {
                if (review.hidden) {
                  onRestore()
                } else {
                  setAsking("hide")
                }
              }}
            >
              {t(review.hidden ? `${G}.restore` : `${G}.hide`)}
            </Button>
          </div>
        </div>
      </FormDialog>
      <HideReviewDialog
        author={author}
        open={asking === "hide"}
        busy={busy}
        onOpenChange={(open) => {
          setAsking(open ? "hide" : null)
        }}
        onConfirm={(reason) => {
          setAsking(null)
          onHide(reason)
        }}
      />
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(open) => {
          setAsking(open ? "delete" : null)
        }}
        title={t(`${G}.deleteConfirm.title`)}
        description={t(`${G}.deleteConfirm.description`)}
        confirmLabel={t(`${G}.deleteConfirm.action`)}
        destructive
        onConfirm={() => {
          setAsking(null)
          send(null, `${G}.replyDeleted`)
        }}
      />
    </>
  )
}
