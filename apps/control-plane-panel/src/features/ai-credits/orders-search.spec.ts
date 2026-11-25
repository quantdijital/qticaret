import { describe, expect, it } from "vitest"
import { ORDERS_PAGE_MAX } from "@/features/ai-credits/api/queries"
import { Route } from "@/routes/_app/ai-orders"

const read = (raw: Record<string, unknown>) =>
  (Route.options.validateSearch as { parse: (input: unknown) => unknown }).parse(raw)

describe("the AI credit requests' address (adr/0085 K11)", () => {
  it("serves up to the control plane's last page (offset 100 000 with 50 a page)", () => {
    expect(ORDERS_PAGE_MAX).toBe(2001)
    expect(read({ page: "2001" })).toEqual({ status: "pending", page: 2001 })
  })

  it.each([["2002"], ["0"], ["-3"], ["1.5"], ["abc"]])("takes page %s to the first", (page) => {
    expect(read({ status: "paid", page })).toEqual({ status: "paid", page: 1 })
  })
})
