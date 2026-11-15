import { readToPanel } from "@qticaret/types/editor-bridge"
import type { ToPanelMessage } from "@qticaret/types/editor-bridge"
import type { AnySection, BodyGroup, LayoutGroup } from "@/features/storefront/api/layout"

/**
 * The panel's side of the theme editor's bridge (adr/0065 §2, Faz 1), as
 * plain functions: the frame's exact origin, the messages taken from it,
 * and why a section asked for would not be on the page shown.
 */

/** The live preview: on unless the build turns it off (`VITE_EDITOR_BRIDGE=false`). */
export const BRIDGE_ON = import.meta.env.VITE_EDITOR_BRIDGE?.trim().toLowerCase() !== "false"

/** The exact origin of the address the frame opens; null for one that is not http(s). */
export function frameOrigin(address: string | null): string | null {
  if (!address) {
    return null
  }
  try {
    const url = new URL(address)
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null
  } catch {
    return null
  }
}

interface Received {
  origin: string
  source: unknown
  data: unknown
}

/**
 * A message from the preview frame: from its exact origin, sent by its own
 * window, shaped as the schema says. Everything else is null. What it
 * carries is still the frame's word: ids are looked up in the document
 * before use and nothing is printed as HTML.
 */
export function acceptFromFrame(
  event: Received,
  origin: string | null,
  frameWindow: unknown
): ToPanelMessage | null {
  if (!origin || event.origin !== origin || !frameWindow || event.source !== frameWindow) {
    return null
  }
  return readToPanel(event.data)
}

export type MissingReason = "hidden" | "scheduled" | "other_page" | "timeout"

/**
 * Why a section would not show on the page in the frame, before asking the
 * frame: hidden, outside its dates (adr/0049 schedule), or on another
 * page's group (the header and footer show on every page). Null: it should.
 */
export function whyNotShown(
  found: { group: LayoutGroup; section: AnySection },
  page: BodyGroup,
  now = new Date()
): MissingReason | null {
  const { group, section } = found
  const shown = section as Partial<{
    visible: boolean
    starts_at: string | null
    ends_at: string | null
  }>
  if (shown.visible === false) {
    return "hidden"
  }
  const at = now.getTime()
  const starts = shown.starts_at ? new Date(shown.starts_at).getTime() : null
  const ends = shown.ends_at ? new Date(shown.ends_at).getTime() : null
  if ((starts !== null && starts > at) || (ends !== null && ends <= at)) {
    return "scheduled"
  }
  if (group !== "header" && group !== "footer" && group !== page) {
    return "other_page"
  }
  return null
}
