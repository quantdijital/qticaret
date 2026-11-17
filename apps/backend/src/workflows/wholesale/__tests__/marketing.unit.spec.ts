import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import {
  NO_WHOLESALERS,
  activeWholesalers,
  isWholesalersCart,
  wholesalersPhones,
} from "../marketing"

function container(shop: {
  enabled?: boolean
  accounts?: { customer_id: string | null }[]
  customers?: { id: string; email: string | null; phone: string | null }[]
}) {
  const listWholesaleAccounts = jest.fn(() => Promise.resolve(shop.accounts ?? []))
  const listCustomers = jest.fn(() => Promise.resolve(shop.customers ?? []))
  const services: Record<string, unknown> = {
    [PLATFORM_SETTINGS_MODULE]: { isFeatureEnabled: () => Promise.resolve(shop.enabled ?? true) },
    [WHOLESALE_MODULE]: { listWholesaleAccounts },
    [Modules.CUSTOMER]: { listCustomers },
  }
  return {
    scope: { resolve: (key: string) => services[key] },
    listWholesaleAccounts,
    listCustomers,
  }
}

/** ADR-0068 decision 16: a campaign and a cart reminder leave active wholesalers out. */
describe("activeWholesalers", () => {
  it("names the active accounts' customers, their addresses lower case and their phones", async () => {
    const { scope, listWholesaleAccounts } = container({
      accounts: [{ customer_id: "cus_1" }, { customer_id: "cus_1" }, { customer_id: "cus_2" }],
      customers: [
        { id: "cus_1", email: " Toptan@Example.com ", phone: "+905321234567" },
        { id: "cus_2", email: null, phone: null },
      ],
    })

    const found = await activeWholesalers(scope)

    expect(listWholesaleAccounts).toHaveBeenCalledWith(
      { status: "active", customer_id: { $ne: null } },
      expect.objectContaining({ take: null })
    )
    expect([...found.customerIds]).toEqual(["cus_1", "cus_2"])
    expect([...found.emails]).toEqual(["toptan@example.com"])
    expect(found.phones).toEqual(["+905321234567"])
  })

  it("names nobody while the shop sells no wholesale: they are retail customers then", async () => {
    const { scope, listWholesaleAccounts } = container({
      enabled: false,
      accounts: [{ customer_id: "cus_1" }],
    })

    expect(await activeWholesalers(scope)).toBe(NO_WHOLESALERS)
    expect(listWholesaleAccounts).not.toHaveBeenCalled()
  })

  it("reads no customers when no account is active", async () => {
    const { scope, listCustomers } = container({ accounts: [] })

    expect(await activeWholesalers(scope)).toBe(NO_WHOLESALERS)
    expect(listCustomers).not.toHaveBeenCalled()
  })
})

describe("isWholesalersCart", () => {
  const wholesalers = {
    customerIds: new Set(["cus_1"]),
    emails: new Set(["toptan@example.com"]),
    phones: [],
  }

  it("knows a wholesaler's cart by its customer, or by the address of one left signed out", () => {
    expect(isWholesalersCart(wholesalers, { customer_id: "cus_1", email: null })).toBe(true)
    expect(isWholesalersCart(wholesalers, { customer_id: null, email: "TOPTAN@example.com" })).toBe(
      true
    )
    expect(
      isWholesalersCart(wholesalers, { customer_id: "cus_9", email: "ayse@example.com" })
    ).toBe(false)
    expect(isWholesalersCart(NO_WHOLESALERS, { customer_id: "cus_1" })).toBe(false)
  })
})

/** Slice 5 review L4: a text campaign leaves out every phone a wholesaler is known by. */
describe("wholesalersPhones", () => {
  interface Graph {
    entity: string
    filters: Record<string, unknown>
    pagination: { skip: number }
  }
  /** The orders' table as `orderIdsByEmail` reads it: its ids by lower-cased address. */
  const ordersTable = (byEmail: Record<string, string[]>) => {
    const asked: { sql: string; values: string[] }[] = []
    const knex = () => ({
      select: () => ({
        whereNull: () => ({
          whereRaw: (sql: string, values: string[]) => {
            asked.push({ sql, values })
            return Promise.resolve(
              values.flatMap((email) => byEmail[email] ?? []).map((id) => ({ id }))
            )
          },
        }),
      }),
    })
    return { knex, asked }
  }
  const scope = (answer: (args: Graph) => unknown[], byEmail: Record<string, string[]> = {}) => {
    const graph = jest.fn((args: Graph) => Promise.resolve({ data: answer(args) }))
    const table = ordersTable(byEmail)
    return {
      graph,
      asked: table.asked,
      container: {
        resolve: (key: string) => {
          if (key === (ContainerRegistrationKeys.PG_CONNECTION as string)) {
            return table.knex
          }
          if (key !== (ContainerRegistrationKeys.QUERY as string)) {
            throw new Error(`unexpected ${key}`)
          }
          return { graph }
        },
      },
    }
  }
  const wholesalers = {
    customerIds: new Set(["cus_1"]),
    emails: new Set(["toptan@example.com"]),
    phones: ["+905321234567"],
  }

  it("reads the record's, the address book's and the orders' phones, signed in or out", async () => {
    const { container, graph, asked } = scope(
      ({ entity, filters }) => {
        if (entity === "customer") {
          return [
            {
              phone: "+905321234567",
              addresses: [{ phone: "0532 765 43 21" }, { phone: null }, { phone: "  " }],
            },
          ]
        }
        return "customer_id" in filters
          ? [{ shipping_address: { phone: "05551112233" }, billing_address: { phone: null } }]
          : [{ shipping_address: { phone: "+90 544 000 11 22" }, billing_address: null }]
      },
      { "toptan@example.com": ["order_guest"] }
    )

    const phones = await wholesalersPhones(container, wholesalers)

    expect(phones.sort()).toEqual(
      ["+905321234567", "0532 765 43 21", "05551112233", "+90 544 000 11 22"].sort()
    )
    expect(graph.mock.calls.map(([args]) => [args.entity, args.filters])).toEqual([
      ["customer", { id: ["cus_1"] }],
      ["order", { customer_id: ["cus_1"] }],
      ["order", { id: ["order_guest"] }],
    ])
    // However the guest typed it ("Toptan@Example.com"): the address is compared lower-cased
    expect(asked).toEqual([{ sql: "lower(btrim(email)) in (?)", values: ["toptan@example.com"] }])
  })

  it("reads no signed-out order when none was placed under their address", async () => {
    const { container, graph } = scope(() => [])
    await wholesalersPhones(container, wholesalers)
    expect(graph.mock.calls.map(([args]) => args.entity)).toEqual(["customer", "order"])
  })

  it("reads every page of a wholesaler's orders", async () => {
    const { container, graph } = scope(({ entity, filters, pagination }) => {
      if (entity !== "order" || !("customer_id" in filters)) {
        return []
      }
      return pagination.skip === 0
        ? Array.from({ length: 1_000 }, () => ({ shipping_address: { phone: "05551112233" } }))
        : [{ shipping_address: { phone: "05559998877" } }]
    })

    const phones = await wholesalersPhones(container, wholesalers)

    expect(phones.sort()).toEqual(["05551112233", "05559998877"])
    expect(graph).toHaveBeenCalledTimes(3)
  })

  it("reads nothing while there is no wholesaler", async () => {
    const { container, graph } = scope(() => [])
    expect(await wholesalersPhones(container, NO_WHOLESALERS)).toEqual([])
    expect(graph).not.toHaveBeenCalled()
  })
})
