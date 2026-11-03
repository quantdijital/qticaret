import { restoredGiftMetadata } from "../cart-gifts"

/** Medusa merges line metadata (2.21.2): the undo names the key, never the whole object. */
describe("restoredGiftMetadata", () => {
  const recipient = {
    recipient_email: "zeynep.kaya@example.com",
    recipient_name: null,
    message: null,
    sender_name: null,
  }

  it("takes a recipient the line did not have out, with an empty string", () => {
    expect(restoredGiftMetadata(null)).toEqual({ qt_gift: "" })
    expect(restoredGiftMetadata({ qt_addons: { items: [] } })).toEqual({ qt_gift: "" })
  })

  it("puts the earlier recipient back as it was, and touches no other key", () => {
    expect(restoredGiftMetadata({ qt_gift: recipient, other: 1 })).toEqual({ qt_gift: recipient })
  })
})
