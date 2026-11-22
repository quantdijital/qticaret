import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import {
  GALLERY_KEY,
  LAYOUT_ACTION_KEY,
  LAYOUT_KEY,
  withAllGroups,
} from "@/features/storefront/api/layout"
import type { KeptDraft, LayoutAnswer } from "@/features/storefront/api/layout"

/**
 * The looks gallery (adr/0064, Ek 2026-11-17; backend
 * `api/admin/storefront-designs`, `api/admin/storefront-presets`): the
 * ready-made looks, the shop's saved ones and where its design stands. A
 * look is never sent: the server reads the draft (or a publication) itself.
 */

export type DesignKind = "saved" | "auto"
export type DesignSource = "preset" | "design" | "own"
export type DesignReason = "preset_apply" | "design_apply" | "restore" | "discard" | "manual"
export type DesignGroup = "header" | "home" | "footer" | "product" | "category"

export interface PresetRef {
  pack: string
  code: string
  version: number
}

/** What a look's card draws without its document (backend `lib/storefront/designs/summary.ts`). */
export interface DesignSummary {
  source: DesignSource
  /** The ready-made or saved look's name at the time; null for the shop's own. */
  source_name: string | null
  preset: PresetRef | null
  colors: { primary: string | null; accent: string | null; background: string | null }
  fonts: { heading: string | null; body: string | null }
  sections: Record<DesignGroup, number>
  /** The home page's first section types, in order. */
  home_types: string[]
  edited: boolean
  /** Null for a ready-made look's card. */
  reason: DesignReason | null
}

export interface DesignCard {
  id: string
  kind: DesignKind
  /** Null for an automatic save: the panel names it from its summary. */
  name: string | null
  summary: DesignSummary
  created_at: string
  updated_at: string
  created_by: string | null
  applied_at: string | null
  in_draft: boolean
  live: boolean
  /** In the draft and changed there since. */
  edited: boolean
}

export interface DesignGallery {
  designs: DesignCard[]
  limits: { saved: number; auto: number }
  current: {
    draft: {
      preset: PresetRef | null
      design_id: string | null
      edited: boolean
      has_changes: boolean
    }
    live: {
      preset: PresetRef | null
      design_id: string | null
      revision: number
      published_at: string | null
    }
  }
}

export interface PresetCard extends PresetRef {
  theme: string
  name: string
  description: string
  tone: "light" | "dark"
  /** The colour family it is shown in (its own code when it has none). */
  family: string
  /** Its colour set's short name; null: the family has one look. */
  swatch: string | null
  summary: DesignSummary
  has_menus: boolean
  has_demo: boolean
  has_preview: boolean
  has_header: boolean
  has_footer: boolean
  preview_url: string | null
  /** The version the draft / the live design was last given; null: not this one. */
  in_draft: number | null
  live: number | null
}

/** A look the draft was kept as before it changed. */
export type DesignRef = KeptDraft

export interface SkippedRef {
  /** `home.kategoriler`; `pages`: a content page's layout, the shop having no such page (adr/0073 §4). */
  where: string
  /** `category:cakilar`; for a page, `page:hakkimizda`. */
  ref: string
  /** A page left out: its usual name (`Hakkımızda`), when the look gives one. */
  name?: string
  /**
   * Why it was left out: a page's layout, no such page or no room for
   * another page's layout; a section, its feature flag off in this shop
   * (`feature_off`, adr/0077 §8: `ref` its type, `flag` the flag).
   */
  reason?: "missing" | "limit" | "feature_off"
  flag?: string
}

/** What an apply did, for the editor's note. */
export interface ApplyReport {
  /** The look's name as the shop knows it. */
  name: string
  auto_saved: DesignRef | null
  /** The name the panel showed the kept draft under. */
  saved_name: string | null
  skipped: SkippedRef[]
  /** The shop's header or footer sections kept (`footer.<id>`), its own page layouts (`pages.<id>`). */
  kept: string[]
}

export { GALLERY_KEY }
export const DESIGNS_KEY = [...GALLERY_KEY, "designs"] as const
export const PRESETS_KEY = [...GALLERY_KEY, "presets"] as const
export const REPORT_KEY = [...GALLERY_KEY, "report"] as const

const DESIGNS = "/admin/storefront-designs"
const PRESETS = "/admin/storefront-presets"
const id = (value: string) => encodeURIComponent(value)

export const designsQuery = () =>
  queryOptions({
    queryKey: DESIGNS_KEY,
    queryFn: () => sdk.client.fetch<DesignGallery>(DESIGNS),
  })

export const presetsQuery = () =>
  queryOptions({
    queryKey: PRESETS_KEY,
    queryFn: async () => (await sdk.client.fetch<{ presets: PresetCard[] }>(PRESETS)).presets,
  })

interface ApplyAnswer extends LayoutAnswer {
  result: {
    auto_saved: DesignRef | null
    skipped: SkippedRef[]
    kept?: string[]
    /** Content page layouts left out for pages deleted since (adr/0073 §1); absent before them. */
    dropped_pages?: number
  }
}

export type ApplyTarget =
  { kind: "preset"; preset: PresetCard } | { kind: "design"; design: DesignCard; name: string }

/**
 * A look into the draft (the draft kept first: named with `save_as`, else
 * automatically); like publishing, the editor's autosave waits for it.
 * The editor opens on the new draft and says what happened.
 */
export function useApplyLook() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: LAYOUT_ACTION_KEY,
    mutationFn: async ({ target, saveAs }: { target: ApplyTarget; saveAs: string | null }) => {
      const body = saveAs ? { save_as: saveAs } : {}
      const path =
        target.kind === "preset"
          ? `${PRESETS}/${id(target.preset.pack)}/${id(target.preset.code)}/apply`
          : `${DESIGNS}/${id(target.design.id)}/apply`
      const answer = await sdk.client.fetch<ApplyAnswer>(path, { method: "POST", body })
      return { layout: withAllGroups(answer.layout), result: answer.result }
    },
    onSuccess: ({ layout }) => {
      client.setQueryData(LAYOUT_KEY, layout)
      void client.invalidateQueries({ queryKey: GALLERY_KEY, refetchType: "all" })
    },
  })
}

const invalidating = (client: ReturnType<typeof useQueryClient>) => () =>
  client.invalidateQueries({ queryKey: GALLERY_KEY })

/** The draft (or a kept publication, `revision`) saved under a name. */
export function useSaveDesign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; revision?: number }) =>
      sdk.client.fetch<{ design: DesignCard | null }>(DESIGNS, { method: "POST", body: input }),
    onSuccess: invalidating(client),
  })
}

/** Renamed; an automatic save given a name becomes a named look. */
export function useRenameDesign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ design, name }: { design: string; name: string }) =>
      sdk.client.fetch<{ design: DesignCard | null }>(`${DESIGNS}/${id(design)}`, {
        method: "POST",
        body: { name },
      }),
    onSuccess: invalidating(client),
  })
}

/** Removed for good (asked first). */
export function useDeleteDesign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (design: string) =>
      sdk.client.fetch<{ id: string; deleted: boolean }>(`${DESIGNS}/${id(design)}`, {
        method: "DELETE",
      }),
    onSuccess: invalidating(client),
  })
}

/** The last apply's note, held until the editor's "Kapat". */
export function useApplyReport(): [ApplyReport | null, () => void] {
  const client = useQueryClient()
  const report = useQuery({
    queryKey: REPORT_KEY,
    queryFn: () => null as ApplyReport | null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data
  return [
    report ?? null,
    () => {
      client.setQueryData(REPORT_KEY, null)
    },
  ]
}
