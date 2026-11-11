import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import type { Plan } from "@/features/packages/api"
import { priceText } from "@/features/packages/format"
import { slugOf } from "./draft"
import type { ShopDraft } from "./draft"

/**
 * The new shop in short, beside every step (docs/06: short facts in the
 * right column): its name, address, package and where the owner's
 * invitation will go, as they are filled in.
 */
export function DraftSummary({
  draft,
  plan,
  platformDomain,
}: {
  draft: ShopDraft
  plan: Plan | null
  platformDomain: string | null
}) {
  const { t } = useTranslation()
  const slug = slugOf(draft)
  const rows: [string, string][] = [
    [t("tenants.create.name"), draft.name.trim()],
    [t("wizard.address.result"), slug && platformDomain ? `${slug}.${platformDomain}` : slug],
    [t("wizard.review.package"), plan ? `${plan.name} · ${priceText(t, plan)}` : ""],
    [t("wizard.summary.invite"), draft.owner.email.trim()],
  ]
  return (
    <SectionCard title={t("wizard.summary.title")} description={t("wizard.summary.text")}>
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium break-words">{value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
