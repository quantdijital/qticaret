// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
// The theme's own part: it exports pages, not this
import { MenuSheet } from "../../../../../packages/themes/atolye/src/frame/MenuSheet"

/**
 * The phone's menu (Tezgâh audit K-14): the catalog header's highlighted
 * link and the account under the categories, and Escape giving the focus
 * back to the menu button.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const WORDS = {
  open: "Menüyü aç",
  title: "Menü",
  close: "Kapat",
  seeAll: "Tümünü gör",
  allIn: {},
  counts: {},
  whatsapp: "WhatsApp",
}
const CONTACT = {
  phone: null,
  phoneHref: null,
  whatsappHref: null,
} as unknown as Parameters<typeof MenuSheet>[0]["contact"]

function draw(extra: Partial<Parameters<typeof MenuSheet>[0]> = {}) {
  act(() => {
    root.render(
      <MenuSheet
        categories={[{ label: "Çakılar", path: "/kategori/cakilar", children: [] }]}
        topLinks={[]}
        contact={CONTACT}
        words={WORDS}
        {...extra}
      />
    )
  })
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="Menüyü aç"]')
  if (!button) {
    throw new Error("no menu button")
  }
  act(() => {
    button.click()
  })
  return button
}

describe("the phone's menu", () => {
  it("lists the highlighted link and the account under the categories", () => {
    draw({
      highlight: { label: "İndirimdekiler", path: "/kampanyalar" },
      account: { label: "Hesabım", path: "/hesap" },
    })
    const links = [...document.querySelectorAll<HTMLAnchorElement>("[role=dialog] a")].map(
      (link) => [link.textContent, link.getAttribute("href")]
    )
    expect(links).toEqual([
      ["Çakılar", "/kategori/cakilar"],
      ["İndirimdekiler", "/kampanyalar"],
      ["Hesabım", "/hesap"],
    ])
  })

  it("adds nothing where the header has neither", () => {
    draw()
    expect(document.querySelectorAll("[role=dialog] a")).toHaveLength(1)
  })

  it("gives the focus back to the menu button when Escape closes it", async () => {
    const button = draw()
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    await act(async () => {
      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(button)
  })
})
