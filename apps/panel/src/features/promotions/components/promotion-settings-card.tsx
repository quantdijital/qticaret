import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { PromotionSettings } from "@/features/settings/api/sections"
import { FREE_SHIPPING_ANCHOR } from "@/features/settings/components/shipping-fee-section"
import { errorText } from "@/lib/errors"

function SwitchRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * Shop-wide promotion rules (F4.4, ADR-0024): whether a cart may carry
 * more than one code. Free shipping from a basket total (F4.5) and what a
 * free shipping coupon needs beside it are edited under Settings >
 * Shipping (the owner, 2026-11-26); here they are lines that say where
 * they stand and link there.
 */
export function PromotionSettingsCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<PromotionSettings>("promotions"))
  const save = useSaveSection<PromotionSettings>("promotions")
  const stored = section.data?.values
  const threshold = stored?.free_shipping_threshold ?? null
  const condition = stored?.free_shipping_condition ?? "amount_or_coupon"
  // What a free shipping coupon does under the shop's condition (Kargo ücreti, "Koşul")
  const coupon =
    threshold === null || condition === "amount_or_coupon"
      ? t("promotions.settings.freeShippingCouponValues.any")
      : condition === "amount"
        ? t("promotions.settings.freeShippingCouponValues.off")
        : t("promotions.settings.freeShippingCouponValues.from", {
            amount: formatMoney(threshold, "try"),
          })
  return (
    <SectionCard title={t("promotions.settings.title")} description={t("promotions.settings.hint")}>
      {!stored ? (
        <Skeleton className="h-20" />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="flex flex-col gap-1">
              <span data-testid="free-shipping-summary">
                {t("promotions.settings.freeShippingSummary", {
                  value:
                    threshold === null
                      ? t("promotions.settings.freeShippingOff")
                      : formatMoney(threshold, "try"),
                })}
              </span>
              <span data-testid="free-shipping-coupon-summary">
                {t("promotions.settings.freeShippingCoupon", { value: coupon })}
              </span>
            </span>
            <Link
              to="/settings/shipping"
              search={{ part: "options" }}
              hash={FREE_SHIPPING_ANCHOR}
              className="text-[13px] font-medium text-primary-text underline-offset-2 hover:underline"
            >
              {t("promotions.settings.freeShippingEdit")}
            </Link>
          </p>
          <div className="border-t pt-5">
            <SwitchRow
              id="combine-codes"
              label={t("promotions.settings.combineCodes")}
              hint={t("promotions.settings.combineCodesHint")}
              checked={stored.combine_codes}
              disabled={save.isPending}
              onChange={(checked) => {
                save.mutate(
                  { combine_codes: checked },
                  {
                    onSuccess: () => toast.success(t("promotions.settings.saved")),
                    onError: (failure) => toast.error(errorText(t, failure)),
                  }
                )
              }}
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}
