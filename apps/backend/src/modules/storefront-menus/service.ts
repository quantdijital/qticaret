import { MedusaService } from "@medusajs/framework/utils"
import { MENU_LOCATIONS, StorefrontMenu } from "./models/storefront-menu"
import { MENU_LINK_KINDS, StorefrontMenuItem } from "./models/storefront-menu-item"

export { MENU_LINK_KINDS, MENU_LOCATIONS }
export type MenuLocation = (typeof MENU_LOCATIONS)[number]
export type MenuLinkKind = (typeof MENU_LINK_KINDS)[number]

/** The storefront's menus (adr/0049): menus and their links. */
class StorefrontMenusModuleService extends MedusaService({ StorefrontMenu, StorefrontMenuItem }) {}

export default StorefrontMenusModuleService
