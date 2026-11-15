import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isConflictError } from "../../../lib/errors"
import { guardWholesaleRecords, hideWholesaleRecords, withoutOwned } from "../wholesale-guard"

const OWNED = {
  priceListIds: new Set(["plist_w"]),
  groupIds: new Set(["cusgroup_w"]),
}

function request(method: string, params: Record<string, string>, extra: object = {}) {
  return {
    method,
    params,
    body: {},
    scope: { resolve: () => ({ ownedIds: () => Promise.resolve(OWNED) }) },
    ...extra,
  } as unknown as MedusaRequest
}

const run = async (
  middleware: ReturnType<typeof guardWholesaleRecords>,
  req: MedusaRequest,
  res = {} as MedusaResponse
) =>
  new Promise<unknown>((resolve) => {
    void middleware(req, res, (error?: unknown) => {
      resolve(error)
    })
  })

describe("the wholesale guard on Medusa's routes (ADR-0068 §9)", () => {
  it("answers wholesale.managed for a write to the module's list, passes others and reads", async () => {
    const refused = await run(
      guardWholesaleRecords("price_list"),
      request("POST", { id: "plist_w" })
    )
    expect(isConflictError(refused)).toBe(true)
    expect((refused as { safeMessage?: string }).safeMessage).toBe("wholesale.managed")
    expect(
      await run(guardWholesaleRecords("price_list"), request("POST", { id: "plist_x" }))
    ).toBeUndefined()
    expect(
      await run(guardWholesaleRecords("group"), request("GET", { id: "cusgroup_w" }))
    ).toBeUndefined()
  })

  it("refuses a customer put in the module's group from the customer's side", async () => {
    const req = request("POST", { id: "cus_1" }, { body: { add: ["cusgroup_w"] } })
    expect(isConflictError(await run(guardWholesaleRecords("memberships"), req))).toBe(true)
  })
})

describe("Medusa's lists without the module's records", () => {
  it("drops the module's rows and lowers the count by as many", () => {
    const body = {
      price_lists: [{ id: "plist_a" }, { id: "plist_w" }, null],
      count: 3,
      offset: 0,
    }
    expect(withoutOwned(body, "price_lists", OWNED.priceListIds)).toEqual({
      price_lists: [{ id: "plist_a" }, null],
      count: 2,
      offset: 0,
    })
    expect(withoutOwned("x", "price_lists", OWNED.priceListIds)).toBe("x")
  })

  it("leaves them out of the query too, unless the request names ids itself", async () => {
    const plain = request("GET", {}, { filterableFields: {} })
    const sent: unknown[] = []
    const res = {
      json: (body: unknown) => {
        sent.push(body)
        return res
      },
    } as unknown as MedusaResponse
    await run(hideWholesaleRecords("customer_groups"), plain, res)
    expect((plain as unknown as { filterableFields: unknown }).filterableFields).toEqual({
      id: { $nin: ["cusgroup_w"] },
    })
    res.json({ customer_groups: [{ id: "cusgroup_w" }], count: 1 })
    expect(sent).toEqual([{ customer_groups: [], count: 0 }])

    const named = request("GET", {}, { filterableFields: { id: ["cusgroup_w"] } })
    await run(hideWholesaleRecords("customer_groups"), named, { json: () => undefined } as never)
    expect((named as unknown as { filterableFields: unknown }).filterableFields).toEqual({
      id: ["cusgroup_w"],
    })
  })
})
