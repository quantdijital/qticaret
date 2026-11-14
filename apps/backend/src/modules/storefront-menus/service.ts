import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { MENU_LOCATIONS, StorefrontMenu } from "./models/storefront-menu"
import { MENU_LINK_KINDS, StorefrontMenuItem } from "./models/storefront-menu-item"

export { MENU_LINK_KINDS, MENU_LOCATIONS }
export type MenuLocation = (typeof MENU_LOCATIONS)[number]
export type MenuLinkKind = (typeof MENU_LINK_KINDS)[number]

/** A link as stored: its target or its address, and its own wording. */
export interface StoredMenuLink {
  kind: MenuLinkKind
  target: string | null
  url: string | null
  label: string | null
}

/** A menu to write whole: its links in order, each with its children beside it. */
export interface NewMenu {
  title: string
  location: MenuLocation
  rank: number
  items: { link: StoredMenuLink; children: StoredMenuLink[] }[]
}

/** A menu as it was, ids kept: put back as it stood. */
export interface MenuRecord {
  menu: { id: string; title: string; location: MenuLocation; rank: number }
  items: (StoredMenuLink & {
    id: string
    menu_id: string
    parent_id: string | null
    rank: number
  })[]
}

/** The storefront's menus (adr/0049): menus and their links. */
class StorefrontMenusModuleService extends MedusaService({ StorefrontMenu, StorefrontMenuItem }) {
  /**
   * Every menu of the shop replaced by these (adr/0063 §3), in one
   * transaction: a write failing part-way leaves the menus as they were.
   */
  @InjectTransactionManager()
  async replaceAllMenus(
    menus: readonly NewMenu[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.removeAll(sharedContext)
    for (const menu of menus) {
      const made = await this.createStorefrontMenus(
        { title: menu.title, location: menu.location, rank: menu.rank },
        sharedContext
      )
      const parents = await this.createStorefrontMenuItems(
        menu.items.map((each, rank) => ({ menu_id: made.id, rank, ...each.link })),
        sharedContext
      )
      const children = menu.items.flatMap((each, index) =>
        each.children.map((child, rank) => ({
          menu_id: made.id,
          parent_id: parents[index]?.id ?? null,
          rank,
          ...child,
        }))
      )
      if (children.length > 0) {
        await this.createStorefrontMenuItems(children, sharedContext)
      }
    }
  }

  /** The menus back as they were, ids and all, in one transaction (a replacement undone). */
  @InjectTransactionManager()
  async restoreAllMenus(
    records: readonly MenuRecord[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.removeAll(sharedContext)
    for (const record of records) {
      await this.createStorefrontMenus(record.menu, sharedContext)
      // Children after their parents: a restored child points at a restored parent
      const items = [...record.items].sort(
        (a, b) => Number(a.parent_id !== null) - Number(b.parent_id !== null)
      )
      if (items.length > 0) {
        await this.createStorefrontMenuItems(items, sharedContext)
      }
    }
  }

  // Each menu's links go with it (the model's cascade)
  private async removeAll(sharedContext: Context): Promise<void> {
    const current = await this.listStorefrontMenus({}, { select: ["id"] }, sharedContext)
    if (current.length > 0) {
      await this.deleteStorefrontMenus(
        current.map((row) => row.id),
        sharedContext
      )
    }
  }
}

export default StorefrontMenusModuleService
