import type { MedusaContainer } from "@medusajs/framework/types"
import bookingHoldExpiry, { config } from "../booking-hold-expiry"
import { SWEEP_BATCH } from "../../modules/booking/sql"

function containerWith(counts: number[]) {
  const releaseExpiredHolds = jest.fn(() => Promise.resolve(counts.shift() ?? 0))
  const container = { resolve: () => ({ releaseExpiredHolds }) } as unknown as MedusaContainer
  return { container, releaseExpiredHolds }
}

describe("booking-hold-expiry job", () => {
  it("runs every minute", () => {
    expect(config).toEqual({ name: "booking-hold-expiry", schedule: "* * * * *" })
  })

  it("sweeps batch after batch while they come back full", async () => {
    const { container, releaseExpiredHolds } = containerWith([SWEEP_BATCH, SWEEP_BATCH, 3])

    await bookingHoldExpiry(container)

    expect(releaseExpiredHolds).toHaveBeenCalledTimes(3)
  })

  it("stops after one read when nothing expired", async () => {
    const { container, releaseExpiredHolds } = containerWith([0])

    await bookingHoldExpiry(container)

    expect(releaseExpiredHolds).toHaveBeenCalledTimes(1)
  })

  it("leaves a backlog past its batches to the next minute", async () => {
    const { container, releaseExpiredHolds } = containerWith(
      Array.from({ length: 30 }, () => SWEEP_BATCH)
    )

    await bookingHoldExpiry(container)

    expect(releaseExpiredHolds).toHaveBeenCalledTimes(20)
  })
})
