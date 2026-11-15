import { act, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ORIGIN,
  PATH,
  callsTo,
  frameElement,
  fromFrame,
  readyAt,
  renderHarness,
  serveSession,
  watchFrame,
} from "./live-preview.harness"
import type * as BridgeClient from "./bridge-client"
import type { FetchMock } from "./live-preview.harness"

const fetchMock = vi.hoisted(() => vi.fn()) as unknown as FetchMock
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
// A build with `VITE_EDITOR_BRIDGE=false`
vi.mock("./bridge-client", async (original) => ({
  ...(await original<typeof BridgeClient>()),
  BRIDGE_ON: false,
}))

async function pass(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("the theme editor's preview with the bridge turned off (VITE_EDITOR_BRIDGE=false)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    serveSession(fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("asks for a signed link per save, the frame reloading, and opens no session", async () => {
    const { rerenderWith } = renderHarness({ round: 0 })
    await pass()
    expect(screen.getByTestId("mode").textContent).toBe("legacy")
    expect(frameElement().getAttribute("src")).toBe(`${ORIGIN}/onizleme/sfl_1`)

    // A bridge answering anyway is not listened to
    const posted = watchFrame()
    fromFrame(readyAt())
    await pass()
    expect(posted.all()).toEqual([])

    rerenderWith({ round: 1 })
    await pass()
    expect(frameElement().getAttribute("src")).toBe(`${ORIGIN}/onizleme/sfl_2`)
    expect(callsTo(fetchMock, `${PATH}/editor-session`)).toEqual([])
  })
})
