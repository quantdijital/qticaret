// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderBarView, NavCategoryView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderFrame, shopFixture } from "@/test/theme-render"
// The theme's own parts: it exports pages, not these
import { MenuSheet } from "../../../../../packages/themes/atolye/src/frame/MenuSheet"
import { menuWords } from "../../../../../packages/themes/atolye/src/frame/menu-words"

/**
 * The menus' category pictures (adr/0049 Ek 2026-11-15, the owner's
 * "isteğe bağlı olsun"): on, "Kategoriler", the dropdowns and the phone's
 * sheet show each category's small square (an empty one where there is no
 * picture); off, all three are words only, no square, on any variant.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const photo = (src: string) => ({
  src,
  alt: "",
  width: 400,
  height: 400,
  sources: { avif: null, webp: null },
})

const CATEGORIES: NavCategoryView[] = [
  {
    label: "Mutfak",
    path: "/kategori/mutfak",
    image: photo("/media/mutfak.jpg"),
    children: [
      { label: "Şef bıçakları", path: "/kategori/mutfak/sef", image: photo("/media/sef.jpg") },
      { label: "Satırlar", path: "/kategori/mutfak/satir" },
    ],
  },
  { label: "Bahçe", path: "/kategori/bahce", children: [] },
]

const bar = (variant: HeaderBarView["variant"], menuImages?: boolean): HeaderBarView => ({
  id: "mainheader",
  variant,
  sticky: true,
  ...(menuImages === undefined ? {} : { menuImages }),
  ...(variant === "catalog"
    ? {
        catalog: {
          searchPlaceholder: null,
          searchLabel: false,
          accountText: true,
          cartTotal: false,
          highlight: null,
          utilityBar: true,
          phone: true,
          categories: CATEGORIES,
          menuGround: "stage",
        },
      }
    : {}),
})

/** The frame as the server prints it, read back as a document. */
const page = (headerBar: HeaderBarView) =>
  new DOMParser().parseFromString(
    renderFrame(atolyeTheme, shopFixture({ categories: CATEGORIES, headerBar })),
    "text/html"
  )

const squares = (within: Element | null | undefined) =>
  [...(within?.querySelectorAll(".size-10, .size-9") ?? [])].map((square) => ({
    size: square.classList.contains("size-10") ? 40 : 36,
    src: square.querySelector("img")?.getAttribute("src") ?? null,
  }))

describe("the menus' pictures in the header as the server prints it", () => {
  it("draws Kategoriler's rows with the dropdowns' squares, an empty one where none", () => {
    const doc = page(bar("catalog", true))
    const list = doc.querySelector('nav[aria-label="Tüm kategoriler"]')
    expect(squares(list?.querySelector("[data-cm-list='top']"))).toEqual([
      { size: 40, src: "/media/mutfak.jpg" },
      // The children's 36 px squares (in the panel) come first in Mutfak's row
      { size: 36, src: "/media/sef.jpg" },
      { size: 36, src: null },
      { size: 40, src: null },
    ])
    // The name beside its square, the row 48 px as the dropdown's
    const top = list?.querySelector<HTMLAnchorElement>('a[data-cm-top="0"]')
    expect(top?.className).toContain("min-h-12")
    expect(top?.querySelector("span.flex-1")?.textContent).toBe("Mutfak")
    // The dropdown under the main menu keeps its 40 px squares
    const drop = doc.querySelector('[data-gf-drop="/kategori/mutfak"]')
    expect(squares(drop)).toEqual([
      { size: 40, src: "/media/sef.jpg" },
      { size: 40, src: null },
    ])
  })

  it("reads an older answer without the setting as on", () => {
    const doc = page(bar("catalog"))
    expect(squares(doc.querySelector('nav[aria-label="Tüm kategoriler"]'))).toHaveLength(4)
  })

  it("draws words only, no square, when the shop turned them off", () => {
    const doc = page(bar("catalog", false))
    const list = doc.querySelector('nav[aria-label="Tüm kategoriler"]')
    expect(squares(list)).toEqual([])
    expect(list?.querySelector('a[data-cm-top="0"]')?.className).toContain("min-h-11")
    expect(list?.querySelector('a[href="/kategori/mutfak/sef"]')?.textContent).toBe("Şef bıçakları")
    const drop = doc.querySelector('[data-gf-drop="/kategori/mutfak"]')
    expect(squares(drop)).toEqual([])
    const rows = [...(drop?.querySelectorAll("a") ?? [])]
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.classList.contains("gf-drop-row--words"))).toBe(true)
  })

  it("is every variant's: today's header drops its dropdowns' squares too", () => {
    for (const variant of ["standard", "centered"] as const) {
      expect(squares(page(bar(variant, true)).querySelector("[data-gf-drop]"))).toHaveLength(2)
      expect(squares(page(bar(variant, false)).querySelector("[data-gf-drop]"))).toEqual([])
    }
  })
})

describe("the menus' pictures in the phone's sheet", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  const open = (pictures?: boolean) => {
    act(() => {
      root.render(
        <MenuSheet
          categories={CATEGORIES}
          topLinks={[]}
          contact={{
            email: null,
            phone: null,
            phoneHref: null,
            whatsappHref: null,
            address: null,
            hours: [],
            mapHref: null,
          }}
          words={{
            open: t("nav.open_menu"),
            title: t("nav.menu"),
            close: t("nav.close"),
            whatsapp: t("home.help_whatsapp"),
            ...menuWords(CATEGORIES, t),
          }}
          {...(pictures === undefined ? {} : { pictures })}
        />
      )
    })
    act(() => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Menüyü aç"]')?.click()
    })
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')
    if (!sheet) {
      throw new Error("The sheet did not open")
    }
    return sheet
  }

  it("shows the squares by default", () => {
    const sheet = open()
    expect(squares(sheet)).toEqual([
      { size: 40, src: "/media/mutfak.jpg" },
      { size: 36, src: "/media/sef.jpg" },
      { size: 36, src: null },
      { size: 40, src: null },
    ])
    expect(sheet.querySelector("details ul")?.className).toContain("ml-13")
  })

  it("lists words only when off, the children a step in under the parent's name", () => {
    const sheet = open(false)
    expect(squares(sheet)).toEqual([])
    expect(sheet.querySelector("details ul")?.className).toContain("ml-4")
    expect(sheet.querySelector('a[href="/kategori/bahce"]')?.textContent).toBe("Bahçe")
  })
})
