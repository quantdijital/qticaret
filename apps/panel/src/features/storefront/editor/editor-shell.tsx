import { useLayoutEffect, useRef } from "react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { SIDEBAR_ID } from "./editor-sidebar"
import type { EditorLayout, EditorView } from "./editor-layout"
import { useLevelEscape } from "./use-level-escape"

// A step of the side panel: its own scroll (`data-scroll-area`, e2e/support/scroll.ts).
// Positioned, so a screen-reader-only text inside (`sr-only` is absolute) scrolls and clips
// with it instead of stretching the window below the editor
const LEVEL = "relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"

interface EditorShellProps {
  layout: EditorLayout
  /** The narrow editor's choice between the side panel and the preview. */
  view: EditorView
  /** Whether the side panel is shown; folded, the preview takes its room. */
  sidebar: boolean
  /** The page's parts: the side panel's first step. */
  tree: ReactNode
  /** The open part's settings (a section's, or the theme's): the next step. */
  form: ReactNode
  /** Which settings are open, null for none: another one starts at its top. */
  formKey: string | null
  /** One step up (Escape), null at the page's parts. */
  onUp: (() => void) | null
  preview: ReactNode
}

/**
 * The editor below its top bar (the owner, 2026-11-27: one side panel,
 * not one beside another): a side panel whose content swaps, the page's
 * parts, then a part's settings, then a footer row's (each with the way
 * back in its header), beside the preview; on a tablet or phone one of
 * the two at a time. The list stays mounted while a part's settings are
 * open, so its scroll and its search are as they were on the way back;
 * what is hidden or folded stays mounted, so a half-filled form survives
 * a look at the preview.
 */
export function EditorShell({
  layout,
  view,
  sidebar,
  tree,
  form,
  formKey,
  onUp,
  preview,
}: EditorShellProps) {
  const narrow = layout === "narrow"
  const open = formKey !== null
  // Folded, the side panel stays mounted (hidden): a half-filled form survives it
  const folded = !sidebar && !narrow
  const away = folded || (narrow && view === "preview")
  useLevelEscape(away ? null : onUp)
  // The list's scroll, kept while it is hidden behind a part's settings
  const list = useRef<HTMLDivElement>(null)
  const listTop = useRef(0)
  const level = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const shown = list.current
    if (!open && shown) {
      shown.scrollTop = listTop.current
    }
  }, [open])
  // The keyboard's place follows the swap: into the settings' header, back to the row left
  const first = useRef(true)
  useLayoutEffect(() => {
    // Not on the way in: the page opens where it was asked to, the focus left alone
    if (first.current) {
      first.current = false
      return
    }
    const active = document.activeElement
    const lost = active === null || active === document.body
    if (formKey !== null) {
      if (lost || list.current?.contains(active)) {
        level.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true })
      }
    } else if (lost || !active.isConnected) {
      list.current
        ?.querySelector<HTMLElement>('[aria-current="true"]')
        ?.focus({ preventScroll: true })
    }
  }, [formKey])
  return (
    <main className="flex min-h-0 flex-1">
      <div
        id={SIDEBAR_ID}
        data-editor-sidebar={folded ? "hidden" : "shown"}
        data-editor-column="sidebar"
        hidden={away}
        className={cn(
          "relative flex min-h-0 shrink-0 flex-col bg-card",
          narrow
            ? "w-full"
            : "w-[clamp(22rem,28vw,26rem)] border-r motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-4 motion-safe:duration-150"
        )}
      >
        <div
          ref={list}
          data-editor-level="list"
          data-scroll-area="y"
          hidden={open}
          className={LEVEL}
          onScroll={(event) => {
            listTop.current = event.currentTarget.scrollTop
          }}
        >
          {tree}
        </div>
        {open ? (
          <div
            key={formKey}
            ref={level}
            data-editor-level="settings"
            data-editor-column="settings"
            data-scroll-area="y"
            className={cn(
              LEVEL,
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-150"
            )}
          >
            {form}
          </div>
        ) : null}
      </div>
      <div
        data-editor-column="preview"
        hidden={narrow && view === "edit"}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {preview}
      </div>
    </main>
  )
}
