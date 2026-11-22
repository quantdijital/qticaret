import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from ".."
import { calendarStatement } from "../calendar"
import type BookingModuleService from "../service"

jest.setTimeout(120 * 1000)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// The month after next, in UTC: far enough that no departure in it has closed
function monthAhead(): { month: string; firstUtc: number; nextUtc: number } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const index = now.getUTCMonth() + 2
  const first = Date.UTC(year, index, 1)
  const label = new Date(first).toISOString().slice(0, 7)
  return { month: label, firstUtc: first, nextUtc: Date.UTC(year, index + 1, 1) }
}

const day = (time: number) => new Date(time).toISOString().slice(0, 10)

/** adr/0077 §6: a month's departures by local day, read in one statement. */
moduleIntegrationTestRunner<BookingModuleService>({
  moduleName: BOOKING_MODULE,
  resolve: "./src/modules/booking",
  testSuite: ({ service, MikroOrmWrapper }) => {
    let seq = 0
    const bookable = async (over: Record<string, unknown> = {}) => {
      seq += 1
      const created = await service.createBookables({
        product_id: `prod_c${String(Date.now())}_${String(seq)}`,
        ...over,
      })
      return created.id
    }
    const slotAt = async (
      bookableId: string,
      startsAt: number,
      capacity = 10,
      priceAdjustments: Record<string, number> | null = null
    ) => {
      const [id] = await service.createSlots([
        {
          bookable_id: bookableId,
          starts_at: new Date(startsAt),
          capacity,
          price_adjustments: priceAdjustments,
        },
      ])
      return id ?? ""
    }
    const sql = (text: string, params: unknown[] = []) =>
      MikroOrmWrapper.forkManager().execute(text, params)
    const rowsOf = (ids: string[], month: string, pax = 1) =>
      service.calendarRows(ids, { month, pax, now: new Date() })

    it("groups a bookable's departures by local day with their distinct differences", async () => {
      const { month, firstUtc } = monthAhead()
      const tour = await bookable({ timezone: "Europe/Istanbul" })
      // Two on the 5th (09:00 and 15:00 local), one with a difference; one on the 6th
      await slotAt(tour, firstUtc + 4 * DAY + 6 * HOUR, 10, { var_a: -5000 })
      await slotAt(tour, firstUtc + 4 * DAY + 12 * HOUR)
      await slotAt(tour, firstUtc + 5 * DAY + 6 * HOUR)

      const rows = await rowsOf([tour], month)
      expect(rows.map((row) => [row.day, row.departures])).toEqual([
        [day(firstUtc + 4 * DAY), 2],
        [day(firstUtc + 5 * DAY), 1],
      ])
      expect(rows[0]?.adjustments).toEqual(expect.arrayContaining([null, { var_a: -5000 }]))
      expect(rows[0]?.adjustments).toHaveLength(2)
      expect(rows[1]?.adjustments).toEqual([null])
    })

    it("reads the month and its days in the product's zone", async () => {
      const { month, firstUtc, nextUtc } = monthAhead()
      const istanbul = await bookable({ timezone: "Europe/Istanbul" })
      // 22:30 UTC the day before is 01:30 on the 1st in Istanbul (UTC+3)...
      await slotAt(istanbul, firstUtc - 90 * 60 * 1000)
      // ...and on the month's last day it is already the next month there
      await slotAt(istanbul, nextUtc - 90 * 60 * 1000)
      const london = await bookable({ timezone: "Europe/London" })
      await slotAt(london, firstUtc - 90 * 60 * 1000)
      await slotAt(london, nextUtc - 90 * 60 * 1000)

      const rows = await rowsOf([istanbul, london], month)
      expect(rows.filter((row) => row.bookable_id === istanbul).map((row) => row.day)).toEqual([
        day(firstUtc),
      ])
      // London keeps UTC's day then (winter or summer, 22:30 UTC is that day there)
      expect(rows.filter((row) => row.bookable_id === london).map((row) => row.day)).toEqual([
        day(nextUtc - DAY),
      ])
    })

    it("leaves out departures without room for the party after live holds", async () => {
      const { month, firstUtc } = monthAhead()
      const tour = await bookable()
      const id = await slotAt(tour, firstUtc + 10 * DAY, 5)
      await sql(`UPDATE booking_slot SET sold = 1 WHERE id = ?`, [id])
      await service.holdUnits("cart_calendar", [{ slotId: id, units: 2 }], 20)

      expect(await rowsOf([tour], month, 2)).toHaveLength(1)
      expect(await rowsOf([tour], month, 3)).toHaveLength(0)
      // An expired hold the sweep has not reached blocks nothing
      await sql(
        `UPDATE booking_hold SET expires_at = now() - interval '1 minute' WHERE cart_id = 'cart_calendar'`
      )
      expect(await rowsOf([tour], month, 4)).toHaveLength(1)
    })

    it("leaves out closed departures, those whose sales have closed and other bookables", async () => {
      const { month, firstUtc } = monthAhead()
      // Sales close 120 days before: every departure of the month after next is past it
      const late = await bookable({ cutoff_hours: 120 * 24 })
      await slotAt(late, firstUtc + 10 * DAY)
      const closed = await bookable()
      const closedSlot = await slotAt(closed, firstUtc + 10 * DAY)
      await sql(`UPDATE booking_slot SET status = 'closed' WHERE id = ?`, [closedSlot])
      const other = await bookable()
      await slotAt(other, firstUtc + 10 * DAY)

      expect(await rowsOf([late, closed], month)).toEqual([])
      expect(await rowsOf([], month)).toEqual([])
    })

    it("refuses a month no search holds as a validation error", async () => {
      const tour = await bookable()
      await expect(rowsOf([tour], "2026-13")).rejects.toMatchObject({
        safeMessage: "booking.dates_invalid",
      })
    })

    it("binds every value: no id or month in the statement's text", () => {
      const { month } = monthAhead()
      const { sql: text, params } = calendarStatement(["bk_'; DROP TABLE x; --"], {
        month,
        pax: 2,
        now: new Date(),
      })
      expect(text).not.toContain("DROP")
      expect(text).not.toContain(month)
      expect(text).toContain("GROUP BY 1, 2")
      expect(text.split("?").length - 1).toBe(params.length)
    })
  },
})
