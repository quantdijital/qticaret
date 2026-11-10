import { Loader2, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { LinkLines, LinkTotals } from "@/features/payment-links/components/link-lines"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { LinkPreviewState } from "./use-link-preview"

const S = "paymentLinks.summary"

/**
 * The form's summary beside it (adr/0051 §13), as the backend prices it;
 * nothing here is worked out by the panel. "Bağlantı oluştur" under it.
 */
export function SummaryCard({
  state,
  busy,
  failure,
}: {
  state: LinkPreviewState
  busy: boolean
  /** Why the last try to make the link was refused, in the backend's words. */
  failure: string | null
}) {
  const { t } = useTranslation()
  const { query, empty, stale, discountPending } = state
  const preview = query.data
  const short = new Set(preview?.short_variant_ids ?? [])
  return (
    <SectionCard title={t(`${S}.title`)}>
      <div className="flex flex-col gap-4">
        {empty ? (
          <p className="text-sm text-muted-foreground">{t(`${S}.empty`)}</p>
        ) : query.isError ? (
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        ) : !preview ? (
          <LoadingRows rows={3} />
        ) : (
          <div
            aria-busy={stale || undefined}
            className={cn("flex flex-col gap-3 transition-opacity", stale && "opacity-60")}
          >
            <LinkLines lines={preview.lines} currency={preview.currency_code} short={short} />
            <LinkTotals
              itemsTotal={preview.items_total}
              discount={preview.discount}
              total={preview.total}
              currency={preview.currency_code}
            />
            {short.size > 0 ? (
              <p className="flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-text">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {t(`${S}.short`, { count: short.size })}
              </p>
            ) : null}
          </div>
        )}
        {discountPending ? (
          <p className="text-xs text-muted-foreground">{t(`${S}.discountPending`)}</p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {t(`${S}.create`)}
        </Button>
        <p className="text-xs text-muted-foreground">{t(`${S}.reauth`)}</p>
      </div>
    </SectionCard>
  )
}
