import {
  ORDER_NOTE_KEY,
  ORDER_NOTE_MAX,
  cleanOrderNote,
  orderNoteLength,
  orderNoteOf,
  withOrderNote,
} from "../customer-note"

describe("cleanOrderNote", () => {
  it("drops control and direction characters, keeps line breaks and Turkish letters", () => {
    expect(cleanOrderNote("Zil\u0000 bozuk\u0007\r\nKapıya\u202e bırakın\u2066")).toBe(
      "Zil bozuk\nKapıya bırakın"
    )
  })

  it("drops invisible format characters but keeps the joiners emoji need", () => {
    expect(cleanOrderNote("a\u200eb\u200bc\ufeffd\u{e0041}e\u061cf")).toBe("abcdef")
    expect(cleanOrderNote("👨\u200d👩")).toBe("👨\u200d👩")
    expect(cleanOrderNote("a\u2028\u2029\u2029\u2029b")).toBe("a\n\nb")
  })

  it("turns tabs into spaces, keeps one empty line at most, trims each line's end and the whole", () => {
    expect(cleanOrderNote("  a\tb   \n\n\n\n c  ")).toBe("a b\n\n c")
  })

  it("drops lone surrogates and joins letters into one form", () => {
    expect(cleanOrderNote("x\ud800y")).toBe("xy")
    expect(cleanOrderNote("i̇")).toBe("i̇".normalize("NFC"))
  })

  it("counts characters, not UTF-16 units", () => {
    expect(orderNoteLength("🎁🎁")).toBe(2)
  })
})

describe("orderNoteOf", () => {
  it("reads only a string under its key, cleaned and capped", () => {
    expect(orderNoteOf(null)).toBeNull()
    expect(orderNoteOf({ [ORDER_NOTE_KEY]: 5 })).toBeNull()
    expect(orderNoteOf({ [ORDER_NOTE_KEY]: " \u0000 " })).toBeNull()
    expect(orderNoteOf({ [ORDER_NOTE_KEY]: "b".repeat(ORDER_NOTE_MAX + 10) })).toHaveLength(
      ORDER_NOTE_MAX
    )
  })
})

describe("withOrderNote", () => {
  it("sets the note beside the other keys, and takes it off when empty", () => {
    expect(withOrderNote({ a: 1 }, "not")).toEqual({ a: 1, [ORDER_NOTE_KEY]: "not" })
    expect(withOrderNote({ a: 1, [ORDER_NOTE_KEY]: "not" }, "")).toEqual({ a: 1 })
    expect(withOrderNote(null, "")).toEqual({})
  })
})
