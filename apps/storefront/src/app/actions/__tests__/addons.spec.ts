import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreProductAddon } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: next.redirect }))
const addons = vi.hoisted(() => ({
  productAddons: vi.fn(),
  addAddonLine: vi.fn(),
  saveAddonLine: vi.fn(),
}))
vi.mock("@/lib/cart/addons", () => addons)
const cart = vi.hoisted(() => ({ addLine: vi.fn() }))
vi.mock("@/lib/cart/cart", () => cart)

const { addAddonsToCart, saveLineAddons } = await import("../addons")

const TEXT: StoreProductAddon = {
  id: "ad_yazi",
  kind: "text",
  label: "Ürün üzerine yazı",
  help: null,
  required: false,
  max_quantity: 10,
  non_withdrawable: true,
  price: 35,
  text: { max_length: 50, charset: "letters_digits" },
}

const PRODUCT = "prod_01K0000000000000000000000"
const VARIANT = "variant_01K0000000000000000000000"
const LINE = "cali_01K0000000000000000000000"

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  Object.entries({ product_id: PRODUCT, variant_id: VARIANT, quantity: "1", ...fields }).forEach(
    ([name, value]) => {
      data.set(name, value)
    }
  )
  return data
}

const add = (fields: Record<string, string>) =>
  addAddonsToCart({ ok: false, error: null }, form(fields))

describe("addAddonsToCart (adr/0052)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addons.productAddons.mockResolvedValue([TEXT])
    addons.addAddonLine.mockResolvedValue(undefined)
    cart.addLine.mockResolvedValue("cart_1")
  })

  it("adds the line with its picks, then refreshes the header's cart", async () => {
    await expect(add({ addon_ad_yazi: "Ahmet" })).resolves.toEqual({ ok: true, error: null })
    expect(addons.addAddonLine).toHaveBeenCalledWith(VARIANT, 1, [
      { addon_id: "ad_yazi", value: "Ahmet" },
    ])
    expect(next.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("adds a plain line when nothing is picked", async () => {
    await expect(add({ addon_ad_yazi: "" })).resolves.toEqual({ ok: true, error: null })
    expect(cart.addLine).toHaveBeenCalledWith(VARIANT, 1)
    expect(addons.addAddonLine).not.toHaveBeenCalled()
  })

  it("says the backend's refusal of a pick in words (the line was taken back)", async () => {
    addons.addAddonLine.mockRejectedValue(new StoreApiError(400, "addons.text_link", null))
    await expect(add({ addon_ad_yazi: "Ahmet" })).resolves.toEqual({
      ok: false,
      error: "addons.text_link",
    })
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("refuses before adding anything: a text it cannot take, more units than the pick allows", async () => {
    await expect(add({ addon_ad_yazi: "www.ornek.com" })).resolves.toMatchObject({
      error: "addons.charset",
    })
    await expect(add({ addon_ad_yazi: "Ahmet", quantity: "11" })).resolves.toMatchObject({
      error: "addons.max_quantity",
    })
    expect(addons.addAddonLine).not.toHaveBeenCalled()
    expect(cart.addLine).not.toHaveBeenCalled()
  })

  it("never drops a pick silently when the shop turned add-ons off meanwhile", async () => {
    addons.productAddons.mockResolvedValue(null)
    await expect(add({ addon_ad_yazi: "Ahmet" })).resolves.toEqual({
      ok: false,
      error: "catalog.addons_disabled",
    })
    // Without a pick it is a plain add
    await expect(add({})).resolves.toEqual({ ok: true, error: null })
  })

  it("says a core add's refusal as the plain form does", async () => {
    cart.addLine.mockRejectedValue(new StoreApiError(400, "Variant out of stock", null))
    await expect(add({})).resolves.toEqual({ ok: false, error: "cart.variant_unavailable" })
    cart.addLine.mockRejectedValue(new StoreApiError(429, null, null))
    await expect(add({})).resolves.toEqual({ ok: false, error: "errors.too_many_requests" })
  })
})

describe("saveLineAddons", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addons.productAddons.mockResolvedValue([TEXT])
    addons.saveAddonLine.mockResolvedValue(undefined)
  })

  const save = (fields: Record<string, string>) => {
    const data = new FormData()
    Object.entries({ line_id: LINE, product_id: PRODUCT, ...fields }).forEach(([name, value]) => {
      data.set(name, value)
    })
    return saveLineAddons(data)
  }

  it("writes the line's picks, or none with `clear`, and goes back to the cart", async () => {
    await expect(save({ addon_ad_yazi: "Ayşe" })).rejects.toThrow("redirect:/sepet")
    expect(addons.saveAddonLine).toHaveBeenCalledWith(LINE, [
      { addon_id: "ad_yazi", value: "Ayşe" },
    ])
    await expect(save({ clear: "1", addon_ad_yazi: "Ayşe" })).rejects.toThrow("redirect:/sepet")
    expect(addons.saveAddonLine).toHaveBeenLastCalledWith(LINE, [])
  })

  it("brings a refusal back to the cart by its key", async () => {
    addons.saveAddonLine.mockRejectedValue(new StoreApiError(400, "addons.max_quantity", null))
    await expect(save({ addon_ad_yazi: "Ayşe" })).rejects.toThrow(
      "redirect:/sepet?hata=addons.max_quantity"
    )
    addons.productAddons.mockResolvedValue(null)
    await expect(save({ addon_ad_yazi: "Ayşe" })).rejects.toThrow(
      "redirect:/sepet?hata=catalog.addons_disabled"
    )
  })
})
