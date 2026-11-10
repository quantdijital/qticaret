import { cleanup } from "@testing-library/react"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { afterEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { ADMIN_UI_NS, adminUiResources } from "../i18n"

// The package's words in Turkish, as an app registers them (the panel's lib/i18n)
void i18next.use(initReactI18next).init({
  resources: { tr: { [ADMIN_UI_NS]: adminUiResources.tr } },
  ns: [ADMIN_UI_NS],
  defaultNS: ADMIN_UI_NS,
  lng: "tr",
  interpolation: { escapeValue: false },
})

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
