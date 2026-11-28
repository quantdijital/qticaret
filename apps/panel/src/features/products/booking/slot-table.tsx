import { useTranslation } from "react-i18next"
import { useIsMobile } from "@qticaret/admin-ui/hooks/use-mobile"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import type { BookingSlot } from "@/features/products/api/booking"
import { SlotRowActions } from "./slot-actions"
import type { SlotActions } from "./slot-actions"
import { formatSlotStart } from "./slot-dates"
import { SLOT_TONES } from "./slot-facts"

const B = "products.booking"

interface SlotListProps {
  slots: readonly BookingSlot[]
  zone: string
  busy: boolean
  actions: SlotActions
}

/**
 * The departures, earliest first: start on the product's clock, places
 * (capacity, sold, held by live carts, free) and state; a row's actions
 * on its right. On a phone each departure is a short card instead of a
 * table row, so nothing runs out of the card.
 */
export function SlotTable(props: SlotListProps) {
  const phone = useIsMobile()
  return phone ? (
    <SlotCards {...props} />
  ) : (
    <div data-scroll-area="x" className="overflow-x-auto overflow-y-hidden rounded-md border">
      <SlotRows {...props} />
    </div>
  )
}

function SlotRows({ slots, zone, busy, actions }: SlotListProps) {
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
          <TableHead className="w-0">
            <span className="sr-only">{t(`${B}.columns.actions`)}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((slot) => {
          const start = formatSlotStart(slot.starts_at, zone, i18n.language)
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
              <TableCell className="py-1">
                <SlotRowActions slot={slot} start={start} busy={busy} actions={actions} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** A phone's departures: the start and state on top, the places under them. */
function SlotCards({ slots, zone, busy, actions }: SlotListProps) {
  const { t, i18n } = useTranslation()
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {slots.map((slot) => {
        const start = formatSlotStart(slot.starts_at, zone, i18n.language)
        const facts: [string, string | number][] = [
          ["capacity", slot.capacity],
          ["sold", slot.sold],
          ["held", slot.held],
          ["available", slot.status === "open" ? slot.available : "–"],
        ]
        return (
          <li key={slot.id} className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium">{start}</span>
              <StatusBadge tone={SLOT_TONES[slot.status]}>
                {t(`${B}.statuses.${slot.status}`)}
              </StatusBadge>
              <SlotRowActions slot={slot} start={start} busy={busy} actions={actions} />
            </div>
            <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {facts.map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <dt>{t(`${B}.columns.${key}`)}</dt>
                  <dd className="font-medium text-foreground tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        )
      })}
    </ul>
  )
}
