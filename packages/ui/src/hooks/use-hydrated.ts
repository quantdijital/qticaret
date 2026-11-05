import { useSyncExternalStore } from "react"

/** Nothing to listen to: once the page's script runs, it runs. */
const subscribe = () => stop

function stop(): void {
  // Nothing was started
}

/**
 * Whether the page's script has taken over (false in the first HTML and
 * while React hydrates it, true after): a control that only works with
 * the script (a clear button, a live panel) is drawn once this is true,
 * so the HTML without script never offers it.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
