import { Ban, Ellipsis, Lock, LockOpen, Pencil, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import type { BookingSlot, SlotStatus } from "@/features/products/api/booking"

const B = "products.booking"

export interface SlotActions {
  onEdit: (slot: BookingSlot) => void
  onBookings: (slot: BookingSlot) => void
  onStatus: (slot: BookingSlot, status: SlotStatus) => void
  /**
   * Asks first with what it touches and gives back (adr/0076 Ek D7a);
   * absent: not offered (money goes back: owner and admin).
   */
  onCancel?: (slot: BookingSlot) => void
}

/**
 * A departure's actions at the end of its row, in two buttons so they
 * fit a narrow card (the owner, 2026-11-28): its travelers, the one used
 * most, and a "⋯" menu with edit, close or open, and cancel.
 */
export function SlotRowActions({
  slot,
  start,
  busy,
  actions,
}: {
  slot: BookingSlot
  /** The departure's start as the row shows it: its buttons are named by it. */
  start: string
  busy: boolean
  actions: SlotActions
}) {
  const { t } = useTranslation()
  const label = (key: string) => t(`${B}.actions.${key}`, { start })
  const cancellable = slot.status !== "cancelled" && actions.onCancel !== undefined
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label("bookings")}
        title={t(`${B}.actions.bookingsShort`)}
        onClick={() => {
          actions.onBookings(slot)
        }}
      >
        <Users />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label("more")}
            disabled={busy}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              actions.onEdit(slot)
            }}
          >
            <Pencil />
            {t(`${B}.actions.editShort`)}
          </DropdownMenuItem>
          {slot.status === "open" ? (
            <DropdownMenuItem
              onSelect={() => {
                actions.onStatus(slot, "closed")
              }}
            >
              <Lock />
              {t(`${B}.actions.closeShort`)}
            </DropdownMenuItem>
          ) : slot.status === "cancelled" ? null : (
            // A cancelled departure is not opened again (the server refuses it)
            <DropdownMenuItem
              onSelect={() => {
                actions.onStatus(slot, "open")
              }}
            >
              <LockOpen />
              {t(`${B}.actions.openShort`)}
            </DropdownMenuItem>
          )}
          {cancellable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  actions.onCancel?.(slot)
                }}
              >
                <Ban />
                {t(`${B}.actions.cancelShort`)}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
