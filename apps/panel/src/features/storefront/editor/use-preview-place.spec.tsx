import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { sampleAt, usePreviewPlace } from "./use-preview-place"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("./use-preview-sample", () => ({
  usePreviewSamples: () => ({
    data: [{ id: "prod_1", name: "Şef bıçağı", path: "/urun/sef-bicagi" }],
    isPending: false,
  }),
}))
// The shop's content pages (adr/0073 §5): a live one and a draft
const PAGES = [
  { id: "cnt_hakkimizda", title: "Hakkımızda", handle: "hakkimizda", path: "/hakkimizda" },
  { id: "cnt_iade", title: "İade", handle: "iade", path: "/iade", status: "draft" },
].map((page) => ({ status: "published", ...page }))
vi.mock("./use-content-pages", () => ({
  useContentPages: () => ({ data: { pages: PAGES, count: PAGES.length }, isPending: false }),
  useContentPage: (id: string | null) => ({
    page: PAGES.find((page) => page.id === id) ?? null,
    finding: false,
  }),
}))

/** The page worked on and shown, as links in the preview change it (adr/0065 Faz 2). */
describe("the preview's place", () => {
  it("names a page reached in the frame by its last part", () => {
    expect(sampleAt("/urun/%C5%9Fef-bicagi?renk=siyah")).toMatchObject({
      name: "şef-bicagi",
      path: "/urun/%C5%9Fef-bicagi?renk=siyah",
    })
    expect(sampleAt("/%E0%A4%A")).toMatchObject({ name: "%E0%A4%A" })
  })

  function setup() {
    const onPageChange = vi.fn()
    const hook = renderHook(() => usePreviewPlace({ onPageChange }))
    return { hook, onPageChange }
  }

  it("shows a link followed at once, then a product's page with that product", () => {
    const { hook, onPageChange } = setup()
    act(() => {
      hook.result.current.visit("/urun/kasap")
    })
    expect(hook.result.current.target.path).toBe("/urun/kasap")
    act(() => {
      hook.result.current.land("/urun/kasap", "product")
    })
    expect(hook.result.current.page).toBe("product")
    expect(hook.result.current.visited).toBeNull()
    expect(hook.result.current.target.path).toBe("/urun/kasap")
    expect(hook.result.current.target.sample?.name).toBe("kasap")
    expect(onPageChange).toHaveBeenCalledTimes(1)
  })

  it("keeps a page none of the editor's (the cart) until a page is picked", () => {
    const { hook } = setup()
    act(() => {
      hook.result.current.visit("/sepet")
    })
    act(() => {
      hook.result.current.land("/sepet", null)
    })
    expect(hook.result.current.page).toBe("home")
    expect(hook.result.current.visited).toBe("/sepet")
    expect(hook.result.current.target.path).toBe("/sepet")
    act(() => {
      hook.result.current.choosePage("category")
    })
    expect(hook.result.current.visited).toBeNull()
    expect(hook.result.current.target.path).toBe("/urun/sef-bicagi")
  })

  it("goes home when the frame drew the home page, whatever path it fell back from", () => {
    const { hook } = setup()
    act(() => {
      hook.result.current.choosePage("product")
    })
    act(() => {
      hook.result.current.visit("/odeme")
    })
    act(() => {
      hook.result.current.land("/odeme", "home")
    })
    expect(hook.result.current.page).toBe("home")
    expect(hook.result.current.target.path).toBeNull()
  })

  it("works on the shop's first content page until another is picked", () => {
    const { hook, onPageChange } = setup()
    act(() => {
      hook.result.current.choosePage("content")
    })
    expect(hook.result.current.content).toBe("cnt_hakkimizda")
    expect(hook.result.current.target.path).toBe("/hakkimizda")
    expect(hook.result.current.target.draft).toBe(false)
    act(() => {
      hook.result.current.chooseContent("cnt_iade")
    })
    expect(hook.result.current.content).toBe("cnt_iade")
    expect(hook.result.current.target).toMatchObject({ path: "/iade", draft: true })
    expect(onPageChange).toHaveBeenCalledTimes(2)
  })

  it("opens on the content page the address names", () => {
    const hook = renderHook(() => usePreviewPlace({ onPageChange: vi.fn(), content: "cnt_iade" }))
    expect(hook.result.current.page).toBe("content")
    expect(hook.result.current.target.path).toBe("/iade")
  })

  it("takes a content page reached in the frame, by its address, for that page", () => {
    const { hook } = setup()
    act(() => {
      hook.result.current.visit("/hakkimizda?ref=menu")
    })
    expect(hook.result.current.page).toBe("content")
    expect(hook.result.current.content).toBe("cnt_hakkimizda")
    expect(hook.result.current.visited).toBeNull()
    // One with a layout of its own is told by its sections, whatever its address
    act(() => {
      hook.result.current.land("/iade", null, "cnt_iade")
    })
    expect(hook.result.current.content).toBe("cnt_iade")
    // A page that is none of the shop's content pages is shown as it is
    act(() => {
      hook.result.current.land("/sepet", null)
    })
    expect(hook.result.current.visited).toBe("/sepet")
    expect(hook.result.current.content).toBe("cnt_iade")
  })
})
