import { Copy, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { AiButton } from "@/features/ai/components/ai-button"

/** A product's reviews summed up by the AI core, as shown on this screen only. */
export interface ReviewSummary {
  productId: string
  productTitle: string
  text: string
}

/**
 * "Yorumları özetle" beside a product in the review list (Aşama 9): the
 * product's approved reviews summed up by the AI core, a suggestion like
 * any other. "Kullan" shows it above the list; nothing is saved and the
 * storefront never shows it. Drawn only while the shop's `ai.reviews` is on
 * and the role may ask (the services list's `allowed`).
 */
export function ReviewSummaryButton({
  productId,
  productTitle,
  onSummary,
}: {
  productId: string
  productTitle: string
  onSummary: (summary: ReviewSummary) => void
}) {
  const { t } = useTranslation()
  return (
    <AiButton
      task="review_summary"
      entity={{ type: "product", id: productId }}
      text={t("ai.reviews.summarize")}
      label={t("ai.reviews.summarizeFor", { product: productTitle })}
      note={t("ai.reviews.note")}
      onUse={(text) => {
        onSummary({ productId, productTitle, text })
      }}
    />
  )
}

/** The summary taken: its lines, a note that it is a suggestion, copy and close. */
export function ReviewSummaryCard({
  summary,
  onClose,
}: {
  summary: ReviewSummary
  onClose: () => void
}) {
  const { t } = useTranslation()
  const title = t("ai.reviews.summaryTitle", { product: summary.productTitle })
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-lg border bg-card px-5 py-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("ai.reviews.copy")}
            title={t("ai.reviews.copy")}
            onClick={() => {
              void navigator.clipboard
                .writeText(summary.text)
                .then(() => toast.success(t("ai.reviews.copied")))
                .catch(() => undefined)
            }}
          >
            <Copy />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("ai.reviews.summaryClose")}
            title={t("ai.reviews.summaryClose")}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm break-words">
        {summary.text.split("\n").map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("ai.reviews.summaryNote")}</p>
    </section>
  )
}
