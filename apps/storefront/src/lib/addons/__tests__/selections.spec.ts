import { describe, expect, it } from "vitest"
import type { StoreProductAddon } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"
import { addonError } from "../errors"
import { fieldOf, hasPicks, pickedLimit, selectionsOf } from "../selections"

const TEXT: StoreProductAddon = {
  id: "ad_yazi",
  kind: "text",
  label: "Ürün üzerine yazı",
  help: null,
  required: false,
  max_quantity: 10,
  non_withdrawable: true,
  price: 35,
  text: { max_length: 12, charset: "letters_digits" },
}

const CHOICE: StoreProductAddon = {
  id: "ad_kilif",
  kind: "choice",
  label: "Kılıf",
  help: null,
  required: false,
  max_quantity: 3,
  non_withdrawable: false,
  choices: [{ id: "ch_siyah", label: "Siyah", price: 300 }],
}

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  Object.entries(fields).forEach(([name, value]) => {
    data.set(name, value)
  })
  return data
}

const pick = (fields: Record<string, string>, addons = [TEXT, CHOICE]) =>
  selectionsOf(addons, fieldOf(form(fields)))

describe("selectionsOf (adr/0052)", () => {
  it("sends the text as the backend keeps it and the choice's id; never a price", () => {
    expect(pick({ addon_ad_yazi: "  Ahmet \n Yılmaz ", addon_ad_kilif: "ch_siyah" })).toEqual({
      ok: true,
      selections: [
        { addon_id: "ad_yazi", value: "Ahmet Yılmaz" },
        { addon_id: "ad_kilif", choice_id: "ch_siyah" },
      ],
    })
  })

  it("leaves out an empty pick, and refuses a required one left empty", () => {
    expect(pick({ addon_ad_yazi: "   ", addon_ad_kilif: "" })).toEqual({ ok: true, selections: [] })
    expect(pick({}, [{ ...CHOICE, required: true }])).toEqual({
      ok: false,
      error: "addons.required",
    })
    expect(pick({ addon_ad_yazi: "" }, [{ ...TEXT, required: true }])).toEqual({
      ok: false,
      error: "addons.required",
    })
  })

  it("refuses a text too long or outside its characters, and a choice the product lacks", () => {
    expect(pick({ addon_ad_yazi: "Çok uzun bir yazı" })).toMatchObject({
      error: "addons.text_too_long",
    })
    expect(pick({ addon_ad_yazi: "a@b.co" })).toMatchObject({ error: "addons.charset" })
    expect(pick({ addon_ad_kilif: "ch_yok" })).toMatchObject({ error: "addons.unknown" })
    // Turkish letters are letters, in either Unicode form
    expect(pick({ addon_ad_yazi: "Şule İğde".normalize("NFD") })).toMatchObject({ ok: true })
  })

  it("knows the fewest units the picks allow, and whether a form picks anything", () => {
    expect(
      pickedLimit(
        [TEXT, CHOICE],
        [
          { addon_id: "ad_yazi", value: "Ahmet" },
          { addon_id: "ad_kilif", choice_id: "ch_siyah" },
        ]
      )
    ).toBe(3)
    expect(pickedLimit([TEXT, CHOICE], [])).toBeNull()
    expect(hasPicks(form({ addon_ad_yazi: " ", variant_id: "variant_1" }))).toBe(false)
    expect(hasPicks(form({ addon_ad_kilif: "ch_siyah" }))).toBe(true)
  })
})

describe("addonError", () => {
  it("passes the backend's add-on refusals on by key, the flag's bare 404 as add-ons off", () => {
    expect(addonError(new StoreApiError(400, "addons.charset", null), "x")).toBe("addons.charset")
    expect(addonError(new StoreApiError(400, "addons.max_quantity", null), "x")).toBe(
      "addons.max_quantity"
    )
    expect(addonError(new StoreApiError(404, "cart.line_unknown", null), "x")).toBe(
      "cart.line_unknown"
    )
    expect(addonError(new StoreApiError(404, null, null), "x")).toBe("catalog.addons_disabled")
    expect(addonError(new StoreApiError(429, null, null), "x")).toBe("errors.too_many_requests")
    // Anything else is the caller's own words; a crash is never a shopper's message
    expect(addonError(new StoreApiError(400, "Variant not found", null), "x")).toBe("x")
    expect(addonError(new Error("boom"), "x")).toBe("x")
  })
})
