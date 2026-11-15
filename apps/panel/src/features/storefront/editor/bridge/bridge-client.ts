import { readToPanel } from "@qticaret/types/editor-bridge"
import type { ToPanelMessage } from "@qticaret/types/editor-bridge"
import type { AnySection, BodyGroup, LayoutGroup } from "@/features/storefront/api/layout"
import { STOREFRONT_ORIGIN } from "@/features/storefront/layout/preview-url"

/**
 * The panel's side of the theme editor's bridge (adr/0065 §2, Faz 1), as
 * plain functions: the frame's exact origin, the messages taken from it,
 * and why a section asked for would not be on the page shown.
 */

/**
 * Whether the live preview runs: unless the build turns it off
 * (`VITE_EDITOR_BRIDGE=false`), and only with a frame origin the build
 * names (security review 2026-11-15): `STOREFRONT_ORIGIN` is
 * `VITE_STOREFRONT_ORIGIN`, the storefront's dev server while developing,
 * and null in a production build without it, where the bridge stays shut
 * (its origin would come from the link the server signs) and the signed
 * link per save is used.
 */
export function bridgeOn(flag: string | undefined, storefrontOrigin: string | null): boolean {
  return flag?.trim().toLowerCase() !== "false" && storefrontOrigin !== null
}

export const BRIDGE_ON = bridgeOn(import.meta.env.VITE_EDITOR_BRIDGE, STOREFRONT_ORIGIN)

/** The frame's editor keys taken at most this often (security review 2026-11-15). */
export const KEYS_PER_SECOND = 5

/**
 * The frame's presses (`click`, `field`, `navigate-request`) taken at most
 * this often (security review 2026-11-15, DÜŞÜK-1): a person presses a
 * label or a link far less often.
 */
export const PICKS_PER_SECOND = 4

/**
 * A gate for messages that act on the panel (a key, or a press that opens
 * a form, a dialog or a page): taken only while the frame itself has the
 * focus (a key pressed or a pointer pressed in it moves the focus to it)
 * and at most `limit` in any `windowMs`, so a page in the frame cannot
 * replay the editor's history, open forms or take the focus on its own.
 * Refusals take no room.
 */
export function createFrameGate(limit: number, windowMs = 1000) {
  const taken: number[] = []
  return (focused: boolean, now: number): boolean => {
    if (!focused) {
      return false
    }
    while (taken.length > 0 && now - (taken[0] ?? 0) >= windowMs) {
      taken.shift()
    }
    if (taken.length >= limit) {
      return false
    }
    taken.push(now)
    return true
  }
}

/** The gate for the frame's `key` messages (undo, redo, escape). */
export const createKeyGate = () => createFrameGate(KEYS_PER_SECOND)

/** The gate for the frame's presses: an edit label, a field's label, a link. */
export const createPickGate = () => createFrameGate(PICKS_PER_SECOND)

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
