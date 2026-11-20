import { freeHandle, wantedHandle } from "../categories"
import { isDemoCategory, isMatchable, mayGive } from "../demo-category"

describe("a moved category's handle (adr/0042 Ek 2026-11-20)", () => {
  it("wants the source's own slug, else its name's", () => {
    expect(wantedHandle({ handle: "bicak-setleri" }, "Bıçak Takımları")).toBe("bicak-setleri")
    expect(wantedHandle({ handle: "çakı" }, "Çakılar")).toBe("caki")
    expect(wantedHandle({ handle: null }, "Bıçak Takımları")).toBe("bicak-takimlari")
    expect(wantedHandle(undefined, "")).toBe("kategori")
  })

  it("numbers a handle another category holds", () => {
    expect(freeHandle("bicaklar", new Set(["bicaklar", "bicaklar-2"]))).toBe("bicaklar-3")
    expect(freeHandle("bicaklar", new Set())).toBe("bicaklar")
  })
})

describe("categories here a moved one may take", () => {
  const shop = { id: "pcat_1", handle: "bicaklar", is_active: true, metadata: null }
  const demo = { ...shop, metadata: { demo: true, demo_catalog: "mutfak" } }

  it("matches by name only a live category of the shop's own", () => {
    expect(isMatchable(shop)).toBe(true)
    expect(isMatchable({ ...shop, is_active: false })).toBe(false)
    expect(isMatchable(demo)).toBe(false)
    expect(isDemoCategory({ ...shop, metadata: { demo: "true" } })).toBe(false)
  })

  it("takes a handle only from a switched-off demo category", () => {
    expect(mayGive({ ...demo, is_active: false })).toBe(true)
    expect(mayGive(demo)).toBe(false)
    expect(mayGive({ ...shop, is_active: false })).toBe(false)
  })
})
