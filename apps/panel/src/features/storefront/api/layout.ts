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
export type * from "@/features/storefront/api/layout-catalog"
export type * from "@/features/storefront/api/layout-shelf"

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

/** The layout as the server answers; an older backend may leave the page groups out. */
interface Answer {
  layout: Omit<AdminLayout, "draft"> & {
    draft: Omit<LayoutDocument, "product" | "category"> &
      Partial<Pick<LayoutDocument, "product" | "category">>
  }
}

/** A draft from before the product and category pages had sections reads with both empty. */
const withAllGroups = (layout: Answer["layout"]): AdminLayout => ({
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

/** A menu set the draft carried is live now (adr/0063 §3): the Menüler screen reads again. */
export const usePublishLayout = () =>
  useLayoutAction(
    () => post(`${PATH}/publish`),
    true,
    (client) => void client.invalidateQueries({ queryKey: MENUS_KEY })
  )

/** The draft back to what is live (or the default design). */
export const useDiscardLayout = () => useLayoutAction(() => post(`${PATH}/discard`))

/** A published revision back into the draft; `menus: false` leaves out the menus it put live. */
export const useRestoreRevision = () =>
  useLayoutAction(({ revision, menus }: { revision: number; menus: boolean }) =>
    post(`${PATH}/revisions/${encodeURIComponent(String(revision))}/restore`, { menus })
  )

/** A fresh link to the draft as saved now. */
export const fetchLayoutPreview = () =>
  sdk.client.fetch<LayoutPreview>(`${PATH}/preview`, { method: "POST", body: {} })
