import { AdminGetCustomerStats, MAX_STATS_CUSTOMERS } from "../validators"

/** CU1: a list page's customers, by id, at most a big page of them. */
describe("customer stats query", () => {
  it("takes customer ids, once each", () => {
    expect(AdminGetCustomerStats.parse({ ids: "cus_1, cus_2,cus_1" })).toEqual({
      ids: ["cus_1", "cus_2"],
    })
  })

  it("refuses other ids, none, too many and other fields", () => {
    const many = Array.from({ length: MAX_STATS_CUSTOMERS + 1 }, (_, i) => `cus_${String(i)}`)

    expect(AdminGetCustomerStats.safeParse({ ids: "order_1" }).success).toBe(false)
    expect(AdminGetCustomerStats.safeParse({ ids: "" }).success).toBe(false)
    expect(AdminGetCustomerStats.safeParse({}).success).toBe(false)
    expect(AdminGetCustomerStats.safeParse({ ids: many.join(",") }).success).toBe(false)
    expect(AdminGetCustomerStats.safeParse({ ids: "cus_1", fields: "email" }).success).toBe(false)
  })
})
