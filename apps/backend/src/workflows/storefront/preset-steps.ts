import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SectorPackError, sectorPack, storefrontPreset } from "@qticaret/sector-packs"
import type { PresetMenu } from "@qticaret/sector-packs"
import { ValidationError } from "../../lib/errors"
import { withDesignMark } from "./design-shared"
import { shopSettingsOf } from "./design-steps"
import { legacySettings } from "./layout-shared"
import { layoutDocument, storedDocument } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import {
  presetDocument,
  presetTheme,
  withShopFrame,
  withShopPages,
} from "../../lib/storefront/presets/document"
import type { ShopFrame } from "../../lib/storefront/presets/document"
import { presetMarkers, resolvePreset } from "../../lib/storefront/presets/resolve"
import type { PresetLink, SkippedRef } from "../../lib/storefront/presets/resolve"
import type { ThemeSettings } from "../../modules/platform-settings/sections"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { defaultLayout } from "./layout-default"
import { layoutRow } from "./layout-row"
import { liveMenus, presetLookups } from "./preset-lookups"
import { sectionTypesOff } from "./layout-flags"

/** The pack every shop has its presets from, applied or not (adr/0063 §7). */
export const GENERAL_PACK = "general"

export interface ApplyPresetInput {
  pack: string
  code: string
  /** Demo records with the preset (adr/0063 §5); offered from work item 2.4 on. */
  demo: boolean
  /** The staff member applying it; null for the provisioner's script. */
  actor: string | null
  /** Where the packs are read from; tests only, the route and the script never pass it. */
  packs_dir?: string
  /**
   * The draft kept under this name first (adr/0064 Ek 2026-11-17); none: an
   * automatic save, when the draft holds anything new.
   */
  save_as?: string | null
}

/** A preset as the steps carry it: plain data (a step's result is stored as JSON). */
export interface LoadedPreset {
  pack: string
  code: string
  version: number
  /** The pack's version: an image's record names the version that first offered it. */
  pack_version: number
  dir: string
  layout: Record<string, unknown[] | undefined>
  menus: PresetMenu[] | null
  theme: ThemeSettings
}

/** What the preset's references point at in this shop, as plain records. */
export interface PresetResolution {
  records: Record<string, string>
  links: Record<string, PresetLink | null>
  /**
   * Section types whose feature flag is off in this shop, with their flags
   * (adr/0077 §8): their sections are dropped as `feature_off`.
   */
  types_off: Record<string, string>
  /** The images the resolved design still shows. */
  images: string[]
}

/** Images checked before they are uploaded: any path on the shop passes the schema. */
const placeholders = (paths: Iterable<string>): Map<string, string> =>
  new Map([...paths].map((path) => [path, `/${path}`]))

/**
 * The draft's header and footer as the editor shows them (the default
 * design's before the first save): kept where the preset leaves the group
 * empty (`withShopFrame`); with its content pages' layouts, kept on every
 * page the preset does not lay out (`withShopPages`). A draft today's
 * schema no longer reads keeps none.
 */
async function shopFrame(
  container: MedusaContainer,
  row: Awaited<ReturnType<typeof layoutRow>>
): Promise<ShopFrame & { pages: LayoutDocument["pages"] }> {
  if (!row) {
    const { header, footer } = await defaultLayout(container)
    return { header, footer, pages: [] }
  }
  const parsed = layoutDocument.safeParse(storedDocument(row.draft))
  return parsed.success
    ? { header: parsed.data.header, footer: parsed.data.footer, pages: parsed.data.pages }
    : { header: [], footer: [], pages: [] }
}

/**
 * The draft's own parts a preset keeps: the trust badges, colour swatches
 * and "Az kaldı"; the shop's header and footer where the preset leaves
 * them empty (`withShopFrame`); with the shop's live menus, kept where the
 * preset leaves a place (`resolveMenus`). Read for the draft it writes
 * under the design's lock (`composePresetDraftStep`), so an editor's save
 * just before is kept.
 */
async function keptSettings(container: MedusaContainer) {
  const [row, live] = await Promise.all([layoutRow(container), liveMenus(container)])
  const frame = await shopFrame(container, row)
  return { settings: shopSettingsOf(row?.draft ?? null), live, frame }
}

/**
 * The preset read and its theme checked (adr/0063 §4.1): a preset this
 * build does not have, or whose pack the shop was not given, is unknown;
 * one whose files the loader refuses, or whose theme the theme section's
 * schema refuses, writes nothing. Reads only.
 */
