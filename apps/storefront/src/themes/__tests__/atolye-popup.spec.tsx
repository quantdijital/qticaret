// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlaceOrderResult, PopupMode, PopupView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import PopupDialog from "../../../../../packages/themes/atolye/src/frame/PopupDialog"
import { popupWords } from "../../../../../packages/themes/atolye/src/frame/popup-words"

/**
 * The shop's pop-up as Atölye draws it (adr/0080 §6): a dialog in the
 * middle, a card in the corner, a phone's bottom sheet; its parts by type.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const words = popupWords(t, "Kampanyalardan e-posta ile haberdar olmayı kabul ediyorum.")

const popup = (patch: Partial<PopupView> = {}): PopupView => ({
  id: "popup_1",
  type: "info",
  title: "Kargo bugün ücretsiz",
  body: "Tüm siparişlerde.\nYalnızca bugün.",
  image: {
    src: "/media/kis.jpg",
    alt: "",
    width: 960,
    height: 540,
    sources: { avif: null, webp: null },
  },
  button: { label: "Alışverişe başla", href: "/kategoriler" },
  submitLabel: null,
  promotion: null,
  targeting: { pages: "all", device: "all", visitor: "any", membership: "any" },
  trigger: { kind: "delay", value: 0 },
  frequency: { kind: "session", days: null },
  layout: "modal",
  priority: 0,
  endsAt: null,
  ...patch,
})

let mount: HTMLDivElement
let root: Root

beforeEach(() => {
  mount = document.createElement("div")
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  mount.remove()
  vi.restoreAllMocks()
})

function draw(
  shown: PopupView,
  mode: PopupMode,
  handlers: {
    onClose?: () => void
    onAct?: (action: "click" | "signup") => void
    subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  } = {}
) {
  act(() => {
    root.render(
      <PopupDialog
        popup={shown}
        mode={mode}
        open
        onClose={handlers.onClose ?? vi.fn()}
        onAct={handlers.onAct ?? vi.fn()}
        words={words}
        privacyPath="/yasal/kvkk"
        subscribe={handlers.subscribe}
      />
    )
  })
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const closeButton = () =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${words.close}"]`)

describe("the three ways it is drawn", () => {
  it("draws a modal dialog in the middle: aria-modal, the scrim, the focus inside", () => {
    draw(popup(), "modal")
    const shown = dialog()
    expect(shown?.dataset["popup"]).toBe("modal")
    expect(shown?.getAttribute("aria-modal")).toBe("true")
    expect(shown?.className).toContain("m-auto")
    expect(document.querySelector(".bg-scrim")).not.toBeNull()
    expect(shown?.contains(document.activeElement)).toBe(true)
    // Labelled by its title, described by its body, which keeps its lines
    const title = document.getElementById(shown?.getAttribute("aria-labelledby") ?? "")
    expect(title?.textContent).toBe("Kargo bugün ücretsiz")
    const body = document.getElementById(shown?.getAttribute("aria-describedby") ?? "")
    expect(body?.textContent).toBe("Tüm siparişlerde.\nYalnızca bugün.")
    expect(body?.className).toContain("whitespace-pre-line")
    expect(shown?.querySelector("img")?.getAttribute("width")).toBe("960")
  })

  it("draws a corner card that takes neither the focus nor the page", () => {
    const page = document.createElement("button")
    document.body.append(page)
    page.focus()
    draw(popup({ layout: "corner" }), "corner")
    const shown = dialog()
    expect(shown?.dataset["popup"]).toBe("corner")
    expect(shown?.hasAttribute("aria-modal")).toBe(false)
    expect(document.querySelector(".bg-scrim")).toBeNull()
    expect(document.activeElement).toBe(page)
    expect(shown?.className).toContain("left-6")
    page.remove()
  })

  it("draws a phone's sheet across the bottom, two fifths at most, without the picture", () => {
    draw(popup(), "sheet")
    const shown = dialog()
    expect(shown?.dataset["popup"]).toBe("sheet")
    expect(shown?.hasAttribute("aria-modal")).toBe(false)
    expect(shown?.className).toContain("max-h-[40dvh]")
    expect(shown?.className).not.toContain("inset-0")
    expect(shown?.querySelector("img")).toBeNull()
  })

  it("comes in only for a visitor who has not asked for less motion", () => {
    draw(popup(), "modal")
    const animated = dialog()
      ?.className.split(" ")
      .filter((name) => /animate-in|zoom-in|slide-in/.test(name))
    expect(animated?.length).toBeGreaterThan(0)
    expect(animated?.every((name) => name.startsWith("motion-safe:"))).toBe(true)
  })

  it("has no description when it has no body", () => {
    draw(popup({ body: null }), "modal")
    expect(dialog()?.hasAttribute("aria-describedby")).toBe(false)
  })
})

describe("closing", () => {
  it("closes by its labelled button", () => {
    const onClose = vi.fn()
    draw(popup(), "modal", { onClose })
    act(() => {
      closeButton()?.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes by Escape, the card too", () => {
    for (const mode of ["modal", "corner", "sheet"] as const) {
      const onClose = vi.fn()
      draw(popup(), mode, { onClose })
      act(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        )
      })
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it("keeps a card open when the visitor clicks on the page", () => {
    const onClose = vi.fn()
    draw(popup(), "corner", { onClose })
    act(() => {
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe("each type's part", () => {
  it("follows an info pop-up's button, counted as a click", () => {
    const onAct = vi.fn()
    draw(popup(), "modal", { onAct })
    const link = dialog()?.querySelector("a")
    expect(link?.getAttribute("href")).toBe("/kategoriler")
    expect(link?.hasAttribute("rel")).toBe(false)
    link?.addEventListener("click", (event) => {
      event.preventDefault()
    })
    act(() => {
      link?.click()
    })
    expect(onAct).toHaveBeenCalledWith("click")
  })

  it("leaves the shop for another site without the opener", () => {
    draw(popup({ button: { label: "Katalog", href: "https://katalog.example.com/" } }), "modal")
    expect(dialog()?.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("shows a campaign's code and copies it, counted as a click", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    const onAct = vi.fn()
    draw(
      popup({ type: "campaign", promotion: { code: "KIS25", automatic: false }, button: null }),
      "corner",
      { onAct }
    )
    expect(dialog()?.querySelector("code")?.textContent).toBe("KIS25")
    const copy = [...(dialog()?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === words.copy
    )
    await act(async () => {
      copy?.click()
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith("KIS25")
    expect(onAct).toHaveBeenCalledWith("click")
    expect(dialog()?.querySelector('[role="status"]')?.textContent).toBe(words.copied)
  })

  it("says the cart applies an automatic campaign, with no code to copy", () => {
    draw(
      popup({ type: "campaign", promotion: { code: null, automatic: true }, button: null }),
      "modal"
    )
    expect(dialog()?.textContent).toContain(words.automatic)
    expect(dialog()?.querySelector("code")).toBeNull()
  })

  it("sends a newsletter pop-up's form with the consent box, counting the sign-up", async () => {
    const onAct = vi.fn()
    const subscribe = vi.fn(() => Promise.resolve({ ok: true, error: null, challenge: null }))
    draw(popup({ type: "newsletter", button: null, submitLabel: "Beni haberdar et" }), "modal", {
      onAct,
      subscribe,
    })
    const form = dialog()?.querySelector("form")
    const consent = form?.querySelector<HTMLInputElement>('input[name="consent"]')
    expect(consent?.required).toBe(true)
    expect(consent?.checked).toBe(false)
    expect(form?.textContent).toContain(
      "Kampanyalardan e-posta ile haberdar olmayı kabul ediyorum."
    )
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe("Beni haberdar et")
    const email = form?.querySelector<HTMLInputElement>('input[name="email"]')
    if (email && consent) {
      email.value = "ayse@example.com"
      consent.checked = true
    }
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(onAct).toHaveBeenCalledWith("signup")
    expect(dialog()?.querySelector('[role="status"]')?.textContent).toBe(words.newsletter.sent)
  })

  it("says the backend's refusal and counts nothing", async () => {
    const onAct = vi.fn()
    const subscribe = vi.fn(() =>
      Promise.resolve({ ok: false, error: "newsletter.rate_limited", challenge: null })
    )
    draw(popup({ type: "newsletter", button: null }), "modal", { onAct, subscribe })
    await act(async () => {
      dialog()
        ?.querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(onAct).not.toHaveBeenCalled()
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      t("newsletter.rate_limited")
    )
  })
})
