import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { refusalOf, samplesPackArg } from "../load-samples"

describe("the provisioner's sample catalogue script", () => {
  it("reads its pack argument and refuses anything else", () => {
    expect(samplesPackArg(["pack=travel"])).toBe("travel")
    expect(() => samplesPackArg([])).toThrow(/required/)
    expect(() => samplesPackArg(["pack=../x"])).toThrow(/required/)
    expect(() => samplesPackArg(["pack=--help"])).toThrow(/required/)
  })

  it("tells the quick check's refusals apart, and throws anything else", () => {
    expect(refusalOf(new MedusaError(MedusaError.Types.NOT_FOUND, "sample_catalog.unknown"))).toBe(
      "unknown_samples"
    )
    // A workflow's error may come back as a plain object of the same shape
    expect(
      refusalOf({ type: MedusaError.Types.NOT_FOUND, message: "sample_catalog.unknown" })
    ).toBe("unknown_samples")
    expect(
      refusalOf(new ValidationError("sample_catalog.pack_not_applied", { field: "pack" }))
    ).toBe("unknown_samples")
    expect(refusalOf(new ValidationError("sample_catalog.already_loaded", { field: "pack" }))).toBe(
      "already_loaded"
    )
    expect(refusalOf(new ValidationError("sample_catalog.busy"))).toBeNull()
    expect(refusalOf(new MedusaError(MedusaError.Types.NOT_FOUND, "media.file_unknown"))).toBeNull()
    expect(refusalOf(new Error("boom"))).toBeNull()
    expect(refusalOf(null)).toBeNull()
  })
})
