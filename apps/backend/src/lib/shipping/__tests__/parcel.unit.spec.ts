import { InvalidMeasures, PLATFORM_PARCEL, defaultParcelOf, parcelOf } from "../parcel"

const units = { weight_unit: "g", dimension_unit: "cm" } as const
const fallback = defaultParcelOf(null, units)
const knife = { title: "Bıçak", quantity: 1, weight: 450, length: 35, width: 8, height: 4 }
const bare = { title: "Kupa", quantity: 1 }

describe("parcelOf (F7.2)", () => {
  it("weighs and sizes the lines in kilograms and centimetres, whatever the shop's units", () => {
    expect(parcelOf([knife], units, fallback)).toEqual({
      weight_kg: 0.45,
      length_cm: 35,
      width_cm: 8,
      height_cm: 4,
      desi: 0.5,
      measured: true,
    })
    expect(
      parcelOf(
        [{ ...knife, weight: 0.45, length: 350, width: 80, height: 40 }],
        { weight_unit: "kg", dimension_unit: "mm" },
        fallback
      )
    ).toMatchObject({ weight_kg: 0.45, length_cm: 35, width_cm: 8, height_cm: 4 })
  })

  it("charges the larger of the weight and the desi, for every unit ordered", () => {
    const pillow = { title: "Yastık", quantity: 2, weight: 500, length: 50, width: 40, height: 20 }

    // 2 × 40 000 cm³ = 80 000 cm³ → 26.7 desi against 1 kg, in one cube
    expect(parcelOf([pillow], units, fallback)).toMatchObject({ desi: 26.7, length_cm: 43.1 })
    // Heavy and small: the weight
    expect(parcelOf([{ ...knife, weight: 12_000 }], units, fallback).desi).toBe(12)
  })
})

describe("parcelOf without measures (adr/0054)", () => {
  it("takes the platform's default parcel: 1 kg in 30 × 20 × 10 cm, 2 desi", () => {
    expect(PLATFORM_PARCEL).toEqual({ weight_g: 1000, length_cm: 30, width_cm: 20, height_cm: 10 })
    expect(parcelOf([bare], units, fallback)).toEqual({
      weight_kg: 1,
      length_cm: 30,
      width_cm: 20,
      height_cm: 10,
      desi: 2,
      measured: false,
    })
  })

  it("counts the default once for every unit, and fills only the values a line lacks", () => {
    // Three default parcels: 18 000 cm³ → 6 desi, 3 kg
    expect(parcelOf([{ ...bare, quantity: 3 }], units, fallback)).toMatchObject({
      weight_kg: 3,
      desi: 6,
      measured: false,
    })
    // A heavy product without a box keeps its own weight in the default box
    expect(parcelOf([{ ...bare, weight: 12_000 }], units, fallback)).toMatchObject({
      weight_kg: 12,
      length_cm: 30,
      desi: 12,
    })
    // A measured line beside an unmeasured one: the parcel is not all measured
    expect(parcelOf([knife, bare], units, fallback)).toMatchObject({
      weight_kg: 1.45,
      measured: false,
    })
  })

  it("reads an empty or zero value as not given", () => {
    expect(parcelOf([{ ...knife, height: 0 }], units, fallback)).toMatchObject({
      height_cm: 10,
      measured: false,
    })
    expect(parcelOf([{ ...knife, weight: null }], units, fallback).weight_kg).toBe(1)
  })

  it("is the shop's own default when set, in its units", () => {
    const own = { weight: 2, length: 400, width: 300, height: 200 }
    const shop = { weight_unit: "kg", dimension_unit: "mm" } as const
    expect(defaultParcelOf(own, shop)).toBe(own)
    expect(defaultParcelOf(null, shop)).toEqual({ weight: 1, length: 300, width: 200, height: 100 })
    // 40 × 30 × 20 cm = 24 000 cm³ → 8 desi
    expect(parcelOf([bare], shop, own)).toMatchObject({ weight_kg: 2, length_cm: 40, desi: 8 })
  })

  it("refuses a value that cannot be a measure, naming each product once", () => {
    const run = () =>
      parcelOf(
        [
          { ...knife, weight: -450 },
          { ...knife, quantity: 2, weight: -1 },
          { ...knife, title: "Kılıf", height: Number.NaN },
          { ...knife, title: "İptal", quantity: 0, weight: -1 },
          bare,
        ],
        units,
        fallback
      )

    expect(run).toThrow(InvalidMeasures)
    try {
      run()
    } catch (error) {
      expect((error as InvalidMeasures).titles).toEqual(["Bıçak", "Kılıf"])
    }
  })
})
