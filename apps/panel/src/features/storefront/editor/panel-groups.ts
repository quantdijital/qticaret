import type { FieldGroupName } from "./forms/field-registry"

/**
 * Where a section's settings stand in its panel (adr/0065 Ek: the owner's
 * "content, style, advanced" as Elementor splits a widget): three tabs,
 * each a few groups closed down to their titles. This file is the one
 * list: a panel group's name (`PanelGroup name`) names its tab and its
 * title here, and a field's place is its group's (`field-registry.ts`
 * gives each field one; the element itself sits inside that group, which
 * a test holds). A new group is one line here; a group not listed (a
 * form's own, added before its line) still shows, in "İçerik" under its
 * own title, so nothing is lost while the line is missing.
 */

export type SettingsTab = "content" | "style" | "advanced"

/** The tabs in their order: "İçerik", "Stil", "Gelişmiş". */
export const SETTINGS_TABS: readonly SettingsTab[] = ["content", "style", "advanced"]

const P = "storefront.editor.panel"

export interface GroupPlace {
  tab: SettingsTab
  /** Its title's i18n key, as its header and a search hit's second line show it. */
  title: string
}

/**
 * Every section panel group, in the order it stands in its tab:
 * - İçerik: what the section says and shows (words, pictures, links, its
 *   items, which products or categories and how many); a long one split
 *   by its parts (the opening's buttons, the cards, how the questions
 *   open), `content` first; the catalog header's by the part of the bar
 *   they fill.
 * - Stil: how it is drawn, the variant first and open, then how it stands,
 *   scrolls and moves, its words' and ground's look.
 * - Gelişmiş: the space around it, when and where it shows, and the
 *   rarely changed fine settings.
 */
export const PANEL_GROUPS: Readonly<Record<FieldGroupName, GroupPlace>> = {
  content: { tab: "content", title: `${P}.content` },
  buttons: { tab: "content", title: `${P}.groups.buttons` },
  categoryList: { tab: "content", title: `${P}.groups.categoryList` },
  tiles: { tab: "content", title: `${P}.groups.tiles` },
  chips: { tab: "content", title: `${P}.groups.chips` },
  picks: { tab: "content", title: `${P}.groups.picks` },
  cards: { tab: "content", title: `${P}.groups.cards` },
  thumbs: { tab: "content", title: `${P}.groups.thumbs` },
  opening: { tab: "content", title: `${P}.groups.opening` },
  options: { tab: "content", title: `${P}.groups.options` },
  backToTop: { tab: "content", title: `${P}.groups.backToTop` },
  search: { tab: "content", title: `${P}.groups.search` },
  topBar: { tab: "content", title: `${P}.groups.topBar` },
  menu: { tab: "content", title: `${P}.groups.menu` },
  icons: { tab: "content", title: `${P}.groups.icons` },
  variant: { tab: "style", title: `${P}.variant` },
  placement: { tab: "style", title: `${P}.placement` },
  layout: { tab: "style", title: `${P}.layout` },
  scroll: { tab: "style", title: `${P}.scroll` },
  motion: { tab: "style", title: `${P}.motion` },
  appearance: { tab: "style", title: `${P}.appearance` },
  frame: { tab: "style", title: `${P}.groups.frame` },
  spacing: { tab: "advanced", title: "storefront.editor.look.spacing.title" },
  visibility: { tab: "advanced", title: `${P}.visibility` },
  look: { tab: "advanced", title: "storefront.editor.look.title" },
}

/**
 * The groups that stand open at first (docs/18 §7.1): each tab's first,
 * the one a shop comes for. "İçerik" opens at the section's main content
 * (`content`, the header's search), "Stil" at the variant; the rest stand
 * closed down to their titles until opened, and a group alone in its tab
 * is always open. A shop's own opening or closing is remembered over this.
 */
export const OPEN_AT_FIRST: ReadonlySet<string> = new Set<string>(["content", "search", "variant"])

/** A group's tab; a group not listed sits in "İçerik". */
export const tabOfGroup = (name: string): SettingsTab =>
  Object.hasOwn(PANEL_GROUPS, name) ? PANEL_GROUPS[name as FieldGroupName].tab : "content"

/** A tab's title and its technical term (i18n keys): "İçerik" content. */
export const tabTitle = (tab: SettingsTab) => ({
  label: `${P}.tabs.${tab}`,
  term: `${P}.tabs.${tab}Term`,
})

/** A tab's element id in its panel (`base`: the panel's own). */
export const tabId = (base: string, tab: SettingsTab) => `${base}-tab-${tab}`
