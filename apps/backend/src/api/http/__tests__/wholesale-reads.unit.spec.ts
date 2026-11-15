import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { isValidationError } from "../../../lib/errors"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import { guardWholesaleMembers, hideWholesalePriceRows } from "../wholesale-reads"

const OWNED = { priceListIds: new Set(["plist_w"]), groupIds: new Set(["cusgroup_w"]) }

function scope(role: string | null, listPrices = jest.fn()) {
  const services: Record<string, unknown> = {
    [WHOLESALE_MODULE]: { ownedIds: () => Promise.resolve(OWNED) },
    [STAFF_ROLES_MODULE]: { roleOf: () => Promise.resolve(role) },
    [Modules.PRICING]: { listPrices },
  }
  return { resolve: (key: string) => services[key] }
}

function request(role: string | null, extra: object = {}, listPrices = jest.fn()) {
  return {
    method: "GET",
    params: {},
    query: {},
    auth_context: role ? { actor_type: "user", actor_id: "user_1" } : undefined,
    scope: scope(role, listPrices),
    ...extra,
  } as unknown as MedusaRequest
}

function response() {
  const sent: unknown[] = []
  const res = {
    json: (body: unknown) => {
      sent.push(body)
      return res
    },
  }
  return { res: res as unknown as MedusaResponse, sent }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("wholesale price rows out of Medusa's product reads (ADR-0068 decision 17)", () => {
  it("drops a variant's price rows that sit on a wholesale list, however expanded", async () => {
    const listPrices = jest.fn().mockResolvedValue([{ id: "price_w" }])
    const { res, sent } = response()
    hideWholesalePriceRows(request("owner", {}, listPrices), res, jest.fn())
    res.json({
      product: {
        variants: [
          { prices: [{ id: "price_base" }, { id: "price_w" }] },
          { price_set: { prices: [{ id: "price_w" }, { id: "price_sale" }] } },
        ],
      },
    })
    await settle()
    expect(listPrices).toHaveBeenCalledWith(
      { id: ["price_base", "price_w", "price_sale"], price_list_id: ["plist_w"] },
      expect.objectContaining({ select: ["id"] })
    )
    expect(sent).toEqual([
      {
        product: {
          variants: [
            { prices: [{ id: "price_base" }] },
            { price_set: { prices: [{ id: "price_sale" }] } },
          ],
        },
      },
    ])
  })

  it("drops every price row when the check fails, never shows one unchecked", async () => {
    const listPrices = jest.fn().mockRejectedValue(new Error("db down"))
    const { res, sent } = response()
    hideWholesalePriceRows(request("owner", {}, listPrices), res, jest.fn())
    res.json({ products: [{ variants: [{ prices: [{ id: "price_base" }] }] }] })
    await settle()
    expect(sent).toEqual([{ products: [{ variants: [{ prices: [] }] }] }])
  })
})

describe("wholesale members kept to the owner and admin (ADR-0068 decision 17)", () => {
  const run = async (req: MedusaRequest, res: MedusaResponse) =>
    new Promise<unknown>((resolve) => {
      void guardWholesaleMembers(req, res, resolve)
    })

  it("refuses another role or an API key a customer list by a wholesale group", async () => {
    for (const role of ["operations", "readonly", null]) {
      const req = request(role, { query: { groups: ["cusgroup_a", "cusgroup_w"] } })
      const error = await run(req, response().res)
      expect({ role, refused: isValidationError(error) }).toEqual({ role, refused: true })
    }
  })

  it("leaves wholesale groups, and groups read without their id, out of a customer's", async () => {
    const { res, sent } = response()
    expect(await run(request("operations"), res)).toBeUndefined()
    res.json({
      customers: [{ groups: [{ id: "cusgroup_w" }, { id: "cusgroup_a" }, { name: "Toptan A" }] }],
    })
    expect(sent).toEqual([{ customers: [{ groups: [{ id: "cusgroup_a" }] }] }])
  })

  it("lets the owner and admin read members and filter by a wholesale group", async () => {
    for (const role of ["owner", "admin"]) {
      const { res, sent } = response()
      const req = request(role, { query: { groups: "cusgroup_w" } })
      expect(await run(req, res)).toBeUndefined()
      res.json({ customer: { groups: [{ id: "cusgroup_w" }] } })
      expect(sent).toEqual([{ customer: { groups: [{ id: "cusgroup_w" }] } }])
    }
  })
})
