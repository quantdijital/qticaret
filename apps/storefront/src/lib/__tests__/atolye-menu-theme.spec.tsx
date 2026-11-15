// @vitest-environment jsdom
import { act } from "react"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NavCategoryView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The menu's parts themselves: the themes export pages, not their parts
import { Aisle } from "../../../../../packages/themes/atolye/src/frame/Aisle"
import { MenuSheet } from "../../../../../packages/themes/atolye/src/frame/MenuSheet"
import { menuWords } from "../../../../../packages/themes/atolye/src/frame/menu-words"

/**
 * The aisle's dropdown and the phone's sheet in the browser (owner's
 * "M1", 2026-11-15): a press opens a category's dropdown and says so,
 * Escape closes it with the focus back on its button; one that would pass
 * the aisle's end lines up with its category's end; the sheet lists
 * "Tümünü gör" with the count first, then the children as rows with
 * their pictures and counts.
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
    label: "Çakılar",
    path: "/kategori/cakilar",
    count: 58,
    image: photo("/media/cakilar.jpg"),
    children: [
      {
        label: "Elmax Çakılar",
        path: "/kategori/cakilar/elmax",
        count: 5,
        image: photo("/media/elmax.jpg"),
      },
      { label: "Damascus Çakılar", path: "/kategori/cakilar/damascus" },
    ],
  },
  { label: "Av Bıçağı", path: "/kategori/av-bicagi", count: 24, children: [] },
  { label: "Hediyelik", path: "/kategori/hediyelik", children: [] },
]

const WORDS = menuWords(CATEGORIES, t)

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
  vi.restoreAllMocks()
})

function render(node: ReactNode) {
  act(() => {
    root.render(node)
  })
}

/** A link's text as a screen reader hears it: its visible words left out where hidden. */
const heard = (element: Element | null | undefined): string =>
  [...(element?.childNodes ?? [])]
    .map((node) =>
      node instanceof Element
        ? node.getAttribute("aria-hidden") === "true"
          ? ""
          : heard(node)
        : (node.textContent ?? "")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

describe("the aisle's dropdown in the browser", () => {
  const aisle = () => (
    <Aisle categories={CATEGORIES} label={t("nav.categories")} words={WORDS} centered />
  )
  const trigger = () => {
    const found = host.querySelector<HTMLButtonElement>("button")
    if (!found) {
      throw new Error("No category button")
    }
    return found
  }
  const drop = () => host.querySelector<HTMLElement>('[data-gf-drop="/kategori/cakilar"]')

  it("opens on a press, says so, and closes on Escape with the focus back on its button", () => {
    render(aisle())
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    expect(drop()?.getAttribute("data-state")).toBe("closed")

    act(() => {
      trigger().focus()
      trigger().click()
    })
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    expect(drop()?.getAttribute("data-state")).toBe("open")
    expect(trigger().getAttribute("aria-controls")).toBe(drop()?.id)

    act(() => {
      drop()
        ?.querySelector("a")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(trigger())
  })

  it("reads each row as its name and count, the last as the category's see-all and count", () => {
    render(aisle())
    const rows = [...(drop()?.querySelectorAll("a") ?? [])]
    expect(rows.map((row) => [row.getAttribute("href"), heard(row)])).toEqual([
      ["/kategori/cakilar/elmax", "Elmax Çakılar 5 ürün"],
      ["/kategori/cakilar/damascus", "Damascus Çakılar"],
      ["/kategori/cakilar", "Tümünü gör: Çakılar 58 ürün"],
    ])
    // A category without children stays a plain link, counted or not
    expect(host.querySelector('a[href="/kategori/av-bicagi"]')?.textContent).toBe("Av Bıçağı")
  })

  it("lines up with its category's end when it would pass the aisle's end", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(336)
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element
    ) {
      // The aisle ends at 900 px; the category starts at 700 px, 336 px would pass it
      const left = this.tagName === "NAV" ? 0 : 700
      const right = this.tagName === "NAV" ? 900 : 780
      return { left, right, top: 0, bottom: 44, width: right - left, height: 44 } as DOMRect
    })
    render(aisle())
    act(() => {
      trigger().click()
    })
    expect(drop()?.getAttribute("data-align")).toBe("end")
  })

  it("hangs from its category's start where it fits", () => {
    render(aisle())
    act(() => {
      trigger().click()
    })
    expect(drop()?.getAttribute("data-align")).toBe("start")
  })
})

describe("the phone's menu sheet", () => {
  const open = () => {
    render(
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
          ...WORDS,
        }}
      />
    )
    act(() => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Menüyü aç"]')?.click()
    })
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')
    if (!sheet) {
      throw new Error("The sheet did not open")
    }
    return sheet
  }

  it("lists Tümünü gör with the count first, then the children with 36 px pictures and counts", () => {
    const sheet = open()
    const opened = sheet.querySelector("details ul")
    const rows = [...(opened?.querySelectorAll("a") ?? [])]
    expect(rows.map((row) => [row.getAttribute("href"), heard(row)])).toEqual([
      ["/kategori/cakilar", "Tümünü gör: Çakılar 58 ürün"],
      ["/kategori/cakilar/elmax", "Elmax Çakılar 5 ürün"],
      ["/kategori/cakilar/damascus", "Damascus Çakılar"],
    ])
    // The visible words: "Tümünü gör" and the pill
    expect(rows[0]?.querySelector('[aria-hidden="true"]')?.textContent).toBe("Tümünü gör")
    expect(rows[0]?.querySelector(".gf-menu-count")?.textContent).toContain("58")
    // 48 px rows with a 36 px square each, the picture where there is one
    expect(rows[1]?.className).toContain("min-h-12")
    expect(rows[1]?.querySelector(".size-9 img")?.getAttribute("src")).toBe("/media/elmax.jpg")
    expect(rows[2]?.querySelector(".size-9")).not.toBeNull()
    expect(rows[2]?.querySelector(".gf-menu-count")).toBeNull()
  })

  it("counts a top category without children on its own row; an uncounted one shows no pill", () => {
    const sheet = open()
    const top = (path: string) => sheet.querySelector(`nav > ul > li > a[href="${path}"]`)
    expect(heard(top("/kategori/av-bicagi"))).toBe("Av Bıçağı 24 ürün")
    expect(heard(top("/kategori/hediyelik"))).toBe("Hediyelik")
    expect(top("/kategori/hediyelik")?.querySelector(".gf-menu-count")).toBeNull()
  })
})
