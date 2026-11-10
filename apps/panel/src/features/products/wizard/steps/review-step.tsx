import { useQuery } from "@tanstack/react-query"
import { CircleCheck, CircleDashed, CircleAlert } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { categoriesQuery } from "@/features/products/api/lookups"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { toSlug } from "@/lib/slug"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { readiness, wordCount } from "../readiness"
import type { ReadinessItem } from "../readiness"
import type { WizardValues } from "../schema"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function ChecklistRow({ item }: { item: ReadinessItem }) {
  const { t } = useTranslation()
  const Icon = item.done ? CircleCheck : item.required ? CircleAlert : CircleDashed
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.done
            ? "text-success-text"
            : item.required
              ? "text-warning-text"
              : "text-muted-foreground"
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm", item.done ? "text-foreground" : "font-medium")}>
          {t(`products.wizard.check.${item.key}`)}
        </span>
        {item.done ? null : (
          <span className="text-xs text-muted-foreground">
            {t(
              item.required ? "products.wizard.check.required" : "products.wizard.check.suggested"
            )}
          </span>
        )}
      </span>
    </li>
  )
}

function priceText(values: WizardValues): string {
  const amounts = values.variants.map((variant) => parseMoneyInput(variant.price) ?? 0)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  return min === max
    ? formatMoney(min, "try")
    : `${formatMoney(min, "try")} – ${formatMoney(max, "try")}`
}

/** Step 5: the product as it will be saved, and what it still lacks. */
export function ReviewStep() {
  const { t } = useTranslation()
  const { control } = useFormContext<WizardValues>()
  const values = useWatch({ control }) as WizardValues
  const categories = useQuery(categoriesQuery())
  const names = (categories.data ?? [])
    .filter((category) => values.category_ids.includes(category.id))
    .map((category) => category.name)
  const items = readiness(values)
  const prefix = useProductPathPrefix()
  const slug = values.handle.trim() || toSlug(values.title)
  const excerpt = values.description.trim()

  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <SectionCard title={t("products.wizard.summary")} className="xl:col-span-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <ProductThumb src={values.images[0]?.url} className="size-36 rounded-lg [&_svg]:size-8" />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg leading-7 font-semibold">{values.title || "—"}</h3>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {prefix}
                {slug}
              </span>
            </div>
            {excerpt ? (
              <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
            ) : null}
            <dl className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Fact label={t("products.wizard.price")} value={priceText(values)} />
              <Fact
                label={t("products.columns.variants")}
                value={t("products.wizard.variantCount", { count: values.variants.length })}
              />
              <Fact
                label={t("products.media.card")}
                value={t("products.wizard.imageCount", { count: values.images.length })}
              />
              <Fact
                label={t("products.wizard.descriptionLabel")}
                value={t("products.wizard.wordTotal", { count: wordCount(values.description) })}
              />
            </dl>
            {names.length ? (
              <div className="flex flex-wrap gap-1.5">
                {names.map((name) => (
                  <span key={name} className="rounded-md border px-2 py-0.5 text-xs">
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title={t("products.wizard.checklist")}
        description={t("products.wizard.checklistHint")}
        className="xl:col-span-4"
      >
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <ChecklistRow key={item.key} item={item} />
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
