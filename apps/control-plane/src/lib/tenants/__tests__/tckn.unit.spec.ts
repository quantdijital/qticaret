import { maskedTckn, openTckn, sealTckn } from "../tckn"

// A valid TCKN made for this test (check digits only; no person's)
const TCKN = "10000000146"

describe("a sole proprietor's TCKN at rest (adr/0061 §2, §4.1)", () => {
  it("is sealed, never in the clear, and opens for its own shop", async () => {
    const sealed = await sealTckn("ten_A", TCKN)

    expect(sealed.tckn_sealed).toMatch(/^qtenv1\./)
    expect(sealed.tckn_sealed).not.toContain(TCKN)
    expect(sealed.tckn_last4).toBe("0146")
    await expect(openTckn("ten_A", sealed.tckn_sealed)).resolves.toBe(TCKN)
  })

  it("does not open when copied to another shop's row", async () => {
    const { tckn_sealed } = await sealTckn("ten_A", TCKN)

    await expect(openTckn("ten_B", tckn_sealed)).rejects.toMatchObject({
      code: "envelope.open_failed",
    })
  })

  it("is shown masked by its last four digits", () => {
    expect(maskedTckn("0146")).toBe("*******0146")
    expect(maskedTckn(null)).toBeNull()
  })
})
