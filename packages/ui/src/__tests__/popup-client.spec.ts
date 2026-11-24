// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  POPUP_PAGE_EVENT,
  POPUPS_KEPT_MS,
  copyText,
  forgetPopupPage,
  forgetPopups,
  loadPopups,
  markPopupPage,
  popupEventUrl,
  popupPageOf,
  sendPopupEvent,
} from "../lib/popup-client"

const popup = {
  id: "popup_1",
  type: "info",
  title: "Duyuru",
  targeting: {},
  trigger: {},
  frequency: {},
}
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe("the pop-ups' list", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    forgetPopups()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("keeps the list a minute: a second page soon after asks nothing", async () => {
    fetchMock.mockResolvedValue(answer({ popups: [popup] }))
    expect(await loadPopups("/api/popups")).toEqual([popup])
    expect(await loadPopups("/api/popups")).toEqual([popup])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(POPUPS_KEPT_MS + 1)
    fetchMock.mockResolvedValue(answer({ popups: [] }))
    expect(await loadPopups("/api/popups")).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("leaves out what is not a pop-up, and answers none on any failure", async () => {
    fetchMock.mockResolvedValueOnce(answer({ popups: [popup, { id: 3 }, null] }))
    expect(await loadPopups("/a")).toEqual([popup])
    forgetPopups()
    fetchMock.mockResolvedValueOnce(answer({ message: "x" }, 502))
    expect(await loadPopups("/a")).toEqual([])
    forgetPopups()
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    expect(await loadPopups("/a")).toEqual([])
  })
})

describe("the counters", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("names the pop-up in the address, encoded", () => {
    expect(popupEventUrl("/api/popups", "popup_1")).toBe("/api/popups/popup_1/events")
    expect(popupEventUrl("/api/popups", "a/b")).toBe("/api/popups/a%2Fb/events")
  })

  it("sends a beacon, which outlives the page a click leaves", async () => {
    const beacon = vi.fn(() => true)
    const fetchMock = vi.fn()
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
    vi.stubGlobal("fetch", fetchMock)
    sendPopupEvent("/api/popups", "popup_1", "click")
    expect(beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe("/api/popups/popup_1/events")
    expect(await blob.text()).toBe('{"type":"click"}')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to a keepalive request, and never throws", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: () => false, configurable: true })
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("offline")))
    vi.stubGlobal("fetch", fetchMock)
    expect(() => {
      sendPopupEvent("/api/popups", "popup_1", "close")
    }).not.toThrow()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/popups/popup_1/events",
      expect.objectContaining({ method: "POST", keepalive: true, body: '{"type":"close"}' })
    )
  })
})

describe("the page's kind", () => {
  beforeEach(() => {
    forgetPopupPage()
    window.history.replaceState(null, "", "/")
  })

  it("is what the page said for its own address, else other", () => {
    const heard = vi.fn()
    window.addEventListener(POPUP_PAGE_EVENT, heard)
    window.history.replaceState(null, "", "/bicaklar/sef-bicagi")
    markPopupPage("product")
    expect(heard).toHaveBeenCalledTimes(1)
    expect(popupPageOf("/bicaklar/sef-bicagi")).toBe("product")
    // A page that said nothing (a soft navigation on): not the last page's word
    expect(popupPageOf("/arama")).toBe("other")
    window.removeEventListener(POPUP_PAGE_EVENT, heard)
  })

  it("knows a blocked page by its address whatever a page said", () => {
    window.history.replaceState(null, "", "/sepet")
    markPopupPage("home")
    expect(popupPageOf("/sepet")).toBe("cart")
  })
})

describe("copyText", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the Clipboard API when there is one", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    expect(await copyText("KIS25")).toBe(true)
    expect(writeText).toHaveBeenCalledWith("KIS25")
  })

  it("falls back to the copy command, and says false when that fails too", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    })
    const exec = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true })
    expect(await copyText("KIS25")).toBe(true)
    expect(exec).toHaveBeenCalledWith("copy")
    expect(document.querySelector("textarea")).toBeNull()
    exec.mockImplementation(() => {
      throw new Error("no")
    })
    expect(await copyText("KIS25")).toBe(false)
  })
})
