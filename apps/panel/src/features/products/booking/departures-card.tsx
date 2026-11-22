import { useQuery } from "@tanstack/react-query"
import { CalendarPlus, ChevronDown, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  BOOKING_FLAG,
  bookableQuery,
  slotsQuery,
  useCancelDeparture,
  useUpdateSlot,
} from "@/features/products/api/booking"
import type { BookingSlot, SlotStatus } from "@/features/products/api/booking"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { useCan } from "@/features/auth/api/staff"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { AddSlotDialog } from "./add-slot-dialog"
import { BookingSettings } from "./booking-settings"
import { bookingFailureText } from "./booking-failure"
import { RecurringDialog } from "./recurring-dialog"
import { SlotBookingsDialog } from "./slot-bookings-dialog"
import { SlotCancelConfirm } from "./slot-cancel-confirm"
import { DEFAULT_ZONE } from "./slot-dates"
import { SlotEditDialog } from "./slot-edit-dialog"
import { variantNamesOf } from "./slot-facts"
import type { VariantName } from "./slot-facts"
import { SlotTable } from "./slot-table"

const B = "products.booking"

/** Which dialog is open, and for which departure. */
type Open =
  | { kind: "add" }
  | { kind: "recurring" }
  | { kind: "edit"; slot: BookingSlot }
  | { kind: "bookings"; slot: BookingSlot }
  | { kind: "cancel"; slot: BookingSlot }
  | null

function Departures({ productId, variants }: { productId: string; variants: VariantName[] }) {
  const { t } = useTranslation()
  const bookable = useQuery(bookableQuery(productId))
  const slots = useQuery(slotsQuery(productId))
  const update = useUpdateSlot(productId)
  const cancelDeparture = useCancelDeparture(productId)
  // Cancelling gives money back: owner and admin (the server decides again)
  const mayCancel = useCan("money")
  const [open, setOpen] = useState<Open>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const zone = bookable.data?.bookable?.timezone ?? DEFAULT_ZONE
  const close = () => {
    setOpen(null)
  }
  const setStatus = (slot: BookingSlot, status: SlotStatus) => {
    update.mutate(
      { id: slot.id, changes: { status } },
      {
        onSuccess: () => {
          toast.success(t(`${B}.statusSaved.${status}`))
        },
        onError: (error) => {
          toast.error(bookingFailureText(t, error))
        },
      }
    )
  }
  const list = slots.data ?? []
  return (
    <SectionCard
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      action={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen({ kind: "add" })
            }}
          >
            <Plus />
            {t(`${B}.add.action`)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen({ kind: "recurring" })
            }}
          >
            <CalendarPlus />
            {t(`${B}.recurring.action`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {slots.isPending ? <LoadingRows /> : null}
        {slots.isError ? (
          <ErrorState text={errorText(t, slots.error)} onRetry={() => void slots.refetch()} />
        ) : null}
        {slots.isSuccess && list.length === 0 ? <EmptyState text={t(`${B}.empty`)} /> : null}
        {list.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <SlotTable
              slots={list}
              zone={zone}
              busy={update.isPending || cancelDeparture.isPending}
              actions={{
                onEdit: (slot) => {
                  setOpen({ kind: "edit", slot })
                },
                onBookings: (slot) => {
                  setOpen({ kind: "bookings", slot })
                },
                onStatus: setStatus,
                ...(mayCancel
                  ? {
                      onCancel: (slot: BookingSlot) => {
                        setOpen({ kind: "cancel", slot })
                      },
                    }
                  : {}),
              }}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-4 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((was) => !was)
            }}
          >
            <ChevronDown className={cn("transition-transform", settingsOpen && "rotate-180")} />
            {t(`${B}.settings.title`)}
          </Button>
          {settingsOpen && bookable.data ? (
            <BookingSettings
              productId={productId}
              bookable={bookable.data.bookable}
              variants={variants}
            />
          ) : null}
        </div>
      </div>
      {open?.kind === "add" ? (
        <AddSlotDialog productId={productId} zone={zone} onClose={close} />
      ) : null}
      {open?.kind === "recurring" ? (
        <RecurringDialog productId={productId} zone={zone} onClose={close} />
      ) : null}
      {open?.kind === "edit" ? (
        <SlotEditDialog
          productId={productId}
          slot={open.slot}
          zone={zone}
          variants={variants}
          onClose={close}
        />
      ) : null}
      {open?.kind === "bookings" ? (
        <SlotBookingsDialog slot={open.slot} zone={zone} onClose={close} />
      ) : null}
      {open?.kind === "cancel" ? (
        <SlotCancelConfirm
          slot={open.slot}
          zone={zone}
          onCancel={close}
          onConfirm={() => {
            cancelDeparture.mutate(open.slot.id, {
              onSuccess: () => {
                toast.success(t(`${B}.cancel.done`))
              },
              onError: (error) => {
                toast.error(bookingFailureText(t, error))
              },
            })
            close()
          }}
        />
      ) : null}
    </SectionCard>
  )
}

/**
 * "Tarihler ve kontenjan" (adr/0076 §9): a dated product's departures,
 * their places and state, adding one or a repeating series, and its
 * booking settings in a second plane. Shown only while the shop's dated
 * products are on and this product is sold by departure.
 */
export function DeparturesCard({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  const flagOn = useFeature(BOOKING_FLAG)
  if (!flagOn || catalog.data?.booking_mode !== "departure") {
    return null
  }
  return <Departures productId={productId} variants={variantNamesOf(catalog.data.variants)} />
}
