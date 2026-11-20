import { describe, expect, it } from "vitest"
import { editorSearch } from "./editor-search"

/** The theme editor's address: what it opens on, nothing else kept. */
describe("the editor's address", () => {
  it("keeps the preferences panel and a content page's id, in their own shape only", () => {
    expect(editorSearch({ open: "preferences", icerik: "cnt_01KABC" })).toEqual({
      open: "preferences",
      icerik: "cnt_01KABC",
    })
    expect(editorSearch({ icerik: "cnt_hakkimizda" })).toEqual({ icerik: "cnt_hakkimizda" })
    expect(editorSearch({ icerik: "prod_1" })).toEqual({})
    expect(editorSearch({ icerik: "cnt_../x" })).toEqual({})
    expect(editorSearch({ icerik: 12, open: "theme", sayfa: "/x" })).toEqual({})
  })

  it("never says a page is new: an old or written `yeni=1` is left out", () => {
    expect(editorSearch({ icerik: "cnt_hakkimizda", yeni: "1" })).toEqual({
      icerik: "cnt_hakkimizda",
    })
  })
})
