// @vitest-environment jsdom
import { act } from "react"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { StyleNonce } from "../StyleNonce"
// A Radix dialog of the theme's own: its scroll lock is what writes the style element
import { MenuSheet } from "../../../../../packages/themes/atolye/src/frame/MenuSheet"
import { menuWords } from "../../../../../packages/themes/atolye/src/frame/menu-words"

/**
 * The dialogs' scroll lock under the production CSP (`style-src 'self'
 * 'nonce-…'`): `react-remove-scroll` writes a `<style>` element when a
 * dialog opens, and the browser applies it only with this response's
 * nonce, which it takes from `__webpack_nonce__`.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  delete window.__webpack_nonce__
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  delete window.__webpack_nonce__
})

function render(node: ReactNode) {
  act(() => {
    root.render(node)
  })
}

const sheet = (
  <MenuSheet
    categories={[]}
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
      ...menuWords([], t),
    }}
  />
)

/** Opens the sheet and returns the scroll lock's style element. */
function openLock() {
  act(() => {
    host.querySelector<HTMLButtonElement>('button[aria-label="Menüyü aç"]')?.click()
  })
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  const lock = [...document.querySelectorAll("style")].find((style) =>
    style.textContent.includes("data-scroll-locked")
  )
  if (!lock) throw new Error("The scroll lock wrote no style element")
  return lock
}

describe("StyleNonce", () => {
  it("gives the scroll lock's style element this response's nonce", () => {
    render(
      <>
        <StyleNonce nonce="bm9uY2UtZm9yLXRlc3Q=" />
        {sheet}
      </>
    )
    expect(openLock().getAttribute("nonce")).toBe("bm9uY2UtZm9yLXRlc3Q=")
  })

  it("keeps the document's nonce when a later render (a server action's) brings another", () => {
    render(
      <>
        <StyleNonce nonce="ZG9jdW1lbnQtbm9uY2U=" />
        {sheet}
      </>
    )
    render(
      <>
        <StyleNonce nonce="YWN0aW9uLW5vbmNl" />
        {sheet}
      </>
    )
    expect(openLock().getAttribute("nonce")).toBe("ZG9jdW1lbnQtbm9uY2U=")
  })

  it("leaves the element without one when the response has no nonce", () => {
    render(
      <>
        <StyleNonce nonce={undefined} />
        {sheet}
      </>
    )
    expect(window.__webpack_nonce__).toBeUndefined()
    expect(openLock().hasAttribute("nonce")).toBe(false)
  })
})
