import { describe, expect, it } from "vitest"
import { bottomNavOf } from "../bottom-nav"

describe("bottomNavOf", () => {
  it.each([
    ["/", "home"],
    ["/?utm_source=x", "home"],
    ["/kategoriler", "categories"],
    ["/arama", "search"],
    ["/arama?q=bicak", "search"],
    ["/sepet", "cart"],
    ["/sepet/geri-don?token=x", "cart"],
    ["/hesap", "account"],
    ["/hesap/siparisler", "account"],
  ] as const)("marks %s as %s", (url, item) => {
    expect(bottomNavOf(url)).toEqual({ current: item })
  })

  it("marks nothing on pages under none of its items", () => {
    expect(bottomNavOf("/urun/keten-gomlek")).toEqual({ current: null })
    expect(bottomNavOf("/sepetler")).toEqual({ current: null })
    expect(bottomNavOf("/kategoriler-hakkinda")).toEqual({ current: null })
    expect(bottomNavOf("")).toEqual({ current: null })
  })

  it("stays away from the checkout, a preview and the maintenance link", () => {
    expect(bottomNavOf("/odeme")).toBeNull()
    expect(bottomNavOf("/odeme?adim=kargo")).toBeNull()
    expect(bottomNavOf("/odeme/kart")).toBeNull()
    expect(bottomNavOf("/odeme/durum?d=bekliyor")).toBeNull()
    expect(bottomNavOf("/onizleme/sfl_x.y.z?sayfa=%2Fmagaza")).toBeNull()
    expect(bottomNavOf("/bakim/gir?t=x")).toBeNull()
    // A shop page whose slug only starts like one keeps the bar
    expect(bottomNavOf("/odemeler-hakkinda")).toEqual({ current: null })
  })
})
