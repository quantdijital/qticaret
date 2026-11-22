import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import { slotBookingsQuery } from "@/features/products/api/booking"
import type { BookingSlot, SlotBooking } from "@/features/products/api/booking"
import { errorText } from "@/lib/errors"
import { formatSlotStart } from "./slot-dates"

const B = "products.booking.bookings"

const TONES = { confirmed: "success", cancelled: "danger", completed: "neutral" } as const

/**
 * A departure's bookings (adr/0076 §9): each order with its link, its
 * places and state. No person's details here: travelers come with D6.
 */
export function SlotBookingsDialog({
  slot,
  zone,
  onClose,
}: {
  slot: BookingSlot
  zone: string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const bookings = useQuery(slotBookingsQuery(slot.id))
  const rows: SlotBooking[] = bookings.data ?? []
  return (
    <DetailDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${B}.title`)}
      description={formatSlotStart(slot.starts_at, zone, i18n.language)}
      size="lg"
    >
      <DialogBody>
        {bookings.isPending ? <LoadingRows /> : null}
        {bookings.isError ? (
          <ErrorState text={errorText(t, bookings.error)} onRetry={() => void bookings.refetch()} />
        ) : null}
        {bookings.isSuccess && rows.length === 0 ? <EmptyState text={t(`${B}.empty`)} /> : null}
        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(`${B}.order`)}</TableHead>
                <TableHead className="text-right">{t(`${B}.units`)}</TableHead>
                <TableHead>{t(`${B}.status`)}</TableHead>
                <TableHead>{t(`${B}.date`)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <Link
                      to="/orders/$id"
                      params={{ id: booking.order_id }}
                      className="font-medium hover:underline"
                    >
                      {booking.display_id === null
                        ? booking.order_id
                        : `#${String(booking.display_id)}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{booking.units}</TableCell>
                  <TableCell>
                    <StatusBadge tone={TONES[booking.status]}>
                      {t(`${B}.statuses.${booking.status}`)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(booking.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </DialogBody>
    </DetailDialog>
  )
}
