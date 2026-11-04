import { isConflictError } from "../../../lib/errors"
import { LEGAL_KINDS, checkLegalDoc, hasStarterNote, starterOf } from "../../../lib/legal"
import { resetTextOf } from "../documents"

const published = {
  title: "İade politikası",
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "{iade_süresi} gün." }] }],
  },
}

/** The owner, 2026-11-04: a draft started again from the starter or the published text. */
describe("the text a draft is started again from", () => {
  it.each(LEGAL_KINDS)(
    "is the %s starter as GET starter gives it, its draft note and tokens with it",
    (kind) => {
      const text = resetTextOf(kind, "starter", published)

      expect(text).toEqual(starterOf(kind))
      // The note for the shop comes with it; publishing removes it
      expect(hasStarterNote(text.body)).toBe(true)
      // The save step checks the tokens again: a starter passes it
      expect(checkLegalDoc(text.body, kind)).toMatchObject({
        isMalformed: false,
        unknownTokens: [],
        broken: [],
      })
    }
  )

  it("is a copy of the published text, title and all", () => {
    expect(resetTextOf("return_policy", "published", published)).toEqual(published)
  })

  it("is refused with 409 legal.nothing_published when nothing is published to copy", () => {
    let thrown: unknown
    try {
      resetTextOf("return_policy", "published", null)
    } catch (error) {
      thrown = error
    }
    expect(isConflictError(thrown)).toBe(true)
    expect(thrown).toMatchObject({ safeMessage: "legal.nothing_published" })
  })
})
