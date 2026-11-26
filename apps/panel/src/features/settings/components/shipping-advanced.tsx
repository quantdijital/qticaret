import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { useStoreUnits } from "@/features/products/use-units"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { shopShippingOptionsQuery } from "@/features/settings/api/shipping-options"
import { DefaultParcelCard } from "@/features/settings/components/default-parcel-card"
import { DeliveryCard } from "@/features/settings/components/delivery-card"
import { LabelSizeCard } from "@/features/settings/components/label-size-card"
import { ShippingClassesCard } from "@/features/settings/components/shipping-classes-card"
import { RatesCard } from "@/features/settings/components/shipping-rules-cards"
import { advancedSummaries } from "@/features/settings/shipping-summaries"

/**
 * Settings > Shipping > "Gelişmiş" (the owner, 2026-11-26: fewer things on
 * screen): what a shop sets once, if ever, folded to a line each with its
 * defaults already in; the shipping classes last (most shops need none).
 * The price table opens by itself while an option is
 * priced by it and it has no rows (a warning, not a stop).
 */
export function ShippingAdvanced({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  const options = useQuery(shopShippingOptionsQuery()).data ?? []
  const tableUnset =
    saved.rate_table.length === 0 && options.some((option) => option.pricing === "table")
  const summary = advancedSummaries(t, saved, units)
  const fold = (id: string, line: string, attention = false) => ({
    id: `shipping-${id}`,
    name: `settings.shipping.${id}`,
    summary: line,
    attention,
  })
  return (
    <section aria-labelledby="shipping-advanced" className="flex flex-col gap-3">
      <h2 id="shipping-advanced" className="pt-2 text-sm font-semibold text-muted-foreground">
        {t("settings.shipping.advanced.title")}
      </h2>
      <FieldHints style="tip">
        <DeliveryCard
          key={`delivery-${JSON.stringify(saved)}`}
          saved={saved}
          collapse={fold("delivery", summary.delivery)}
        />
        <RatesCard
          key={`rates-${JSON.stringify(saved)}`}
          saved={saved}
          collapse={fold(
            "rates",
            tableUnset ? t("settings.shipping.advanced.ratesNeeded") : summary.rates,
            tableUnset
          )}
        />
        <DefaultParcelCard
          key={`parcel-${JSON.stringify(saved)}`}
          saved={saved}
          collapse={fold("parcel", summary.parcel)}
        />
        <LabelSizeCard
          key={`labels-${JSON.stringify(saved)}`}
          saved={saved}
          collapse={fold("labels", summary.label)}
        />
        <ShippingClassesCard
          key={`classes-${JSON.stringify(saved.shipping_classes ?? [])}`}
          saved={saved}
          collapse={fold("classes", summary.classes)}
        />
      </FieldHints>
    </section>
  )
}
