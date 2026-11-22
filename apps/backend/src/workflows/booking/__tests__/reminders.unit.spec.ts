import type { MedusaContainer } from "@medusajs/framework/types"
import { REMINDER_BATCH, sendDueReminders } from "../reminders"

jest.mock("../../messaging/send-message", () => ({ sendMessageWorkflow: jest.fn() }))

function containerWith(due: string[]) {
  const marked: string[] = []
  const service = {
    dueReminders: jest.fn(() => Promise.resolve(due)),
    markReminded: jest.fn((id: string) => {
      marked.push(id)
      return Promise.resolve(true)
    }),
  }
  const container = { resolve: () => service } as unknown as MedusaContainer
  return { container, service, marked }
}

describe("departure reminders (adr/0076 Ek D7b)", () => {
  const now = new Date("2027-05-10T08:00:00.000Z")

  it("asks for the due departures, a batch at most, at the run's time", async () => {
    const { container, service } = containerWith([])
    await sendDueReminders(container, now, () => Promise.resolve({}))
    expect(service.dueReminders.mock.calls).toEqual([[now, REMINDER_BATCH]])
  })

  it("marks a departure once its message went or was held for good", async () => {
    const { container, marked } = containerWith(["bkuse_1", "bkuse_2", "bkuse_3"])
    const outcomes: Record<string, Record<string, string>> = {
      bkuse_1: { email: "sent" },
      // the shop turned the reminder off, or the order has no address: done all the same
      bkuse_2: { email: "template_off" },
      bkuse_3: {},
    }
    const run = await sendDueReminders(container, now, (id) => Promise.resolve(outcomes[id] ?? {}))
    expect(marked).toEqual(["bkuse_1", "bkuse_2", "bkuse_3"])
    expect(run).toEqual({ sent: 3, failed: 0 })
  })

  it("leaves a provider failure and a thrown send unmarked, for the next run", async () => {
    const { container, marked } = containerWith(["bkuse_1", "bkuse_2", "bkuse_3"])
    const run = await sendDueReminders(container, now, (id) => {
      if (id === "bkuse_2") {
        return Promise.reject(new Error("down"))
      }
      return Promise.resolve(id === "bkuse_1" ? { email: "failed" } : { email: "duplicate" })
    })
    expect(marked).toEqual(["bkuse_3"])
    expect(run).toEqual({ sent: 1, failed: 2 })
  })
})
