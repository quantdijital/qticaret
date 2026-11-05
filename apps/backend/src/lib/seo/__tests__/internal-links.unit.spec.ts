import {
  bareHost,
  internalLinkOf,
  isHostname,
  isStorefrontPage,
  outcomeOf,
} from "../internal-links"

const hosts = new Set(["mylarte.com", "magaza.example.com"])

describe("internal links (adr/0042 Ek 2026-11-05)", () => {
  it("takes a path on the shop and an absolute address on its hosts, www or not", () => {
    expect(internalLinkOf("/el-yapimi-caki/", hosts)).toEqual({
      path: "/el-yapimi-caki/",
      query: "",
      hash: "",
      absolute: false,
    })
    expect(internalLinkOf("https://www.mylarte.com/urun/x/?renk=mavi#yorumlar", hosts)).toEqual({
      path: "/urun/x/",
      query: "?renk=mavi",
      hash: "#yorumlar",
      absolute: true,
    })
    expect(internalLinkOf("HTTP://MYLARTE.COM/Magaza", hosts)?.path).toBe("/Magaza")
    expect(internalLinkOf("//magaza.example.com/sepet", hosts)?.absolute).toBe(true)
  })

  it("never takes a link elsewhere, another scheme, an anchor or a relative address", () => {
    for (const href of [
      "https://example.org/el-yapimi-caki",
      "https://mylarte.com.evil.example/x",
      "https://user:pass@mylarte.com/x",
      "mailto:bilgi@mylarte.com",
      "tel:+905320000000",
      "#bolum-2",
      "urun/x",
      "javascript:alert(1)",
    ]) {
      expect(internalLinkOf(href, hosts)).toBeNull()
    }
  })

  it("knows the storefront's own pages, never a record's prefix or the backend's", () => {
    for (const path of [
      "/",
      "/blog",
      "/sepet",
      "/arama",
      "/yasal/kvkk-aydinlatma-metni",
      "/magaza",
    ]) {
      expect(isStorefrontPage(path)).toBe(true)
    }
    for (const path of [
      "/urun/x",
      "/kategori/x",
      "/blog/elmax",
      "/el-yapimi-caki",
      "/admin",
      "/store/x",
    ]) {
      expect(isStorefrontPage(path)).toBe(false)
    }
  })

  it("points a moved link at its new address, the fragment kept", () => {
    const link = internalLinkOf("https://mylarte.com/el-yapimi-caki/#n690", hosts)
    expect(
      link &&
        outcomeOf("https://mylarte.com/el-yapimi-caki/#n690", link, {
          type: "moved",
          location: "/kategori/el-yapimi-caki",
        })
    ).toEqual({ status: "changed", href: "/kategori/el-yapimi-caki#n690" })
  })

  it("writes a live page as the shop keeps its path: no host, no trailing slash, query kept", () => {
    const absolute = internalLinkOf("https://mylarte.com/urun/x/?a=1", hosts)
    expect(
      absolute &&
        outcomeOf("https://mylarte.com/urun/x/?a=1", absolute, { type: "live", path: "/urun/x" })
    ).toEqual({ status: "changed", href: "/urun/x?a=1" })
    const already = internalLinkOf("/urun/x", hosts)
    expect(already && outcomeOf("/urun/x", already, { type: "live", path: "/urun/x" })).toEqual({
      status: "same",
    })
  })

  it("leaves a gone or unknown address as written, and says why", () => {
    const link = internalLinkOf("/eski-kampanya", hosts)
    expect(link && outcomeOf("/eski-kampanya", link, { type: "gone" })).toEqual({
      status: "unresolved",
      reason: "gone",
    })
    expect(link && outcomeOf("/eski-kampanya", link, { type: "not_found" })).toEqual({
      status: "unresolved",
      reason: "not_found",
    })
  })

  it("compares hosts without case or www, and knows a hostname", () => {
    expect(bareHost(" WWW.MyLarte.com ")).toBe("mylarte.com")
    expect(isHostname("mylarte.com")).toBe(true)
    expect(isHostname("magaza")).toBe(false)
    expect(isHostname("https://mylarte.com")).toBe(false)
    expect(isHostname("my larte.com")).toBe(false)
  })
})
