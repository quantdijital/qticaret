import { Loader2, Send } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useTestSend } from "@/features/bulk-messages/api/bulk-messages"
import type { BulkChannel } from "@/features/bulk-messages/api/types"
import { errorText } from "@/lib/errors"

const T = "bulkMessages.test"

/**
 * "Bana gönder" (adr/0050 §5): an e-mail to the signed-in person's own
 * address, a text to the shop's number; never one typed here. Marked
 * `[Deneme]`, counted in the day's quota, ten an hour.
 */
export function TestSendCard({
  id,
  channel,
  blocked,
}: {
  id: string
  channel: BulkChannel
  /** Why it cannot go yet (unsaved, incomplete), in words; none: it can. */
  blocked: string | null
}) {
  const { t } = useTranslation()
  const test = useTestSend(id)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <SectionCard title={t(`${T}.title`)} description={t(`${T}.description.${channel}`)}>
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="flex flex-col gap-2">
          {blocked ? <p className="text-[13px] text-muted-foreground">{blocked}</p> : null}
          {result ? (
            <p
              role={result.ok ? "status" : "alert"}
              className={
                result.ok ? "text-[13px] text-success-text" : "text-[13px] text-destructive-text"
              }
            >
              {result.text}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          className="self-start"
          disabled={blocked !== null || test.isPending}
          onClick={() => {
            setResult(null)
            test.mutate(undefined, {
              onSuccess: ({ to }) => {
                const text = t(`${T}.sent`, { to })
                setResult({ ok: true, text })
                toast.success(text)
              },
              onError: (failure) => {
                setResult({ ok: false, text: errorText(t, failure) })
              },
            })
          }}
        >
          {test.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {t(`${T}.send`)}
        </Button>
      </div>
    </SectionCard>
  )
}
