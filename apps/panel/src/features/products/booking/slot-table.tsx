import { Ban, Lock, LockOpen, Pencil, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import type { BookingSlot, SlotStatus } from "@/features/products/api/booking"
import { formatSlotStart } from "./slot-dates"
import { SLOT_TONES } from "./slot-facts"

const B = "products.booking"

export interface SlotActions {
  onEdit: (slot: BookingSlot) => void
  onBookings: (slot: BookingSlot) => void
  onStatus: (slot: BookingSlot, status: SlotStatus) => void
  /** Asks first: confirmed bookings stay and are refunded by hand until D7. */
  onCancel: (slot: BookingSlot) => void
}

/**
 * The departures, earliest first: start on the product's clock, places
 * (capacity, sold, held by live carts, free) and state; a row's actions
 * on its right.
 */
export function SlotTable({
  slots,
  zone,
  busy,
  actions,
}: {
  slots: readonly BookingSlot[]
  zone: string
  busy: boolean
  actions: SlotActions
}) {
  const { t, i18n } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t(`${B}.columns.start`)}</TableHead>
          <TableHead className="text-right">{t(`${B}.columns.capacity`)}</TableHead>
          <TableHead className="text-right">{t(`${B}.columns.sold`)}</TableHead>
          <TableHead className="text-right">{t(`${B}.columns.held`)}</TableHead>
          <TableHead className="text-right">{t(`${B}.columns.available`)}</TableHead>
          <TableHead>{t(`${B}.columns.status`)}</TableHead>
          <TableHead className="sr-only">{t(`${B}.columns.actions`)}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((slot) => {
          const start = formatSlotStart(slot.starts_at, zone, i18n.language)
          const label = (key: string) => t(`${B}.actions.${key}`, { start })
          return (
            <TableRow key={slot.id}>
              <TableCell className="font-medium whitespace-nowrap">{start}</TableCell>
              <TableCell className="text-right tabular-nums">{slot.capacity}</TableCell>
              <TableCell className="text-right tabular-nums">{slot.sold}</TableCell>
              <TableCell className="text-right tabular-nums">{slot.held}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {slot.status === "open" ? slot.available : "–"}
              </TableCell>
              <TableCell>
                <StatusBadge tone={SLOT_TONES[slot.status]}>
                  {t(`${B}.statuses.${slot.status}`)}
                </StatusBadge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={label("bookings")}
                    onClick={() => {
                      actions.onBookings(slot)
                    }}
                  >
                    <Users />
                    <span className="hidden lg:inline">{t(`${B}.actions.bookingsShort`)}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label("edit")}
                    disabled={busy}
                    onClick={() => {
                      actions.onEdit(slot)
                    }}
                  >
                    <Pencil />
                  </Button>
                  {slot.status === "open" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={label("close")}
                      disabled={busy}
                      onClick={() => {
                        actions.onStatus(slot, "closed")
                      }}
                    >
                      <Lock />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={label("open")}
                      disabled={busy}
                      onClick={() => {
                        actions.onStatus(slot, "open")
                      }}
                    >
                      <LockOpen />
                    </Button>
                  )}
                  {slot.status === "cancelled" ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive-text"
                      aria-label={label("cancel")}
                      disabled={busy}
                      onClick={() => {
                        actions.onCancel(slot)
                      }}
                    >
                      <Ban />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
