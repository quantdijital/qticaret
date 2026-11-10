import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { REVIEW_REPLY_MAX, useReviewReply } from "@/features/reviews/api/reviews"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { Stars } from "@/features/reviews/components/google-review-item"
import { ReviewPhotos } from "@/features/reviews/components/review-photos"
import { errorText } from "@/lib/errors"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"

const R = "reviews.reply"

/**
 * One approved customer review in the standard dialog, as a Google
 * review's: the review whole, the shop's public reply (plain text, 1,000
 * characters) sent with "Yanıtla" or "Yanıtı güncelle", removed with
 * "Yanıtı sil" after asking. The storefront shows it under the review as
 * "Mağazanın yanıtı", signed with the shop's name.
 */
export function ReviewDialog({ review, onClose }: { review: ReviewRow; onClose: () => void }) {
  const { t } = useTranslation()
  const reply = useReviewReply()
  const [text, setText] = useState(review.reply ?? "")
  const [asking, setAsking] = useState(false)
  const trimmed = text.trim()
  const tooLong = trimmed.length > REVIEW_REPLY_MAX
  const had = review.reply !== null
  const send = (body: string | null, done: string) => {
    reply.mutate(
      { id: review.id, body },
      {
        onSuccess: () => {
          toast.success(t(done))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const fieldId = `review-reply-${review.id}`
  const about = [review.product.title, formatDate(review.created_at)].filter(Boolean).join(" · ")
  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        title={t("reviews.dialogTitle", { author: review.author_name })}
        description={about}
        dirty={trimmed !== (review.reply ?? "").trim()}
        canSubmit={trimmed !== "" && !tooLong}
        saving={reply.isPending}
        submitLabel={t(had ? `${R}.update` : `${R}.send`)}
        initialFocus={fieldId}
        footerStart={
          had ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive-text"
              disabled={reply.isPending}
              onClick={() => {
                setAsking(true)
              }}
            >
              {t(`${R}.delete`)}
            </Button>
          ) : null
        }
        onSubmit={() => {
          send(trimmed, had ? `${R}.updated` : `${R}.sent`)
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            {had ? <StatusBadge tone="neutral">{t("reviews.replied")}</StatusBadge> : null}
          </div>
          {review.title ? <p className="text-sm font-medium">{review.title}</p> : null}
          <p className="text-sm whitespace-pre-wrap">{review.body}</p>
          <ReviewPhotos photos={review.photos} author={review.author_name} />
        </div>
        <Field
          label={t(`${R}.label`)}
          htmlFor={fieldId}
          hint={t(`${R}.hint`)}
          error={tooLong ? t(`${R}.tooLong`, { max: REVIEW_REPLY_MAX }) : undefined}
        >
          <Textarea
            id={fieldId}
            rows={5}
            value={text}
            placeholder={t(`${R}.placeholder`)}
            aria-invalid={tooLong}
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {review.replied_at ? t(`${R}.at`, { when: formatDateTime(review.replied_at) }) : ""}
            </span>
            <span className={tooLong ? "text-destructive-text" : undefined}>
              {t(`${R}.count`, { used: trimmed.length, max: REVIEW_REPLY_MAX })}
            </span>
          </p>
        </Field>
      </FormDialog>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${R}.deleteConfirm.title`)}
        description={t(`${R}.deleteConfirm.description`)}
        confirmLabel={t(`${R}.deleteConfirm.action`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          send(null, `${R}.deleted`)
        }}
      />
    </>
  )
}
