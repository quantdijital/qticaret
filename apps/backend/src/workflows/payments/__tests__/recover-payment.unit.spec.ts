import { asValue } from "@medusajs/framework/awilix"
import {
  ContainerRegistrationKeys,
  Modules,
  createMedusaContainer,
} from "@medusajs/framework/utils"
import type * as WorkflowsSdk from "@medusajs/framework/workflows-sdk"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import { PAYMENT_RECOVERY_MODULE } from "../../../modules/payment-recovery"
import { refundRecovery } from "../recover-payment"

// The lock around a recovery is Medusa's; the providers' refunds are watched, never made
jest.mock("@medusajs/medusa/core-flows", () => {
  const sdk = jest.requireActual<typeof WorkflowsSdk>("@medusajs/framework/workflows-sdk")
  const noop = (name: string) => sdk.createStep(name, () => new sdk.StepResponse(undefined))
  return {
    acquireLockStep: noop("test-acquire-lock"),
    releaseLockStep: noop("test-release-lock"),
  }
})
const recoverPaytrPayment = jest.fn<Promise<string>, unknown[]>()
jest.mock("../recover-paytr", () => ({
  recoverPaytrPayment: (...args: unknown[]) => recoverPaytrPayment(...args),
}))
const recoverIyzicoPayment = jest.fn<Promise<string>, unknown[]>()
jest.mock("../recover-iyzico", () => ({
  recoverIyzicoPayment: (...args: unknown[]) => recoverIyzicoPayment(...args),
}))

const MERCHANT_OID = "payses01JABCDEFGHJKMNPQRSTVWXYZ0"
const SESSION = "payses_01JABCDEFGHJKMNPQRSTVWXYZ0"

const row = (fields: Record<string, unknown> = {}) => ({
  id: "precov_01",
  provider: "paytr",
  reference: MERCHANT_OID,
  refund_reference: `R${MERCHANT_OID}`,
  amount: 21000,
  currency_code: "try",
  test_mode: true,
  reason: "completion_failed",
  status: "pending",
  attempts: 0,
  error_code: null,
  cart_id: "cart_01",
  ...fields,
})

const cartOrdered = (session: string, reference: string) => ({
  completed_at: "2026-11-16T10:00:00Z",
  order: { id: "order_01" },
  payment_collection: {
    payments: [{ payment_session_id: session, data: { merchant_oid: reference } }],
  },
})

interface Reads {
  cart?: unknown
  payments?: unknown[]
  fail?: boolean
}

function containerWith(recovery: ReturnType<typeof row>, reads: Reads) {
  const service = {
    retrievePaymentRecovery: jest.fn().mockResolvedValue(recovery),
    markOrderExists: jest.fn().mockResolvedValue(undefined),
    markAttempt: jest.fn().mockResolvedValue("pending"),
    markRefunded: jest.fn().mockResolvedValue(undefined),
  }
  const graph = jest.fn((query: { entity: string }) => {
    if (reads.fail) {
      return Promise.reject(new Error("connection reset"))
    }
    return Promise.resolve({
      data: query.entity === "cart" ? (reads.cart ? [reads.cart] : []) : (reads.payments ?? []),
    })
  })
  const createNotifications = jest.fn().mockResolvedValue([])
  const record = jest.fn().mockResolvedValue(undefined)
  const container = createMedusaContainer()
  container.register({
    [PAYMENT_RECOVERY_MODULE]: asValue(service),
    [ContainerRegistrationKeys.QUERY]: asValue({ graph }),
    [Modules.NOTIFICATION]: asValue({ createNotifications }),
    [AUDIT_LOG_MODULE]: asValue({ record }),
  })
  return { container, service, createNotifications, record }
}

beforeEach(() => {
  jest.resetAllMocks()
  recoverPaytrPayment.mockResolvedValue("refunded")
  recoverIyzicoPayment.mockResolvedValue("refunded")
})

describe("refundRecovery never refunds a placed order's payment (finding 2026-11-16)", () => {
  it("stops an orphan whose cart is an order: out of the queue, the shop told, ids only", async () => {
    const { container, service, createNotifications, record } = containerWith(row(), {
      cart: cartOrdered(SESSION, MERCHANT_OID),
    })

    const outcome = await refundRecovery(container, "precov_01")

    expect(outcome).toBe("order_exists")
    expect(recoverPaytrPayment).not.toHaveBeenCalled()
    expect(service.markOrderExists).toHaveBeenCalledWith("precov_01")
    expect(service.markAttempt).not.toHaveBeenCalled()
    const alert = (createNotifications.mock.calls as unknown[][])[0]?.[0] as {
      trigger_type: string
      data: Record<string, unknown>
    }
    expect(alert.trigger_type).toBe("payments.orphan_order_exists")
    expect(alert.data).toMatchObject({ order_id: "order_01", reference: MERCHANT_OID })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payments.orphan_refund_stopped",
        resource_id: "precov_01",
      })
    )
  })

  it("stops an iyzico orphan the same way, before any cancel or refund", async () => {
    const { container } = containerWith(row({ provider: "iyzico", reference: "27000001" }), {
      cart: cartOrdered("payses_01JIYZICO0000000000000000", "x"),
    })

    expect(await refundRecovery(container, "precov_01")).toBe("order_exists")
    expect(recoverIyzicoPayment).not.toHaveBeenCalled()
  })

  it("finds the order by PayTR's session when the orphan names no cart", async () => {
    const { container, service } = containerWith(row({ reason: "session_gone", cart_id: null }), {
      payments: [{ payment_collection: { order: { id: "order_09" } } }],
    })

    expect(await refundRecovery(container, "precov_01")).toBe("order_exists")
    expect(service.markOrderExists).toHaveBeenCalledWith("precov_01")
    expect(recoverPaytrPayment).not.toHaveBeenCalled()
  })

  it("refunds nothing this run when the order cannot be read (fail closed)", async () => {
    const { container, service } = containerWith(row(), { fail: true })

    expect(await refundRecovery(container, "precov_01")).toBe("pending")
    expect(recoverPaytrPayment).not.toHaveBeenCalled()
    expect(service.markAttempt).not.toHaveBeenCalled()
    expect(service.markOrderExists).not.toHaveBeenCalled()
  })

  it("still gives back a payment beside an order another payment placed", async () => {
    const { container } = containerWith(row({ reason: "amount_mismatch" }), {
      cart: cartOrdered("payses_01JOTHER00000000000000000", "payses01JOTHER00000000000000000"),
      payments: [],
    })

    expect(await refundRecovery(container, "precov_01")).toBe("refunded")
    expect(recoverPaytrPayment).toHaveBeenCalledTimes(1)
  })

  it("gives back a payment that became no order, as before", async () => {
    const { container } = containerWith(row(), { cart: { completed_at: null, order: null } })

    expect(await refundRecovery(container, "precov_01")).toBe("refunded")
    expect(recoverPaytrPayment).toHaveBeenCalledTimes(1)
  })

  it("skips a row no longer pending", async () => {
    const { container } = containerWith(row({ status: "order_exists" }), {})

    expect(await refundRecovery(container, "precov_01")).toBe("skipped")
    expect(recoverPaytrPayment).not.toHaveBeenCalled()
  })
})
