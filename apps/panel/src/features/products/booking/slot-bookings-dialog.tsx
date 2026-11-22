import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Printer } from "lucide-react"
import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { Button } from "@qticaret/admin-ui/ui/button"
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
import { openTravelerPrint } from "./traveler-print-link"
import { SlotTravelers } from "./slot-travelers"

const B = "products.booking.bookings"

const TONES = { confirmed: "success", cancelled: "danger", completed: "neutral" } as const

/**
 * A departure's bookings (adr/0076 §9): each order with its link, its
 * places and state, and under it its travelers on this departure (D6b:
 * name, birth date, nationality, the number masked). The list prints on
 * its own page; it is not exported (that is a permission of its own).
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
  // An older backend gives no travelers: nothing under the rows, nothing to print
  const withTravelers = rows.some((booking) => booking.travelers !== undefined)
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
      headerAction={
        withTravelers ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              openTravelerPrint(slot.id, zone, slot.starts_at)
            }}
          >
            <Printer />
            {t(`${B}.print`)}
          </Button>
        ) : undefined
      }
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
                <Fragment key={booking.id}>
                  <TableRow className={booking.travelers ? "border-b-0" : undefined}>
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
                  {booking.travelers ? (
                    <TableRow>
                      <TableCell colSpan={4} className="pt-0 pl-6">
                        <SlotTravelers travelers={booking.travelers} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </DialogBody>
    </DetailDialog>
  )
}
