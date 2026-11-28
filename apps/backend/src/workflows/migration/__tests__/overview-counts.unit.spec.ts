import { MOVED_RECORDS_SQL, PRODUCT_EXTENSION_LINK } from "../overview-counts"

describe("the migration overview's counts", () => {
  it("joins the product ↔ catalog extension link by Medusa's own table name", () => {
    expect(PRODUCT_EXTENSION_LINK).toBe("product_product_catalogextension_product_extension")
    expect(MOVED_RECORDS_SQL).toContain(`FROM ${PRODUCT_EXTENSION_LINK} link`)
  })

  it("counts in one statement and reads no document", () => {
    expect(MOVED_RECORDS_SQL).not.toMatch(/SELECT\s+[^(]*summary_doc\s*,/i)
    expect(MOVED_RECORDS_SQL).not.toContain("?")
  })
})
