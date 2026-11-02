import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { menuInput } from "../lib/storefront/menus"
import type { MenuInput } from "../lib/storefront/menus"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"
import { STOREFRONT_MENUS_MODULE } from "../modules/storefront-menus"
import type StorefrontMenusModuleService from "../modules/storefront-menus/service"
import { linkFromHref } from "../workflows/storefront/menu-hrefs"
import { saveStorefrontMenuWorkflow } from "../workflows/storefront/menus"

type Container = Pick<MedusaContainer, "resolve">

interface TypedLink {
  label: string
  href: string
}

/** What the storefront section held before menus (adr/0049), as stored. */
export interface FrameLinks {
  menu?: (TypedLink & { children?: TypedLink[] })[]
  top_links?: TypedLink[]
  footer_groups?: { title: string; links: TypedLink[] }[]
}

/**
 * The menus the frame's typed links become (adr/0049): the header menu,
 * the top links, a footer column per group; each address as a record
 * where it is one. Titles are the shop's own once it renames them.
 */
export async function menusFromFrame(container: Container, frame: FrameLinks) {
  const linkOf = (link: TypedLink) => linkFromHref(container, link)
  const menus: MenuInput[] = []
  if (frame.menu?.length) {
    menus.push(
      menuInput.parse({
        title: "Ana menü",
        location: "main",
        items: await Promise.all(
          frame.menu.map(async (item) => ({
            link: await linkOf(item),
            children: await Promise.all((item.children ?? []).map(linkOf)),
          }))
        ),
      })
    )
  }
  if (frame.top_links?.length) {
    menus.push(
      menuInput.parse({
        title: "Üst bağlantılar",
        location: "top",
        items: await Promise.all(
          frame.top_links.map(async (link) => ({ link: await linkOf(link) }))
        ),
      })
    )
  }
  for (const [rank, group] of (frame.footer_groups ?? []).entries()) {
    menus.push(
      menuInput.parse({
        title: group.title,
        location: "footer",
        rank,
        items: await Promise.all(group.links.map(async (link) => ({ link: await linkOf(link) }))),
      })
    )
  }
  return menus
}

/**
 * Runs once per shop, on the `db:migrate` that brings menus (adr/0049): a
 * shop with no menus yet gets them from its storefront section's typed
 * links, which the section no longer keeps. Returns how many it made.
 */
export async function moveFrameLinks(container: MedusaContainer): Promise<number> {
  const service = container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)
  if ((await service.listStorefrontMenus({}, { select: ["id"], take: 1 })).length > 0) {
    return 0
  }
  const [row] = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .listSettingsSections({ section: "storefront" }, { take: 1 })
  const frame = ((row as { values?: unknown } | undefined)?.values ?? {}) as FrameLinks
  const menus = await menusFromFrame(container, frame)
  for (const menu of menus) {
    await saveStorefrontMenuWorkflow(container).run({ input: menu })
  }
  return menus.length
}

export default async function storefrontMenusFromSettings({ container }: ExecArgs) {
  const made = await moveFrameLinks(container)
  logger.info({ event: "storefront.menus_moved", made })
}
