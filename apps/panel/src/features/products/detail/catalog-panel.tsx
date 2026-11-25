import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { useFeature } from "@/features/settings/api/features"
import { manualBadgesOn, productBadgesQuery } from "@/features/settings/api/product-badges"
import { errorText } from "@/lib/errors"
import { bookingFailureText } from "@/features/products/booking/booking-failure"
import { BookingOffConfirm } from "@/features/products/booking/booking-off-confirm"
import { CatalogFields } from "./catalog-fields"
import type { CatalogShown, CatalogValues } from "./catalog-fields"

const catalogValuesOf = (catalog: ProductCatalog): CatalogValues => ({
  condition: catalog.condition,
  kind: catalog.kind,
  primary_category_id: catalog.primary_category_id ?? "",
  withdrawal_excluded: catalog.withdrawal_excluded,
  restriction: catalog.restriction,
  is_gift_card: catalog.is_gift_card,
  booking: catalog.booking_mode === "departure",
  badge: catalog.badge ?? "",
})

/**
 * The booking mode a save sends, if it changes: `departure` once a service
 * is switched to it, `none` once it leaves (switched off, another kind, a
 * gift card), which the server needs in the same save as the kind.
 */
function bookingModeOf(
  catalog: ProductCatalog,
  values: CatalogValues
): "none" | "departure" | undefined {
  const wanted = values.booking && values.kind === "service" && !values.is_gift_card
  const dated = catalog.booking_mode === "departure"
  if (dated && !wanted) {
    return "none"
  }
  return !dated && wanted ? "departure" : undefined
}

const refused = (failure: unknown) => (failure as { status?: unknown } | null)?.status === 400

function CatalogForm({
  productId,
  catalog,
  shown,
}: {
  productId: string
  catalog: ProductCatalog
  shown: CatalogShown
}) {
  const { t } = useTranslation()
  const save = useSaveCatalog(productId)
  // Marking it refused (the shop's gift cards off): said beside the switch, with where to turn them on
  const [giftFailure, setGiftFailure] = useState<string | null>(null)
  const saved = catalogValuesOf(catalog)
  const form = useForm<CatalogValues>({
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const { dirtyFields } = form.formState
  // Leaving dated sale waits on its warning (adr/0076 Ek D2): the values asked about
  const [confirming, setConfirming] = useState<CatalogValues | null>(null)

  // Only what changed is sent; the audit log shows those fields (F3.1)
  const send = (values: CatalogValues) => {
    const bookingMode = bookingModeOf(catalog, values)
    save.mutate(
      {
        ...(dirtyFields.condition ? { condition: values.condition } : {}),
        // A gift card's kind is the server's (digital): a kind picked before marking is not sent
        ...(dirtyFields.kind && !values.is_gift_card ? { kind: values.kind } : {}),
        ...(dirtyFields.primary_category_id
          ? { primary_category_id: values.primary_category_id || null }
          : {}),
        ...(dirtyFields.withdrawal_excluded
          ? { withdrawal_excluded: values.withdrawal_excluded }
          : {}),
        ...(dirtyFields.restriction ? { restriction: values.restriction } : {}),
        ...(dirtyFields.is_gift_card ? { is_gift_card: values.is_gift_card } : {}),
        ...(bookingMode ? { booking_mode: bookingMode } : {}),
        ...(dirtyFields.badge ? { badge: values.badge.trim() || null } : {}),
      },
      {
        onSuccess: () => {
          form.reset(values, FULL_RESET)
          toast.success(t("products.detail.saved"))
        },
        onError: (failure) => {
          if (dirtyFields.is_gift_card && values.is_gift_card && refused(failure)) {
            setGiftFailure(errorText(t, failure))
          } else {
            toast.error(bookingFailureText(t, failure))
          }
        },
      }
    )
  }
  const submit = form.handleSubmit((values) => {
    if (bookingModeOf(catalog, values) === "none") {
      setConfirming(values)
    } else {
      send(values)
    }
  })

  return (
    <CardForm
      bare
      title={t("products.catalog.card")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        setGiftFailure(null)
        form.reset(saved, FULL_RESET)
      }}
    >
      <p className="text-[13px] text-muted-foreground">{t("products.catalog.hint")}</p>
      <CatalogFields
        form={form}
        catalog={catalog}
        shown={shown}
        giftFailure={giftFailure}
        onGiftChange={() => {
          setGiftFailure(null)
        }}
      />
      {confirming ? (
        <BookingOffConfirm
          productId={productId}
          onCancel={() => {
            setConfirming(null)
          }}
          onConfirm={() => {
            send(confirming)
            setConfirming(null)
          }}
        />
      ) : null}
    </CardForm>
  )
}

/**
 * The "Katalog" tab of the "Ürün verileri" card (docs/06 "Ürün sayfası"):
 * condition and primary category, the fields search results and feeds
 * read (F3.1), whether the product is sold to adults only and is outside
 * the right of withdrawal (F13.4, F13.6), and whether it sells gift cards
 * (adr/0025 Ek 2026-11-03), always as their form; its save shows once
 * something changes, the page's save bar saves it too.
 */
export function CatalogPanel({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  const flags = {
    kinds: useFeature("catalog.non_physical"),
    restricted: useFeature("catalog.restricted"),
    giftCards: useFeature(GIFT_CARDS_FLAG),
    booking: useFeature(BOOKING_FLAG),
  }
  const badges = useQuery(productBadgesQuery())
  if (!catalog.data) {
    return <Skeleton className="h-44 w-full rounded-lg" />
  }
  // A field shows once the shop uses it, or this product already has it set
  const shown: CatalogShown = {
    kinds: flags.kinds || catalog.data.kind !== "physical",
    restricted: flags.restricted || catalog.data.restriction !== null,
    giftCard: flags.giftCards || catalog.data.is_gift_card,
    booking: flags.booking || (catalog.data.booking_mode ?? "none") !== "none",
    badge: manualBadgesOn(badges.data) || !!catalog.data.badge,
  }
  return <CatalogForm productId={productId} catalog={catalog.data} shown={shown} />
}
