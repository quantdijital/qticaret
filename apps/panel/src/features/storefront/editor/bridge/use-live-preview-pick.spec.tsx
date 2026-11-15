import { act, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ORIGIN,
  SESSION_PATH,
  frameElement,
  fromFrame,
  panelMessage,
  readyAt,
  renderHarness,
  serveSession,
  watchFrame,
} from "./live-preview.harness"
import type { FetchMock } from "./live-preview.harness"
import type { PickMessage } from "./use-live-preview"

const fetchMock = vi.hoisted(() => vi.fn()) as unknown as FetchMock
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

async function pass(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/**
 * Faz 2's messages through the live preview (adr/0065 §2, §6): handed on
 * only from the frame's exact origin and window; a page that left the
 * preview on its own is loaded again on the preview's address.
 */
describe("the live preview's picking messages (adr/0065 Faz 2)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function connected(props: Partial<Parameters<typeof renderHarness>[0]> = {}) {
    serveSession(fetchMock)
    const picked: PickMessage[] = []
    const view = renderHarness({
      round: 0,
      onPick: (message) => {
        picked.push(message)
      },
      ...props,
    })
    await pass()
    const posted = watchFrame()
    fromFrame(readyAt())
    await pass()
    return { ...view, picked, posted }
  }

  it("hands on hover, click, links and the page shown from its own frame only", async () => {
    const { picked } = await connected()
    const messages = [
      panelMessage("hover", { id: "girisbolumu" }),
      panelMessage("click", { id: "girisbolumu" }),
      panelMessage("navigate-request", { path: "/sepet", previewable: true }),
      panelMessage("location", { path: "/sepet", sections: ["mainheader"] }),
    ]
    for (const message of messages) {
      fromFrame(message, { origin: "https://evil.example" })
      fromFrame(message, { source: window })
    }
    // A path to another host never passes the schema
    fromFrame({
      ...panelMessage("navigate-request", { path: "/x", previewable: true }),
      payload: { path: "//evil.example", previewable: true },
    })
    expect(picked).toEqual([])
    for (const message of messages) {
      fromFrame(message)
    }
    expect(picked.map((message) => message.type)).toEqual([
      "hover",
      "click",
      "navigate-request",
      "location",
    ])
  })

  it("posts the tree's hover to the frame's exact origin", async () => {
    const { posted } = await connected()
    fireEvent.click(screen.getByRole("button", { name: "hover" }))
    expect(posted.of("hover").map((message) => message.payload)).toEqual([{ id: "girisbolumu" }])
    expect(posted.all().every(({ to }) => to === ORIGIN)).toBe(true)
  })

  it("loads the preview again when the page left it for none it shows", async () => {
    const { picked } = await connected()
    const before = frameElement()
    fromFrame(panelMessage("left", { path: null }))
    await pass()
    expect(picked.map((message) => message.type)).toEqual(["left"])
    // A new frame on the session's address
    expect(frameElement()).not.toBe(before)
    expect(frameElement().getAttribute("src")).toBe(`${ORIGIN}${SESSION_PATH}`)
  })

  it("stops loading a page that keeps leaving: 3 times in 10 s, then signed links", async () => {
    await connected()
    for (let time = 0; time < 3; time++) {
      fromFrame(panelMessage("left", { path: null }))
      await pass()
      expect(frameElement().getAttribute("src")).toBe(`${ORIGIN}${SESSION_PATH}`)
      watchFrame()
      fromFrame(readyAt())
      await pass()
    }
    fromFrame(panelMessage("left", { path: null }))
    await pass()
    expect(document.querySelector("iframe")?.getAttribute("src") ?? null).not.toBe(
      `${ORIGIN}${SESSION_PATH}`
    )
  })

  it("loads the page left for on the preview's address once the editor shows it", async () => {
    const { picked, rerenderWith } = await connected()
    const before = frameElement()
    fromFrame(panelMessage("left", { path: "/sepet?hata=cart.update_failed" }))
    await pass()
    expect(picked.at(-1)).toMatchObject({ payload: { path: "/sepet?hata=cart.update_failed" } })
    // The editor takes the page (`visit`): the frame opens on it
    rerenderWith({ round: 0, page: "/sepet?hata=cart.update_failed" })
    await pass()
    expect(frameElement()).not.toBe(before)
    expect(frameElement().getAttribute("src")).toBe(
      `${ORIGIN}${SESSION_PATH}?sayfa=${encodeURIComponent("/sepet?hata=cart.update_failed")}`
    )
  })
})
