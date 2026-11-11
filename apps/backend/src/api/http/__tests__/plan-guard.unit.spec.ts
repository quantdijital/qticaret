import type { MedusaRequest } from "@medusajs/framework/http"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { DEFAULT_PLAN_STATE } from "../../../modules/control-plane/types"
import { forDashboard } from "../dashboard-messages"
import { guardPlanStatus, refuseSellingEdit, refuseSuspendedCheckout } from "../plan-guard"
import { fakeResponse } from "./fakes"

function request(
  method: string,
  path: string,
  plan: { managed: boolean; status: TenantStatus },
  body: Record<string, unknown> = {}
) {
  const state = { ...DEFAULT_PLAN_STATE(plan.managed), status: plan.status }
  return {
    method,
    path,
    originalUrl: path,
    headers: {},
    body,
    query: {},
    scope: { resolve: () => ({ planState: () => Promise.resolve(state) }) },
  } as unknown as MedusaRequest
}

async function run(
  middleware: typeof guardPlanStatus,
  req: MedusaRequest
): Promise<{ passed: boolean; status: number; body: unknown; retryAfter?: string }> {
  const answer = fakeResponse()
  let passed = false
  await middleware(req, answer.res, () => {
    passed = true
  })
  return {
    passed,
    status: answer.status(),
    body: answer.body(),
    ...(answer.headers["retry-after"] ? { retryAfter: answer.headers["retry-after"] } : {}),
  }
}

const RESTRICTED = { managed: true, status: "restricted" as const }
const SUSPENDED = { managed: true, status: "suspended" as const }

describe("guardPlanStatus", () => {
  it("refuses a closed write with 403 plan.restricted and the status", async () => {
    for (const plan of [RESTRICTED, SUSPENDED]) {
      const answer = await run(guardPlanStatus, request("POST", "/admin/products", plan))
      expect(answer.passed).toBe(false)
      expect(answer.status).toBe(403)
      expect(answer.body).toMatchObject({
        type: "not_allowed",
        message: "plan.restricted",
        status: plan.status,
      })
    }
  })

  it("lets reads and the allow-list through", async () => {
    for (const [method, path] of [
      ["GET", "/admin/plan"],
      ["GET", "/admin/products"],
      ["POST", "/admin/orders/order_1/cancel"],
      ["POST", "/admin/staff/me/profile"],
    ] as const) {
      expect((await run(guardPlanStatus, request(method, path, RESTRICTED))).passed).toBe(true)
    }
  })

  it("starts an export, not an import", async () => {
    const job = (type: string) => request("POST", "/admin/async-jobs", SUSPENDED, { type })
    expect((await run(guardPlanStatus, job("order.export"))).passed).toBe(true)
    expect((await run(guardPlanStatus, job("catalog.import"))).status).toBe(403)
  })

  it("never blocks an active or an unmanaged shop", async () => {
    for (const plan of [
      { managed: true, status: "active" as const },
      { managed: false, status: "suspended" as const },
    ]) {
      expect((await run(guardPlanStatus, request("POST", "/admin/products", plan))).passed).toBe(
        true
      )
    }
  })

  it("tells the panel's session why, in words", () => {
    const session = {
      originalUrl: "/admin/products",
      headers: {},
      session: { auth_context: { actor_id: "user_1" } },
    } as unknown as MedusaRequest
    const restricted = forDashboard(session, {
      message: "plan.restricted",
      status: "restricted",
    })
    expect(restricted.code).toBe("plan.restricted")
    expect(restricted.message).toMatch(/^Abonelik ödemesi geciktiği için.*Ayarlar > Abonelik/)
    const suspended = forDashboard(session, { message: "plan.restricted", status: "suspended" })
    expect(suspended.message).toMatch(/^Mağazanız platform tarafından askıya alındı/)
  })
})

describe("refuseSellingEdit (review L1)", () => {
  const edit = (
    plan: { managed: boolean; status: TenantStatus },
    body: Record<string, unknown>
  ) => {
    const req = request("POST", "/admin/orders/order_1/edit", plan)
    ;(req as { validatedBody?: unknown }).validatedBody = { items: [], add: [], ...body }
    return run(refuseSellingEdit, req)
  }

  it("refuses new lines or a difference owed while restricted or suspended", async () => {
    for (const plan of [RESTRICTED, SUSPENDED]) {
      for (const body of [
        { add: [{ variant_id: "variant_1", quantity: 1 }], expected_difference: 0 },
        { expected_difference: 30 },
      ]) {
        const answer = await edit(plan, body)
        expect(answer.status).toBe(403)
        expect(answer.body).toMatchObject({ message: "plan.restricted", status: plan.status })
      }
    }
  })

  it("lets corrections down through, and any edit of an open shop", async () => {
    expect((await edit(RESTRICTED, { expected_difference: -20 })).passed).toBe(true)
    expect((await edit(RESTRICTED, { expected_difference: 0 })).passed).toBe(true)
    const open = { managed: true, status: "active" as const }
    expect((await edit(open, { expected_difference: 30 })).passed).toBe(true)
  })
})

describe("refuseSuspendedCheckout", () => {
  const complete = (plan: { managed: boolean; status: TenantStatus }) =>
    request("POST", "/store/carts/cart_1/complete", plan)

  it("answers 503 plan.suspended with Retry-After while suspended", async () => {
    const answer = await run(refuseSuspendedCheckout, complete(SUSPENDED))
    expect(answer).toMatchObject({
      passed: false,
      status: 503,
      body: { type: "unavailable", message: "plan.suspended" },
      retryAfter: "3600",
    })
  })

  it("sells as usual while restricted, active or unmanaged", async () => {
    for (const plan of [
      RESTRICTED,
      { managed: true, status: "active" as const },
      { managed: false, status: "suspended" as const },
    ]) {
      expect((await run(refuseSuspendedCheckout, complete(plan))).passed).toBe(true)
    }
  })
})
