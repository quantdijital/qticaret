import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { measureLogo } from "../logo-size"

export interface FillLogoSizesInput {
  /** Without it nothing is written: the counts say what would be. */
  apply: boolean
  /** Only these brands (the demo catalogue's); none means every brand. */
  ids?: string[] | undefined
  /** One page per run: the brands after this id; none from the start. */
  after?: string | null | undefined
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

export interface FillLogoSizesPage extends FillLogoSizesResult {
  /** The id the next page starts after; null when this one was the last. */
  next: string | null
}

/** A brand given a size, by the logo it was measured from (the undo matches it too). */
interface Written {
  id: string
  logo_file_id: string
}

/**
 * Brands measured under one hold of the brands lock: each may read a file
 * up to the upload limit, and the lock's 60 seconds must outlast them.
 */
export const FILL_PAGE = 20

const NO_SIZE = [{ logo_width: null }, { logo_height: null }]

/**
 * One page of brands with a logo and no width or height, by id, each
 * measured as a save measures it (the library's record of the file, else
 * its header). A size is written only where it still fits: the brand
 * keeps the logo it was measured from and still has no size (a save
 * between the read and the write wins). `measure` is for tests.
 */
export async function fillLogoSizesPage(
  container: Pick<MedusaContainer, "resolve">,
  input: FillLogoSizesInput,
  measure: typeof measureLogo = measureLogo
): Promise<{ page: FillLogoSizesPage; written: Written[] }> {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  const after = input.after ?? ""
  const rows = await service.listBrands(
    {
      logo_file_id: { $ne: null },
      $or: NO_SIZE,
      id: input.ids ? { $in: input.ids, $gt: after } : { $gt: after },
    },
    { select: ["id", "logo_file_id", "logo_url"], take: FILL_PAGE, order: { id: "ASC" } }
  )
  const sizes: (Written & { logo_width: number; logo_height: number })[] = []
  const unmeasured: string[] = []
  for (const row of rows) {
    const size =
      row.logo_file_id && row.logo_url
        ? await measure(container, row.logo_file_id, row.logo_url)
        : null
    if (size && row.logo_file_id) {
      sizes.push({
        id: row.id,
        logo_file_id: row.logo_file_id,
        logo_width: size.width,
        logo_height: size.height,
      })
    } else {
      unmeasured.push(row.id)
    }
  }
  const written: Written[] =
    input.apply && sizes.length > 0
      ? (
          await service.updateBrands(
            sizes.map((size) => ({
              selector: { id: size.id, logo_file_id: size.logo_file_id, $or: NO_SIZE },
              data: { logo_width: size.logo_width, logo_height: size.logo_height },
            }))
          )
        ).map((brand) => ({ id: brand.id, logo_file_id: brand.logo_file_id ?? "" }))
      : []
  const page: FillLogoSizesPage = {
    missing: rows.length,
    measured: sizes.length,
    unmeasured,
    written: written.length,
    next: rows.length === FILL_PAGE ? (rows[rows.length - 1]?.id ?? null) : null,
  }
  return { page, written }
}

/**
 * Logo sizes for brands whose logo was set before sizes were kept
 * (`brand-logo-sizes:backfill`, the demo catalogue), one page per run
 * (`fillBrandLogoSizes` runs them all). A brand with a size is never
 * touched, so it is safe to run again. Undone (sizes back to unknown,
 * where the logo is still the one measured) if a later step fails.
 */
export const fillLogoSizesStep = createStep(
  "brands-fill-logo-sizes",
  async (input: FillLogoSizesInput, { container }) => {
    const { page, written } = await fillLogoSizesPage(container, input)
    return new StepResponse(page, written)
  },
  async (written, { container }) => {
    if (!written?.length) {
      return
    }
    await container.resolve<BrandsModuleService>(BRANDS_MODULE).updateBrands(
      written.map((brand) => ({
        selector: { id: brand.id, logo_file_id: brand.logo_file_id },
        data: { logo_width: null, logo_height: null },
      }))
    )
  }
)
