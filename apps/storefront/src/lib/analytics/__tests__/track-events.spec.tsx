// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnalyticsEvent } from "../events"

const calls = vi.hoisted(() => [] as unknown[][])
vi.mock("../client", () => ({
  noteAmounts: (amounts: boolean) => calls.push(["noteAmounts", amounts]),
  track: (event: AnalyticsEvent, once: string | null, amounts: boolean) =>
    calls.push(["track", event.name, once, amounts]),
  setPageContext: () => undefined,
}))

const { TrackEvents } = await import("../TrackEvents")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const purchase: AnalyticsEvent = {
  name: "purchase",
  transactionId: "order_1",
  value: 7350,
  shipping: 90,
  items: [],
}
const viewed: AnalyticsEvent = { name: "view_item", value: 612.5, items: [] }

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  calls.length = 0
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

/** ADR-0068 slice 5 review L1 and L2: a page's events carry the server's word of its request. */
describe("TrackEvents", () => {
  it("notes the request's answer before its events go, so a soft navigation is not left stale", () => {
    act(() => {
      root.render(<TrackEvents events={[viewed]} visitorAmounts={false} />)
    })
    expect(calls).toEqual([
      ["noteAmounts", false],
      ["track", "view_item", null, true],
    ])
  })

  it("sends a wholesale order's purchase without amounts, whatever the visitor's answer", () => {
    act(() => {
      root.render(
        <TrackEvents
          events={[purchase]}
          once="purchase:order_1"
          visitorAmounts={true}
          amounts={false}
        />
      )
    })
    expect(calls).toEqual([
      ["noteAmounts", true],
      ["track", "purchase", "purchase:order_1:purchase", false],
    ])
  })
})
