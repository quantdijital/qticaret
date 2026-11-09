import { Modules } from "@medusajs/framework/utils"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { alertPaymentIssue } from "../issue-alert"
import { refundedKurus } from "../steps/paytr-payment-check"

const containerWith = (createNotifications: jest.Mock) => ({
  resolve: (key: string): unknown => {
    if (key === Modules.NOTIFICATION) {
      return { createNotifications }
    }
    if (key === PLATFORM_SETTINGS_MODULE) {
      // Order e-mails off: only the bell rings
      return {
        getSection: () => Promise.resolve({ alert_new_order: false, staff_emails: [] }),
      }
    }
    throw new Error(`unexpected ${key}`)
  },
})

describe("alertPaymentIssue (security review 2026-11-09)", () => {
  it("rings the bell once per issue and reference, worded for the shop", async () => {
    const createNotifications = jest.fn().mockResolvedValue([])

    await alertPaymentIssue(containerWith(createNotifications), {
      issue: "completion_stuck",
      provider: "paytr",
      reference: "payses01ABC",
      cart_id: "cart_01XYZ",
      amount: 21000,
    })

    expect(createNotifications).toHaveBeenCalledTimes(1)
    const sent = (createNotifications.mock.calls as unknown[][])[0]?.[0] as {
      data: Record<string, unknown>
    } & Record<string, unknown>
    expect(sent).toMatchObject({
      channel: "feed",
      trigger_type: "payments.completion_stuck",
      resource_id: "cart_01XYZ",
      idempotency_key: "payments.completion_stuck:payses01ABC",
    })
    expect(sent.data).toMatchObject({
      kind: "payment_issue",
      issue: "completion_stuck",
      reference: "payses01ABC",
      cart_id: "cart_01XYZ",
      title: "PayTR ödemesi siparişe dönüşemiyor",
    })
    expect(sent.data["description"]).toContain("210,00 TRY (payses01ABC, sepet cart_01XYZ)")
  })

  it("never fails what raised it when the bell cannot ring", async () => {
    const createNotifications = jest.fn().mockRejectedValue(new Error("feed down"))

    await expect(
      alertPaymentIssue(containerWith(createNotifications), {
        issue: "refunded_before_order",
        provider: "paytr",
        reference: "payses01DEF",
        cart_id: null,
      })
    ).resolves.toBeUndefined()
  })
})

describe("refundedKurus", () => {
  it("sums what PayTR shows given back, whoever gave it", () => {
    expect(refundedKurus([])).toBe(0)
    expect(refundedKurus([{ amount: 5000 }, { amount: 16000 }])).toBe(21000)
    expect(refundedKurus([{ amount: -3 }, { amount: Number.NaN }])).toBe(0)
  })
})
