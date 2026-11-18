import type { MedusaRequest } from "@medusajs/framework/http"
import { BIRFATURA_ROUTES, birfaturaDoor } from "../birfatura-routes"

// Each middleware says what it is: the limiter its profile, the guard itself
jest.mock("../rate-limit", () => ({
  rateLimit: (resolve: (req: MedusaRequest) => { name: string }) =>
    Object.assign(() => undefined, { step: `limit:${resolve({} as MedusaRequest).name}` }),
}))
jest.mock("../birfatura-guard", () => ({
  birfaturaGuard: () => Object.assign(() => undefined, { step: "guard" }),
}))

const steps = (middlewares: unknown[]) =>
  middlewares.map((middleware) => (middleware as { step?: string }).step ?? "schema")

describe("BirFatura's door, in its order (adr/0072 §3, security review S1)", () => {
  it("counts the address before the token, and the shop's budget only after it", () => {
    expect(steps(birfaturaDoor())).toEqual([
      "limit:einvoice_pull",
      "guard",
      "limit:einvoice_pull_shop",
    ])
  })

  it("checks a body only once the door let it in, on every service", () => {
    for (const route of BIRFATURA_ROUTES) {
      const order = steps(route.middlewares)

      expect(order.slice(0, 3)).toEqual([
        "limit:einvoice_pull",
        "guard",
        "limit:einvoice_pull_shop",
      ])
      expect(route.bodyParser).toEqual({ sizeLimit: "16kb" })
    }
  })
})
