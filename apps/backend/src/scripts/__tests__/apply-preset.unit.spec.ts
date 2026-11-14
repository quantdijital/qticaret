import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { isUnknownPreset, presetArgs } from "../apply-preset"

describe("the provisioner's preset script (adr/0063 §7)", () => {
  it("reports only an unknown preset or an unapplied pack as unknown_preset", () => {
    expect(
      isUnknownPreset(new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_preset.unknown"))
    ).toBe(true)
    expect(
      isUnknownPreset(new ValidationError("storefront_preset.pack_not_applied", { field: "pack" }))
    ).toBe(true)
    // A workflow's error may come back as a plain object of the same shape
    expect(
      isUnknownPreset({ type: MedusaError.Types.NOT_FOUND, message: "storefront_preset.unknown" })
    ).toBe(true)
    // Anything else not found on the way is thrown with its own code
    expect(
      isUnknownPreset(new MedusaError(MedusaError.Types.NOT_FOUND, "media.file_unknown"))
    ).toBe(false)
    expect(isUnknownPreset(new ValidationError("storefront_preset.invalid", { field: "x" }))).toBe(
      false
    )
    expect(isUnknownPreset(null)).toBe(false)
  })

  it("reads its arguments", () => {
    expect(presetArgs(["pack=general", "preset=grafit"])).toEqual({
      pack: "general",
      preset: "grafit",
      demo: false,
    })
    expect(() => presetArgs(["pack=general"])).toThrow(/required/)
  })
})
