import { describe, expect, it } from "vitest"
import { BLANK_VARIANT, defaultWizardValues } from "./schema"
import type { WizardValues } from "./schema"
import { applyDraft, draftName, draftTies, draftValues, ownImageUrls } from "./variant-draft"

const PURPLE = "https://cdn/mor.jpg"
const GREEN = "https://cdn/yesil.jpg"
const SHARED = "https://cdn/genel.jpg"

const row = (colour: string, extra: Partial<WizardValues["variants"][number]> = {}) => ({
  ...BLANK_VARIANT,
  key: colour,
  title: colour,
  options: { Renk: colour },
  price: "1.250,00",
  ...extra,
})

const values = (): WizardValues => ({
  ...defaultWizardValues(),
  title: "Şef Bıçağı",
  has_options: true,
  options: [{ title: "Renk", values: ["Mor", "Yeşil"] }],
  images: [
    { id: "file_1", url: SHARED },
    { id: "file_2", url: PURPLE },
    { id: "file_3", url: GREEN },
  ],
  variants: [row("Mor", { image_urls: [PURPLE] }), row("Yeşil", { image_urls: [GREEN, PURPLE] })],
})

describe("the new product's variant in its dialog", () => {
  it("starts from the row, the form's pictures marked as its own or not", () => {
    const start = draftValues(values(), 0)
    expect(start).toMatchObject({ price: "1.250,00", stock: "0", gtin: "", applyAll: false })
    expect(start?.images).toEqual([
      { key: SHARED, url: SHARED, imageId: "file_1", mediaId: null, alt: "", tied: false },
      { key: PURPLE, url: PURPLE, imageId: "file_2", mediaId: null, alt: "", tied: true },
      { key: GREEN, url: GREEN, imageId: "file_3", mediaId: null, alt: "", tied: false },
    ])
    expect(draftValues(values(), 5)).toBeNull()
  })

  it("names the other variants a picture is tied to", () => {
    const ties = draftTies(values(), 0)
    expect(ties.get(PURPLE)).toEqual(["Yeşil"])
    expect(ties.get(GREEN)).toEqual(["Yeşil"])
    expect(ties.get(SHARED)).toEqual([])
    expect(draftName(row("Mor"))).toBe("Renk: Mor")
  })

  it("puts what was typed back in the row, a library picture in the gallery too", () => {
    const form = values()
    const start = draftValues(form, 0)
    if (!start) {
      throw new Error("no row")
    }
    const next = applyDraft(form, 0, {
      ...start,
      cost: "400",
      mpn: "SB-MOR",
      gtin: "8690000000005",
      weight: "0,35",
      images: [
        ...start.images.map((image) => ({ ...image, tied: image.url !== PURPLE })),
        {
          key: "new-media_9",
          url: "https://cdn/kutu.jpg",
          imageId: null,
          mediaId: "media_9",
          alt: "",
          tied: true,
        },
      ],
    })
    expect(next.images).toEqual([
      { id: "file_1", url: SHARED },
      { id: "file_2", url: PURPLE },
      { id: "file_3", url: GREEN },
      { id: "media_9", url: "https://cdn/kutu.jpg" },
    ])
    expect(next.variants[0]).toMatchObject({
      cost: "400",
      mpn: "SB-MOR",
      ean: "8690000000005",
      weight: "0,35",
      image_urls: [SHARED, GREEN, "https://cdn/kutu.jpg"],
    })
    // The other row is left as it was
    expect(next.variants[1]).toEqual(form.variants[1])
  })

  it("gives the price to every row when asked", () => {
    const form = values()
    const start = draftValues(form, 1)
    if (!start) {
      throw new Error("no row")
    }
    const next = applyDraft(form, 1, { ...start, price: "999", applyAll: true })
    expect(next.variants.map((each) => each.price)).toEqual(["999", "999"])
  })

  it("forgets a picture taken out of the gallery", () => {
    expect(ownImageUrls({ image_urls: [GREEN, PURPLE] }, [{ id: "file_2", url: PURPLE }])).toEqual([
      PURPLE,
    ])
  })
})
