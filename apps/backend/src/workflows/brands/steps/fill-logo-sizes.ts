import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { measureLogo } from "../logo-size"

export interface FillLogoSizesInput {
  /** Without it nothing is written: the counts say what would be. */
  apply: boolean
  /** Only these brands (the demo catalogue's); none means every brand. */
  ids?: string[] | undefined
}

export interface FillLogoSizesResult {
  /** Brands with a logo and no size. */
  missing: number
  /** Of those, the ones whose logo could be measured (written when `apply`). */
  measured: number
  /** Ones whose file says no size: left unknown, drawn as before. */
  unmeasured: string[]
  written: number
}

// Brands read at a time
const PAGE = 200

/**
 * Logo sizes for brands whose logo was set before sizes were kept
 * (`brand-logo-sizes:backfill`, the demo catalogue): each one with a logo
 * and no width or height is measured as a save measures it (the library's
 * record of the file, else its header) and gets both. A brand with a size
 * is never touched, so it is safe to run again. Undone (sizes back to
 * unknown) if a later step fails.
 */
export const fillLogoSizesStep = createStep(
  "brands-fill-logo-sizes",
  async (input: FillLogoSizesInput, { container }) => {
    const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
    const filters = {
      logo_file_id: { $ne: null },
      $or: [{ logo_width: null }, { logo_height: null }],
      ...(input.ids ? { id: input.ids } : {}),
    }
    const rows: { id: string; logo_file_id: string | null; logo_url: string | null }[] = []
    for (let skip = 0; ; skip += PAGE) {
      const page = await service.listBrands(filters, {
        select: ["id", "logo_file_id", "logo_url"],
        skip,
        take: PAGE,
        order: { id: "ASC" },
      })
      rows.push(...page)
      if (page.length < PAGE) {
        break
      }
    }
    const sizes: { id: string; logo_width: number; logo_height: number }[] = []
    const unmeasured: string[] = []
    for (const row of rows) {
      const size =
        row.logo_file_id && row.logo_url
          ? await measureLogo(container, row.logo_file_id, row.logo_url)
          : null
      if (size) {
        sizes.push({ id: row.id, logo_width: size.width, logo_height: size.height })
      } else {
        unmeasured.push(row.id)
      }
    }
    if (input.apply && sizes.length > 0) {
      await service.updateBrands(sizes)
    }
    const written = input.apply ? sizes.map((size) => size.id) : []
    const result: FillLogoSizesResult = {
      missing: rows.length,
      measured: sizes.length,
      unmeasured,
      written: written.length,
    }
    return new StepResponse(result, written)
  },
  async (written, { container }) => {
    if (!written?.length) {
      return
    }
    await container
      .resolve<BrandsModuleService>(BRANDS_MODULE)
      .updateBrands(written.map((id) => ({ id, logo_width: null, logo_height: null })))
  }
)
