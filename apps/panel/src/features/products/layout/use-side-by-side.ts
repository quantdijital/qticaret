import { useSyncExternalStore } from "react"

// Where the page's two columns stand side by side (Tailwind `lg`, `EditorLayout narrowSide`)
const QUERY = "(min-width: 64rem)"

// Without media queries (a test's DOM) the columns read as side by side
const supported = () => typeof window.matchMedia === "function"

const subscribe = (onChange: () => void) => {
  if (!supported()) {
    return () => undefined
  }
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}

const wideNow = () => !supported() || window.matchMedia(QUERY).matches

/** Whether the product page's columns stand side by side now. */
export function useSideBySide(): boolean {
  return useSyncExternalStore(subscribe, wideNow, () => true)
}
