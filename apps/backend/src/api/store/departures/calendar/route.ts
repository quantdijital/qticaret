import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { departureCalendar } from "../../../../workflows/booking/calendar"
import type { StoreGetDepartureCalendarType } from "./validators"

/**
 * GET /store/departures/calendar?month=YYYY-MM[&kategori=][&kisi=]
 * (adr/0077 §6), behind `catalog.booking`: each local day of the month
 * with a departure a date search would match, how many, and the lowest
 * paying price over them in lira (the card's unit). Only published
 * products in the shopper's sales channels count, in the category's shown
 * subtree when one is asked. Prices are worked out here; nothing priced
 * is read from the request. Kept a minute on the server, so a shopper's
 * cache keeps it no longer.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetDepartureCalendarType>,
  res: MedusaResponse
): Promise<void> {
  const { month, kategori, kisi } = req.validatedQuery
  const calendar = await departureCalendar(req.scope, {
    month,
    category: kategori ?? null,
    pax: kisi ?? 1,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(calendar)
}
