import { useSyncExternalStore } from "react"

// Below this width the sidebar becomes a sheet (shadcn's breakpoint)
const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}

const isMobileNow = () => window.matchMedia(QUERY).matches

/** Whether the viewport is phone-sized; read from the media query, no state of its own. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileNow, () => false)
}
