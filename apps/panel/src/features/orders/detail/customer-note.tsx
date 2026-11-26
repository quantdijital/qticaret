import { MessageSquareQuote } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { customerNoteOf } from "@/features/orders/customer-note"

/**
 * The shopper's own words at checkout (Batch 8 / O1), beside the customer:
 * read before packing. Drawn only when they left one; plain text, never
 * markup.
 */
export function CustomerNoteCard({
  metadata,
}: {
  metadata: Record<string, unknown> | null | undefined
}) {
  const { t } = useTranslation()
  const note = customerNoteOf(metadata)
  if (!note) {
    return null
  }
  return (
    <SectionCard title={t("orders.customerNote.title")}>
      <div className="flex items-start gap-3 rounded-md bg-muted/60 p-3">
        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 text-sm break-words whitespace-pre-wrap">{note}</p>
      </div>
    </SectionCard>
  )
}
