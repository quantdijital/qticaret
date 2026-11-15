import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import {
  LAYOUT_KEY,
  closeEditorSession,
  openEditorSession,
  renewEditorSession,
} from "@/features/storefront/api/layout"

const SESSION_KEY = [...LAYOUT_KEY, "editor-session"] as const

/**
 * Closings waiting a moment: an effect set up again at once (React's strict
 * development mode, a quick remount) keeps its session rather than closing it.
 */
const closing = new Map<string, ReturnType<typeof setTimeout>>()
const CLOSE_AFTER_MS = 1000

/** How often the open editor renews its session: a third of its idle time, five minutes at most. */
export const renewEvery = (idleMs: number) => Math.max(30_000, Math.min(idleMs / 3, 5 * 60_000))

/**
 * The theme editor's live preview session (adr/0065 §1): opened once while
 * the editor is open and `enabled`, renewed on a timer, closed when the
 * editor goes (or the live preview is given up) and when the tab closes
 * (`pagehide`, a `keepalive` request that outlives the page). Never retried: a refusal
 * falls back to the signed link per save.
 */
export function useEditorSession(enabled: boolean) {
  const client = useQueryClient()
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: openEditorSession,
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const id = session.data?.id
  const idle = session.data?.idle_ms
  useEffect(() => {
    if (!id || !idle || !enabled) {
      return
    }
    clearTimeout(closing.get(id))
    closing.delete(id)
    const timer = setInterval(() => {
      // A renewal refused (ended elsewhere): the frame's next redraw says so and falls back
      renewEditorSession(id).catch(() => undefined)
    }, renewEvery(idle))
    // The tab closing (or the page left): the session ends now, not 30 idle minutes later.
    // Brought back from the back-forward cache, the frame's next redraw finds it ended and
    // falls back to signed links.
    let left = false
    const onLeave = () => {
      if (left) {
        return
      }
      left = true
      clearInterval(timer)
      closeEditorSession(id, { keepalive: true }).catch(() => undefined)
    }
    window.addEventListener("pagehide", onLeave)
    return () => {
      clearInterval(timer)
      window.removeEventListener("pagehide", onLeave)
      if (left) {
        return
      }
      closing.set(
        id,
        setTimeout(() => {
          closing.delete(id)
          closeEditorSession(id).catch(() => undefined)
          client.removeQueries({ queryKey: SESSION_KEY, exact: true })
        }, CLOSE_AFTER_MS)
      )
    }
  }, [id, idle, enabled, client])
  return session
}
