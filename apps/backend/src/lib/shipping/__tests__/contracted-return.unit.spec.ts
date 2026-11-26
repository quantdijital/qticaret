import { contractedReturnOf, requestReturnCode } from "../contracted-return"

const NONE = {
  aras: null,
  yurtici: null,
  dhlecommerce: null,
  other_carrier: null,
  other_code: null,
}

describe("contractedReturnOf (adr/0031 Ek 2026-11-26)", () => {
  it("is none without a code for the way the shop ships", () => {
    expect(contractedReturnOf({ codes: NONE, birfatura: false, primaryCarrier: null })).toBeNull()
    // BirFatura's carrier only: our carriers' codes do not count there
    expect(
      contractedReturnOf({
        codes: { ...NONE, aras: "111" },
        birfatura: true,
        primaryCarrier: "aras",
      })
    ).toBeNull()
    // Nor BirFatura's once the shop ships with its own contracts
    expect(
      contractedReturnOf({
        codes: { ...NONE, other_carrier: "Sürat Kargo", other_code: "555" },
        birfatura: false,
        primaryCarrier: null,
      })
    ).toBeNull()
  })

  it("takes the only carrier with a code, by its shopper-facing name", () => {
    expect(
      contractedReturnOf({
        codes: { ...NONE, yurtici: "222" },
        birfatura: false,
        primaryCarrier: "aras",
      })
    ).toEqual({ carrier: "Yurtiçi Kargo", code: "222" })
  })

  it("prefers the main option's carrier when both have a code, else Aras", () => {
    const codes = { ...NONE, aras: "111", yurtici: "222" }
    expect(contractedReturnOf({ codes, birfatura: false, primaryCarrier: "yurtici" })).toEqual({
      carrier: "Yurtiçi Kargo",
      code: "222",
    })
    expect(contractedReturnOf({ codes, birfatura: false, primaryCarrier: null })).toEqual({
      carrier: "Aras Kargo",
      code: "111",
    })
  })

  it("names DHL eCommerce by its brand, never MNG, and puts it last without a main option", () => {
    const codes = { ...NONE, yurtici: "222", dhlecommerce: "333" }
    expect(contractedReturnOf({ codes, birfatura: false, primaryCarrier: "dhlecommerce" })).toEqual(
      { carrier: "DHL eCommerce", code: "333" }
    )
    expect(contractedReturnOf({ codes, birfatura: false, primaryCarrier: null })).toEqual({
      carrier: "Yurtiçi Kargo",
      code: "222",
    })
  })

  it("names BirFatura's carrier as the shop wrote it", () => {
    expect(
      contractedReturnOf({
        codes: { ...NONE, aras: "111", other_carrier: "Sürat Kargo", other_code: "555" },
        birfatura: true,
        primaryCarrier: "aras",
      })
    ).toEqual({ carrier: "Sürat Kargo", code: "555" })
  })
})

describe("requestReturnCode", () => {
  const contracted = { carrier: "Aras Kargo", code: "111" }

  it("shows the contracted code only while the parcel is still to send", () => {
    expect(requestReturnCode({ status: "approved" }, contracted)).toEqual({
      return_code: "111",
      return_carrier: "Aras Kargo",
    })
    for (const status of ["requested", "rejected", "received", "refunded", "canceled"]) {
      expect(requestReturnCode({ status }, contracted)).toEqual({
        return_code: null,
        return_carrier: null,
      })
    }
    expect(requestReturnCode({ status: "approved" }, null).return_code).toBeNull()
  })

  it("keeps an old request's own code, unnamed, unless cancelled", () => {
    expect(requestReturnCode({ status: "received", return_code: "GLV1" }, contracted)).toEqual({
      return_code: "GLV1",
      return_carrier: null,
    })
    expect(
      requestReturnCode({ status: "canceled", return_code: "GLV1" }, contracted).return_code
    ).toBeNull()
  })
})