export const loadPresetStep = createStep(
  "storefront-preset-load",
  async (input: ApplyPresetInput, { container }) => {
    if (input.demo) {
      throw new ValidationError("storefront_preset.demo_unavailable", { field: "demo" })
    }
    let preset
    try {
      preset = storefrontPreset(input.pack, input.code, input.packs_dir)
    } catch (error) {
      if (error instanceof SectorPackError) {
        throw new ValidationError("storefront_preset.invalid", { field: "preset" })
      }
      throw error
    }
    const pack = preset ? sectorPack(input.pack, input.packs_dir) : null
    if (!preset || !pack) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_preset.unknown")
    }
    if (input.pack !== GENERAL_PACK) {
      const [applied] = await container
        .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
        .listSectorPackApplications({ pack: input.pack }, { select: ["id"], take: 1 })
      if (!applied) {
        throw new ValidationError("storefront_preset.pack_not_applied", { field: "pack" })
      }
    }
    const loaded: LoadedPreset = {
      pack: preset.pack,
      code: preset.code,
      version: preset.version,
      pack_version: pack.version,
      dir: preset.dir,
      layout: preset.layout,
      menus: preset.menus,
      theme: presetTheme(preset.theme_settings),
    }
    return new StepResponse(loaded)
  }
)

/** The draft the preset makes with these lookups and image addresses (`presetDocument`). */
function documentOf(
  preset: LoadedPreset,
  resolution: Omit<PresetResolution, "images">,
  images: Map<string, string>,
  kept: Awaited<ReturnType<typeof keptSettings>>
): {
  document: LayoutDocument
  skipped: SkippedRef[]
  dropped: string[]
  kept: string[]
  images: string[]
} {
  const resolved = resolvePreset(preset.layout, preset.menus, {
    records: new Map(Object.entries(resolution.records)),
    links: new Map(Object.entries(resolution.links)),
    images,
    live: kept.live,
    laid_out: kept.frame.pages.map((page) => page.page_id),
    types_off: new Map(Object.entries(resolution.types_off)),
  })
  const frame = withShopFrame(resolved.groups, kept.frame)
  const pages = withShopPages(resolved.pages, kept.frame.pages)
  const document = presetDocument(
    { groups: frame.groups, menus: resolved.menus, pages: pages.pages },
    preset.theme,
    { pack: preset.pack, code: preset.code, version: preset.version },
    kept.settings
  )
  return {
    document,
    skipped: resolved.skipped,
    dropped: resolved.dropped,
    kept: [...frame.kept, ...pages.kept],
    images: resolved.images,
  }
}

/**
 * Every `$handle` and `$href` looked up (adr/0063 §4.4) and the resolved
 * design held to the editor's schema before anything is uploaded or
 * written: a preset the schema refuses writes nothing. Reads only.
 */
export const resolvePresetStep = createStep(
  "storefront-preset-resolve",
  async (preset: LoadedPreset, { container }) => {
    const markers = presetMarkers({ layout: preset.layout, menus: preset.menus })
    const [lookups, off] = await Promise.all([
      presetLookups(container, markers, placeholders(markers.images)),
      sectionTypesOff(container),
    ])
    const resolution = {
      records: Object.fromEntries(lookups.records),
      links: Object.fromEntries(lookups.links),
      types_off: Object.fromEntries(off),
    }
    const checked = documentOf(
      preset,
      resolution,
      new Map(lookups.images),
      await keptSettings(container)
    )
    const out: PresetResolution = { ...resolution, images: checked.images }
    return new StepResponse(out)
  }
)

/**
 * The draft the preset makes, its images now the library's (adr/0063
 * §4.5); with what was left out and the shop's sections kept, for the panel to say. Reads only, run
 * under the design's lock: the draft is written next (`saveDraftSteps`),
 * the shop's kept settings as they are at that moment. Labelled as a
 * ready-made look's (`settings.design`, adr/0064 Ek 2026-11-17 §2), so the
 * gallery tells it apart once edited.
 */
export const composePresetDraftStep = createStep(
  "storefront-preset-compose",
  async (
    input: { preset: LoadedPreset; resolution: PresetResolution; images: Record<string, string> },
    { container }
  ) => {
    const [kept, legacy] = await Promise.all([keptSettings(container), legacySettings(container)])
    const made = documentOf(
      input.preset,
      input.resolution,
      new Map(Object.entries(input.images)),
      kept
    )
    const document = withDesignMark(made.document, null, legacy)
    return new StepResponse({
      document,
      skipped: made.skipped,
      dropped: made.dropped,
      kept: made.kept,
    })
  }
)
