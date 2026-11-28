import { useTranslation } from "react-i18next"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { PRODUCT_KINDS } from "@/features/products/api/product-edit"
import { Choices } from "@/features/products/bulk/bulk-choices"
import type { FieldsProps } from "@/features/products/bulk/bulk-fields"
import { useFeature } from "@/features/settings/api/features"

const K = "products.bulk.kind"

/**
 * The kind of the products picked (F3.2) and, for a service, whether it
 * is sold by departure (adr/0076 §2), as the product page sets them. The
 * server keeps its rules: a gift card stays digital, and the products that
 * lose dated sale are counted in the preview before anything is written.
 */
export function BulkKindFields({ form, onChange }: FieldsProps) {
  const { t } = useTranslation()
  const bookingOn = useFeature(BOOKING_FLAG)
  return (
    <>
      <Choices
        label={t(`${K}.label`)}
        value={form.kind}
        onChange={(kind) => {
          onChange({ kind })
        }}
        options={PRODUCT_KINDS.map((value) => ({
          value,
          label: t(`products.catalog.kinds.${value}`),
        }))}
      />
      {form.kind === "service" && bookingOn ? (
        <Choices
          label={t(`${K}.booking`)}
          value={form.kindBooking}
          onChange={(kindBooking) => {
            onChange({ kindBooking })
          }}
          className="sm:grid-cols-2"
          options={(["none", "departure"] as const).map((value) => ({
            value,
            label: t(`${K}.bookings.${value}`),
          }))}
        />
      ) : null}
      <p className="text-[13px] text-muted-foreground">{t(`${K}.hints.${form.kind}`)}</p>
    </>
  )
}
