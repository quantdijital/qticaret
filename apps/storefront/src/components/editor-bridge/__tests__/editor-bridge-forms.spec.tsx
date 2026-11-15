// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EditorBridge } from "../editor-bridge"

/**
 * The bridge's search forms and its one style element, as the browser
 * tour found them (PR #40): the panel's frame has no `allow-forms`, so the
 * browser fires no `submit` there; the bridge turns Enter and the search
 * button into one, the page's own `onSubmit` still hears it, and the
 * panel is asked for the results page. A redraw brings a new nonce; the
 * layer and the style keep the first (the document's CSP).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/onizleme/sfs_${"0".repeat(32)}.abc.mac`,
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PANEL = "https://panel.example.com"

let host: HTMLDivElement
let root: Root
let posted: ReturnType<typeof vi.fn>

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  posted = vi.fn()
  Object.defineProperty(window, "parent", { value: { postMessage: posted }, configurable: true })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, "parent")
})

function mount(nonce: string | undefined) {
  act(() => {
    root.render(<EditorBridge panelOrigin={PANEL} edition={null} nonce={nonce} />)
  })
}

const asked = () =>
  posted.mock.calls
    .map(([message]) => message as { type: string; payload: unknown })
    .filter((message) => message.type === "navigate-request")
    .map((message) => message.payload)

/** A search form as the theme's header writes it, with its own submit handler. */
function searchForm(method = "get") {
  const form = document.createElement("form")
  form.setAttribute("action", "/arama")
  form.setAttribute("method", method)
  const field = document.createElement("input")
  field.type = "search"
  field.name = "q"
  field.value = "bıçak"
  const button = document.createElement("button")
  button.type = "submit"
  form.append(field, button)
  host.append(form)
  const heard = vi.fn()
  form.addEventListener("submit", heard)
  return { form, field, button, heard }
}

function press(target: Element, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

const RESULTS = { path: "/arama?q=b%C4%B1%C3%A7ak", previewable: true }

describe("the bridge's search forms in a frame without allow-forms", () => {
  it("Enter in the search field asks for the results page; the page hears its submit", () => {
    mount(undefined)
    const { field, heard } = searchForm()
    const enter = press(field, { key: "Enter" })
    expect(enter.defaultPrevented).toBe(true)
    expect(asked()).toEqual([RESULTS])
    // Its own `onSubmit` runs (a search panel closes), the sending itself is cancelled
    expect(heard).toHaveBeenCalledTimes(1)
    expect((heard.mock.calls[0]?.[0] as Event).defaultPrevented).toBe(true)
  })

  it("the search button asks for the results page", () => {
    mount(undefined)
    const { button } = searchForm()
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => {
      button.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(asked()).toEqual([RESULTS])
  })

  it("leaves Enter alone when the page took it, when composing, or in a POST form", () => {
    mount(undefined)
    const { field } = searchForm()
    field.addEventListener("keydown", (event) => {
      event.preventDefault()
    })
    press(field, { key: "Enter" })
    const post = searchForm("post")
    press(post.field, { key: "Enter", isComposing: true })
    press(post.field, { key: "Enter" })
    expect(asked()).toEqual([])
    expect(post.heard).not.toHaveBeenCalled()
  })
})

describe("the bridge's nonce across redraws", () => {
  it("keeps its layer and style (with the first nonce) when a redraw brings a new one", () => {
    mount("first-nonce")
    const layer = document.querySelector("qt-editor-layer")
    const readies = () =>
      posted.mock.calls.filter(([m]) => (m as { type: string }).type === "ready")
    expect(layer).not.toBeNull()
    expect(readies()).toHaveLength(1)
    mount("second-nonce")
    // Not set up again: the same layer, no second `ready`, nothing written with the new nonce
    expect(document.querySelector("qt-editor-layer")).toBe(layer)
    expect(document.querySelectorAll("qt-editor-layer")).toHaveLength(1)
    expect(readies()).toHaveLength(1)
    for (const style of document.querySelectorAll("style")) {
      expect(style.nonce).not.toBe("second-nonce")
    }
  })
})
