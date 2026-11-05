import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import type { SectionFindings } from "@/features/content/section-findings"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { DRAFT_KINDS, draftsQuery } from "@/features/products/api/content-drafts"
import type { Draft, DraftKind } from "@/features/products/api/content-drafts"
import { productFold } from "./sections"

const D = "products.drafts"
const TONE = {
  draft: "info",
  approved: "success",
  rejected: "neutral",
  refused: "warning",
} as const

/**
 * A product's content drafts from a model (F10.13, adr/0005): asked for
 * one text at a time, checked by the advisor's rules, and shown here only
 * as drafts. Nothing reaches the page until staff approve it. Hidden
 * while the shop has drafts off (Settings > Features). With `fold`, folded
 * under the product page's main parts to what waits for approval.
 */
export function ContentDraftsCard({
  productId,
  fold,
}: {
  productId: string
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(draftsQuery(productId))
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["products", productId] })
    // An approved description is the product's text now and drops its document (ADR-0055)
    await client.invalidateQueries({ queryKey: ["products", "detail", productId] })
    await client.invalidateQueries({ queryKey: ["products", "catalog", productId] })
    await client.invalidateQueries({ queryKey: ["seo"] })
  }
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const ask = useMutation({
    mutationFn: (kind: DraftKind) =>
      sdk.client.fetch<{ draft: Draft }>("/admin/content-drafts", {
        method: "POST",
        body: { entity_type: "product", entity_id: productId, kind },
      }),
    onSuccess: async ({ draft }) => {
      if (draft.status === "refused") {
        toast.warning(t(`${D}.refused`))
      }
      await refresh()
    },
    onError: failed,
  })
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "approve" | "reject" }) =>
      sdk.client.fetch(`/admin/content-drafts/${encodeURIComponent(input.id)}/${input.decision}`, {
        method: "POST",
      }),
    onSuccess: async (_answer, input) => {
      toast.success(t(`${D}.decided.${input.decision}`))
      await refresh()
    },
    onError: failed,
  })
  const data = query.data
  // Off, or nothing to write them (the flag is not even listed then): no card
  if (!data?.enabled || !data.provider_ready) {
    return null
  }
  const full = data.quota.used >= data.quota.limit
  const waiting = data.drafts.filter((draft) => draft.status === "draft").length
  return (
    <SectionCard
      title={t(`${D}.title`)}
      description={t(`${D}.description`, { used: data.quota.used, limit: data.quota.limit })}
      collapse={
        fold &&
        productFold(t, "drafts", fold, [
          waiting > 0
            ? t("products.sections.draftsWaiting", { count: waiting })
            : t(
                data.drafts.length > 0
                  ? "products.sections.noneWaiting"
                  : "products.sections.noDrafts"
              ),
          t("products.sections.draftsQuota", { used: data.quota.used, limit: data.quota.limit }),
        ])
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {DRAFT_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              disabled={ask.isPending || full}
              onClick={() => {
                ask.mutate(kind)
              }}
            >
              {ask.isPending && ask.variables === kind ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {t(`${D}.ask.${kind}`)}
            </Button>
          ))}
        </div>
        {data.drafts.length === 0 ? null : (
          <ul className="flex flex-col divide-y">
            {data.drafts.map((draft) => (
              <li key={draft.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t(`${D}.kinds.${draft.kind}`)}</span>
                  <StatusBadge tone={TONE[draft.status]}>
                    {t(`${D}.status.${draft.status}`)}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{t(`${D}.source`)}</StatusBadge>
                </div>
                <p className="line-clamp-6 text-[13px] whitespace-pre-wrap">{draft.text}</p>
                {draft.problems ? (
                  <p className="text-xs text-warning-text">
                    {draft.problems.problems
                      .map((problem) => t(`${D}.problems.${problem}`))
                      .join(" · ")}
                  </p>
                ) : null}
                {draft.status === "draft" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => {
                        decide.mutate({ id: draft.id, decision: "approve" })
                      }}
                    >
                      {t(`${D}.approve`)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() => {
                        decide.mutate({ id: draft.id, decision: "reject" })
                      }}
                    >
                      {t(`${D}.reject`)}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  )
}
