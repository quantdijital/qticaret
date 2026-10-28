import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import "@testing-library/jest-dom/vitest"

// Without vitest globals Testing Library cannot clean up by itself
afterEach(() => {
  cleanup()
})

// jsdom has no ResizeObserver; Radix measures some controls with it (Switch).
// Nothing is ever resized in a test, so the stand-in never reports.
const noResize = (): undefined => undefined
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe = noResize
    unobserve = noResize
    disconnect = noResize
  }
}

// jsdom has no pointer capture or scrolling; Radix's Select calls both when it
// opens. A test never drags, and nothing scrolls, so the stand-ins do nothing
const elementProto = Element.prototype as unknown as Record<string, unknown>
for (const name of ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"]) {
  if (typeof elementProto[name] !== "function") {
    elementProto[name] = () => false
  }
}
