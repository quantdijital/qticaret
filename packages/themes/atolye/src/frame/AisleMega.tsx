import { ArrowRight } from "lucide-react"
import { NavigationMenu } from "radix-ui"
import type { ReactNode } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView, NavChildView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { MenuWords } from "./menu-words"
import { MenuCount } from "./MenuParts"

/** A column lists this many of its child's own links; the rest are a "Tümünü gör" away. */
export const MEGA_LINKS = 6

/** A picture box: the shop's picture, else the media ground alone (no broken image). */
function Picture({ entry, sizes }: { entry: NavChildView; sizes: string }) {
  return (
    <span className="gf-mega-picture">
      {entry.image && (
        <ResponsiveImage
          image={{ ...entry.image, alt: "" }}
          sizes={sizes}
          className="gf-mega-img"
        />
      )}
    </span>
  )
}

/** The card's picture made of its children's: two to four tiles, drawing only. */
function Mosaic({ entries }: { entries: readonly NavChildView[] }) {
  return (
    <span className="gf-mega-picture gf-mega-mosaic" data-count={entries.length}>
      {entries.map((entry) =>
        entry.image ? (
          <ResponsiveImage
            key={entry.path}
            image={{ ...entry.image, alt: "" }}
            sizes="160px"
            className="gf-mega-img"
          />
        ) : null
      )}
    </span>
  )
}

/** A link of the panel: Radix's, so the arrow keys and Escape reach it and a press closes the menu. */
function PanelLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: ReactNode
}) {
  return (
    <NavigationMenu.Link asChild>
      <a href={href} className={className}>
        {children}
      </a>
    </NavigationMenu.Link>
  )
}

/** One child as a column: its picture, its name and count, its own links under it. */
function Column({
  child,
  words,
  pictures,
}: {
  child: NavChildView
  words: MenuWords
  pictures: boolean
}) {
  const links = child.links ?? []
  const shown = links.slice(0, MEGA_LINKS)
  return (
    <li className="gf-mega-column">
      <PanelLink href={child.path} className="gf-mega-head">
        {pictures && <Picture entry={child} sizes="(min-width: 1280px) 220px, 180px" />}
        <span className="gf-mega-title">
          <span className="gf-menu-word">{child.label}</span>
          <MenuCount count={words.counts[child.path]} />
        </span>
      </PanelLink>
      {shown.length > 0 && (
        <ul className="gf-mega-links">
          {shown.map((link) => (
            <li key={link.path}>
              <PanelLink href={link.path} className="gf-mega-link">
                {link.label}
              </PanelLink>
            </li>
          ))}
          {links.length > shown.length && (
            <li>
              <PanelLink href={child.path} className="gf-mega-link gf-mega-more">
                <span aria-hidden="true">{words.seeAll}</span>
                <span className="sr-only">{words.allIn[child.path] ?? child.label}</span>
              </PanelLink>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

/**
 * A menu item's wide panel (`submenuStyle: mega`, adr/0049 Ek 2026-11-26),
 * as the tour shops draw theirs: each child a column (its picture, its
 * name and count, then its own links: a menu link's children or a
 * category's subcategories, `MEGA_LINKS` of them), and beside them the
 * item itself as a card with its picture and "Tümünü gör". With no
 * pictures (`menuImages: off`) the columns are words only and the card is
 * a plain "Tümünü gör" link. Every link is Radix's own, so the keyboard
 * moves through the panel as through the dropdown list.
 */
export function Mega({
  category,
  words,
  pictures = true,
}: {
  category: NavCategoryView
  words: MenuWords
  pictures?: boolean
}) {
  // An item with no picture of its own (a link to the whole catalogue): its
  // children's pictures side by side, the kinds of tours at a glance
  const mosaic = category.children.filter((child) => child.image).slice(0, 4)
  return (
    <div className={cn("gf-mega-grid", !pictures && "gf-mega-grid--words")}>
      <ul className="gf-mega-columns">
        {category.children.map((child) => (
          <Column key={child.path} child={child} words={words} pictures={pictures} />
        ))}
      </ul>
      <PanelLink href={category.path} className="gf-mega-feature">
        {pictures &&
          (category.image || mosaic.length < 2 ? (
            <Picture entry={category} sizes="320px" />
          ) : (
            <Mosaic entries={mosaic} />
          ))}
        <span className="gf-mega-feature-text">
          <span className="gf-mega-feature-name">{category.label}</span>
          <span className="gf-mega-feature-all">
            {/* Heard in full ("Tümünü gör: Yurt içi turlar"), its visible words first (WCAG 2.5.3) */}
            <span aria-hidden="true">{words.seeAll}</span>
            <span className="sr-only">{words.allIn[category.path] ?? category.label}</span>
            <MenuCount count={words.counts[category.path]} dark />
            <ArrowRight className="size-4" aria-hidden="true" strokeWidth={2} />
          </span>
        </span>
      </PanelLink>
    </div>
  )
}
