import { NavigationMenu } from "radix-ui"
import type { Ref } from "react"
import type { LinkView, NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Word } from "./AisleDrop"

/** A row of the "Daha fazla" panel: its hovered fill is the recipe's (`.gf-menu-row`). */
const MORE_ROW =
  "gf-menu-row -mx-3 flex min-h-10 items-center rounded-inner px-3 py-2 text-sm leading-snug no-underline pointer-coarse:min-h-11"

/**
 * "Daha fazla"'s panel: the floating surfaces' one recipe, the page's ink;
 * a list taller than the screen allows scrolls inside (`.gf-menu-scroll`,
 * `menu.css`). Drawn only once the bar is measured, never in the first HTML.
 * It hangs as far under the bar as the other dropdowns (`.gf-hang`).
 */
export const MORE_PANEL =
  "gf-menu-scroll gf-hang absolute right-0 z-(--z-dropdown) w-max rounded-tile border border-rule bg-field p-6 text-text shadow-float-edged data-[state=closed]:hidden xl:p-8"

/**
 * The categories that did not fit on the bar's line, each with its
 * children under it: a column each, two at most below 1280 px and three
 * from it, the panel as wide as they are (Tezgâh audit Y-06). The shop's
 * top links, when they did not fit at the bar's end either (`top_links:
 * bar`), stand in one more column, plain.
 */
export function MorePanel({
  categories,
  links = [],
}: {
  categories: readonly NavCategoryView[]
  links?: readonly LinkView[]
}) {
  const cells = categories.length + (links.length > 0 ? 1 : 0)
  const columns =
    cells === 1 ? "grid-cols-1" : cells === 2 ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3"
  return (
    <ul className={cn("grid w-max gap-x-(--gap-columns) gap-y-4", columns)}>
      {categories.map((category) => (
        <li key={category.path} className="w-52">
          <NavigationMenu.Link asChild>
            <a href={category.path} className={cn(MORE_ROW, "font-bold text-text")}>
              <span className="gf-menu-word">{category.label}</span>
            </a>
          </NavigationMenu.Link>
          {category.children.length > 0 && (
            <ul>
              {category.children.map((child) => (
                <li key={child.path}>
                  <NavigationMenu.Link asChild>
                    <a href={child.path} className={cn(MORE_ROW, "text-text-2 hover:text-text")}>
                      <span className="gf-menu-word">{child.label}</span>
                    </a>
                  </NavigationMenu.Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {links.length > 0 && (
        <li className="w-52">
          <ul>
            {links.map((link) => (
              <li key={link.path}>
                <NavigationMenu.Link asChild>
                  <a href={link.path} className={cn(MORE_ROW, "text-text-2 hover:text-text")}>
                    <span className="gf-menu-word">{link.label}</span>
                  </a>
                </NavigationMenu.Link>
              </li>
            ))}
          </ul>
        </li>
      )}
    </ul>
  )
}

/**
 * The shop's top links at the menu bar's end (`top_links: bar`, adr/0049
 * Ek 2026-11-15): quiet words on the bar's ground, lighter than the
 * categories; pointed at, the menus' one look (`menu_style`). `hidden`
 * while they wait under "Daha fazla" (`aisle-fit.ts` measures the group).
 */
export function BarLinks({
  ref,
  links,
  label,
  hidden = false,
  className,
}: {
  ref?: Ref<HTMLElement>
  links: readonly LinkView[]
  label: string
  hidden?: boolean
  className?: string
}) {
  return (
    <nav
      ref={ref}
      aria-label={label}
      data-bar-links=""
      hidden={hidden}
      // No display of its own while hidden, so `hidden` always holds
      className={cn("shrink-0 items-center", !hidden && "flex", className)}
    >
      {links.map((link) => (
        <a
          key={link.path}
          href={link.path}
          className="gf-menu-item gf-menu-item--bar inline-flex min-h-11 items-center rounded-button px-2 text-sm whitespace-nowrap no-underline transition-colors duration-(--dur-micro) xl:px-3"
        >
          <Word text={link.label} />
        </a>
      ))}
    </nav>
  )
}
