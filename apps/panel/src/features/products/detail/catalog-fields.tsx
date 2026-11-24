import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { Restriction } from "@/features/categories/api/restrictions"
import { RestrictionSelect } from "@/features/categories/components/restriction-select"
import { PRODUCT_CONDITIONS, PRODUCT_KINDS } from "@/features/products/api/product-edit"
import { PRODUCT_BADGE_MAX, badgeLength } from "@/features/settings/api/product-badges"
import type {
  ProductCatalog,
  ProductCondition,
  ProductKind,
} from "@/features/products/api/product-edit"
import { BookingModeField } from "./booking-mode-field"
import { GiftCardField } from "./gift-card-field"

// Radix Select has no empty value; this one stands for "none chosen"
const NONE = "__none__"

export interface CatalogValues {
  condition: ProductCondition
  kind: ProductKind
  primary_category_id: string
  withdrawal_excluded: boolean
  restriction: Restriction | null
  is_gift_card: boolean
  /** Sold by departure (`booking_mode: departure`, adr/0076 §2). */
  booking: boolean
  /** Its own card badge; empty: none. */
  badge: string
}

/** Which of the fields the shop uses (feature flags), or this product already has. */
export interface CatalogShown {
  kinds: boolean
  restricted: boolean
  giftCard: boolean
  /** Dated sale: the flag on, or this product already dated. */
  booking: boolean
  /** Its own badge: the shop has them on, or this product already has one. */
  badge: boolean
}

/**
 * The catalog's fields (F3.1, F13.4, F13.6, adr/0025 Ek): the kind, the
 * condition, the primary category, the age limit, the gift card mark and
 * the right of withdrawal.
 */
export function CatalogFields({
  form,
  catalog,
  shown,
  giftFailure,
  onGiftChange,
}: {
  form: UseFormReturn<CatalogValues>
  catalog: ProductCatalog
  shown: CatalogShown
  giftFailure: string | null
  onGiftChange: () => void
}) {
  const { t } = useTranslation()
  // A gift card is digital: its kind is the server's while it is one
  const gift = useWatch({ control: form.control, name: "is_gift_card" })
  // Only a service is sold by departure (adr/0076 §2)
  const kind = useWatch({ control: form.control, name: "kind" })
  const badgeError = Boolean(form.formState.errors.badge)
  return (
    <>
      {shown.kinds ? (
        <Field
          label={t("products.catalog.kind")}
          htmlFor="catalog-kind"
          hint={t(gift ? "products.catalog.kindGiftCard" : "products.catalog.kindHint")}
        >
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <Select
                value={gift ? "digital" : field.value}
                disabled={gift}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="catalog-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`products.catalog.kinds.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      ) : null}
      {shown.booking && kind === "service" && !gift ? <BookingModeField form={form} /> : null}
      <Field label={t("products.catalog.condition")} htmlFor="catalog-condition">
        <Controller
          control={form.control}
          name="condition"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="catalog-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {t(`products.catalog.conditions.${condition}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        label={t("products.catalog.primaryCategory")}
        htmlFor="catalog-primary"
        hint={t("products.catalog.primaryCategoryHint")}
      >
        <Controller
          control={form.control}
          name="primary_category_id"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              disabled={catalog.categories.length === 0}
              onValueChange={(next) => {
                field.onChange(next === NONE ? "" : next)
              }}
            >
              <SelectTrigger id="catalog-primary" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("products.catalog.noPrimary")}</SelectItem>
                {catalog.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      {shown.restricted ? (
        <Field
          label={t("restrictions.label")}
          htmlFor="catalog-restriction"
          hint={t("restrictions.productHint")}
        >
          <Controller
            control={form.control}
            name="restriction"
            render={({ field }) => (
              <RestrictionSelect
                id="catalog-restriction"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      ) : null}
      {shown.giftCard || gift || giftFailure !== null ? (
        <Controller
          control={form.control}
          name="is_gift_card"
          render={({ field }) => (
            <GiftCardField
              checked={field.value}
              onCheckedChange={(checked) => {
                onGiftChange()
                field.onChange(checked)
              }}
              failure={giftFailure}
            />
          )}
        />
      ) : null}
      {shown.badge ? (
        <Field
          label={t("products.catalog.badge")}
          htmlFor="catalog-badge"
          hint={t("products.catalog.badgeHint", { max: PRODUCT_BADGE_MAX })}
          error={
            badgeError ? t("products.catalog.badgeTooLong", { max: PRODUCT_BADGE_MAX }) : undefined
          }
        >
          {/* Counted as a reader counts letters (the server's rule), not by the input's UTF-16 units */}
          <Input
            id="catalog-badge"
            aria-invalid={badgeError}
            {...form.register("badge", {
              validate: (value) => badgeLength(value) <= PRODUCT_BADGE_MAX,
            })}
          />
        </Field>
      ) : null}
      <div className="flex items-start justify-between gap-4 border-t pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="catalog-withdrawal" className="text-sm font-medium">
            {t("products.catalog.withdrawalExcluded")}
          </label>
          <span id="catalog-withdrawal-hint" className="text-[13px] text-muted-foreground">
            {t("products.catalog.withdrawalExcludedHint")}
          </span>
        </div>
        <Controller
          control={form.control}
          name="withdrawal_excluded"
          render={({ field }) => (
            <Switch
              id="catalog-withdrawal"
              aria-describedby="catalog-withdrawal-hint"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  )
}
