import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { guardWholesaleLinkFields } from "../wholesale-link-fields"

jest.mock("../staff-guard", () => ({ staffRoleOf: jest.fn() }))
jest.mock("../reject", () => ({
  rejectRequest: jest.fn(
    (_req: unknown, res: { statusCode: number }, status: number) => (res.statusCode = status)
  ),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { staffRoleOf } = require("../staff-guard") as { staffRoleOf: jest.Mock }

function call(path: string, fields: unknown, role: string | null | undefined) {
  staffRoleOf.mockResolvedValue(role)
  const req = { originalUrl: path, query: { fields } } as unknown as MedusaRequest
  const res = { statusCode: 200 } as unknown as MedusaResponse & { statusCode: number }
  const next = jest.fn<undefined, unknown[]>()
  return guardWholesaleLinkFields(req, res, next).then(() => ({
    passed: next.mock.calls.length === 1 && next.mock.calls[0]?.length === 0,
    status: res.statusCode,
  }))
}

/** Security review M3: the customer's wholesale link is the managers' to expand. */
describe("fields naming the wholesale link", () => {
  it("passes a reading that does not ask for it, whoever asks", async () => {
    expect(await call("/admin/customers", "*addresses", "readonly")).toEqual({
      passed: true,
      status: 200,
    })
    expect(await call("/store/customers/me", undefined, undefined)).toEqual({
      passed: true,
      status: 200,
    })
  })

  it("lets the owner and admin expand it on the admin API", async () => {
    for (const role of ["owner", "admin"]) {
      expect(await call("/admin/customers", "*wholesale_account", role)).toMatchObject({
        passed: true,
      })
    }
  })

  it("refuses it to other roles, API keys and the Store API, however written", async () => {
    for (const [path, fields, role] of [
      ["/admin/customers", "*wholesale_account", "operations"],
      ["/admin/customers", "+Wholesale_Account.status", "readonly"],
      ["/admin/orders", ["id", "customer.wholesale_account.*"], undefined],
      ["/store/customers/me", "+wholesale_account.*", undefined],
      ["/store/customers/me", "*wholesale_account", "owner"],
    ] as const) {
      expect({ path, ...(await call(path, fields, role)) }).toEqual({
        path,
        passed: false,
        status: 400,
      })
    }
  })
})
