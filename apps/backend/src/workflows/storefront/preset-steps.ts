import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SectorPackError, sectorPack, storefrontPreset } from "@qticaret/sector-packs"
import type { PresetMenu } from "@qticaret/sector-packs"
import { ValidationError } from "../../lib/errors"
import { withDesignMark } from "./design-shared"
import { legacySettings } from "./layout-shared"
import {
  presetDocument,
  presetTheme,
  withShopFrame,
  withShopPages,
} from "../../lib/storefront/presets/document"
import { withShopTexts } from "../../lib/storefront/presets/page-texts"
import type { PageTextSource } from "../../lib/storefront/page-text"
import { presetMarkers, resolvePreset } from "../../lib/storefront/presets/resolve"
import type { PresetLink } from "../../lib/storefront/presets/resolve"
import type { ThemeSettings } from "../../modules/platform-settings/sections"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { keptSettings } from "./preset-kept"
import type { KeptSettings } from "./preset-kept"
import { presetLookups } from "./preset-lookups"
import { sectionTypesOff } from "./layout-flags"
import { placeholderOf, presetPageRefs, shopTextSources } from "./preset-pages"
import type { KeptText, MadePage, OpenedPages, PageToOpen } from "./preset-pages"

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
  /**
   * The pages the preset lays out that the shop has not made, to be opened
   * as drafts (adr/0073 Ek 2026-11-19 (2) K6): each by its handle and the
   * look's name for it, its title. Only the ones the design has room for.
   */
  open_pages: PageToOpen[]
}

/** Images checked before they are uploaded: any path on the shop passes the schema. */
const placeholders = (paths: Iterable<string>): Map<string, string> =>
  new Map([...paths].map((path) => [path, `/${path}`]))

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

/** The pages' ids the preset lays out with these records (opened pages' placeholders included). */
const laidOutIds = (preset: LoadedPreset, records: Record<string, string>): string[] =>
  presetPageRefs(preset.layout).flatMap(({ ref }) => (records[ref] ? [records[ref]] : []))

/** The draft the preset makes with these lookups and image addresses (`presetDocument`). */
function documentOf(
  preset: LoadedPreset,
  resolution: Omit<PresetResolution, "images" | "open_pages"> & { taken?: string[] },
  images: Map<string, string>,
  kept: KeptSettings,
  sources: ReadonlyMap<string, PageTextSource>
) {
  const resolved = resolvePreset(preset.layout, preset.menus, {
    records: new Map(Object.entries(resolution.records)),
    links: new Map(Object.entries(resolution.links)),
    images,
    live: kept.live,
    laid_out: kept.frame.pages.map((page) => page.page_id),
    types_off: new Map(Object.entries(resolution.types_off)),
    taken: new Set(resolution.taken ?? []),
  })
  const frame = withShopFrame(resolved.groups, kept.frame)
  // The shop's own page text kept on the pages the look lays out (adr/0073 Ek 2026-11-19 (2) K6)
  const named = new Set(resolved.pages.map((page) => page.page_id))
  const others = kept.frame.pages.filter((page) => !named.has(page.page_id))
  const texts = withShopTexts(resolved.pages, kept.frame.pages, sources, [frame.groups, others])
  const pages = withShopPages(texts.pages, kept.frame.pages)
  const document = presetDocument(
    { groups: frame.groups, menus: resolved.menus, pages: pages.pages },
    preset.theme,
    { pack: preset.pack, code: preset.code, version: preset.version },
    kept.settings
  )
  const refs = presetPageRefs(preset.layout)
  const textsKept: KeptText[] = refs.flatMap(({ ref, name }) => {
    const id = resolution.records[ref]
    return id && texts.kept.includes(id) ? [{ ref, ...(name === null ? {} : { name }) }] : []
  })
  return {
    document,
    skipped: resolved.skipped,
    dropped: [...resolved.dropped, ...texts.dropped],
    kept: [...frame.kept, ...pages.kept],
    texts_kept: textsKept,
    carried: texts.carried,
    images: resolved.images,
  }
}

/**
 * Every `$handle` and `$href` looked up (adr/0063 §4.4) and the resolved
 * design held to the editor's schema before anything is uploaded or
 * written: a preset the schema refuses writes nothing. A page the preset
 * lays out and the shop has not made is held to it under a stand-in id;
 * the ones the design has room for are to be opened as drafts
 * (`open_pages`, adr/0073 Ek 2026-11-19 (2) K6). Reads only.
 */
export const resolvePresetStep = createStep(
  "storefront-preset-resolve",
  async (preset: LoadedPreset, { container }) => {
    const markers = presetMarkers({ layout: preset.layout, menus: preset.menus })
    const [lookups, off, kept] = await Promise.all([
      presetLookups(container, markers, placeholders(markers.images)),
      sectionTypesOff(container),
      keptSettings(container),
    ])
    const resolution = {
      records: Object.fromEntries(lookups.records),
      links: Object.fromEntries(lookups.links),
      types_off: Object.fromEntries(off),
    }
    // A page with no name of the look's has no title to be opened with: left out, `missing`
    const toOpen = presetPageRefs(preset.layout).flatMap(({ ref, name }) =>
      lookups.records.has(ref) || name === null ? [] : [{ ref, title: name }]
    )
    const records = { ...resolution.records }
    toOpen.forEach((page, index) => {
      records[page.ref] = placeholderOf(index)
    })
    const sources = await shopTextSources(container, laidOutIds(preset, records), kept.frame.pages)
    const checked = documentOf(
      preset,
      { ...resolution, records },
      new Map(lookups.images),
      kept,
      sources
    )
    const placed = new Set(checked.document.pages.map((page) => page.page_id))
    const out: PresetResolution = {
      ...resolution,
      images: checked.images,
      open_pages: toOpen.flatMap((page, index) =>
        placed.has(placeholderOf(index))
          ? [{ ...page, handle: page.ref.slice(page.ref.indexOf(":") + 1) }]
          : []
      ),
    }
    return new StepResponse(out)
  }
)

/**
 * The draft the preset makes, its images now the library's (adr/0063
 * §4.5), on the pages opened for it (`openPresetPagesStep`); with what was
 * left out, the shop's sections and page texts kept, and the pages opened,
 * for the panel to say. Reads only, run under the design's lock: the
 * draft is written next (`saveDraftSteps`, the kept texts `carried`: the
 * shop's own, not the apply's new work), the shop's kept settings as they
 * are at that moment. Labelled as a ready-made look's (`settings.design`,
 * adr/0064 Ek 2026-11-17 §2), so the gallery tells it apart once edited.
 */
export const composePresetDraftStep = createStep(
  "storefront-preset-compose",
  async (
    input: {
      preset: LoadedPreset
      resolution: PresetResolution
      images: Record<string, string>
      opened: OpenedPages
    },
    { container }
  ) => {
    const [kept, legacy] = await Promise.all([keptSettings(container), legacySettings(container)])
    const records = { ...input.resolution.records, ...input.opened.records }
    const sources = await shopTextSources(
      container,
      laidOutIds(input.preset, records),
      kept.frame.pages
    )
    const made = documentOf(
      input.preset,
      { ...input.resolution, records, taken: input.opened.taken },
      new Map(Object.entries(input.images)),
      kept,
      sources
    )
    const document = withDesignMark(made.document, null, legacy)
    const madePages: MadePage[] = input.opened.made
    return new StepResponse({
      document,
      skipped: made.skipped,
      dropped: made.dropped,
      kept: made.kept,
      texts_kept: made.texts_kept,
      carried: made.carried,
      made_pages: madePages,
    })
  }
)
