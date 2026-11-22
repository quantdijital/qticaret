import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from ".."
import { matchesStatement } from "../matches"
import type { DepartureQuery } from "../matches"
import type BookingModuleService from "../service"

jest.setTimeout(120 * 1000)

const HOUR = 60 * 60 * 1000

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

/** adr/0077 §3: a date search's departures, read in SQL. */
moduleIntegrationTestRunner<BookingModuleService>({
  moduleName: BOOKING_MODULE,
  resolve: "./src/modules/booking",
  testSuite: ({ service, MikroOrmWrapper }) => {
    let seq = 0
    const bookable = async (over: Record<string, unknown> = {}) => {
      seq += 1
      const product_id = `prod_m${String(Date.now())}_${String(seq)}`
      const created = await service.createBookables({ product_id, ...over })
      return { id: created.id, product_id }
    }
    const slotAt = async (bookableId: string, startsAt: Date, capacity = 10) => {
      const [id] = await service.createSlots([
        { bookable_id: bookableId, starts_at: startsAt, capacity },
      ])
      return id ?? ""
    }
    const sql = (text: string, params: unknown[] = []) =>
      MikroOrmWrapper.forkManager().execute(text, params)
    const matched = async (query: Omit<DepartureQuery, "now">) =>
      (await service.departureMatches({ ...query, now: new Date() })).map((m) => m.product_id)

    it("counts sold places and live holds, not expired ones", async () => {
      const { firstUtc } = monthAhead()
      const tour = await bookable()
      const id = await slotAt(tour.id, new Date(firstUtc + 10 * 24 * HOUR), 5)
      await sql(`UPDATE booking_slot SET sold = 1 WHERE id = ?`, [id])
      await service.holdUnits("cart_live", [{ slotId: id, units: 2 }], 20)
      const dates = { ranges: [{ from: day(firstUtc), to: day(firstUtc + 20 * 24 * HOUR) }] }

      const [match] = await service.departureMatches({ dates, pax: 2, now: new Date() })
      expect(match).toMatchObject({ product_id: tour.product_id, slot_id: id, left: 2 })
      expect(await matched({ dates, pax: 3 })).not.toContain(tour.product_id)

      // An expired hold the sweep has not reached blocks nothing
      await sql(
        `UPDATE booking_hold SET expires_at = now() - interval '1 minute' WHERE cart_id = 'cart_live'`
      )
      expect(await matched({ dates, pax: 4 })).toContain(tour.product_id)
    })

    it("leaves out closed departures and those whose sales have closed", async () => {
      const soon = await bookable({ cutoff_hours: 48 })
      await slotAt(soon.id, new Date(Date.now() + 24 * HOUR))
      const closed = await bookable()
      const closedSlot = await slotAt(closed.id, new Date(Date.now() + 72 * HOUR))
      await sql(`UPDATE booking_slot SET status = 'closed' WHERE id = ?`, [closedSlot])
      const open = await bookable({ cutoff_hours: 1 })
      await slotAt(open.id, new Date(Date.now() + 24 * HOUR))
      const dates = {
        ranges: [{ from: day(Date.now()), to: day(Date.now() + 5 * 24 * HOUR) }],
      }

      const found = await matched({ dates, pax: 1 })
      expect(found).toContain(open.product_id)
      expect(found).not.toContain(soon.product_id)
      expect(found).not.toContain(closed.product_id)
    })

    it("reads a month in the product's zone and gives each product its first departure", async () => {
      const { month, firstUtc, nextUtc } = monthAhead()
      const istanbul = await bookable({ timezone: "Europe/Istanbul" })
      // 22:30 UTC the day before is 01:30 on the 1st in Istanbul (UTC+3)
      const inside = await slotAt(istanbul.id, new Date(firstUtc - 90 * 60 * 1000))
      await slotAt(istanbul.id, new Date(firstUtc + 5 * 24 * HOUR))
      // ...and on the month's last day it is already the next month there
      const after = await bookable({ timezone: "Europe/Istanbul" })
      await slotAt(after.id, new Date(nextUtc - 90 * 60 * 1000))
      const london = await bookable({ timezone: "Europe/London" })
      await slotAt(london.id, new Date(firstUtc - 90 * 60 * 1000))

      const matches = await service.departureMatches({
        dates: { months: [month] },
        pax: 1,
        now: new Date(),
      })
      const ids = matches.map((match) => match.product_id)
      expect(ids).toContain(istanbul.product_id)
      expect(ids).not.toContain(after.product_id)
      expect(ids).not.toContain(london.product_id)
      expect(matches.find((match) => match.product_id === istanbul.product_id)?.slot_id).toBe(
        inside
      )
      // The earliest first
      const starts = matches.map((match) => match.starts_at.getTime())
      expect([...starts].sort((a, b) => a - b)).toEqual(starts)
    })

    it("prices a page of cards over the dates: only matching departures, by start", async () => {
      const { firstUtc } = monthAhead()
      const tour = await bookable()
      const full = await slotAt(tour.id, new Date(firstUtc + 2 * 24 * HOUR), 1)
      await sql(`UPDATE booking_slot SET sold = 1 WHERE id = ?`, [full])
      const second = await slotAt(tour.id, new Date(firstUtc + 4 * 24 * HOUR))
      const third = await slotAt(tour.id, new Date(firstUtc + 3 * 24 * HOUR))
      await slotAt(tour.id, new Date(firstUtc + 40 * 24 * HOUR))
      const dates = { ranges: [{ from: day(firstUtc), to: day(firstUtc + 10 * 24 * HOUR) }] }

      const slots = await service.windowSlots([tour.id], { dates, pax: 1, now: new Date() }, 10)
      expect(slots.map((slot) => slot.id)).toEqual([third, second])
      expect(slots[0]?.available).toBe(10)
    })

    it("finds the departures through the partial index on their start", async () => {
      const { month } = monthAhead()
      const { sql: text, params } = matchesStatement({
        dates: { months: [month] },
        pax: 2,
        now: new Date(),
      })
      const plan = await MikroOrmWrapper.forkManager().transactional(async (em) => {
        // A handful of test rows reads cheaper whole: ask for the plan an index allows
        await em.execute("SET LOCAL enable_seqscan = off")
        return em.execute<{ "QUERY PLAN": string }[]>(`EXPLAIN ${text}`, params)
      })
      const lines = plan.map((row) => row["QUERY PLAN"]).join("\n")
      expect(lines).toContain("IDX_booking_slot_open_starts_at")
    })
  },
})
