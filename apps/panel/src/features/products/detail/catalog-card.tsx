import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { bookingFailureText } from "@/features/products/booking/booking-failure"
import { BookingOffConfirm } from "@/features/products/booking/booking-off-confirm"
import { CatalogFields } from "./catalog-fields"
import type { CatalogShown, CatalogValues } from "./catalog-fields"
import { PRODUCT_SECTIONS } from "./sections"
import { SideCard } from "./side-card"
import type { SideRow } from "./side-card"

const catalogValuesOf = (catalog: ProductCatalog): CatalogValues => ({
  condition: catalog.condition,
  kind: catalog.kind,
  primary_category_id: catalog.primary_category_id ?? "",
  withdrawal_excluded: catalog.withdrawal_excluded,
  restriction: catalog.restriction,
  is_gift_card: catalog.is_gift_card,
  booking: catalog.booking_mode === "departure",
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

function CatalogDialog({
  productId,
  catalog,
  shown,
  onClose,
}: {
  productId: string
  catalog: ProductCatalog
  shown: CatalogShown
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveCatalog(productId)
  // Marking it refused (the shop's gift cards off): said beside the switch, with where to turn them on
  const [giftFailure, setGiftFailure] = useState<string | null>(null)
  const form = useForm<CatalogValues>({ defaultValues: catalogValuesOf(catalog) })
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
      },
      {
        onSuccess: () => {
          toast.success(t("products.detail.saved"))
          onClose()
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
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("products.catalog.card")}
      description={t("products.catalog.hint")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
    >
      <DialogBody>
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
      </DialogBody>
    </FormDialog>
  )
}

/** What is saved, a fact to a line: the kind (when the shop sells others), condition, primary category… */
function catalogRows(t: TFunction, catalog: ProductCatalog, shown: CatalogShown): SideRow[] {
  const primary = catalog.categories.find((category) => category.id === catalog.primary_category_id)
  return [
    ...(shown.kinds
      ? [{ label: t("products.catalog.kind"), value: t(`products.catalog.kinds.${catalog.kind}`) }]
      : []),
    {
      label: t("products.catalog.condition"),
      value: t(`products.catalog.conditions.${catalog.condition}`),
    },
    {
      label: t("products.catalog.primaryCategory"),
      value: primary?.name ?? t("products.catalog.noPrimary"),
      empty: !primary,
    },
    ...(catalog.restriction
      ? [
          {
            label: t("restrictions.label"),
            value: t(`restrictions.options.${catalog.restriction}`),
          },
        ]
      : []),
    ...(catalog.is_gift_card
      ? [{ label: t("products.catalog.giftCard"), value: t("products.side.yes") }]
      : []),
    ...(catalog.booking_mode === "departure"
      ? [{ label: t("products.booking.mode.label"), value: t("products.side.yes") }]
      : []),
    {
      label: t("products.side.withdrawal"),
      value: t(
        catalog.withdrawal_excluded ? "products.side.withdrawalOut" : "products.side.withdrawalIn"
      ),
    },
  ]
}

/**
 * Condition and primary category, the fields search results and feeds read
 * (F3.1), whether the product is sold to adults only and is outside the
 * right of withdrawal (F13.4, F13.6), and whether it sells gift cards
 * (adr/0025 Ek 2026-11-03): a line each in the product page's narrow
 * column, "Düzenle" opens them in a dialog.
 */
export function CatalogCard({
  productId,
  findings,
}: {
  productId: string
  /** The advisor's findings for it, counted under its facts. */
  findings?: SectionFindings
}) {
  const { t } = useTranslation()
  const catalog = useQuery(productCatalogQuery(productId))
  const [open, setOpen] = useState(false)
  const flags = {
    kinds: useFeature("catalog.non_physical"),
    restricted: useFeature("catalog.restricted"),
    giftCards: useFeature(GIFT_CARDS_FLAG),
    booking: useFeature(BOOKING_FLAG),
  }
  if (!catalog.data) {
    return <Skeleton className="h-44 w-full rounded-lg" />
  }
  // A field shows once the shop uses it, or this product already has it set
  const shown: CatalogShown = {
    kinds: flags.kinds || catalog.data.kind !== "physical",
    restricted: flags.restricted || catalog.data.restriction !== null,
    giftCard: flags.giftCards || catalog.data.is_gift_card,
    booking: flags.booking || (catalog.data.booking_mode ?? "none") !== "none",
  }
  return (
    <SideCard
      id={PRODUCT_SECTIONS.catalog}
      title={t("products.catalog.card")}
      rows={catalogRows(t, catalog.data, shown)}
      findings={findings && findingsNote(t, findings)}
      onEdit={() => {
        setOpen(true)
      }}
    >
      {open ? (
        <CatalogDialog
          productId={productId}
          catalog={catalog.data}
          shown={shown}
          onClose={() => {
            setOpen(false)
          }}
        />
      ) : null}
    </SideCard>
  )
}
