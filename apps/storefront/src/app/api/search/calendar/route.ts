import { isStoreApiError } from "@/lib/store-api/errors"
import { departureCalendar } from "@/lib/store-api/listings"
import { allCategories } from "@/lib/store-api/requests"
import {
  calendarAskOf,
  calendarMonthView,
  calendarQuery,
  knownCategory,
} from "@/lib/views/search-calendar"
import { monthsFrom } from "@/lib/views/search-form"
import { shopToday } from "@/lib/views/search-form-data"

// Asked with the shopper's own form values: never a page built ahead
export const dynamic = "force-dynamic"

// A guest's prices, the same for everyone; kept by the browser for the backend's minute, by no proxy
const KEPT = { "cache-control": "private, max-age=60" }
const NOT_KEPT = { "cache-control": "private, no-store" }

/**
 * `GET /api/search/calendar?month=YYYY-MM[&kategori=][&kisi=]` (adr/0077
 * §6, PR6): the search box's calendar asks for one month once it is open,
 * from the storefront's server only (adr/0046 §5: the browser never calls
 * the backend). The month must be one a search reads (this one and the
 * next eleven, in the shop's zone), the category one the shop has (its
 * kept tree); a wrong or unknown parameter is a 400 before the backend is
 * asked. The days come back with their prices
 * written; prices are only shown, a search never sends one. The shop not
 * selling dated products (the backend's 404) answers no days; its 429 is
 * passed on, any other failure is a 502 and the calendar still picks days.
 */
export async function GET(request: Request): Promise<Response> {
  const ask = calendarAskOf(new URL(request.url).searchParams, monthsFrom(shopToday()))
  if (ask === null) {
    return Response.json({ message: "search.calendar_invalid" }, { status: 400, headers: NOT_KEPT })
  }
  try {
    // A category the shop does not have is refused here, never asked of the backend (#310 D1)
    if (ask.category !== null && !knownCategory(ask, await allCategories())) {
      return Response.json(
        { message: "search.calendar_invalid" },
        { status: 400, headers: NOT_KEPT }
      )
    }
    const answer = await departureCalendar(calendarQuery(ask))
    return Response.json(calendarMonthView(ask.month, answer), { headers: KEPT })
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return Response.json({ month: ask.month, days: [] }, { headers: NOT_KEPT })
    }
    const status = isStoreApiError(error) && error.status === 429 ? 429 : 502
    return Response.json({ message: "search.calendar_failed" }, { status, headers: NOT_KEPT })
  }
}
