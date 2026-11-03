import { restoredAddonsMetadata } from "../set-line"

/** Medusa merges line metadata (2.21.2): the undo names the key, never the whole object. */
describe("restoredAddonsMetadata", () => {
  const addons = {
    items: [{ addon_id: "add_1", kind: "text", label: "Yazı", value: "Ada", amount: 35 }],
    base: 1000,
    non_withdrawable: true,
    max_quantity: 10,
  }

  it("takes add-ons the line did not have out, with an empty string", () => {
    expect(restoredAddonsMetadata(null)).toEqual({ qt_addons: "" })
    expect(restoredAddonsMetadata({ qt_gift: { recipient_email: "a@b.c" } })).toEqual({
      qt_addons: "",
    })
  })

  it("puts the earlier add-ons back as they were, and touches no other key", () => {
    expect(restoredAddonsMetadata({ qt_addons: addons, qt_gift: { x: 1 }, note: "a" })).toEqual({
      qt_addons: addons,
    })
  })
})
