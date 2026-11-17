import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { LayoutDocument } from "@/features/storefront/api/layout-sections"
import { MENUS_KEY } from "@/features/storefront/api/menus"

/**
 * The theme editor's document (adr/0049, backend lib/storefront/layout.ts):
 * the header's, the home page's, every product and category page's and
 * the footer's sections, saved whole as a draft and published together.
 */

export * from "@/features/storefront/api/layout-limits"
export type * from "@/features/storefront/api/layout-sections"
export type * from "@/features/storefront/api/layout-main"
export type * from "@/features/storefront/api/layout-footer-rows"
export type * from "@/features/storefront/api/layout-catalog"
export type * from "@/features/storefront/api/layout-cards"
export type * from "@/features/storefront/api/layout-shelf"
export type * from "@/features/storefront/api/layout-strips"

export interface LayoutRevision {
  revision: number
  published_at: string
  published_by: string | null
  /** It put a menu set live: restoring it brings that day's menus too, unless left out (adr/0063 §3). */
  has_menus: boolean
}

export interface AdminLayout {
  draft: LayoutDocument
  /** Never saved: the draft is the default design (the storefront as it was built). */
  is_default: boolean
  /** The draft differs from what is live. */
  has_changes: boolean
  revision: number
  published_at: string | null
  /** Newest first. */
  revisions: LayoutRevision[]
}

/** A signed link to the draft as saved now; a later save ends it. */
export interface LayoutPreview {
  url: string
  path: string
  expires_at: string
}

const PATH = "/admin/storefront-layout"
export const LAYOUT_KEY = ["storefront-layout"] as const
/** Publish, discard and restore: the autosave waits while one runs. */
export const LAYOUT_ACTION_KEY = [...LAYOUT_KEY, "action"] as const

/**
 * The looks gallery's queries (`features/storefront/gallery/api.ts`): a
 * publish, discard or restore changes what it shows (adr/0064 Ek 2026-11-17).
 */
export const GALLERY_KEY = ["storefront-gallery"] as const

/** The layout as the server answers; an older backend may leave the page groups out. */
export interface LayoutAnswer {
  layout: Omit<AdminLayout, "draft"> & {
    draft: Omit<LayoutDocument, "product" | "category"> &
      Partial<Pick<LayoutDocument, "product" | "category">>
  }
}
type Answer = LayoutAnswer

/** The draft kept before a discard or a restore replaced it; null: it held nothing new. */
export interface KeptDraft {
  id: string
  kind: "saved" | "auto"
  name: string | null
}

/** A draft from before the product and category pages had sections reads with both empty. */
export const withAllGroups = (layout: Answer["layout"]): AdminLayout => ({
  ...layout,
  draft: {
    ...layout.draft,
    product: layout.draft.product ?? [],
    category: layout.draft.category ?? [],
  },
})

export const layoutQuery = () =>
  queryOptions({
    queryKey: LAYOUT_KEY,
    queryFn: async () => withAllGroups((await sdk.client.fetch<Answer>(PATH)).layout),
    // The editor holds its own copy once open; a refetch would not change it
    staleTime: Infinity,
  })

/** Each change answers with the layout as stored: it replaces the cache at once. */
function useLayoutAction<T>(
  call: (input: T) => Promise<Answer>,
  action = true,
  after?: (client: ReturnType<typeof useQueryClient>) => void
) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: action ? LAYOUT_ACTION_KEY : [...LAYOUT_KEY, "save"],
    mutationFn: async (input: T) => withAllGroups((await call(input)).layout),
    onSuccess: (layout) => {
      client.setQueryData(LAYOUT_KEY, layout)
      after?.(client)
    },
  })
}

const post = (path: string, body: object = {}) =>
  sdk.client.fetch<Answer>(path, { method: "POST", body })

/** The draft saved whole; nothing reaches shoppers until it is published. */
export const useSaveLayout = () =>
  useLayoutAction((document: LayoutDocument) => post(PATH, { document }), false)

/**
 * A menu set the draft carried is live now (adr/0063 §3): the Menüler
 * screen reads again; so does the gallery ("Yayında").
 */
export const usePublishLayout = () =>
  useLayoutAction(
    () => post(`${PATH}/publish`),
    true,
    (client) => {
      void client.invalidateQueries({ queryKey: MENUS_KEY })
      void client.invalidateQueries({ queryKey: GALLERY_KEY })
    }
  )

/**
 * The draft replaced whole (a discard, a restore): the server keeps the
 * one it replaces as an automatic save first (adr/0064 Ek 2026-11-17), so
 * the gallery reads again, and `kept` names it for the toast.
 */
function useDraftReplace<T>(
  call: (input: T) => Promise<Answer & { auto_saved?: KeptDraft | null }>
) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: LAYOUT_ACTION_KEY,
    mutationFn: async (input: T) => {
      const answer = await call(input)
      return { layout: withAllGroups(answer.layout), kept: answer.auto_saved ?? null }
    },
    onSuccess: ({ layout }) => {
      client.setQueryData(LAYOUT_KEY, layout)
      void client.invalidateQueries({ queryKey: GALLERY_KEY })
    },
  })
}

/** The draft back to what is live (or the default design). */
export const useDiscardLayout = () => useDraftReplace(() => post(`${PATH}/discard`))

/** A published revision back into the draft; `menus: false` leaves out the menus it put live. */
export const useRestoreRevision = () =>
  useDraftReplace(({ revision, menus }: { revision: number; menus: boolean }) =>
    post(`${PATH}/revisions/${encodeURIComponent(String(revision))}/restore`, { menus })
  )

/** A fresh link to the draft as saved now. */
export const fetchLayoutPreview = () =>
  sdk.client.fetch<LayoutPreview>(`${PATH}/preview`, { method: "POST", body: {} })

/** The theme editor's live preview session (adr/0065 §1): one address while the editor is open. */
export interface EditorSession extends LayoutPreview {
  id: string
  /** How long it lasts without a renewal. */
  idle_ms: number
}

export const openEditorSession = () =>
  sdk.client.fetch<EditorSession>(`${PATH}/editor-session`, { method: "POST", body: {} })

export const renewEditorSession = (id: string) =>
  sdk.client.fetch<{ renewed: boolean }>(`${PATH}/editor-session/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: {},
  })

/** With `keepalive`, the request outlives the page (a tab closing). */
export const closeEditorSession = (id: string, { keepalive = false } = {}) =>
  sdk.client.fetch<{ deleted: boolean }>(`${PATH}/editor-session/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ...(keepalive ? { keepalive: true } : {}),
  })
