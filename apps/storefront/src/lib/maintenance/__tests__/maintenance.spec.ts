import { describe, expect, it } from "vitest"
import { escapeHtml, expectedLine, maintenanceHtml, maintenanceResponse } from "../page"
import {
  bypassCookieName,
  isAllowedPath,
  isBypassToken,
  isOpenDuringMaintenance,
  isStorefrontOpenPath,
  retryAfterSeconds,
} from "../rules"

const NOW = Date.parse("2026-11-03T12:00:00+03:00")

describe("the paths a dark shop keeps open", () => {
  it.each([
    "/onizleme/cnt_01ABC.zzz.mac",
    "/onizleme/sfl_01ABC.zzz.mac",
    "/odeme/sonuc",
    "/odeme/sonuc/hata",
    "/odeme/durum",
    "/bakim/gir",
    "/robots.txt",
    "/sitemap.xml",
    "/sitemap-products-1.xml",
    "/_next/webpack-hmr",
    "/_next/static/chunks/a.js",
    "/_next/image",
    "/.well-known/security.txt",
    "/favicon.ico",
    "/icon.svg",
  ])("leaves %s open", (path) => {
    expect(isStorefrontOpenPath(path)).toBe(true)
  })

  it.each([
    "/",
    "/odeme",
    "/odeme/kart",
    "/odeme/sonuclar",
    "/sepet",
    "/hesap/giris",
    "/urun/keten-gomlek",
    "/onizleme",
    "/bakim",
    "/bakim/gir/baska",
    "/robots.txt.bak",
    // Only the crawlers' files by their names, only Next's own files (adr/0061 Ek C15 L3)
    "/sitemap-kampanya",
    "/sitemaps",
    "/sitemap.xml/x",
    "/_next/data/x.json",
    "/_next/x",
    "/kategoriler",
  ])("closes %s", (path) => {
    expect(isStorefrontOpenPath(path)).toBe(false)
  })

  it("opens the shop's paths exactly, or with what is below them for `/x/*`", () => {
    const allow = ["/iletisim", "/sozlesmeler/*"]
    expect(isAllowedPath("/iletisim", allow)).toBe(true)
    expect(isAllowedPath("/iletisim/form", allow)).toBe(false)
    expect(isAllowedPath("/iletisimler", allow)).toBe(false)
    expect(isAllowedPath("/sozlesmeler", allow)).toBe(true)
    expect(isAllowedPath("/sozlesmeler/mesafeli-satis", allow)).toBe(true)
    expect(isAllowedPath("/sozlesmelerimiz", allow)).toBe(false)
    expect(isAllowedPath("/", allow)).toBe(false)
  })

  it("compares as the backend stores them: lower case, no trailing slash", () => {
    expect(isAllowedPath("/Iletisim/", ["/iletisim"])).toBe(true)
    expect(isAllowedPath("/SOZLESMELER/Gizlilik", ["/sozlesmeler/*"])).toBe(true)
    expect(isAllowedPath("/iletisim", ["/Iletisim/"])).toBe(true)
    // A rule that would open everything opens nothing (the backend refuses it too)
    expect(isAllowedPath("/sepet", ["/*"])).toBe(false)
    expect(isAllowedPath("/sepet", [])).toBe(false)
  })

  it("is open when either the storefront or the shop keeps the path", () => {
    expect(isOpenDuringMaintenance("/odeme/sonuc", [])).toBe(true)
    expect(isOpenDuringMaintenance("/iletisim", ["/iletisim"])).toBe(true)
    expect(isOpenDuringMaintenance("/", ["/iletisim"])).toBe(false)
  })
})

describe("Retry-After", () => {
  it("is the seconds until the expected opening, between five minutes and a day", () => {
    expect(retryAfterSeconds("2026-11-03T14:00:00+03:00", NOW)).toBe(7200)
    expect(retryAfterSeconds("2026-11-03T12:01:00+03:00", NOW)).toBe(300)
    expect(retryAfterSeconds("2026-11-10T12:00:00+03:00", NOW)).toBe(86_400)
    expect(retryAfterSeconds("2026-11-03T12:30:00.500+03:00", NOW)).toBe(1801)
  })

  it("is an hour with no time, an unreadable one or one already past", () => {
    expect(retryAfterSeconds(null, NOW)).toBe(3600)
    expect(retryAfterSeconds("yakında", NOW)).toBe(3600)
    expect(retryAfterSeconds("2026-11-03T11:00:00+03:00", NOW)).toBe(3600)
    expect(retryAfterSeconds("2026-11-03T12:00:00+03:00", NOW)).toBe(3600)
  })
})

