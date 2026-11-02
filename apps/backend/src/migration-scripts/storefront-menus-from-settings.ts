import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { menuInput, storefrontLink } from "../lib/storefront/menus"
import type { MenuInput, MenuLinkInput } from "../lib/storefront/menus"
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

interface Planned {
  /** The menu with its addresses turned into records where they are ones. */
  typed: MenuInput
  /** The same menu with every link kept as the address it was: the fallback. */
  plain: MenuInput
}

/** A link that fits today's rules, else none (counted, never logged: an address may name someone). */
const fitting = (link: MenuLinkInput): MenuLinkInput | null => {
  const parsed = storefrontLink.safeParse(link)
  return parsed.success ? parsed.data : null
}

async function planned(
  container: Container,
  head: { title: string; location: MenuInput["location"]; rank: number },
  items: (TypedLink & { children?: TypedLink[] })[]
): Promise<{ plan: Planned; dropped: number }> {
  let dropped = 0
  const keep = (link: MenuLinkInput | null) => {
    if (!link) {
      dropped += 1
    }
    return link
  }
  const typed: MenuInput["items"] = []
  const plain: MenuInput["items"] = []
  for (const item of items) {
    const link = keep(fitting(await linkFromHref(container, item)))
    const raw = fitting({ kind: "url", url: item.href, label: item.label })
    const children = await Promise.all(
      (item.children ?? []).map(async (child) => ({
        typed: keep(fitting(await linkFromHref(container, child))),
        plain: fitting({ kind: "url", url: child.href, label: child.label }),
      }))
    )
    if (link) {
      typed.push({ link, children: children.flatMap((each) => (each.typed ? [each.typed] : [])) })
    }
    if (raw) {
      plain.push({
        link: raw,
        children: children.flatMap((each) => (each.plain ? [each.plain] : [])),
      })
    }
  }
  const menu = (links: MenuInput["items"]) =>
    menuInput.parse({ ...head, items: links.slice(0, 30) })
  return { plan: { typed: menu(typed), plain: menu(plain) }, dropped }
}

/**
 * The menus the frame's typed links become (adr/0049): the header menu,
 * the top links, a footer column per group; each address as a record
 * where it is one. Titles are the shop's own once it renames them. A link
 * that no longer fits is left out and counted.
 */
export async function menusFromFrame(container: Container, frame: FrameLinks) {
  const plans: Planned[] = []
  let dropped = 0
  const add = async (
    head: { title: string; location: MenuInput["location"]; rank: number },
    items: (TypedLink & { children?: TypedLink[] })[]
  ) => {
    if (items.length === 0) {
      return
    }
    const made = await planned(container, head, items)
    plans.push(made.plan)
    dropped += made.dropped
  }
  await add({ title: "Ana menü", location: "main", rank: 0 }, frame.menu ?? [])
  await add({ title: "Üst bağlantılar", location: "top", rank: 0 }, frame.top_links ?? [])
  for (const [rank, group] of (frame.footer_groups ?? []).slice(0, 10).entries()) {
    await add({ title: group.title.slice(0, 60), location: "footer", rank }, group.links)
  }
  return { plans, dropped }
}

/**
 * Runs once per shop, on the `db:migrate` that brings menus (adr/0049):
 * the storefront section's typed links become menus, place by place (a
 * place that has a menu already is left alone, so a run that stopped
 * carries on). A menu whose records will not save is kept with its links
 * as the addresses they were: nothing the shop wrote is lost. Returns how
 * many menus it made.
 */
export async function moveFrameLinks(container: MedusaContainer): Promise<number> {
  const service = container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)
  const [row] = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .listSettingsSections({ section: "storefront" }, { take: 1 })
  const frame = ((row as { values?: unknown } | undefined)?.values ?? {}) as FrameLinks
  const { plans, dropped } = await menusFromFrame(container, frame)
  const existing = await service.listStorefrontMenus({}, { select: ["location", "title"] })
  let made = 0
  for (const { typed, plain } of plans) {
    const taken = existing.some((menu) =>
      typed.location === "footer"
        ? menu.location === "footer" && menu.title === typed.title
        : menu.location === typed.location
    )
    if (taken) {
      continue
    }
    try {
      await saveStorefrontMenuWorkflow(container).run({ input: typed })
    } catch {
      await saveStorefrontMenuWorkflow(container).run({ input: plain })
    }
    made += 1
  }
  if (dropped > 0) {
    logger.warn({ event: "storefront.menus_links_dropped", dropped })
  }
  return made
}

export default async function storefrontMenusFromSettings({ container }: ExecArgs) {
  const made = await moveFrameLinks(container)
  logger.info({ event: "storefront.menus_moved", made })
}
