import type { MedusaContainer } from "@medusajs/framework/types"
import { layoutDocument } from "../../lib/storefront/layout"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { UNSET_SETTINGS, withLegacy } from "../../lib/storefront/layout-settings"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StorefrontSettings, ThemeSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { linkFromHref } from "./menu-hrefs"

type Container = Pick<MedusaContainer, "resolve">

const NOT_SCHEDULED = { visible: true, starts_at: null, ends_at: null }

/**
 * The design a shop starts from, before it publishes its own (adr/0049):
 * the storefront as it was built, its announcement lines and home page
 * opening from the storefront settings, its trust badges, colour names and
 * "Az kaldı" line from their old fields there (adr/0049 Ek 2026-11-06);
 * no theme and no menu set of its own (adr/0063 §3).
 * The one source of the default:
 * the storefront shows it, the theme editor opens it as the first draft.
 */
export async function defaultLayout(container: Container): Promise<LayoutDocument> {
  const sections = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [settings, theme] = (await Promise.all([
    sections.getSection("storefront"),
    sections.getSection("theme"),
  ])) as unknown as [StorefrontSettings, ThemeSettings]
  const { hero, announcements } = settings
  const links = hero
    ? await Promise.all(hero.links.map((link) => linkFromHref(container, link)))
    : []
  return layoutDocument.parse({
    // The top strip always (owner 2026-11-27): without lines it carries the top links and the
    // phone, as the header drew them above itself before the strip was its own
    header: [{ id: "duyurular", type: "announcement_bar", ...NOT_SCHEDULED, lines: announcements }],
    home: [
      {
        id: "girisbolumu",
        type: "hero",
        ...NOT_SCHEDULED,
        eyebrow: hero?.eyebrow ?? null,
        heading: hero?.heading ?? null,
        text: hero?.text ?? null,
        links,
        image: null,
      },
      { id: "kategoriler", type: "categories", ...NOT_SCHEDULED, title: null, category_ids: [] },
      {
        id: "yeniurunler",
        type: "products",
        ...NOT_SCHEDULED,
        title: null,
        source: { kind: "newest" },
        limit: 12,
        more: { kind: "system", target: "shop", label: null },
      },
      { id: "yardimkutusu", type: "help", ...NOT_SCHEDULED, title: null, text: null },
      { id: "blogyazilari", type: "posts", ...NOT_SCHEDULED, title: null, limit: 3 },
    ],
    footer: [
      { id: "ebultenkutusu", type: "newsletter", ...NOT_SCHEDULED, title: null, text: null },
    ],
    // The product and category pages show only their own blocks until the shop adds sections
    product: [],
    category: [],
    // The theme stays unset: the theme section stands in for it as it always has
    // (adr/0063 §3), the editor opening it filled (`withLegacySettings`)
    settings: { ...withLegacy({ ...UNSET_SETTINGS }, { ...settings, theme }), theme: null },
  })
}
