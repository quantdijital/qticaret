import type { MedusaContainer } from "@medusajs/framework/types"
import type { SourceBrand, StepProgress } from "../../lib/migration/types"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { saveBrandWorkflow } from "../brands/workflows"

type Container = Pick<MedusaContainer, "resolve">

export interface BrandMap {
  /** A brand's name to its handle here; null for one not made (a dry run). */
  handleOf: (name: string) => string | null
  counts: { read: number; created: number; found: number }
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase("tr-TR")

/**
 * The source's brands here (F14, adr/0042 §2): one met before by its name
 * (any case) kept, the rest made through the brand workflow, which claims
 * each one's page path as a brand made by hand does. A dry run makes none.
 */
export async function migrateBrands(
  container: Container,
  source: string,
  brands: readonly SourceBrand[],
  apply: boolean,
  progress: StepProgress
): Promise<BrandMap> {
  const existing = await container
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listBrands({}, { select: ["id", "name", "handle"], take: null })
  const known = new Map<string, { id: string; handle: string }>(
    existing.map((brand) => [nameKey(brand.name), { id: brand.id, handle: brand.handle }])
  )
  const byId = new Map(existing.map((brand) => [brand.id, brand]))
  const before = await container.resolve<MigrationModuleService>(MIGRATION_MODULE).targetsOf(
    source,
    "brand",
    brands.map((brand) => brand.source_key)
  )
  // Names a dry run would make, each counted once
  const planned = new Set<string>()
  const counts = { read: brands.length, created: 0, found: 0 }
  const remembered: { source_key: string; target_id: string; old_url: string | null }[] = []
  for (const [index, brand] of brands.entries()) {
    // One a run made before, though renamed since; else by its name
    const madeBefore = byId.get(before.get(brand.source_key)?.target_id ?? "")
    let found = madeBefore
      ? { id: madeBefore.id, handle: madeBefore.handle }
      : known.get(nameKey(brand.name))
    if (found) {
      counts.found += 1
    } else if (!apply) {
      counts.created += planned.has(nameKey(brand.name)) ? 0 : 1
      planned.add(nameKey(brand.name))
    } else {
      const { result } = await saveBrandWorkflow(container as MedusaContainer).run({
        input: { values: { name: brand.name.trim(), is_active: true } },
      })
      found = { id: result.id, handle: result.handle }
      known.set(nameKey(brand.name), found)
      counts.created += 1
    }
    if (found) {
      remembered.push({ source_key: brand.source_key, target_id: found.id, old_url: brand.old_url })
    }
    await progress(index + 1, brands.length)
  }
  if (apply) {
    await container.resolve<MigrationModuleService>(MIGRATION_MODULE).remember(
      source,
      "brand",
      remembered.map((item) => ({ ...item, status: "done" as const }))
    )
  }
  return { handleOf: (name) => known.get(nameKey(name))?.handle ?? null, counts }
}
