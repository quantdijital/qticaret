import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { AT_CHECKOUT, quoteShipping } from "../shipping-quote"
import { staffNames } from "../views"

interface GraphCall {
  entity: string
  filters: Record<string, unknown>
  context?: { calculated_price?: Record<string, unknown> }
}

/** A container whose query answers one shipping option row (or none). */
function optionContainer(row: Record<string, unknown> | null) {
  const calls: GraphCall[] = []
  const query = {
    graph: (call: GraphCall) => {
      calls.push(call)
      return Promise.resolve({ data: row ? [row] : [] })
    },
  }
  return {
    calls,
    container: {
      resolve: (key: string) => {
        if (key !== (ContainerRegistrationKeys.QUERY as string)) {
          throw new Error(`unexpected ${key}`)
        }
        return query
      },
    } as never,
  }
}

const QUOTE = {
  shipping_option_id: "so_01JABCDEFGHJKMNPQRSTVWXYZ",
  with_address: true,
  region_id: "reg_1",
  item_total: 27_000,
}

describe("payment link preview shipping (adr/0051 §2)", () => {
  it("prices a flat-rate option for the lira region and the basket after its discount", async () => {
    const { calls, container } = optionContainer({
      price_type: "flat",
      calculated_price: { calculated_amount: 89.9 },
    })

    expect(await quoteShipping(container, QUOTE)).toEqual({
      shipping_total: 8_990,
      shipping_estimate: "priced",
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.entity).toBe("shipping_option")
    expect(calls[0]?.filters).toEqual({ id: QUOTE.shipping_option_id })
    // The cart's own pricing context: currency, region, item_total in lira
    expect(calls[0]?.context?.calculated_price).toMatchObject({
      currency_code: "try",
      region_id: "reg_1",
      item_total: 270,
    })
  })

  it("leaves a carrier-priced option, an unpriced one and a missing option to the checkout", async () => {
    for (const row of [
      { price_type: "calculated", calculated_price: null },
      { price_type: "flat", calculated_price: { calculated_amount: null } },
      null,
    ]) {
      expect(await quoteShipping(optionContainer(row).container, QUOTE)).toEqual(AT_CHECKOUT)
    }
  })

  it("asks nothing without an option or an address", async () => {
    const noOption = optionContainer(null)
    const noAddress = optionContainer(null)

    expect(await quoteShipping(noOption.container, { ...QUOTE, shipping_option_id: null })).toEqual(
      AT_CHECKOUT
    )
    expect(await quoteShipping(noAddress.container, { ...QUOTE, with_address: false })).toEqual(
      AT_CHECKOUT
    )
    expect([...noOption.calls, ...noAddress.calls]).toHaveLength(0)
  })
})

describe("payment link staff names (adr/0051 §13)", () => {
  it("names staff by first and last name, once each, never by e-mail; the nameless and the gone are left out", async () => {
    const asked: unknown[] = []
    const container = {
      resolve: (key: string) => {
        if (key !== (Modules.USER as string)) {
          throw new Error(`unexpected ${key}`)
        }
        return {
          listUsers: (filters: unknown, config: unknown) => {
            asked.push(filters, config)
            return Promise.resolve([
              { id: "user_a", first_name: "Ayşe", last_name: "Yılmaz", email: "a@example.com" },
              { id: "user_b", first_name: "Mehmet", last_name: null, email: "b@example.com" },
              { id: "user_c", first_name: null, last_name: " ", email: "c@example.com" },
            ])
          },
        }
      },
    } as never

    const names = await staffNames(container, ["user_a", "user_b", null, "user_a", "user_c"])

    expect(Object.fromEntries(names)).toEqual({ user_a: "Ayşe Yılmaz", user_b: "Mehmet" })
    expect(asked).toEqual([
      { id: ["user_a", "user_b", "user_c"] },
      { select: ["id", "first_name", "last_name"], take: 3 },
    ])
    expect(await staffNames(container, [null])).toEqual(new Map())
    expect(asked).toHaveLength(2)
  })
})
