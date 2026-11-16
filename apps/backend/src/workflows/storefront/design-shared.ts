import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError, ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { SectorPackError, storefrontPreset } from "@qticaret/sector-packs"
import { readStoredLayout } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import type { Legacy } from "../../lib/storefront/layout-settings"
import { storedSettings } from "../../lib/storefront/layout-settings"
import { designDigest, rawDigest } from "../../lib/storefront/designs/digest"
import { DESIGN_LIMITS } from "../../lib/storefront/designs/limits"
import { nameKey } from "../../lib/storefront/designs/names"
import { designSummary, partsOf } from "../../lib/storefront/designs/summary"
import type { DesignReason, DesignSummary } from "../../lib/storefront/designs/summary"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"
import { layouts } from "./layout-row"
import { withLegacySettings } from "./layout-shared"

type Container = Pick<MedusaContainer, "resolve">

/** A saved look as the answers name it (adr/0064 Ek 2026-11-17). */
export interface DesignRef {
  id: string
  kind: "saved" | "auto"
  name: string | null
}

/** A design ready to be kept: its document (no menu set), digest and card. */
export interface DesignLook {
  document: Record<string, unknown>
  digest: string
  summary: DesignSummary
}

/** A saved look's whole row: what an undo writes back. */
export interface DesignRow extends DesignRef {
  name_key: string | null
  document: Record<string, unknown>
  digest: string
  summary: Record<string, unknown>
  created_by: string | null
  applied_at: Date | null
  created_at: Date
  updated_at: Date
}

export const DESIGN_ROW_FIELDS = [
  "id",
  "kind",
  "name",
  "name_key",
  "document",
  "digest",
  "summary",
  "created_by",
  "applied_at",
  "created_at",
  "updated_at",
] as const

/** The design's fingerprint as the editor opens it (`designDigest`). */
export const digestOf = (doc: LayoutDocument, legacy: Legacy): string =>
  designDigest(withLegacySettings(doc, legacy))

/**
 * The design labelled with the look it was given (`settings.design`, adr/0064
 * Ek 2026-11-17 §2): a saved look's id, null for a ready-made one, and the
 * digest of the design as written, which tells "düzenlenmiş" later.
 */
export function withDesignMark(
  doc: LayoutDocument,
  id: string | null,
  legacy: Legacy
): LayoutDocument {
  const design = { id, digest: digestOf(doc, legacy) }
  return { ...doc, settings: { ...doc.settings, design } }
}

/** Whether the stored design changed since the look it names was applied; none named: no. */
export function isEdited(stored: unknown, legacy: Legacy): boolean {
  const mark = storedSettings(stored).design
  if (!mark) {
    return false
  }
  const read = readable(stored)
  return read === null || digestOf(read, legacy) !== mark.digest
}

/** A ready-made look's name as this build has it; null when it has it no more. */
export function presetName(pack: string, code: string): string | null {
  try {
    return storefrontPreset(pack, code)?.name ?? null
  } catch (error) {
    if (error instanceof SectorPackError) {
      return null
    }
    throw error
  }
}

async function sourceOf(
  container: Container,
  stored: unknown
): Promise<Pick<DesignSummary, "source" | "source_name">> {
  const { design, preset } = storedSettings(stored)
  if (design?.id) {
    const [from] = await layouts(container).listStorefrontDesigns(
      { id: design.id },
      { select: ["id", "name"], take: 1 }
    )
    if (from) {
      return { source: "design", source_name: from.name ?? null }
    }
  }
  if (preset) {
    return { source: "preset", source_name: presetName(preset.pack, preset.code) }
  }
  return { source: "own", source_name: null }
}

/** A stored design through today's schema; null when it no longer reads. */
export function readable(stored: unknown): LayoutDocument | null {
  try {
    return readStoredLayout(stored)
  } catch {
    return null
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/**
 * A stored design (a draft, a revision) as a saved look keeps it: read
 * through today's schema with its unset parts filled as the editor opens
 * them, its menu set and labels dropped. One today's schema no longer
 * reads is kept as stored (applying it later says it cannot be opened):
 * nothing the shop made is lost. Too large to keep refuses the write
 * (and whatever replaces the draft with it).
 */
export async function lookOf(
  container: Container,
  stored: unknown,
  legacy: Legacy,
  reason: DesignReason
): Promise<DesignLook> {
  const source = await sourceOf(container, stored)
  const read = readable(stored)
  let look: DesignLook
  if (read) {
    const filled = withLegacySettings(read, legacy)
    const digest = designDigest(filled)
    const document = { ...filled, settings: { ...filled.settings, menus: null, design: null } }
    const mark = filled.settings.design
    look = {
      document,
      digest,
      summary: designSummary(
        { groups: filled, theme: filled.settings.theme, preset: filled.settings.preset },
        { ...source, edited: mark !== null && mark.digest !== digest, reason }
      ),
    }
  } else {
    const raw = asRecord(stored)
    const document = { ...raw, settings: { ...asRecord(raw["settings"]), menus: null } }
    look = {
      document,
      digest: rawDigest(document),
      summary: designSummary(partsOf(document), { ...source, edited: false, reason }),
    }
  }
  if (JSON.stringify(look.document).length > DESIGN_LIMITS.bytes) {
    throw new ValidationError("storefront_design.too_large", { field: "document" })
  }
  return look
}

/** A unique index refusing a second saved look of one name: the check's answer. */
export function nameTaken(error: unknown): never {
  if (uniqueViolationKeys(error)?.includes("name_key")) {
    throw new ConflictError("storefront_design.name_taken")
  }
  throw error
}

/**
 * The saved looks' rules for a name (adr/0064 §3): one per name in Turkish
 * lower case, ten at most; `self` is the look being renamed (counted
 * already when it is a named one).
 */
export async function assertNameFree(
  service: StorefrontLayoutModuleService,
  name: string,
  self: { id: string; kind: "saved" | "auto" } | null
): Promise<string> {
  const key = nameKey(name)
  const saved = await service.listStorefrontDesigns(
    { kind: "saved" },
    { select: ["id", "name_key"], take: null }
  )
  if (saved.some((row) => row.name_key === key && row.id !== self?.id)) {
    throw new ConflictError("storefront_design.name_taken")
  }
  if (self?.kind !== "saved" && saved.length >= DESIGN_LIMITS.saved) {
    throw new ConflictError("storefront_design.limit_reached")
  }
  return key
}

/** A named saved look written (rules first, the index last). */
export async function createSaved(
  service: StorefrontLayoutModuleService,
  look: DesignLook,
  name: string,
  actor: string | null
): Promise<DesignRef> {
  const trimmed = name.trim()
  const key = await assertNameFree(service, trimmed, null)
  const made = await service
    .createStorefrontDesigns({
      kind: "saved",
      name: trimmed,
      name_key: key,
      document: look.document,
      digest: look.digest,
      summary: look.summary as unknown as Record<string, unknown>,
      created_by: actor,
    })
    .catch(nameTaken)
  return { id: made.id, kind: "saved", name: trimmed }
}
