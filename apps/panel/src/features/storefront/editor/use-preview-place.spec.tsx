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
})
