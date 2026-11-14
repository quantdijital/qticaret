import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { MenuSet } from "../../lib/storefront/layout-menus"
import { STOREFRONT_MENUS_MODULE } from "../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../modules/storefront-menus/service"
import { parentsFirst, snapshotOf, writeLinks } from "./menus"
import type { Snapshot } from "./menus"

const menus = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)

/** Every menu the shop has now, with its links. */
async function snapshotAll(service: StorefrontMenusModuleService): Promise<Snapshot[]> {
  const rows = await service.listStorefrontMenus({}, { select: ["id"] })
  const snapshots = await Promise.all(rows.map((row) => snapshotOf(service, row.id)))
  return snapshots.filter((each): each is Snapshot => each !== null)
}

/** The menus as they were: whatever stands now removed (its links with it), the old ones back. */
async function putBackAll(service: StorefrontMenusModuleService, previous: Snapshot[]) {
  const current = await service.listStorefrontMenus({}, { select: ["id"] })
  if (current.length > 0) {
    await service.deleteStorefrontMenus(current.map((row) => row.id))
  }
  for (const snapshot of previous) {
    await service.createStorefrontMenus(snapshot.menu)
    if (snapshot.items.length > 0) {
      await service.createStorefrontMenuItems(parentsFirst(snapshot.items))
    }
  }
}

/**
 * Puts a design's menu set live (adr/0063 §3): every menu the shop has is
 * replaced by the set's. Undone, the old menus come back as they were
 * (`menus.ts`'s snapshot and put-back pattern); writes failing part-way
 * are put back here, as the workflow undoes only a step that finished.
 * No set: the menus are left alone. The caller holds the menus' lock.
 */
export const replaceMenusStep = createStep(
  "storefront-menus-replace",
  async (set: MenuSet | null, { container }) => {
    if (!set) {
      return new StepResponse({ replaced: false }, null)
    }
    const service = menus(container)
    const previous = await snapshotAll(service)
    try {
      if (previous.length > 0) {
        await service.deleteStorefrontMenus(previous.map((each) => each.menu.id))
      }
      for (const menu of set) {
        const made = await service.createStorefrontMenus({
          title: menu.title,
          location: menu.location,
          rank: menu.rank,
        })
        await writeLinks(service, made.id, menu.items)
      }
    } catch (error) {
      await putBackAll(service, previous)
      throw error
    }
    return new StepResponse({ replaced: true }, previous)
  },
  async (previous, { container }) => {
    if (previous) {
      await putBackAll(menus(container), previous)
    }
  }
)
