import type { MedusaRequest } from "@medusajs/framework/http"
import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { forDashboard } from "../../../api/http/dashboard-messages"
import { writeErrorText } from "../../../workflows/catalog/write-error"
import { PlanLimitError, isPlanLimitError, isValidationError, toHttpError } from ".."
import { planLimitSentence } from "../messages"

const failing = createStep("test-plan-limit-throw", () => {
  throw new PlanLimitError("products", 500, 500)
})
const workflow = createWorkflow("test-plan-limit-workflow", () => {
  failing()
  return new WorkflowResponse(undefined)
})

describe("PlanLimitError (adr/0061 Ek C14)", () => {
  it("answers 403 plan.limit_reached with which limit, its use and allowance", () => {
    expect(toHttpError(new PlanLimitError("storage_mb", 2048, 2048))).toEqual({
      status: 403,
      body: {
        type: "not_allowed",
        message: "plan.limit_reached",
        limit: "storage_mb",
        used: 2048,
        max: 2048,
      },
    })
  })

  it("is recognised by its shape after a workflow run and a JSON round trip, and only then", async () => {
    const caught: unknown = await workflow()
      .run({ input: undefined })
      .then(
        () => null,
        (error: unknown) => error
      )
    expect(caught).not.toBeInstanceOf(Error)
    expect(isPlanLimitError(caught)).toBe(true)
    expect(isPlanLimitError(JSON.parse(JSON.stringify(new PlanLimitError("staff", 3, 3))))).toBe(
      true
    )
    expect(isValidationError(new PlanLimitError("staff", 3, 3))).toBe(false)
    // A made-up limit or a count that is not one is not this error
    for (const fake of [
      { qtErrorKind: "plan_limit", safeMessage: "plan.limit_reached", limit: "x", used: 1, max: 1 },
      {
        qtErrorKind: "plan_limit",
        safeMessage: "plan.limit_reached",
        limit: "staff",
        used: -1,
        max: 1,
      },
      { qtErrorKind: "plan_limit", safeMessage: "other.key", limit: "staff", used: 1, max: 1 },
    ]) {
      expect(isPlanLimitError(fake)).toBe(false)
    }
  })

  it("reads as a Turkish sentence that names the limit and points to Settings > Abonelik", () => {
    expect(planLimitSentence({ limit: "products", used: 500, max: 500 })).toBe(
      "Paketinizin ürün limitine ulaştınız (500/500). Paketinizi ve kullanımınızı Ayarlar > Abonelik sayfasında görebilirsiniz."
    )
    expect(planLimitSentence({ limit: "storage_mb", used: 2048, max: 2048 }, "en")).toContain(
      "storage limit is reached (2048/2048 MB)"
    )
    const dashboard = {
      originalUrl: "/admin/products",
      headers: {},
      session: { auth_context: { actor_id: "user_1" } },
    } as unknown as MedusaRequest
    const body = toHttpError(new PlanLimitError("staff", 3, 3))?.body
    expect(body && forDashboard(dashboard, body)).toMatchObject({
      code: "plan.limit_reached",
      message: expect.stringContaining("ekip üyesi limitine ulaştınız (3/3)") as unknown,
      limit: "staff",
    })
  })

  it("is a sheet import row's words", () => {
    expect(writeErrorText(new PlanLimitError("products", 5, 5))).toContain("ürün limiti doldu")
  })
})
