import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { MenuSet } from "../../lib/storefront/layout-menus"
import { STOREFRONT_MENUS_MODULE } from "../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../modules/storefront-menus/service"
import { snapshotOf, stored } from "./menus"
import type { Snapshot } from "./menus"

const menus = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)

/** Every menu the shop has now, with its links. */
async function snapshotAll(service: StorefrontMenusModuleService): Promise<Snapshot[]> {
  const rows = await service.listStorefrontMenus({}, { select: ["id"] })
  const snapshots = await Promise.all(rows.map((row) => snapshotOf(service, row.id)))
  return snapshots.filter((each): each is Snapshot => each !== null)
}

/**
 * Puts a design's menu set live (adr/0063 §3): every menu the shop has is
 * replaced by the set's in one transaction of the menus module, so a write
 * failing part-way leaves them as they were. Undone (a later step of the
 * publication failing), the old menus come back as they were, again in one
 * transaction. No set: the menus are left alone. The caller holds the
 * menus' lock.
 */
export const replaceMenusStep = createStep(
  "storefront-menus-replace",
  async (set: MenuSet | null, { container }) => {
    if (!set) {
      return new StepResponse({ replaced: false }, null)
    }
    const service = menus(container)
    const previous = await snapshotAll(service)
    await service.replaceAllMenus(
      set.map((menu) => ({
        title: menu.title,
        location: menu.location,
        rank: menu.rank,
        items: menu.items.map((each) => ({
          link: stored(each.link),
          children: each.children.map(stored),
        })),
      }))
    )
    return new StepResponse({ replaced: true }, previous)
  },
  async (previous, { container }) => {
    if (previous) {
      await menus(container).restoreAllMenus(previous)
    }
  }
)
