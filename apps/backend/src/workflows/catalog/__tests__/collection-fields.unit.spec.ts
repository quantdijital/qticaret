import { LIVE_RECORDS, keptRows, liveFieldsOf } from "../../seo/live-records"
import { CATALOG_ENTITY_TYPES } from "../entity-paths"
import { isCollectionShown } from "../collection-fields"

describe("a collection's visibility", () => {
  it("is shown without a row of its own, or with one the shop left on", () => {
    expect(isCollectionShown({})).toBe(true)
    expect(isCollectionShown({ collection_extension: null })).toBe(true)
    expect(isCollectionShown({ collection_extension: { is_active: true } })).toBe(true)
    expect(isCollectionShown({ collection_extension: { is_active: false } })).toBe(false)
  })

  it("is read through the link and checked after the query, as live records go", () => {
    const spec = LIVE_RECORDS.find((each) => each.type === CATALOG_ENTITY_TYPES.collection)
    if (!spec) {
      throw new Error("no collection spec")
    }
    const rows = [
      { id: "pcol_shown", collection_extension: { is_active: true } },
      { id: "pcol_plain" },
      { id: "pcol_hidden", collection_extension: { is_active: false } },
    ]

    expect(liveFieldsOf(spec)).toEqual(["id", "collection_extension.is_active"])
    expect(keptRows(spec, rows).map((row) => row.id)).toEqual(["pcol_shown", "pcol_plain"])
  })

  it("leaves other kinds' rows as their query found them", () => {
    const spec = LIVE_RECORDS.find((each) => each.type === CATALOG_ENTITY_TYPES.brand)
    if (!spec) {
      throw new Error("no brand spec")
    }
    expect(liveFieldsOf(spec)).toEqual(["id"])
    expect(keptRows(spec, [{ id: "brand_1" }])).toEqual([{ id: "brand_1" }])
  })
})
