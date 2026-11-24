// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PopupView } from "@qticaret/ui"
import { forgetPopupPage, forgetPopups, markPopupPage } from "@qticaret/ui/lib/popup-client"
import { forgetPopupFallback } from "@qticaret/ui/lib/popup-memory"
import { SHOP_EVENT } from "@qticaret/ui/lib/shop-events"
import { t } from "@/lib/i18n"
import { PopupHost } from "../../../../../packages/themes/atolye/src/frame/PopupHost"
import { popupWords } from "../../../../../packages/themes/atolye/src/frame/popup-words"

/**
 * The layout's pop-up host with the shared choosing (`usePopup`, adr/0080
 * §4): after the page is up and the cookie question answered, one pop-up a
 * page view, never on the blocked pages, counted and remembered.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SETUP = { address: "/api/popups", events: "/api/popups" }

const popup = (patch: Partial<PopupView> = {}): PopupView => ({
  id: "popup_1",
  type: "info",
  title: "Kargo bugün ücretsiz",
  body: null,
  image: null,
  button: null,
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
let phone = false
const beacons: { url: string; type: string }[] = []
const signals: unknown[] = []
const heard = (event: Event) => signals.push((event as CustomEvent).detail)

function serve(popups: PopupView[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ popups }), { status: 200 })))
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  forgetPopupFallback()
  forgetPopups()
  forgetPopupPage()
  window.history.replaceState(null, "", "/")
  phone = false
  beacons.length = 0
  signals.length = 0
  vi.stubGlobal("requestIdleCallback", (work: () => void) => setTimeout(work, 0))
  vi.stubGlobal("cancelIdleCallback", (id: number) => {
    clearTimeout(id)
  })
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone, media: query }))
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, blob: Blob) => {
      void blob.text().then((text) => {
        beacons.push({ url, type: (JSON.parse(text) as { type: string }).type })
      })
      return true
    },
  })
  window.addEventListener(SHOP_EVENT, heard)
  mount = document.createElement("div")
  document.body.append(mount)
  root = createRoot(mount)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  mount.remove()
  document.querySelector("[data-cookie-banner]")?.remove()
  window.removeEventListener(SHOP_EVENT, heard)
  vi.unstubAllGlobals()
})

function host(member = false) {
  act(() => {
    root.render(
      <PopupHost
        setup={SETUP}
        member={member}
        words={popupWords(t, "Onay metni")}
        privacyPath={null}
      />
    )
  })
}

/** Lets the idle wait, the list, the trigger and the dialog's code each take their turn. */
async function settle(ms = 30) {
  for (let round = 0; round < 6; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })
  }
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')

/** Waits for the dialog, whose code loads only now (slow on a busy first run), three seconds at most. */
async function shown() {
  for (let round = 0; round < 150 && !dialog(); round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
}

describe("the pop-up host", () => {
  it("shows the first pop-up that fits once the page is up, counted and told to GA4", async () => {
    serve([
      popup({ id: "popup_a", targeting: { ...popup().targeting, device: "mobile" } }),
      popup({ id: "popup_b", title: "Kış indirimi" }),
      popup({ id: "popup_c", title: "Üçüncü" }),
    ])
    host()
    expect(dialog()).toBeNull()
    await shown()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(dialog()?.textContent).toContain("Kış indirimi")
    expect(beacons).toEqual([{ url: "/api/popups/popup_b/events", type: "impression" }])
    expect(signals).toEqual([
      { type: "popup", action: "view", popupId: "popup_b", popupType: "info" },
    ])
  })

  it("waits for the cookie question to be answered", async () => {
    const banner = document.createElement("section")
    banner.setAttribute("data-cookie-banner", "")
    document.body.append(banner)
    serve([popup()])
    host()
    await settle()
    expect(dialog()).toBeNull()
    expect(beacons).toEqual([])
    banner.hidden = true
    await shown()
    expect(dialog()).not.toBeNull()
  })

  it("never shows on the cart, the checkout or the account", async () => {
    serve([popup()])
    window.history.replaceState(null, "", "/sepet")
    host()
    await settle()
    expect(dialog()).toBeNull()
    expect(beacons).toEqual([])
  })

  it("follows the page the storefront marked", async () => {
    serve([popup({ targeting: { ...popup().targeting, pages: ["product"] } })])
    window.history.replaceState(null, "", "/bicaklar/sef")
    host()
    await settle()
    expect(dialog()).toBeNull()
    forgetPopups()
    act(() => {
      root.unmount()
    })
    root = createRoot(mount)
    markPopupPage("product")
    host()
    await shown()
    expect(dialog()).not.toBeNull()
  })

  it("draws a bottom sheet on a phone, whatever its layout", async () => {
    phone = true
    serve([popup({ layout: "modal" })])
    host()
    await shown()
    expect(dialog()?.dataset["popup"]).toBe("sheet")
  })

  it("counts a close, remembers it, and shows it no more this session", async () => {
    serve([popup({ frequency: { kind: "until_closed", days: null } })])
    host()
    await shown()
    act(() => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="${t("popup.close")}"]`)?.click()
    })
    await settle(5)
    expect(beacons.map((each) => each.type)).toEqual(["impression", "close"])
    expect(JSON.parse(window.localStorage.getItem("qt:popups") ?? "{}")).toMatchObject({
      popup_1: { dismissed: true },
    })
    act(() => {
      root.unmount()
    })
    root = createRoot(mount)
    host()
    await settle()
    expect(dialog()).toBeNull()
  })

  it("waits for its share of the page to be scrolled", async () => {
    serve([popup({ trigger: { kind: "scroll", value: 50 } })])
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2800,
    })
    vi.stubGlobal("innerHeight", 800)
    host()
    await settle()
    expect(dialog()).toBeNull()
    expect(beacons).toEqual([])
    vi.stubGlobal("scrollY", 1000)
    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    await shown()
    expect(dialog()).not.toBeNull()
    Reflect.deleteProperty(document.documentElement, "scrollHeight")
  })

  it("skips a pop-up for members when the visitor is a guest", async () => {
    serve([popup({ targeting: { ...popup().targeting, membership: "member" } })])
    host(false)
    await settle()
    expect(dialog()).toBeNull()
    expect(beacons).toEqual([])
  })
})
