import { useQuery } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { useCallback, useMemo } from "react"
import { contentQuery } from "@/features/content/api/content"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import type { ContentPageSection, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  pageLayoutOf,
  pagesFull,
  withPageSections,
} from "@/features/storefront/layout/page-layouts"
import { idsOf, newBodySection, newPageText } from "@/features/storefront/layout/sections"
import { namesPage, roleRef } from "./page-roles"
import type { PageRole } from "./page-roles"

/**
 * A content page the design has no entry for (adr/0073 Ek 2026-11-19 (2)
 * K1: its limit was full, an import, an older revision) is shown as the
 * storefront draws it: its text (the `body` mirror) made into sections as
 * the conversion makes them, the contact page's as `contact`, the payment
 * and shipping pages' facts after it. The first change makes the page's
 * entry of them (the reducer's `seed`); none while fifty pages have one.
 */

const isEmpty = (body: JSONContent): boolean => (body.content?.length ?? 0) === 0

/** A section id made from the page's: the same on every read, clear of the design's. */
function sectionIdOf(pageId: string, kind: string, taken: Set<string>): string {
  let hash = 2166136261
  for (const char of `${pageId}:${kind}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  }
  const seed = `p${hash.toString(36)}`.padEnd(8, "0")
  let id = seed
  for (let n = 1; taken.has(id); n += 1) {
    id = `${seed}${String(n)}`
  }
  taken.add(id)
  return id
}

/** The sections a page's text becomes (K3's table): none for an empty page without a role. */
export function synthesizedSections(
  pageId: string,
  body: JSONContent,
  roles: readonly PageRole[],
  taken: Set<string>
): ContentPageSection[] {
  const sections: ContentPageSection[] = []
  const id = (kind: string) => sectionIdOf(pageId, kind, taken)
  if (roles.includes("contact")) {
    const contact = newBodySection("pages", "contact", id("contact")) as ContentPageSection
    sections.push({ ...contact, body } as ContentPageSection)
  } else if (!isEmpty(body)) {
    sections.push(newPageText(id("article"), body))
  }
  if (roles.includes("payment")) {
    sections.push(newBodySection("pages", "payment_facts", id("payment")) as ContentPageSection)
  }
  if (roles.includes("shipping")) {
    sections.push(newBodySection("pages", "shipping_facts", id("shipping")) as ContentPageSection)
  }
  return sections
}

const ROLES: readonly PageRole[] = ["contact", "payment", "shipping"]

/** Whether an action changes the page's synthesized sections (or adds to the page). */
function touches(action: EditorAction, pageId: string, ids: ReadonlySet<string>): boolean {
  if (action.type === "add") {
    return action.group === "pages" && action.page === pageId
  }
  if (action.type === "update") {
    return ids.has(action.section.id)
  }
  return (
    (action.type === "move" ||
      action.type === "duplicate" ||
      action.type === "remove" ||
      action.type === "toggle") &&
    ids.has(action.id)
  )
}

/**
 * The page picked as the editor shows it: `view`, the draft with the
 * page's text made into its sections when it has no entry; `act`, the
 * editor's change that first makes that entry when it touches them.
 */
export function usePageSynth(
  doc: LayoutDocument,
  pageId: string | null,
  act: (action: EditorAction) => void
) {
  const listed = pageId !== null && pageLayoutOf(doc, pageId) !== undefined
  const wanted = pageId !== null && !listed
  const detail = useQuery({ ...contentQuery(pageId ?? ""), enabled: wanted })
  const settings = useQuery({ ...sectionQuery<StorefrontSettings>("storefront"), enabled: wanted })
  const body = detail.data?.kind === "page" ? detail.data.body : null
  const values = settings.data?.values
  const page = detail.data
  const roles = useMemo(
    () => (page && values ? ROLES.filter((role) => namesPage(roleRef(values, role), page)) : []),
    [page, values]
  )
  // Made once per page and text: their ids stay while the page is shown
  const sections = useMemo(
    () => (wanted && body ? synthesizedSections(pageId, body, roles, new Set(idsOf(doc))) : []),
    // The design's ids are read when the text is made, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wanted, body, roles, pageId]
  )
  const synthesized = pageId !== null && sections.length > 0
  const view = useMemo(
    () => (synthesized ? withPageSections(doc, pageId, sections) : doc),
    [doc, pageId, sections, synthesized]
  )
  const ids = useMemo(() => new Set(sections.map((section) => section.id)), [sections])
  const wrapped = useCallback(
    (action: EditorAction) => {
      if (synthesized && touches(action, pageId, ids)) {
        act({ type: "seed", page: pageId, sections, then: action })
        return
      }
      act(action)
    },
    [act, synthesized, pageId, ids, sections]
  )
  return {
    view,
    act: wrapped,
    synthesized,
    /** Synthesized but the design has no room for its entry: shown, not changed. */
    shownOnly: synthesized && pagesFull(doc, pageId),
  }
}
