import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { Promotion } from "@/features/promotions/api/promotions"
import {
  ConditionLines,
  OfferText,
  ScheduleBadge,
} from "@/features/promotions/components/offer-text"
import { buyGetCounts } from "@/features/promotions/form"
import type { PromotionValues } from "@/features/promotions/form"
import { applicationMethod, buyGetMethod } from "@/features/promotions/offer"
import { formatCount } from "@/lib/format"
import { parseMoneyInput } from "@/lib/money-input"

const CURRENCY = "try"

/** The offer as the shop will see it, with its code, conditions and, once saved, its use. */
export function PromotionPreview({ existing }: { existing: Promotion | null }) {
  const { t } = useTranslation()
  const [kind, value, code, automatic, scope, scopeIds, minimum, perCustomer] = useWatch<
    PromotionValues,
    ["kind", "value", "code", "automatic", "scope", "scopeIds", "minimum", "perCustomer"]
  >({
    name: ["kind", "value", "code", "automatic", "scope", "scopeIds", "minimum", "perCustomer"],
  })
  const [buyCount, payCount] = useWatch<PromotionValues, ["buyCount", "payCount"]>({
    name: ["buyCount", "payCount"],
  })
  const counts = buyGetCounts({ buyCount, payCount })
  const target = { scope, ids: scopeIds }
  const method =
    kind === "buyget"
      ? counts && buyGetMethod(counts.buy, counts.pay, target)
      : applicationMethod(kind, parseMoneyInput(value) ?? 0, CURRENCY, target)
  return (
    <SectionCard title={t("promotions.form.preview")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-5">
          <span className="text-2xl font-semibold tracking-tight">
            {method ? <OfferText method={method} /> : t("promotions.kinds.buyget.title")}
          </span>
          <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-sm tracking-wider uppercase">
            {code.trim() || t("promotions.form.codePlaceholder")}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t(automatic ? "promotions.form.previewAutomatic" : "promotions.form.previewCode")}
          </span>
          <ConditionLines
            kind={kind}
            scope={scope}
            count={scopeIds.length}
            minimum={parseMoneyInput(minimum)}
            perCustomer={Number(perCustomer) || null}
          />
        </div>
        {existing ? (
          <dl className="flex flex-col divide-y text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">{t("promotions.columns.status")}</dt>
              <dd>
                <ScheduleBadge promotion={existing} />
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">{t("promotions.columns.used")}</dt>
              <dd className="tabular-nums">
                {formatCount(existing.used ?? 0)}
                {existing.limit ? ` / ${formatCount(existing.limit)}` : ""}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </SectionCard>
  )
}
