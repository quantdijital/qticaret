import type { MedusaContainer } from "@medusajs/framework/types"
import { menuInput } from "../../lib/storefront/menus"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { STOREFRONT_MENUS_MODULE } from "../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../modules/storefront-menus/service"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"
import type { SaveMenuInput } from "../../workflows/storefront/menus"
import { saveStorefrontMenuWorkflow } from "../../workflows/storefront/menus"
import { DEMO_STOREFRONT, DEMO_TOP_LINKS } from "./data"

/**
 * Fills the storefront's frame once; a frame the shop (or an earlier seed)
 * already saved is left as it is. Then the top links (`ensureDemoTopLinks`),
 * on every run: a demo seeded before them gets them too.
 */
export async function ensureDemoStorefront(container: MedusaContainer): Promise<void> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const { version } = await settings.readSection("storefront")
  if (version === 0) {
    await updatePlatformSettingsWorkflow(container).run({
      input: { section: "storefront", values: DEMO_STOREFRONT, actor_id: null },
    })
  }
  await ensureDemoTopLinks(container)
}

/** The shop's top-links menu as the seed finds it; null: it has none. */
export interface FoundTopMenu {
  id: string
  title: string
  links: number
}

/**
 * What the seed writes to the top links: the demo's links when the shop has
 * no such menu, or has one with nothing in it (kept, its title too); a menu
 * with links of its own is the shop's and is left alone, so a rerun neither
 * doubles nor undoes anything.
 */
export function demoTopLinksPlan(found: FoundTopMenu | null): SaveMenuInput | null {
  if (found && found.links > 0) {
    return null
  }
  const input = menuInput.parse({
    title: found?.title ?? DEMO_TOP_LINKS.title,
    location: "top",
    rank: 0,
    items: DEMO_TOP_LINKS.links.map((link) => ({ link, children: [] })),
  })
  return found ? { ...input, id: found.id } : input
}

/** Gives the demo its top links (`demoTopLinksPlan`); safe to run again. */
async function ensureDemoTopLinks(container: MedusaContainer): Promise<void> {
  const service = container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)
  const [menu] = await service.listStorefrontMenus(
    { location: "top" },
    { select: ["id", "title"], take: 1 }
  )
  const items = menu
    ? await service.listStorefrontMenuItems({ menu_id: menu.id }, { select: ["id"], take: 1 })
    : []
  const plan = demoTopLinksPlan(
    menu ? { id: menu.id, title: menu.title, links: items.length } : null
  )
  if (plan) {
    await saveStorefrontMenuWorkflow(container).run({ input: plan })
  }
}
