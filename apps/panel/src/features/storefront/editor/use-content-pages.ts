import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import { contentQuery } from "@/features/content/api/content"
import type { ContentEntry } from "@/features/content/api/content"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { sdk } from "@/lib/sdk"

/**
 * The shop's content pages as the theme editor knows them (adr/0073 §5):
 * the pages of İçerik (never the blog's posts), drafts too, each with its
 * title, address and status. Read once from İçerik's own list (the
 * newest change first) and found by title or address; a shop with more
 * pages than one read holds is also searched on the server, by title.
 */

/** A content page the editor may open: its id, title, address and whether it is live. */
export type ContentPageOption = Pick<ContentEntry, "id" | "title" | "handle" | "path" | "status">

/** As many as İçerik's list gives at once: a shop's pages are a handful. */
const READ = 100
const KEEP_MS = 60_000

const optionOf = (entry: ContentEntry): ContentPageOption => ({
  id: entry.id,
  title: entry.title,
  handle: entry.handle,
  path: entry.path,
  status: entry.status,
})

const fetchPages = async (q?: string) => {
  const answer = await sdk.client.fetch<{ entries: ContentEntry[]; count: number }>(
    "/admin/content",
    { query: { kind: "page", offset: 0, limit: READ, ...(q ? { q } : {}) } }
  )
  return { pages: answer.entries.map(optionOf), count: answer.count }
}

/** Under İçerik's own key: a page saved, published or deleted there reads again here. */
export const contentPagesQuery = () =>
  queryOptions({
    queryKey: ["content", "editor-pages"],
    queryFn: () => fetchPages(),
    staleTime: KEEP_MS,
  })

/** The shop's content pages (as many as one read holds), when `enabled`. */
export function useContentPages(enabled = true) {
  return useQuery({ ...contentPagesQuery(), enabled })
}

const folded = (text: string) => text.toLocaleLowerCase("tr")

/** Whether the page's title or address holds the words typed. */
export const pageMatches = (page: ContentPageOption, q: string): boolean => {
  const wanted = folded(q.trim())
  return folded(page.title).includes(wanted) || folded(page.handle).includes(wanted)
}

/**
 * The pages a search finds: from the pages read, by title or address;
 * when the shop has more than were read, the server's by title beside.
 */
export function useContentPageSearch(q: string, enabled: boolean) {
  const all = useContentPages(enabled)
  const partial = (all.data?.count ?? 0) > (all.data?.pages.length ?? 0)
  const more = useQuery({
    queryKey: ["content", "editor-pages", "search", q],
    queryFn: () => fetchPages(q),
    enabled: enabled && partial && q !== "",
    staleTime: KEEP_MS,
    placeholderData: keepPreviousData,
  })
  const found = (all.data?.pages ?? []).filter((page) => pageMatches(page, q))
  const seen = new Set(found.map((page) => page.id))
  const extra = q && partial ? (more.data?.pages ?? []).filter((page) => !seen.has(page.id)) : []
  return {
    pages: [...found, ...extra],
    loading: all.isPending || (partial && q !== "" && more.isFetching && !more.data),
  }
}

/** A content page by its id, from the pages read; else read on its own (a shop past one read). */
export function useContentPage(id: string | null) {
  const all = useContentPages(id !== null)
  const listed = id === null ? undefined : all.data?.pages.find((page) => page.id === id)
  const lookAlone = id !== null && all.isSuccess && !listed
  const alone = useQuery({ ...contentQuery(id ?? ""), enabled: lookAlone })
  const page = listed ?? (alone.data?.kind === "page" ? optionOf(alone.data) : undefined)
  return {
    page: page ?? null,
    /** Still being looked up. */
    finding: id !== null && !page && (all.isPending || (lookAlone && alone.isPending)),
  }
}

/** The page the contact form shows on (Vitrin tercihleri; adr/0047): its path, when on. */
export function useContactPath(enabled: boolean): string | null {
  const settings = useQuery({ ...sectionQuery<StorefrontSettings>("storefront"), enabled })
  return settings.data?.values.contact_form_path ?? null
}
