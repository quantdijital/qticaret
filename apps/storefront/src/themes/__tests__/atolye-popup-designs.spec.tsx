// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PopupDesign, PopupMode, PopupView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import PopupDialog from "../../../../../packages/themes/atolye/src/frame/PopupDialog"
import { popupWords } from "../../../../../packages/themes/atolye/src/frame/popup-words"

/**
 * A pop-up's design as Atölye draws it (adr/0080 §6a): `classic` as it
 * was, and each other design for every type, with and without a picture,
 * still a labelled dialog with its close button.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const words = popupWords(t, "Kampanyalardan e-posta ile haberdar olmayı kabul ediyorum.")

const IMAGE = {
  src: "/media/kis.jpg",
  alt: "",
  width: 960,
  height: 540,
  sources: { avif: null, webp: null },
}

const popup = (patch: Partial<PopupView> = {}): PopupView => ({
  id: "popup_1",
  type: "info",
  title: "Kargo bugün ücretsiz",
  body: "Tüm siparişlerde.",
  image: IMAGE,
  button: { label: "Alışverişe başla", href: "/kategoriler" },
  submitLabel: null,
  promotion: null,
  targeting: { pages: "all", device: "all", visitor: "any", membership: "any" },
  trigger: { kind: "delay", value: 0 },
  frequency: { kind: "session", days: null },
  layout: "modal",
  design: "classic",
  priority: 0,
  endsAt: null,
  ...patch,
})

const CAMPAIGN = {
  type: "campaign",
  promotion: { code: "KIS25", automatic: false },
} as const satisfies Partial<PopupView>

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
})

function draw(shown: PopupView, mode: PopupMode = "modal") {
  act(() => {
    root.render(
      <PopupDialog
        popup={shown}
        mode={mode}
        open
        onClose={vi.fn()}
        onAct={vi.fn()}
        words={words}
        privacyPath="/yasal/kvkk"
        subscribe={() => Promise.resolve({ ok: true } as never)}
      />
    )
  })
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
function title(): HTMLElement {
  const found = document.getElementById(dialog()?.getAttribute("aria-labelledby") ?? "")
  if (!found) {
    throw new Error("the dialog has no title")
  }
  return found
}
const ticket = () => document.querySelector("[data-popup-ticket]")

describe("classic", () => {
  it("draws as before: the picture above, the words left, the dialog 480 px", () => {
    draw(popup())
    expect(dialog()?.className).toContain("max-w-120")
    expect(dialog()?.className).not.toContain("sm:max-w-180")
    const img = dialog()?.querySelector("img")
    expect(img?.className).toContain("max-h-72")
    expect(img?.className).toContain("rounded-t-tile")
    expect(title().className.split(" ").sort()).toEqual(["max-w-none", "pr-10", "text-title"])
    expect(dialog()?.querySelector("[data-popup-words]")).toBeNull()
    draw(popup(CAMPAIGN))
    expect(ticket()).toBeNull()
    expect(dialog()?.querySelector("code")?.textContent).toBe("KIS25")
  })
})

describe("split", () => {
  it("sets the picture beside the words in a wide dialog, above them in a corner card", () => {
    draw(popup({ design: "split" }))
    expect(dialog()?.className).toContain("sm:max-w-180")
    expect(dialog()?.querySelector(".sm\\:grid-cols-2 img")).not.toBeNull()
    draw(popup({ design: "split", layout: "corner" }), "corner")
    expect(dialog()?.className).not.toContain("sm:max-w-180")
    expect(dialog()?.querySelector(".sm\\:grid-cols-2")).toBeNull()
    expect(dialog()?.querySelector("img")).not.toBeNull()
  })

  it("keeps the narrow dialog without a picture", () => {
    draw(popup({ design: "split", image: null }))
    expect(dialog()?.className).not.toContain("sm:max-w-180")
    expect(title().textContent).toBe("Kargo bugün ücretsiz")
  })
})

describe("hero, minimal and coupon centre the words", () => {
  it("hero: a tall picture, the title large and centred", () => {
    draw(popup({ design: "hero" }))
    expect(dialog()?.querySelector("img")?.className).toContain("aspect-[4/3]")
    expect(title().className).toContain("text-center")
    expect(title().className).toContain("text-section")
    expect(title().className).not.toContain("text-title")
  })

  it("minimal: never the picture, the title large", () => {
    draw(popup({ design: "minimal" }))
    expect(dialog()?.querySelector("img")).toBeNull()
    expect(title().className).toContain("text-section")
    expect(dialog()?.querySelector("[data-popup-words]")).not.toBeNull()
  })

  it("coupon: the campaign's code on a ticket, its copy button inside", () => {
    draw(popup({ ...CAMPAIGN, design: "coupon" }))
    expect(ticket()?.querySelector("code")?.textContent).toBe("KIS25")
    expect(ticket()?.querySelector("button")?.textContent).toBe(words.copy)
    expect(title().className).not.toContain("border-dashed")
  })

  it("coupon without a code: the title takes the ticket, an automatic one says so", () => {
    draw(popup({ design: "coupon" }))
    expect(ticket()).toBeNull()
    expect(title().className).toContain("border-dashed")
    draw(popup({ type: "campaign", promotion: { code: null, automatic: true }, design: "coupon" }))
    expect(document.body.textContent).toContain(words.automatic)
    expect(title().className).not.toContain("border-dashed")
  })
})

describe("every design", () => {
  const DESIGNS: PopupDesign[] = ["classic", "split", "hero", "minimal", "coupon"]

  it.each(DESIGNS)(
    "%s: a labelled dialog with its close button, for each type and the phone's sheet",
    (design) => {
      for (const patch of [
        {},
        CAMPAIGN,
        { type: "newsletter", button: null } as const,
        { image: null },
      ] satisfies Partial<PopupView>[]) {
        for (const mode of ["modal", "corner", "sheet"] as const) {
          draw(popup({ ...patch, design }), mode)
          expect(title().textContent).toBe("Kargo bugün ücretsiz")
          expect(document.querySelector(`button[aria-label="${words.close}"]`)).not.toBeNull()
          if (mode === "sheet") {
            expect(dialog()?.querySelector("img")).toBeNull()
          }
        }
      }
    }
  )

  it("a newsletter's form in each design", () => {
    for (const design of DESIGNS) {
      draw(popup({ type: "newsletter", button: null, design }))
      expect(dialog()?.querySelector('input[type="email"]')).not.toBeNull()
    }
  })
})
