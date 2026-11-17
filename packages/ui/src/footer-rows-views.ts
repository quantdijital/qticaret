import type {
  FooterImageWidth,
  FooterNewsletterVariant,
  FooterRowLayout,
  FooterRowStep,
  FooterRowsStep,
  FooterTrustLayout,
} from "@qticaret/types"
import type { ShopMarkView } from "./card-views"
import type { ImageView, LinkView, OpeningHoursView, SocialLinkView, TrustBadgeView } from "./views"

/**
 * The free rows footer as a theme draws it (adr/0070 §5): rows of a
 * ready-made split, each column a short stack of blocks, the shop's own
 * details already put in them (its menus by their order, its ways to
 * reach it, its profiles, the design's promises). A block the storefront
 * has nothing to draw with (a menu not there, a contact with nothing
 * filled in) is left out; its column keeps its place. Every step read
 * forgivingly: one off its list is the default.
 */
export interface FooterRowsView {
  ground: FooterRowsStep<"ground">
  /** The ways to pay on white cards or straight on the ground (on the stage always cards). */
  badgeStyle: FooterRowsStep<"badge_style">
  /** The ways to pay in the fixed bottom line. */
  bottomBadges: boolean
}

export interface FooterRowView {
  id: string
  layout: FooterRowLayout
  ground: FooterRowStep<"ground">
  space: FooterRowStep<"space">
  align: FooterRowStep<"align">
  /** Columns side by side on a phone. */
  phoneColumns: FooterRowStep<"phone_columns">
  /** A thin line above the row. */
  divider: boolean
  /** As many as the split has parts; an empty one keeps its place. */
  columns: { blocks: FooterBlockView[] }[]
}

interface FooterBlockViewBase {
  id: string
  /** Its place in the design (0–23, the editor bridge's `blocks.<at>`). */
  at: number
  device: "all" | "mobile" | "desktop"
}

/** A block, its words and links resolved. */
export type FooterBlockView = FooterBlockViewBase &
  (
    | { type: "text"; title: string | null; /** The backend's HTML (adr/0019). */ html: string }
    | {
        type: "menu"
        /** The block's title, else the menu's. */
        title: string
        links: LinkView[]
        /** A closed row on a phone and a tablet; open from 1024 px either way. */
        collapsePhone: boolean
      }
    | {
        type: "brand"
        /** The store profile's logo; null: the shop's name (or the block asked for none). */
        logo: ImageView | null
        name: string
        about: string | null
        /** The shop's profiles; empty: none (or the block shows none). */
        social: SocialLinkView[]
        /** The shop's address under its line; null: none (or the block shows none). */
        address: string | null
      }
    | {
        type: "newsletter"
        title: string
        /** The consent sentence (İYS), as the shop wrote it or the storefront's. */
        consent: string
        description: string | null
        variant: FooterNewsletterVariant
      }
    | {
        type: "contact"
        title: string | null
        address: string | null
        phone: string | null
        phoneHref: string | null
        whatsappHref: string | null
        email: string | null
        hours: OpeningHoursView[]
      }
    | { type: "social"; title: string | null; profiles: SocialLinkView[] }
    | { type: "payments"; title: string | null; payments: ShopMarkView[]; carriers: ShopMarkView[] }
    | { type: "image"; image: ImageView; width: FooterImageWidth; link: LinkView | null }
    | { type: "app_badges"; appStore: string | null; googlePlay: string | null }
    | { type: "trust"; badges: TrustBadgeView[]; layout: FooterTrustLayout }
  )
