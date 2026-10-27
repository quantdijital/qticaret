import { MissingMeasures, parcelOf } from "../parcel"

const units = { weight_unit: "g", dimension_unit: "cm" } as const
const knife = { title: "Bıçak", quantity: 1, weight: 450, length: 35, width: 8, height: 4 }

describe("parcelOf (F7.2)", () => {
  it("weighs and sizes the lines in kilograms and centimetres, whatever the shop's units", () => {
    expect(parcelOf([knife], units)).toEqual({
      weight_kg: 0.45,
      length_cm: 10.4,
      width_cm: 10.4,
      height_cm: 10.4,
      desi: 0.5,
    })
    expect(
      parcelOf([{ ...knife, weight: 0.45, length: 350, width: 80, height: 40 }], {
        weight_unit: "kg",
        dimension_unit: "mm",
      }).weight_kg
    ).toBe(0.45)
  })

  it("charges the larger of the weight and the desi, for every unit ordered", () => {
    const pillow = { title: "Yastık", quantity: 2, weight: 500, length: 50, width: 40, height: 20 }

    // 2 × 40 000 cm³ = 80 000 cm³ → 26.7 desi against 1 kg
    expect(parcelOf([pillow], units).desi).toBe(26.7)
    // Heavy and small: the weight
    expect(parcelOf([{ ...knife, weight: 12_000 }], units).desi).toBe(12)
  })

  it("names every product without a weight or a measure, once", () => {
    const run = () =>
      parcelOf(
        [
          { ...knife, weight: null },
          { ...knife, quantity: 2, weight: null },
          { ...knife, title: "Kılıf", height: 0 },
          { ...knife, title: "İptal", quantity: 0, weight: null },
        ],
        units
      )

    expect(run).toThrow(MissingMeasures)
    try {
      run()
    } catch (error) {
      expect((error as MissingMeasures).titles).toEqual(["Bıçak", "Kılıf"])
    }
  })
})
