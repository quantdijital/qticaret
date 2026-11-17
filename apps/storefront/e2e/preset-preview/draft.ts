import type { AdminApi } from "../admin.ts"

/**
 * The developer's own draft around a preview run: kept as a saved look
 * first (adr/0064, the feature's own tool), put back exactly afterwards and
 * checked against what was read before. Nothing is published.
 */

export const BACKUP_NAME = "önizleme betiği yedeği"

interface Mark {
  id: string | null
  digest: string
}

interface Applied {
  pack: string
  code: string
}

export interface Layout {
  draft: { settings?: { design?: Mark | null; preset?: Applied | null } & Record<string, unknown> }
  published_at: string | null
  revision: number
}

interface Card {
  id: string
  kind: string
  name: string
}

interface Gallery {
  designs: Card[]
  limits: { saved: number }
}

export interface Before {
  layout: Layout
  designs: Set<string>
}

const readLayout = async (api: AdminApi) =>
  (await api.get<{ layout: Layout }>("/admin/storefront-layout")).layout

const readDesigns = (api: AdminApi) => api.get<Gallery>("/admin/storefront-designs")

/** What the run starts from; refused when the backup cannot be kept. */
export async function readBefore(api: AdminApi): Promise<Before> {
  const [layout, gallery] = await Promise.all([readLayout(api), readDesigns(api)])
  if (gallery.designs.some((each) => each.name === BACKUP_NAME)) {
    throw new Error(
      `a saved look named "${BACKUP_NAME}" is already there: an earlier run did not finish; apply it in the panel (Görünümler) if the draft is not yours, then delete it`
    )
  }
  const named = gallery.designs.filter((each) => each.kind !== "auto").length
  if (named >= gallery.limits.saved) {
    throw new Error(`the saved looks are full (${String(named)}): delete one to keep the backup`)
  }
  return { layout, designs: new Set(gallery.designs.map((each) => each.id)) }
}

/** The draft kept under the backup's name; its id. */
export async function keepBackup(api: AdminApi): Promise<string> {
  const saved = await api.post<{ design: Card | null }>("/admin/storefront-designs", {
    name: BACKUP_NAME,
  })
  if (!saved.design) {
    throw new Error("the backup was not kept")
  }
  return saved.design.id
}

/** JSON with its keys sorted, so two reads of one draft compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, each: unknown) =>
    each && typeof each === "object" && !Array.isArray(each)
      ? Object.fromEntries(Object.entries(each).sort(([a], [b]) => a.localeCompare(b)))
      : each
  )
}

const withoutMark = (layout: Layout) => ({
  ...layout.draft,
  settings: { ...layout.draft.settings, design: undefined },
})

export type Comparison = "same" | "mark" | "differs"

/** Whether the draft is back: whole, but for the saved-look mark, or not. */
export function compare(before: Layout, after: Layout): Comparison {
  if (before.published_at !== after.published_at || before.revision !== after.revision) {
    return "differs"
  }
  if (canonical(before.draft) === canonical(after.draft)) {
    return "same"
  }
  return canonical(withoutMark(before)) === canonical(withoutMark(after)) ? "mark" : "differs"
}

/**
 * The draft's saved-look mark brought back as it was first (saving the
 * draft keeps the stored one; only applying or discarding writes it): the
 * saved look it names applied again when still there, the ready-made one
 * it names, or, with none, the draft discarded to what is live (a design
 * from before saved looks carries none); else the backup. Then the draft
 * itself saved whole over it, as the theme editor saves.
 */
async function putBack(api: AdminApi, before: Before, backup: string | null): Promise<void> {
  const mark = before.layout.draft.settings?.design ?? null
  const preset = before.layout.draft.settings?.preset ?? null
  if (mark?.id && mark.id !== backup && before.designs.has(mark.id)) {
    await api.post(`/admin/storefront-designs/${mark.id}/apply`, {})
  } else if (mark?.id === null && preset) {
    await api.post(`/admin/storefront-presets/${preset.pack}/${preset.code}/apply`, {
      demo: false,
    })
  } else if (!mark) {
    await api.post("/admin/storefront-layout/discard", {})
  } else if (backup) {
    await api.post(`/admin/storefront-designs/${backup}/apply`, {})
  }
  await api.post("/admin/storefront-layout", { document: before.layout.draft })
}

/**
 * The draft put back and checked; the automatic saves the run made removed,
 * and the backup too once the draft is back (else it stays, named, for the
 * developer to apply). Returns how the draft compares with the one before.
 */
export async function restore(
  api: AdminApi,
  before: Before,
  backup: string | null
): Promise<Comparison> {
  await putBack(api, before, backup)
  const result = compare(before.layout, await readLayout(api))
  const gallery = await readDesigns(api)
  for (const each of gallery.designs) {
    const made = !before.designs.has(each.id)
    if (made && each.kind === "auto") {
      await api.del(`/admin/storefront-designs/${each.id}`)
    } else if (made && each.id === backup && result !== "differs") {
      await api.del(`/admin/storefront-designs/${each.id}`)
    }
  }
  return result
}