describe("the bypass link", () => {
  const MAC = "A".repeat(43)

  it("takes only the backend's token shape", () => {
    expect(isBypassToken(`mnb_AbCdEfGhIjKlMnOp.mhx0v3k0.${MAC}`)).toBe(true)
    // base64url's own two characters in the random part
    expect(isBypassToken(`mnb_Ab-dEf_hIjKlMnOp.mhx0v3k0.${MAC}`)).toBe(true)
    expect(isBypassToken("bozuk")).toBe(false)
    expect(isBypassToken(null)).toBe(false)
    expect(isBypassToken(undefined)).toBe(false)
    // Another kind of signed link, a short random part, a short MAC, an upper-case end
    expect(isBypassToken(`sfl_AbCdEfGhIjKlMnOp.mhx0v3k0.${MAC}`)).toBe(false)
    expect(isBypassToken(`mnb_AbCd.mhx0v3k0.${MAC}`)).toBe(false)
    expect(isBypassToken(`mnb_AbCdEfGhIjKlMnOp.mhx0v3k0.${MAC.slice(1)}`)).toBe(false)
    expect(isBypassToken(`mnb_AbCdEfGhIjKlMnOp.MHX0.${MAC}`)).toBe(false)
    expect(isBypassToken(`mnb_AbCdEfGhIjKlMnOp.mhx0v3k0.${MAC}\n`)).toBe(false)
  })

  it("keeps its cookie under `__Host-` over HTTPS", () => {
    expect(bypassCookieName(true)).toBe("__Host-qt_bypass")
    expect(bypassCookieName(false)).toBe("qt_bypass")
  })
})

describe("the maintenance page", () => {
  const notice = {
    shopName: "Bıçak & Co",
    title: "Yeni yüzümüzle <döneceğiz>",
    message: "Sipariş için 0532 000 00 00\n\nTeşekkürler",
    expectedAt: "2026-11-10T09:00:00+03:00",
  }

  it("writes the shop's words as text, line by line, with the opening time in Turkish", () => {
    const html = maintenanceHtml(notice, "bm9uY2U=", { now: NOW })
    expect(html).toContain('<p class="shop">Bıçak &amp; Co</p>')
    expect(html).toContain("<h1>Yeni yüzümüzle &lt;döneceğiz&gt;</h1>")
    expect(html).toContain("<p>Sipariş için 0532 000 00 00</p><p>Teşekkürler</p>")
    expect(html).toContain("10 Kasım 2026 09:00")
    expect(html).toContain('<style nonce="bm9uY2U=">')
    expect(html).not.toContain("noindex")
    expect(html).not.toMatch(/ style=/)
  })

  it("uses its own words when the shop wrote none, and no time once it has passed", () => {
    const html = maintenanceHtml(
      { shopName: "Mağaza", title: null, message: null, expectedAt: "2026-11-01T09:00:00+03:00" },
      "n",
      { now: NOW }
    )
    expect(html).toContain("<h1>Kısa bir aradayız</h1>")
    expect(html).toContain("bakım çalışması")
    expect(html).not.toContain("Tahmini açılış")
    expect(expectedLine(null, NOW)).toBeNull()
  })

  it("says a broken link is broken, kept out of indexes", () => {
    const html = maintenanceHtml(notice, "n", { linkInvalid: true, now: NOW })
    expect(html).toContain("<h1>Bağlantı geçersiz</h1>")
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).not.toContain("Teşekkürler")
  })

  it("answers 503 with Retry-After, never stored, under the page's CSP; a HEAD has no body", async () => {
    const response = maintenanceResponse(notice, {
      nonce: "n",
      csp: "default-src 'self'",
      now: NOW,
    })
    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("86400")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-security-policy")).toBe("default-src 'self'")
    expect(response.headers.get("x-robots-tag")).toBeNull()
    expect(await response.text()).toContain("Bıçak &amp; Co")

    const head = maintenanceResponse(notice, { nonce: "n", csp: "", head: true, now: NOW })
    expect(await head.text()).toBe("")

    const broken = maintenanceResponse(notice, { nonce: "n", csp: "", linkInvalid: true, now: NOW })
    expect(broken.headers.get("x-robots-tag")).toBe("noindex")
    expect(broken.headers.get("referrer-policy")).toBe("no-referrer")
  })

  it("escapes every character that could leave text", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    )
  })
})
