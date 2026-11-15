import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ORIGIN,
  PATH,
  SESSION_PATH,
  callsTo,
  frameElement,
  fromFrame,
  panelMessage,
  readyAt,
  renderHarness,
  serveSession,
  watchFrame,
} from "./live-preview.harness"
import type { FetchMock } from "./live-preview.harness"
import { READY_MS, RENDER_MS } from "./use-live-preview"

const fetchMock = vi.hoisted(() => vi.fn()) as unknown as FetchMock
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

/** Lets `ms` pass on the held clock, with the answers it sets off. */
async function pass(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const mode = () => screen.getByTestId("mode").textContent
const src = () => frameElement().getAttribute("src")

/** The harness on its live session, the frame watched, the bridge not yet ready. */
async function openLive(props: Parameters<typeof renderHarness>[0] = { round: 0 }) {
  serveSession(fetchMock)
  const view = renderHarness(props)
  await pass()
  expect(src()).toBe(`${ORIGIN}${SESSION_PATH}`)
  return { ...view, posted: watchFrame() }
}

describe("the theme editor's live preview (adr/0065 Faz 1)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("answers only its own frame: the exact origin and window, a message the schema takes", async () => {
    const { posted } = await openLive()

    fromFrame(readyAt(), { origin: "https://evil.example" })
    fromFrame(readyAt(), { origin: "http://localhost:8001" })
    // The right origin from another window: the panel itself, standing in for a second tab
    fromFrame(readyAt(), { source: window })
    fromFrame(readyAt(), { source: null })
    fromFrame({ ...readyAt(), extra: "field" })
    fromFrame({ ...readyAt(), padding: "x".repeat(64 * 1024) })
    await pass()
    expect(posted.all()).toEqual([])

    fromFrame(readyAt())
    await pass()
    expect(posted.of("init")).toEqual([
      expect.objectContaining({ payload: { scale: 1, selected: null } }),
    ])
    // Every message goes to the frame's exact origin, never to "*"
    expect(posted.all().map(({ to }) => to)).toEqual([ORIGIN])
  })

  it("redraws in place after a save: the frame keeps its address, no new link is asked for", async () => {
    const { posted, rerenderWith } = await openLive()
    fromFrame(readyAt())
    await pass()

    rerenderWith({ round: 1 })
    await pass()
    expect(posted.of("refresh")).toHaveLength(1)
    expect(screen.getByTestId("busy").textContent).toBe("busy")
    fromFrame(panelMessage("rendered", { edition: null, ms: 120 }))
    await pass()
    expect(screen.getByTestId("busy").textContent).toBe("idle")

    rerenderWith({ round: 2 })
    await pass()
    expect(posted.of("refresh")).toHaveLength(2)
    expect(src()).toBe(`${ORIGIN}${SESSION_PATH}`)
    expect(callsTo(fetchMock, `${PATH}/preview`)).toEqual([])
    expect(posted.all().every(({ to }) => to === ORIGIN)).toBe(true)
  })

  it("shows another page inside the same frame", async () => {
    const { posted, rerenderWith } = await openLive()
    fromFrame(readyAt())
    await pass()

    rerenderWith({ round: 0, page: "/urun/sef-bicagi" })
    await pass()
    expect(posted.of("navigate")).toEqual([
      expect.objectContaining({ payload: { page: "/urun/sef-bicagi" } }),
    ])
    expect(src()).toBe(`${ORIGIN}${SESSION_PATH}`)
  })

  it("scrolls to a moved section once its save is drawn, not before", async () => {
    const { posted, rerenderWith } = await openLive()
    fromFrame(readyAt())
    await pass()

    fireEvent.click(screen.getByRole("button", { name: "moved" }))
    rerenderWith({ round: 1 })
    await pass()
    expect(posted.of("refresh")).toHaveLength(1)
    expect(posted.of("select")).toEqual([])

    fromFrame(panelMessage("rendered", { edition: null, ms: 80 }))
    await pass()
    expect(posted.of("select")).toEqual([
      expect.objectContaining({ payload: { id: "moved01", reveal: "if_hidden", flash: true } }),
    ])
  })

  it("passes the frame's undo keys and missing sections on", async () => {
    const onKey = vi.fn()
    const onMissing = vi.fn()
    await openLive({ round: 0, onKey, onMissing })
    fromFrame(readyAt())
    frameElement().focus()
    fromFrame(panelMessage("key", { key: "undo" }))
    fromFrame(panelMessage("missing", { id: "abc123", reason: "timeout" }))
    // From elsewhere: not taken
    fromFrame(panelMessage("key", { key: "redo" }), { origin: "https://evil.example" })
    await pass()
    expect(onKey.mock.calls).toEqual([["undo"]])
    expect(onMissing.mock.calls).toEqual([["abc123", "timeout"]])
  })

  it("takes the frame's keys only while it has the focus, five a second at most", async () => {
    const onKey = vi.fn()
    await openLive({ round: 0, onKey })
    fromFrame(readyAt())
    // The focus elsewhere in the panel: a page in the frame cannot drive the history
    fromFrame(panelMessage("key", { key: "undo" }))
    expect(onKey).not.toHaveBeenCalled()

    frameElement().focus()
    for (let index = 0; index < 8; index++) {
      fromFrame(panelMessage("key", { key: "redo" }))
    }
    expect(onKey).toHaveBeenCalledTimes(5)
    await pass(1000)
    fromFrame(panelMessage("key", { key: "undo" }))
    expect(onKey).toHaveBeenCalledTimes(6)
    expect(onKey).toHaveBeenLastCalledWith("undo")
  })

  it("closes its session with a request that outlives the page when the tab closes", async () => {
    await openLive()
    act(() => {
      window.dispatchEvent(new Event("pagehide"))
    })
    const closes = fetchMock.mock.calls.filter(
      ([url, init]) => url === `${PATH}/editor-session/ses1` && init?.method === "DELETE"
    )
    expect(closes).toHaveLength(1)
    expect(closes[0]?.[1]?.keepalive).toBe(true)
    // No renewal after it, and no second close
    await pass(10 * 60_000)
    expect(
      fetchMock.mock.calls.filter(([url]) => url === `${PATH}/editor-session/ses1`)
    ).toHaveLength(1)
  })

  it("goes back to signed links when the frame never says it is ready", async () => {
    await openLive()
    fireEvent.load(frameElement())
    await pass(READY_MS)
    await pass()
    expect(mode()).toBe("legacy")
    expect(src()).toBe(`${ORIGIN}/onizleme/sfl_1`)
  })

  it("goes back to signed links when the session ends: the redraw never comes", async () => {
    const { rerenderWith } = await openLive()
    fromFrame(readyAt())
    await pass()

    // Signed out elsewhere: the session's page no longer answers, the bridge with it
    rerenderWith({ round: 1 })
    await pass(RENDER_MS)
    await pass()
    expect(mode()).toBe("legacy")
    expect(src()).toBe(`${ORIGIN}/onizleme/sfl_1`)
    // The session given up is closed
    await pass(1000)
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) => url === `${PATH}/editor-session/ses1` && init?.method === "DELETE"
      )
    ).toHaveLength(1)
  })

  it("goes back to signed links when the frame reports it cannot redraw", async () => {
    await openLive()
    fromFrame(readyAt())
    fromFrame(panelMessage("error", { code: "redraw_timeout" }))
    await pass()
    expect(mode()).toBe("legacy")
    expect(src()).toBe(`${ORIGIN}/onizleme/sfl_1`)
  })

  it("uses signed links when the session is refused", async () => {
    // The refusal and the link after it settle over several query ticks: the wall clock waits them out
    vi.useRealTimers()
    serveSession(fetchMock, { refuse: true })
    renderHarness({ round: 0 })
    await waitFor(() => {
      expect(src()).toBe(`${ORIGIN}/onizleme/sfl_1`)
    })
    expect(mode()).toBe("legacy")
  })
})
