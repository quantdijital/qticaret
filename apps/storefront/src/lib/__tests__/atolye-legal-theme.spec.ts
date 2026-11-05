import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { LegalPageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's legal page (docs/tema/yon-2026-11-05.md § Yasal metin): the
 * title and the date in force, the text in a reading measure, its table
 * of contents (a closed well on a phone, a list beside the text from
 * 1024 px) and the shop's other texts at the end.
 */

const view = (over: Partial<LegalPageView> = {}): LegalPageView => ({
  title: "Mesafeli Satış Sözleşmesi",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Mesafeli Satış Sözleşmesi", path: null },
  ],
  html: '<h2 id="1-taraflar">1. Taraflar</h2><p>Satıcı.</p><h2 id="2-konu">2. Konu</h2><p>Konu.</p>',
  updated: { label: "5 Kasım 2026", dateTime: "2026-11-05T06:00:00.000Z" },
  outline: [
    { id: "1-taraflar", label: "1. Taraflar" },
    { id: "2-konu", label: "2. Konu" },
  ],
  others: [{ label: "Çerez Politikası", path: "/yasal/cerez-politikasi" }],
  ...over,
})

const page = (over: Partial<LegalPageView> = {}) =>
  renderPage(atolyeTheme, "LegalPage", { view: view(over) })

describe("the theme's legal page", () => {
  it("opens with the trail, the one h1 and the date this version came into force", () => {
    const html = page()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">Mesafeli Satış Sözleşmesi</h1>")
    expect(html).toContain('<time dateTime="2026-11-05T06:00:00.000Z"')
    expect(html).toContain("Son güncelleme:")
    expect(html).toContain('aria-current="page"')
  })

  it("lists the text's headings twice, closed on a phone and open beside the text, each to its anchor", () => {
    const html = page()
    expect(html.match(/href="#1-taraflar"/g)).toHaveLength(2)
    expect(html.match(/href="#2-konu"/g)).toHaveLength(2)
    expect(html).toMatch(/<details class="[^"]*lg:hidden"/)
    expect(html).toContain("2 bölüm")
    expect(html).toContain('<h2 id="1-taraflar">1. Taraflar</h2>')
  })

  it("sets the text in the posts' reading column, its contents on the left from 1024 px", () => {
    const html = page()
    // Owner 2026-11-05: 56 letters was "aşırı dar" on a computer
    expect(html).toContain("lg:grid-cols-[minmax(14rem,1fr)_minmax(0,46rem)_minmax(0,1fr)]")
    expect(html).toMatch(/<aside[^>]*class="max-lg:hidden lg:col-start-1 lg:row-start-1"/)
    expect(html).toMatch(/<article class="min-w-0 lg:col-start-2">/)
    expect(html).not.toContain("56ch")
  })

  it("leaves the table of contents out for a text of one heading", () => {
    const html = page({ outline: [{ id: "tek", label: "Tek" }] })
    expect(html).not.toContain("İçindekiler")
    expect(html).not.toContain("<details")
  })

  it("closes on the shop's other legal texts, and on nothing without them", () => {
    expect(page()).toContain('href="/yasal/cerez-politikasi"')
    expect(page()).toContain("Diğer yasal metinler")
    expect(page({ others: [] })).not.toContain("Diğer yasal metinler")
  })
})
