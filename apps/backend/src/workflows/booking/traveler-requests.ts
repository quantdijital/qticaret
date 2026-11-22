import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cleanBirthDate, cleanDocument, cleanName, maskDocument } from "../../lib/booking/travelers"
import { ValidationError } from "../../lib/errors"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A traveler's own KVKK request (adr/0076 Ek D6b): a traveler is not the
 * buyer and has no account, so staff find their rows by what they give
 * (the name, and the birth date or the ID number when the product asked
 * them), hand over a copy (the number masked) and delete them on request.
 * The buyer's own request reaches the same rows through their carts
 * (`customerBookingTravelers`, the data export; `eraseCartTravelers`).
 */

// A search names one person; past this, a common name with nothing else to tell them apart
export const MOST_FOUND = 100

export interface TravelerQuery {
  first_name: string
  last_name: string
  birth_date?: string | undefined
  document_no?: string | undefined
}

/** One traveler's row as a request's copy shows it: never the sealed number nor its hash. */
export interface TravelerCopy {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_masked: string | null
  /** The departure's start and its product's title, when they are still there. */
  starts_at: string | null
  product_title: string | null
  /** Null: entered in a cart that never became an order. */
  order_id: string | null
  display_id: number | null
  created_at: string
  purge_after: string
}

interface TravelerRow {
  id: string
  slot_id: string
  booking_id: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_last4: string | null
  created_at: Date | string
  purge_after: Date | string
}

const SHOWN = [
  "id",
  "slot_id",
  "booking_id",
  "first_name",
  "last_name",
  "birth_date",
  "nationality",
  "document_last4",
  "created_at",
  "purge_after",
]

const iso = (value: Date | string): string => new Date(value).toISOString()

// The pattern's own characters taken as they are: a name is matched whole, case aside
const exactly = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`)

const refuse = (field: string): never => {
  throw new ValidationError("booking.traveler_search_invalid", { field })
}

/** The rows' departures, products and orders, to tell the person which trip each is. */
async function described(container: Container, rows: readonly TravelerRow[]) {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const slotIds = [...new Set(rows.map((row) => row.slot_id))]
  const bookingIds = [...new Set(rows.flatMap((row) => (row.booking_id ? [row.booking_id] : [])))]
  const [slots, bookings] = await Promise.all([
    slotIds.length
      ? service.listBookingSlots(
          { id: slotIds },
          { select: ["id", "starts_at", "bookable_id"], withDeleted: true }
        )
      : [],
    bookingIds.length
      ? service.listBookings({ id: bookingIds }, { select: ["id", "order_id"] })
      : [],
  ])
  const bookableIds = [...new Set(slots.map((slot) => slot.bookable_id))]
  const bookables = bookableIds.length
    ? await service.listBookables(
        { id: bookableIds },
        { select: ["id", "product_id"], withDeleted: true }
      )
    : []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productIds = [...new Set(bookables.map((bookable) => bookable.product_id))]
  const orderIds = [...new Set(bookings.map((booking) => booking.order_id))]
  const [{ data: products }, { data: orders }] = await Promise.all([
    productIds.length
      ? query.graph({ entity: "product", fields: ["id", "title"], filters: { id: productIds } })
      : { data: [] },
    orderIds.length
      ? query.graph({ entity: "order", fields: ["id", "display_id"], filters: { id: orderIds } })
      : { data: [] },
  ])
  const titleOf = new Map((products as { id: string; title: string }[]).map((p) => [p.id, p.title]))
  const productOf = new Map(bookables.map((bookable) => [bookable.id, bookable.product_id]))
  const slotOf = new Map(slots.map((slot) => [slot.id, slot]))
  const orderOf = new Map(bookings.map((booking) => [booking.id, booking.order_id]))
  const numberOf = new Map(
    (orders as { id: string; display_id: number | null }[]).map((o) => [o.id, o.display_id])
  )
  return rows.map((row): TravelerCopy => {
    const slot = slotOf.get(row.slot_id)
    const orderId = row.booking_id ? (orderOf.get(row.booking_id) ?? null) : null
    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      birth_date: row.birth_date,
      nationality: row.nationality,
      document_masked: maskDocument(row.document_last4),
      starts_at: slot ? iso(slot.starts_at) : null,
      product_title: slot ? (titleOf.get(productOf.get(slot.bookable_id) ?? "") ?? null) : null,
      order_id: orderId,
      display_id: orderId ? (numberOf.get(orderId) ?? null) : null,
      created_at: iso(row.created_at),
      purge_after: iso(row.purge_after),
    }
  })
}

/**
 * The rows that name the person asking: the first and last name matched
 * whole (case aside), and the birth date and the number when given (the
 * number by its keyed hash). 400 `booking.traveler_search_invalid` when
 * an entry is not a name, a date or a number. Newest first, at most
 * `MOST_FOUND`.
 */
export async function findBookingTravelers(
  container: Container,
  input: TravelerQuery,
  now: Date = new Date()
): Promise<TravelerCopy[]> {
  const firstName = cleanName(input.first_name) ?? refuse("first_name")
  const lastName = cleanName(input.last_name) ?? refuse("last_name")
  const birth = input.birth_date?.trim()
    ? (cleanBirthDate(input.birth_date.trim(), now) ?? refuse("birth_date"))
    : null
  const number = input.document_no?.trim()
    ? (cleanDocument(input.document_no) ?? refuse("document_no"))
    : null
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const rows = await service.listBookingTravelers(
    {
      first_name: { $ilike: exactly(firstName) },
      last_name: { $ilike: exactly(lastName) },
      ...(birth ? { birth_date: birth } : {}),
      ...(number ? { document_hash: service.travelerDocumentHash(number) } : {}),
    },
    { select: SHOWN, take: MOST_FOUND, order: { created_at: "DESC" } }
  )
  return described(container, rows)
}

/**
 * The rows a request names deleted for good (booked or not); how many
 * were there. The order keeps its lines and amounts for the books.
 */
export async function eraseBookingTravelers(container: Container, ids: readonly string[]) {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const rows = await service.listBookingTravelers({ id: [...ids] }, { select: ["id"] })
  if (rows.length > 0) {
    await service.deleteBookingTravelers(rows.map((row) => row.id))
  }
  return rows.length
}

/**
 * The travelers entered in a customer's carts, for their copy (adr/0041
 * §6): the buyer gave them, so they are theirs to see; the number masked.
 */
export async function customerBookingTravelers(container: Container, customerId: string) {
  const carts = await container
    .resolve(Modules.CART)
    .listCarts({ customer_id: customerId }, { select: ["id"] })
  if (carts.length === 0) {
    return []
  }
  const rows = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .listBookingTravelers(
      { cart_id: carts.map((cart) => cart.id) },
      { select: SHOWN, order: { created_at: "DESC" } }
    )
  return (await described(container, rows as unknown as TravelerRow[])).map((copy) => ({
    ad: copy.first_name,
    soyad: copy.last_name,
    doğum_tarihi: copy.birth_date,
    uyruk: copy.nationality,
    kimlik_ya_da_pasaport_no: copy.document_masked,
    ürün: copy.product_title,
    hizmet_tarihi: copy.starts_at,
    sipariş: copy.display_id,
    silinme_tarihi: copy.purge_after,
  }))
}
