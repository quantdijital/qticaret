import type { MedusaContainer } from "@medusajs/framework/types"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { saveBrandWorkflow } from "../../workflows/brands/workflows"
import { deriveLibraryMediaWorkflow } from "../../workflows/media/workflows"
import { uploadDemoImage } from "./images"
import type { DemoCatalog } from "./schema"

/**
 * A brand's logo from the data file's `images` folder, brought in as a
 * category's picture is (an upload into the media library, with its
 * versions); the brand keeps the file's storage key, as the panel's logo
 * card saves it.
 */
async function uploadLogo(
  container: MedusaContainer,
  handle: string,
  file: string,
  imageDir: string
): Promise<string> {
  const asset = await uploadDemoImage(container, { dir: imageDir, file }, `marka-${handle}`, true)
  if (!asset.file_id) {
    throw new Error(`demo-catalog: the logo of ${handle} was stored without a file`)
  }
  await deriveLibraryMediaWorkflow(container).run({ input: { ids: [asset.id] } })
  return asset.file_id
}

/**
 * The file's brands by handle; one missing is made through the panel's
 * workflow, with its logo when the file gives one. A brand already here
 * is kept as it is, save that one without a logo gets the file's (a run
 * before logos, or a brand made by hand); a logo the shop chose stays.
 */
export async function ensureBrands(
  container: MedusaContainer,
  catalog: DemoCatalog,
  imageDir: string
): Promise<{ ids: Map<string, string>; created: number; logos: number }> {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  const known = await service.listBrands(
    { handle: catalog.brands.map((brand) => brand.handle) },
    { select: ["id", "handle", "logo_file_id"] }
  )
  const rows = new Map(known.map((brand) => [brand.handle, brand]))
  const ids = new Map<string, string>()
  let created = 0
  let logos = 0
  for (const brand of catalog.brands) {
    const existing = rows.get(brand.handle)
    const logo = existing?.logo_file_id ? undefined : brand.logo
    if (existing) {
      ids.set(brand.handle, existing.id)
      if (!logo) {
        continue
      }
    }
    const logoFileId = logo ? await uploadLogo(container, brand.handle, logo, imageDir) : null
    const { result } = await saveBrandWorkflow(container).run({
      input: existing
        ? { id: existing.id, values: { logo_file_id: logoFileId } }
        : {
            values: {
              name: brand.name,
              handle: brand.handle,
              description: brand.description,
              logo_file_id: logoFileId,
            },
          },
    })
    ids.set(brand.handle, result.id)
    created += existing ? 0 : 1
    logos += logoFileId ? 1 : 0
  }
  return { ids, created, logos }
}
