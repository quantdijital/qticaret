import { describe, expect, it, vi } from "vitest"

// The backend's answers as each test sets them
const api = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("../server", () => api)

const { productById } = await import("../requests")

describe("productById's fields", () => {
  it("asks for the whole category, whose id the related rails need (W-02)", async () => {
    api.storeGet.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/store/regions"
          ? { regions: [{ id: "reg_1", name: "Türkiye", currency_code: "try" }] }
          : { product: { id: "prod_1", categories: [{ id: "pcat_1" }] } }
      )
    )
    await productById("prod_1")
    const call = api.storeGet.mock.calls.find(([path]) => path === "/store/products/prod_1")
    const fields = String((call?.[1] as { fields?: string } | undefined)?.fields).split(",")
    // `categories.id` comes back as `{ is_internal }` only: no rail of the category
    expect(fields).toContain("*categories")
    expect(fields).not.toContain("categories.id")
  })
})
