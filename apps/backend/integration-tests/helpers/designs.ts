import type { MedusaContainer } from "@medusajs/framework/types"
import { STOREFRONT_LAYOUT_MODULE } from "../../src/modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../src/modules/storefront-layout/service"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"

/** The saved looks' answers as the panel reads them (adr/0064 Ek 2026-11-17). */
export interface DesignSummary {
  source: "preset" | "design" | "own"
  source_name: string | null
  preset: { pack: string; code: string; version: number } | null
  sections: Record<string, number>
  home_types: string[]
  edited: boolean
  reason: string | null
}

export interface DesignCard {
  id: string
  kind: "saved" | "auto"
  name: string | null
  summary: DesignSummary
  created_by: string | null
  applied_at: string | null
  in_draft: boolean
  live: boolean
  edited: boolean
}

export interface DesignGallery {
  designs: DesignCard[]
  limits: { saved: number; auto: number }
  current: {
    draft: { preset: unknown; design_id: string | null; edited: boolean; has_changes: boolean }
    live: { preset: unknown; design_id: string | null; revision: number }
  }
}

export interface DesignRef {
  id: string
  kind: "saved" | "auto"
  name: string | null
}

export interface Section {
  id: string
  type: string
  [key: string]: unknown
}

export interface Draft {
  header: Section[]
  home: Section[]
  footer: Section[]
  settings: Record<string, unknown> & {
    design?: { id: string | null; digest: string } | null
    menus?: unknown
    trust_badges?: unknown
  }
}

export interface AdminLayout {
  layout: { draft: Draft; has_changes: boolean; revision: number }
}

type Answer<T> = Promise<HttpResponse<T & { message?: string }>>

/** One staff member's calls, every answer settled (4xx and 5xx too). */
export function staffClient(http: HttpClient, headers: Record<string, string>) {
  const config = { headers }
  const get = <T>(url: string): Answer<T> => settle(http.get(url, config))
  const post = <T>(url: string, body: unknown = {}): Answer<T> =>
    settle(http.post(url, body, config))
  const remove = <T>(url: string): Answer<T> => settle(http.delete(url, config))
  return {
    get,
    post,
    remove,
    gallery: async () => (await get<DesignGallery>("/admin/storefront-designs")).data,
    layout: async () => (await get<AdminLayout>("/admin/storefront-layout")).data.layout,
    saveDraft: (draft: Draft) => post<AdminLayout>("/admin/storefront-layout", { document: draft }),
    applyPreset: (pack: string, code: string, body: object = {}) =>
      post<{ result: { auto_saved: DesignRef | null }; layout: AdminLayout["layout"] }>(
        `/admin/storefront-presets/${pack}/${code}/apply`,
        body
      ),
    applyDesign: (id: string, body: object = {}) =>
      post<{
        result: { design: DesignRef; auto_saved: DesignRef | null; skipped: []; dropped: [] }
        layout: AdminLayout["layout"]
      }>(`/admin/storefront-designs/${id}/apply`, body),
    saveDesign: (body: object) =>
      post<{ design: DesignCard | null }>("/admin/storefront-designs", body),
  }
}

export const designService = (container: MedusaContainer) =>
  container.resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)

/** Every saved look removed: a test counts from none. */
export async function clearDesigns(container: MedusaContainer): Promise<void> {
  const service = designService(container)
  const rows = await service.listStorefrontDesigns({}, { select: ["id"], take: null })
  if (rows.length > 0) {
    await service.deleteStorefrontDesigns(rows.map((row) => row.id))
  }
}

/** The stored rows (documents included), newest first, for what the answers never show. */
export async function storedDesigns(container: MedusaContainer) {
  const rows = await designService(container).listStorefrontDesigns(
    {},
    { select: ["id", "kind", "name", "document", "digest"], take: null }
  )
  return rows as unknown as {
    id: string
    kind: "saved" | "auto"
    name: string | null
    document: { settings?: Record<string, unknown>; home?: Section[] }
    digest: string
  }[]
}

export const SCHEDULE = { visible: true, starts_at: null, ends_at: null }

/** A help box of this title: a section any shop can have, no records named. */
export const helpBox = (id: string, title: string): Section => ({
  id,
  type: "help",
  ...SCHEDULE,
  title,
  text: null,
})
