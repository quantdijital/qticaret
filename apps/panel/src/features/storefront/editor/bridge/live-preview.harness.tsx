import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import type { Mock } from "vitest"
import { vi } from "vitest"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import type { ToPanelMessage, ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import { useLivePreview } from "./use-live-preview"

/** The storefront's dev origin the frame opens in tests (`STOREFRONT_ORIGIN`). */
export const ORIGIN = "http://localhost:8000"
export const PATH = "/admin/storefront-layout"
export const SESSION_PATH = "/onizleme/sfs_0123456789abcdef0123456789abcdef.abc.mac"

type Init = { method?: string; body?: unknown; keepalive?: boolean } | undefined
export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>

/** The server: a live session (unless refused) and a signed link per call (`sfl_1`, `sfl_2`…). */
export function serveSession(fetchMock: FetchMock, { refuse = false } = {}) {
  let links = 0
  fetchMock.mockImplementation((url, init) => {
    if (url === `${PATH}/editor-session` && init?.method === "POST") {
      return refuse
        ? Promise.reject(Object.assign(new Error("refused"), { status: 403 }))
        : Promise.resolve({
            id: "ses1",
            idle_ms: 30 * 60_000,
            url: `https://shop.example${SESSION_PATH}`,
            path: SESSION_PATH,
            expires_at: "2026-11-15T20:00:00.000Z",
          })
    }
    if (url.startsWith(`${PATH}/editor-session/`)) {
      return Promise.resolve(init?.method === "DELETE" ? { deleted: true } : { renewed: true })
    }
    if (url === `${PATH}/preview`) {
      links++
      const path = `/onizleme/sfl_${String(links)}`
      return Promise.resolve({ url: path, path, expires_at: "2026-11-15T20:00:00.000Z" })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

export const callsTo = (fetchMock: FetchMock, url: string) =>
  fetchMock.mock.calls.filter(([to]) => to === url)

export interface HarnessProps {
  round: number
  page?: string | null
  holding?: boolean
  selected?: string | null
  onKey?: (key: "undo" | "redo" | "escape") => void
  onMissing?: (id: string, reason: string) => void
}

/** The hook alone, with the frame as `PreviewFrame` draws it. */
// eslint-disable-next-line react-refresh/only-export-components -- a test harness, never hot-reloaded
function Harness({
  round,
  page = null,
  holding = false,
  selected = null,
  onKey,
  onMissing,
}: HarnessProps) {
  const preview = useLivePreview({
    ready: true,
    round,
    page,
    holding,
    selected,
    onKey: onKey ?? (() => undefined),
    onMissing: onMissing ?? (() => undefined),
  })
  const { live, busy, address, frameKey, frame, onFrameLoad, selectAfterSave } = preview
  return (
    <>
      <p data-testid="mode">{live ? "live" : "legacy"}</p>
      <p data-testid="busy">{busy ? "busy" : "idle"}</p>
      {address ? (
        <iframe key={frameKey} ref={frame} title="frame" src={address} onLoad={onFrameLoad} />
      ) : null}
      <button
        type="button"
        onClick={() => {
          selectAfterSave("moved01", "if_hidden")
        }}
      >
        moved
      </button>
    </>
  )
}

export function renderHarness(props: HarnessProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>
  )
  return {
    ...view,
    rerenderWith: (next: HarnessProps) => {
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness {...next} />
        </QueryClientProvider>
      )
    },
  }
}

export const frameElement = () => screen.getByTitle<HTMLIFrameElement>("frame")

/** Watches what the panel posts to the frame's window. */
export function watchFrame() {
  const target = frameElement().contentWindow
  if (!target) {
    throw new Error("the frame has no window")
  }
  const spy = vi.spyOn(target, "postMessage").mockImplementation(() => undefined)
  return {
    /** Every message posted, with the origin it was posted to. */
    all: () =>
      // Typed by the overload without an origin; what is checked is what was passed
      (spy.mock.calls as unknown[][]).map(([data, to]) => ({
        message: data as ToStorefrontMessage,
        to,
      })),
    of: (type: ToStorefrontMessage["type"]) =>
      spy.mock.calls
        .map(([data]) => data as ToStorefrontMessage)
        .filter((message) => message.type === type),
  }
}

/** A message arriving on the panel's window, by default from the frame itself. */
export function fromFrame(
  data: unknown,
  { origin = ORIGIN, source }: { origin?: string; source?: MessageEventSource | null } = {}
) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source: source === undefined ? frameElement().contentWindow : source,
        data,
      })
    )
  })
}

export const panelMessage = <T extends ToPanelMessage["type"]>(
  type: T,
  payload: Extract<ToPanelMessage, { type: T }>["payload"]
) => bridgeMessage(type, payload as never, 0)

export const readyAt = (path = "/") => panelMessage("ready", { v: 1, path, edition: null })
