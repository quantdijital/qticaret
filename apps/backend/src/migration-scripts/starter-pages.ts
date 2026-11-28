import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { sectorPack } from "@qticaret/sector-packs"
import { logger } from "../lib/logging"
import { planStarterPages } from "../lib/storefront/starter-pages"
import type { StarterFacts, StarterPage } from "../lib/storefront/starter-pages"
import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"
import { openDraftPage } from "../workflows/content/draft-page"
import { convertFaqTexts } from "../workflows/storefront/faq-convert"
import { storefrontRolePages } from "../workflows/storefront/page-roles"
import { GENERAL_PACK } from "../workflows/storefront/preset-steps"

export interface StarterPagesPorts {
  /** The starter pages: the general pack's. */
  starters: () => StarterPage[]
  facts: (handles: readonly string[]) => Promise<StarterFacts>
  /** Opens one as a draft with its text; null when another record holds its address. */
  open: (page: StarterPage) => Promise<string | null>
}

export interface StarterPagesTally {
  opened: number
  kept: number
  role_held: number
  taken: number
}

/**
 * The starter pages a shop has not got, opened as drafts (adr/0073 Ek
 * 2026-11-28): one at an address the shop has is kept, a role's starter
 * whose role another page holds is left, one whose address another
 * record holds is skipped. Idempotent: a second run finds them all.
 */
export async function openStarterPages(ports: StarterPagesPorts): Promise<StarterPagesTally> {
  const starters = ports.starters()
  const plan = planStarterPages(starters, await ports.facts(starters.map((page) => page.handle)))
  let opened = 0
  let taken = 0
  for (const page of plan.open) {
    if ((await ports.open(page)) === null) {
      taken += 1
    } else {
      opened += 1
    }
  }
  return { opened, kept: plan.kept.length, role_held: plan.role_held.length, taken }
}

export function starterPagesPorts(container: MedusaContainer): StarterPagesPorts {
  return {
    starters: () => sectorPack(GENERAL_PACK)?.pages ?? [],
    facts: async (handles) => {
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      const [entries, storefront] = await Promise.all([
        container
          .resolve<ContentModuleService>(CONTENT_MODULE)
          .listContentEntries(
            { kind: "page", handle: [...handles] },
            { select: ["handle"], take: null }
          ),
        settings.getSection("storefront") as Promise<unknown> as Promise<Record<string, unknown>>,
      ])
      const roles = await storefrontRolePages(container, storefront)
      return {
        pages: new Set(entries.map((entry) => entry.handle)),
        roles: {
          contact: roles.contact?.handle ?? null,
          payment: roles.payment?.handle ?? null,
          shipping: roles.shipping?.handle ?? null,
        },
      }
    },
    open: (page) => openDraftPage(container, { title: page.title, handle: page.handle }, page.body),
  }
}

/**
 * Runs once per shop, on the `db:migrate` that brings the starter pages
 * (adr/0073 Ek 2026-11-28): the shops from before them get the ones they
 * lack as drafts, to read, adjust and publish. Logged with counts only.
 */
export default async function starterPages({ container }: ExecArgs) {
  const tally = await openStarterPages(starterPagesPorts(container))
  logger.info({ event: "content.starter_pages_opened", ...tally })
  if (tally.opened > 0) {
    // The questions page's text as its FAQ section (adr/0073 Ek 2026-11-24 (2) §8)
    await convertFaqTexts(container)
  }
}
