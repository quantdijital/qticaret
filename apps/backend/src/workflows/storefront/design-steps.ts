import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { storedSettings } from "../../lib/storefront/layout-settings"
import type { LayoutSettings } from "../../lib/storefront/layout-settings"
import { autoToEvict } from "../../lib/storefront/designs/evict"
import { DESIGN_LIMITS } from "../../lib/storefront/designs/limits"
import type { DesignReason } from "../../lib/storefront/designs/summary"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"
import { DESIGN_ROW_FIELDS, createSaved, digestOf, lookOf, readable } from "./design-shared"
import type { DesignRef, DesignRow } from "./design-shared"
import { layoutRow, layouts } from "./layout-row"
import type { LayoutRow } from "./layout-row"
import { legacySettings } from "./layout-shared"

type Container = Pick<MedusaContainer, "resolve">

export interface AutoSaveInput {
  /** The staff member replacing the draft; null for a script. */
  actor: string | null
  /** Keep the draft under this name instead (a named saved look, within the ten). */
  save_as: string | null
  reason: DesignReason
}

/**
 * The shop's own data in the draft that applying a look keeps (adr/0063 §4,
 * adr/0064 §2): the trust badges, colour swatches and "Az kaldı", as the
 * draft stores them (unset: the old fields stand in, as before).
 */
export function shopSettingsOf(
  draft: unknown
): Pick<LayoutSettings, "trust_badges" | "color_swatches" | "low_stock"> {
  const { trust_badges, color_swatches, low_stock } = storedSettings(draft)
  return { trust_badges, color_swatches, low_stock }
}

/** The same, read from the draft now (under the design's lock, by the caller). */
export async function keptShopSettings(container: Container) {
  const row = await layoutRow(container)
  return shopSettingsOf(row?.draft ?? null)
}

/**
 * Whether an automatic save would keep nothing new (adr/0064 Ek 2026-11-17
 * §1): the draft is the ready-made look it was given, unchanged (applying
 * that look again makes it again); a discarded draft is what is live (kept
 * in the revisions); or a saved look already holds this design.
 */
async function nothingNew(
  service: StorefrontLayoutModuleService,
  row: LayoutRow,
  digest: string,
  reason: DesignReason,
  liveDigest: string | null
): Promise<boolean> {
  const mark = storedSettings(row.draft).design
  if (mark?.id === null && mark.digest === digest) {
    return true
  }
  if (reason === "discard" && liveDigest === digest) {
    return true
  }
  const [same] = await service.listStorefrontDesigns({ digest }, { select: ["id"], take: 1 })
  return same !== undefined
}

interface AutoSaveUndo {
  made: string | null
  evicted: DesignRow[]
}

async function undoAutoSave(service: StorefrontLayoutModuleService, undo: AutoSaveUndo) {
  if (undo.made) {
    await service.deleteStorefrontDesigns(undo.made)
  }
  if (undo.evicted.length > 0) {
    await service.createStorefrontDesigns(undo.evicted)
  }
}

/**
 * The draft kept before something replaces it (adr/0064 Ek 2026-11-17 §1.2):
 * a ready-made or saved look applied, a revision restored, the draft
 * discarded. Under the design's lock, which the workflow holds. With
 * `save_as`, a named saved look (refused past the ten or on a name in use,
 * and the replacement with it); else an automatic one, unless it would keep
 * nothing new, the oldest beyond five removed. No draft saved yet: nothing
 * to keep. Undone, the look made is removed and those removed come back.
 */
export const autoSaveDraftStep = createStep(
  "storefront-design-auto-save",
  async (input: AutoSaveInput, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      return new StepResponse<DesignRef | null, AutoSaveUndo | null>(null, null)
    }
    const service = layouts(container)
    const legacy = await legacySettings(container)
    const look = await lookOf(container, row.draft, legacy, input.reason)
    if (input.save_as !== null) {
      const saved = await createSaved(service, look, input.save_as, input.actor)
      return new StepResponse<DesignRef | null, AutoSaveUndo | null>(saved, {
        made: saved.id,
        evicted: [],
      })
    }
    const live = row.published ? readable(row.published) : null
    const liveDigest = live ? digestOf(live, legacy) : null
    if (await nothingNew(service, row, look.digest, input.reason, liveDigest)) {
      return new StepResponse<DesignRef | null, AutoSaveUndo | null>(null, null)
    }
    const made = await service.createStorefrontDesigns({
      kind: "auto",
      name: null,
      name_key: null,
      document: look.document,
      digest: look.digest,
      summary: look.summary as unknown as Record<string, unknown>,
      created_by: input.actor,
    })
    const undo: AutoSaveUndo = { made: made.id, evicted: [] }
    try {
      const autos = (await service.listStorefrontDesigns(
        { kind: "auto" },
        { select: [...DESIGN_ROW_FIELDS], take: null }
      )) as DesignRow[]
      const evict = autoToEvict(autos, DESIGN_LIMITS.auto)
      if (evict.length > 0) {
        await service.deleteStorefrontDesigns(evict.map((each) => each.id))
        undo.evicted = evict
      }
    } catch (error) {
      await undoAutoSave(service, undo)
      throw error
    }
    const ref: DesignRef = { id: made.id, kind: "auto", name: null }
    return new StepResponse<DesignRef | null, AutoSaveUndo | null>(ref, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await undoAutoSave(layouts(container), undo)
    }
  }
)
